import { SupabaseNoteSessionRepository } from "./supabase-note-session-repository";

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
  user_id: string;
};

class FakeTableQuery<Row extends Record<string, unknown>> {
  private readonly equals = new Map<string, string>();
  private orderField: string | null = null;
  private orderAscending = true;

  constructor(
    private readonly rows: Row[],
    private readonly mode: "select" | "delete",
    private readonly columns?: string,
    private readonly forcedError: { message: string } | null = null,
  ) {}

  eq(field: string, value: string) {
    this.equals.set(field, value);
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  private execute() {
    if (this.forcedError) {
      return { data: null, error: this.forcedError };
    }

    let filtered = this.rows.filter((row) =>
      Array.from(this.equals.entries()).every(
        ([field, value]) => String(row[field]) === value,
      ),
    );

    if (this.orderField) {
      const orderField = this.orderField;
      filtered = [...filtered].sort((left, right) => {
        const comparison = String(left[orderField] ?? "").localeCompare(
          String(right[orderField] ?? ""),
        );
        return this.orderAscending ? comparison : -comparison;
      });
    }

    if (this.mode === "delete") {
      filtered.forEach((row) => {
        const index = this.rows.findIndex((candidate) => candidate === row);
        if (index >= 0) {
          this.rows.splice(index, 1);
        }
      });

      return { data: null, error: null };
    }

    if (!this.columns) {
      return { data: filtered, error: null };
    }

    const selectedFields = this.columns
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean);

    return {
      data: filtered.map((row) =>
        Object.fromEntries(selectedFields.map((field) => [field, row[field as keyof Row]])),
      ),
      error: null,
    };
  }

  then<TResult1 = ReturnType<FakeTableQuery<Row>["execute"]>, TResult2 = never>(
    onfulfilled?:
      | ((value: ReturnType<FakeTableQuery<Row>["execute"]>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

function createFakeClient({
  rows = [],
  forceDeleteError = false,
}: {
  rows?: NoteSessionRow[];
  forceDeleteError?: boolean;
} = {}) {
  const noteSessionRows = [...rows];
  let lastUpsertRow: Omit<NoteSessionRow, "user_id"> | null = null;
  let lastUpsertOptions: { onConflict?: string } | undefined;

  const client = {
    from: jest.fn().mockImplementation((table: string) => {
      if (table !== "editor_note_sessions") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: (columns: string) =>
          new FakeTableQuery(noteSessionRows, "select", columns),
        upsert: (
          row: Omit<NoteSessionRow, "user_id">,
          options?: { onConflict?: string },
        ) => {
          lastUpsertRow = row;
          lastUpsertOptions = options;
          const index = noteSessionRows.findIndex(
            (candidate) =>
              candidate.class_id === row.class_id &&
              candidate.note_node_id === row.note_node_id &&
              candidate.user_id === "user-123",
          );
          const fullRow: NoteSessionRow = {
            ...row,
            user_id: "user-123",
          };
          if (index >= 0) {
            noteSessionRows[index] = fullRow;
          } else {
            noteSessionRows.push(fullRow);
          }

          return {
            select: (columns: string) => ({
              single: async () => {
                const selectedFields = columns
                  .split(",")
                  .map((field) => field.trim())
                  .filter(Boolean);

                return {
                  data: Object.fromEntries(
                    selectedFields.map((field) => [field, fullRow[field as keyof NoteSessionRow]]),
                  ),
                  error: null,
                };
              },
            }),
          };
        },
        delete: () =>
          new FakeTableQuery(
            noteSessionRows,
            "delete",
            undefined,
            forceDeleteError ? { message: "delete failed" } : null,
          ),
      };
    }),
    noteSessionRows,
    getLastUpsert: () => ({
      options: lastUpsertOptions,
      row: lastUpsertRow,
    }),
  };

  return client;
}

describe("SupabaseNoteSessionRepository", () => {
  test("listByClass maps rows, sanitizes arrays, and returns newest sessions first", async () => {
    const client = createFakeClient({
      rows: [
        {
          class_id: "cs101-ai",
          created_at: "2026-04-01T00:00:00.000Z",
          id: "session-1",
          note_node_id: "note-node-1",
          note_titles: ["Note A", 42 as unknown as string],
          pdf_titles: null,
          title: "Older session",
          unit_titles: ["Unit 1"],
          updated_at: "2026-04-01T00:00:00.000Z",
          user_id: "user-123",
        },
        {
          class_id: "cs101-ai",
          created_at: "2026-04-02T00:00:00.000Z",
          id: "session-2",
          note_node_id: "note-node-2",
          note_titles: ["Note B"],
          pdf_titles: ["lecture.pdf", 7 as unknown as string],
          title: "Newer session",
          unit_titles: null,
          updated_at: "2026-04-02T00:00:00.000Z",
          user_id: "user-123",
        },
      ],
    });
    const repository = new SupabaseNoteSessionRepository(client as never);

    const sessions = await repository.listByClass("cs101-ai");

    expect(sessions).toEqual([
      expect.objectContaining({
        id: "session-2",
        noteTitles: ["Note B"],
        pdfTitles: ["lecture.pdf"],
        unitTitles: [],
      }),
      expect.objectContaining({
        id: "session-1",
        noteTitles: ["Note A"],
        pdfTitles: [],
        unitTitles: ["Unit 1"],
      }),
    ]);
  });

  test("upsertByNoteNode sends the expected payload and returns normalized data", async () => {
    const client = createFakeClient();
    const repository = new SupabaseNoteSessionRepository(client as never);
    (globalThis.crypto.randomUUID as jest.Mock).mockReturnValueOnce("session-uuid");

    const session = await repository.upsertByNoteNode({
      classId: "cs101-ai",
      noteNodeId: "note-node-1",
      noteTitles: ["Chapter note"],
      pdfTitles: ["lecture.pdf"],
      title: "Generated note",
      unitTitles: ["Unit 1"],
    });

    const upsert = client.getLastUpsert();
    expect(upsert.options).toEqual({
      onConflict: "user_id,class_id,note_node_id",
    });
    expect(upsert.row).toEqual(
      expect.objectContaining({
        class_id: "cs101-ai",
        id: "session-uuid",
        note_node_id: "note-node-1",
        note_titles: ["Chapter note"],
        pdf_titles: ["lecture.pdf"],
        title: "Generated note",
        unit_titles: ["Unit 1"],
      }),
    );
    expect(upsert.row?.created_at).toEqual(expect.any(String));
    expect(upsert.row?.updated_at).toEqual(expect.any(String));
    expect(session).toEqual(
      expect.objectContaining({
        classId: "cs101-ai",
        id: "session-uuid",
        noteNodeId: "note-node-1",
        noteTitles: ["Chapter note"],
        pdfTitles: ["lecture.pdf"],
        title: "Generated note",
        unitTitles: ["Unit 1"],
      }),
    );
  });

  test("deleteById deletes only the targeted row and surfaces errors", async () => {
    const client = createFakeClient({
      rows: [
        {
          class_id: "cs101-ai",
          created_at: "2026-04-01T00:00:00.000Z",
          id: "session-1",
          note_node_id: "note-node-1",
          note_titles: ["Note A"],
          pdf_titles: [],
          title: "Session A",
          unit_titles: [],
          updated_at: "2026-04-01T00:00:00.000Z",
          user_id: "user-123",
        },
        {
          class_id: "other-class",
          created_at: "2026-04-01T00:00:00.000Z",
          id: "session-2",
          note_node_id: "note-node-2",
          note_titles: ["Note B"],
          pdf_titles: [],
          title: "Session B",
          unit_titles: [],
          updated_at: "2026-04-01T00:00:00.000Z",
          user_id: "user-123",
        },
      ],
    });
    const repository = new SupabaseNoteSessionRepository(client as never);

    await repository.deleteById({
      classId: "cs101-ai",
      sessionId: "session-1",
    });

    expect(client.noteSessionRows).toEqual([
      expect.objectContaining({
        class_id: "other-class",
        id: "session-2",
      }),
    ]);

    const failingClient = createFakeClient({ forceDeleteError: true });
    const failingRepository = new SupabaseNoteSessionRepository(failingClient as never);
    await expect(
      failingRepository.deleteById({
        classId: "cs101-ai",
        sessionId: "session-1",
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        message: "delete failed",
      }),
    );
  });
});
