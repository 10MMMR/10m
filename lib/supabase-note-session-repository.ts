import type { SupabaseClient } from "@supabase/supabase-js";

export type NoteSession = {
  classId: string;
  createdAt: string;
  id: string;
  noteNodeId: string;
  noteTitles: string[];
  pdfTitles: string[];
  title: string;
  unitTitles: string[];
  updatedAt: string;
};

type NoteSessionRow = {
  class_id: string;
  created_at: string;
  id: string;
  note_node_id: string;
  note_titles: string[] | null;
  pdf_titles: string[] | null;
  title: string;
  unit_titles: string[] | null;
  updated_at: string;
};

function toTextArray(value: string[] | null): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function toNoteSession(row: NoteSessionRow): NoteSession {
  return {
    classId: row.class_id,
    createdAt: row.created_at,
    id: row.id,
    noteNodeId: row.note_node_id,
    noteTitles: toTextArray(row.note_titles),
    pdfTitles: toTextArray(row.pdf_titles),
    title: row.title,
    unitTitles: toTextArray(row.unit_titles),
    updatedAt: row.updated_at,
  };
}

export class SupabaseNoteSessionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByClass(classId: string) {
    const { data, error } = await this.client
      .from("editor_note_sessions")
      .select(
        "class_id, created_at, id, note_node_id, note_titles, pdf_titles, title, unit_titles, updated_at",
      )
      .eq("class_id", classId)
      .order("updated_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => toNoteSession(row as NoteSessionRow));
  }

  async upsertByNoteNode({
    classId,
    noteNodeId,
    noteTitles,
    pdfTitles,
    title,
    unitTitles,
  }: {
    classId: string;
    noteNodeId: string;
    noteTitles: string[];
    pdfTitles: string[];
    title: string;
    unitTitles: string[];
  }) {
    const timestamp = new Date().toISOString();
    const { data, error } = await this.client
      .from("editor_note_sessions")
      .upsert(
        {
          class_id: classId,
          created_at: timestamp,
          id: crypto.randomUUID(),
          note_node_id: noteNodeId,
          note_titles: noteTitles,
          pdf_titles: pdfTitles,
          title,
          unit_titles: unitTitles,
          updated_at: timestamp,
        },
        {
          onConflict: "user_id,class_id,note_node_id",
        },
      )
      .select(
        "class_id, created_at, id, note_node_id, note_titles, pdf_titles, title, unit_titles, updated_at",
      )
      .single();

    if (error) {
      throw error;
    }

    return toNoteSession(data as NoteSessionRow);
  }

  async deleteById({
    classId,
    sessionId,
  }: {
    classId: string;
    sessionId: string;
  }) {
    const { error } = await this.client
      .from("editor_note_sessions")
      .delete()
      .eq("class_id", classId)
      .eq("id", sessionId);

    if (error) {
      throw error;
    }
  }
}
