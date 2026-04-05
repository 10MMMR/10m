import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMPTY_NOTE_DOCUMENT,
  parseNoteDocument,
  type NoteDocument,
} from "@/lib/note-document";
import {
  ensureTreeRoot,
  sortTreeNodes,
  type TreeNode,
} from "@/lib/tree-repository";

type TreeNodeRow = {
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
  content_json?: NoteDocument;
  content_version: number;
  created_at: string;
  id: string;
  title: string;
  updated_at: string;
};

type InvalidNoteDocumentDetails = {
  classId: string;
  error: string;
  noteId: string;
};

type ListTreeByClassOptions = {
  includeNoteContent?: boolean;
  onInvalidNoteDocument?: (
    details: InvalidNoteDocumentDetails,
  ) => void | Promise<void>;
};

type LoadNotesByIdsOptions = {
  onInvalidNoteDocument?: (
    details: InvalidNoteDocumentDetails,
  ) => void | Promise<void>;
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
    contentJson: note?.content_json,
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
    content_json: parseNoteDocument(node.contentJson ?? EMPTY_NOTE_DOCUMENT),
    content_version: 1,
    created_at: node.createdAt,
    id: node.noteId ?? node.id,
    title: node.title,
    updated_at: node.updatedAt,
  };
}

export class SupabaseTreeRepository {
  constructor(private readonly client: SupabaseClient) {}

  private async loadNotesByIdsInternal(
    classId: string,
    noteIds: string[],
    options?: LoadNotesByIdsOptions,
    includeContent = true,
  ) {
    if (noteIds.length === 0) {
      return new Map<string, EditorNoteRow>();
    }

    const columns = includeContent
      ? "content_json, content_version, created_at, id, title, updated_at"
      : "content_version, created_at, id, title, updated_at";
    const { data: noteData, error: noteError } = await this.client
      .from("editor_notes")
      .select(columns)
      .in("id", noteIds);

    if (noteError) {
      throw noteError;
    }

    const noteMap = new Map<string, EditorNoteRow>();

    (noteData ?? []).forEach((row) => {
      const note = row as unknown as EditorNoteRow;

      if (!includeContent || note.content_json === undefined) {
        noteMap.set(note.id, note);
        return;
      }

      try {
        noteMap.set(note.id, {
          ...note,
          content_json: parseNoteDocument(note.content_json),
        });
      } catch (error) {
        void options?.onInvalidNoteDocument?.({
          classId,
          error: error instanceof Error ? error.message : "Invalid note document.",
          noteId: note.id,
        });

        noteMap.set(note.id, {
          ...note,
          content_json: EMPTY_NOTE_DOCUMENT,
        });
      }
    });

    return noteMap;
  }

  async listTreeByClass(classId: string, options?: ListTreeByClassOptions) {
    const { data, error } = await this.client
      .from("editor_tree_nodes")
      .select(
        "class_id, created_at, file_mime_type, file_size, file_storage_path, id, kind, note_id, order_index, parent_id, title, updated_at",
      )
      .eq("class_id", classId)
      .order("order_index", { ascending: true });

    if (error) {
      throw error;
    }

    const treeRows = (data ?? []) as TreeNodeRow[];
    const noteIds = treeRows
      .flatMap((row) => (row.note_id ? [row.note_id] : []));
    const noteMap = await this.loadNotesByIdsInternal(
      classId,
      noteIds,
      {
        onInvalidNoteDocument: options?.onInvalidNoteDocument,
      },
      options?.includeNoteContent !== false,
    );

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

  async loadNotesByIds(
    classId: string,
    noteIds: string[],
    options?: LoadNotesByIdsOptions,
  ) {
    return this.loadNotesByIdsInternal(classId, noteIds, options, true);
  }

  async loadNoteById(
    classId: string,
    noteId: string,
    options?: LoadNotesByIdsOptions,
  ) {
    const noteMap = await this.loadNotesByIdsInternal(classId, [noteId], options, true);
    return noteMap.get(noteId) ?? null;
  }

  async replaceTree(classId: string, nodes: TreeNode[]) {
    const nextNodes = sortTreeNodes(ensureTreeRoot(nodes, classId));
    const rows = nextNodes.map(toTreeNodeRow);
    const nodeIds = nextNodes.map((node) => node.id);
    const noteNodes = nextNodes.filter((node) => node.kind === "note");
    const loadedNoteNodes = noteNodes.filter((node) => node.contentJson !== undefined);
    const loadedNoteRows = loadedNoteNodes.map(toEditorNoteRow);
    const retainedNoteIds = noteNodes.map((node) => node.noteId ?? node.id);

    const { data: existingRows, error: listError } = await this.client
      .from("editor_tree_nodes")
      .select("id, note_id")
      .eq("class_id", classId);

    if (listError) {
      throw listError;
    }

    if (loadedNoteRows.length > 0) {
      const { error: upsertNotesError } = await this.client
        .from("editor_notes")
        .upsert(loadedNoteRows, {
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
      .filter((id) => !retainedNoteIds.includes(id));

    if (staleNodeIds.length > 0) {
      const { error: deleteError } = await this.client
        .from("editor_tree_nodes")
        .delete()
        .eq("class_id", classId)
        .in("id", staleNodeIds);

      if (deleteError) {
        throw deleteError;
      }
    }

    if (staleNoteIds.length > 0) {
      const { error: deleteNotesError } = await this.client
        .from("editor_notes")
        .delete()
        .in("id", staleNoteIds);

      if (deleteNotesError) {
        throw deleteNotesError;
      }
    }

    return nextNodes;
  }
}
