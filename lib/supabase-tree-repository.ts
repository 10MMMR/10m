import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ensureTreeRoot,
  sortTreeNodes,
  type TreeNode,
} from "@/lib/tree-repository";

type TreeNodeRow = {
  user_id?: string;
  class_id: string;
  created_at: string;
  file_mime_type: string | null;
  file_size: number | null;
  file_storage_path: string | null;
  id: string;
  kind: TreeNode["kind"];
  note_id: string | null;
  order_index: number;
  parent_id: string | null;
  title: string | null;
  updated_at: string;
};

type EditorNoteRow = {
  user_id?: string;
  body: string;
  created_at: string;
  id: string;
  title: string;
  updated_at: string;
};

function toTreeNode(
  row: TreeNodeRow,
  noteMap: Map<string, EditorNoteRow>,
): TreeNode {
  const note = row.note_id ? noteMap.get(row.note_id) : undefined;

  return {
    id: row.id,
    classId: row.class_id,
    parentId: row.parent_id,
    kind: row.kind,
    noteId: row.note_id ?? undefined,
    title: note?.title ?? row.title ?? "Untitled note",
    order: row.order_index,
    createdAt: row.created_at,
    updatedAt: note?.updated_at ?? row.updated_at,
    fileStoragePath: row.file_storage_path ?? undefined,
    fileMimeType: row.file_mime_type ?? undefined,
    fileSize: row.file_size ?? undefined,
    body: note?.body,
  };
}

function toTreeNodeRow(node: TreeNode) {
  return {
    class_id: node.classId,
    created_at: node.createdAt,
    file_mime_type: node.fileMimeType ?? null,
    file_size: node.fileSize ?? null,
    file_storage_path: node.fileStoragePath ?? null,
    id: node.id,
    kind: node.kind,
    note_id: node.kind === "note" ? node.noteId ?? node.id : null,
    order_index: node.order,
    parent_id: node.parentId,
    title: node.kind === "note" ? null : node.title,
    updated_at: node.updatedAt,
  };
}

function toEditorNoteRow(node: TreeNode): EditorNoteRow {
  return {
    body: node.body ?? "<p></p>",
    created_at: node.createdAt,
    id: node.noteId ?? node.id,
    title: node.title,
    updated_at: node.updatedAt,
  };
}

export class SupabaseTreeRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly userId?: string,
  ) {}

  async listTreeByClass(classId: string) {
    let query = this.client
      .from("editor_tree_nodes")
      .select(
        "class_id, created_at, file_mime_type, file_size, file_storage_path, id, kind, note_id, order_index, parent_id, title, updated_at",
      )
      .eq("class_id", classId);

    if (this.userId) {
      query = query.eq("user_id", this.userId);
    }

    const { data, error } = await query.order("order_index", { ascending: true });

    if (error) {
      throw error;
    }

    const treeRows = (data ?? []) as TreeNodeRow[];
    const noteIds = treeRows
      .flatMap((row) => (row.note_id ? [row.note_id] : []));
    const noteMap = new Map<string, EditorNoteRow>();

    if (noteIds.length > 0) {
      let noteQuery = this.client
        .from("editor_notes")
        .select("body, created_at, id, title, updated_at")
        .in("id", noteIds);

      if (this.userId) {
        noteQuery = noteQuery.eq("user_id", this.userId);
      }

      const { data: noteData, error: noteError } = await noteQuery;

      if (noteError) {
        throw noteError;
      }

      (noteData ?? []).forEach((row) => {
        const note = row as EditorNoteRow;
        noteMap.set(note.id, note);
      });
    }

    if (treeRows.length === 0) {
      throw new Error(`Class "${classId}" does not exist.`);
    }

    const rootId = `root:${classId}`;

    if (!treeRows.some((row) => row.id === rootId)) {
      throw new Error(`Class "${classId}" is missing its root node.`);
    }

    return sortTreeNodes(
      ensureTreeRoot(
        treeRows.map((row) => toTreeNode(row, noteMap)),
        classId,
      ),
    );
  }

  async replaceTree(classId: string, nodes: TreeNode[]) {
    const nextNodes = sortTreeNodes(ensureTreeRoot(nodes, classId));
    const rows = nextNodes.map((node) => ({
      ...toTreeNodeRow(node),
      ...(this.userId ? { user_id: this.userId } : {}),
    }));
    const nodeIds = nextNodes.map((node) => node.id);
    const noteNodes = nextNodes.filter((node) => node.kind === "note");
    const noteRows = noteNodes.map((node) => ({
      ...toEditorNoteRow(node),
      ...(this.userId ? { user_id: this.userId } : {}),
    }));
    const noteIds = noteRows.map((row) => row.id);

    let existingRowsQuery = this.client
      .from("editor_tree_nodes")
      .select("id, note_id")
      .eq("class_id", classId);

    if (this.userId) {
      existingRowsQuery = existingRowsQuery.eq("user_id", this.userId);
    }

    const { data: existingRows, error: listError } = await existingRowsQuery;

    if (listError) {
      throw listError;
    }

    if (noteRows.length > 0) {
      const { error: upsertNotesError } = await this.client
        .from("editor_notes")
        .upsert(noteRows, {
          onConflict: "user_id,id",
        });

      if (upsertNotesError) {
        throw upsertNotesError;
      }
    }

    const { error: upsertError } = await this.client
      .from("editor_tree_nodes")
      .upsert(rows, {
        onConflict: "user_id,id",
      });

    if (upsertError) {
      throw upsertError;
    }

    const staleRows = (existingRows ?? []) as Array<{
      id: string;
      note_id: string | null;
    }>;
    const staleNodeIds = staleRows
      .map((row) => row.id)
      .filter((id) => !nodeIds.includes(id));
    const staleNoteIds = staleRows
      .flatMap((row) => (row.note_id ? [row.note_id] : []))
      .filter((id) => !noteIds.includes(id));

    if (staleNodeIds.length > 0) {
      let deleteQuery = this.client
        .from("editor_tree_nodes")
        .delete()
        .eq("class_id", classId);

      if (this.userId) {
        deleteQuery = deleteQuery.eq("user_id", this.userId);
      }

      const { error: deleteError } = await deleteQuery.in("id", staleNodeIds);

      if (deleteError) {
        throw deleteError;
      }
    }

    if (staleNoteIds.length > 0) {
      let deleteNotesQuery = this.client
        .from("editor_notes")
        .delete()
        .in("id", staleNoteIds);

      if (this.userId) {
        deleteNotesQuery = deleteNotesQuery.eq("user_id", this.userId);
      }

      const { error: deleteNotesError } = await deleteNotesQuery;

      if (deleteNotesError) {
        throw deleteNotesError;
      }
    }

    return nextNodes;
  }
}
