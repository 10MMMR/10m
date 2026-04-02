import { SupabaseTreeRepository } from "./supabase-tree-repository";

type TreeRow = Record<string, unknown> & {
  class_id: string;
  id: string;
  note_id: string | null;
  order_index: number;
  user_id: string;
};

type NoteRow = Record<string, unknown> & {
  body: string;
  id: string;
  title: string;
  user_id: string;
};

class FakeTableQuery<Row extends Record<string, unknown>> {
  private readonly equals = new Map<string, string>();
  private inFilter: { field: string; values: string[] } | null = null;
  private orderField: string | null = null;

  constructor(
    private readonly rows: Row[],
    private readonly mode: "select" | "delete",
    private readonly columns?: string,
  ) {}

  eq(field: string, value: string) {
    this.equals.set(field, value);
    return this;
  }

  in(field: string, values: string[]) {
    this.inFilter = { field, values };
    return this;
  }

  order(field: string) {
    this.orderField = field;
    return this;
  }

  private execute() {
    let filteredRows = this.rows.filter((row) =>
      Array.from(this.equals.entries()).every(
        ([field, value]) => String(row[field]) === value,
      ),
    );

    if (this.inFilter) {
      filteredRows = filteredRows.filter((row) =>
        this.inFilter?.values.includes(String(row[this.inFilter.field])),
      );
    }

    if (this.orderField) {
      filteredRows = [...filteredRows].sort(
        (left, right) => Number(left[this.orderField!]) - Number(right[this.orderField!]),
      );
    }

    if (this.mode === "delete") {
      filteredRows.forEach((row) => {
        const index = this.rows.findIndex(
          (candidate) => candidate.user_id === row.user_id && candidate.id === row.id,
        );

        if (index >= 0) {
          this.rows.splice(index, 1);
        }
      });

      return { data: null, error: null };
    }

    if (!this.columns) {
      return { data: filteredRows, error: null };
    }

    const selectedFields = this.columns
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean);

    return {
      data: filteredRows.map((row) =>
        Object.fromEntries(selectedFields.map((field) => [field, row[field]])),
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

function createFakeClient(userId = "user-123") {
  const treeRows: TreeRow[] = [];
  const noteRows: NoteRow[] = [];

  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === "editor_tree_nodes") {
        return {
          select: (columns: string) => new FakeTableQuery(treeRows, "select", columns),
          upsert: async (nextRows: Omit<TreeRow, "user_id">[]) => {
            nextRows.forEach((row) => {
              const fullRow = {
                ...row,
                user_id: userId,
              };
              const index = treeRows.findIndex(
                (candidate) =>
                  candidate.user_id === fullRow.user_id && candidate.id === fullRow.id,
              );

              if (index >= 0) {
                treeRows[index] = fullRow;
              } else {
                treeRows.push(fullRow);
              }
            });

            return { error: null };
          },
          delete: () => new FakeTableQuery(treeRows, "delete"),
        };
      }

      if (table === "editor_notes") {
        return {
          select: (columns: string) => new FakeTableQuery(noteRows, "select", columns),
          upsert: async (nextRows: Omit<NoteRow, "user_id">[]) => {
            nextRows.forEach((row) => {
              const fullRow = {
                ...row,
                user_id: userId,
              };
              const index = noteRows.findIndex(
                (candidate) =>
                  candidate.user_id === fullRow.user_id && candidate.id === fullRow.id,
              );

              if (index >= 0) {
                noteRows[index] = fullRow;
              } else {
                noteRows.push(fullRow);
              }
            });

            return { error: null };
          },
          delete: () => new FakeTableQuery(noteRows, "delete"),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
    noteRows,
    treeRows,
  };
}

describe("SupabaseTreeRepository", () => {
  test("listTreeByClass throws when the class does not exist", async () => {
    const fakeClient = createFakeClient();
    const repository = new SupabaseTreeRepository(fakeClient as never);

    await expect(repository.listTreeByClass("cs101-ai")).rejects.toThrow(
      'Class "cs101-ai" does not exist.',
    );
    expect(fakeClient.treeRows).toEqual([]);
  });

  test("listTreeByClass returns the existing class tree and hydrates note content", async () => {
    const fakeClient = createFakeClient();
    fakeClient.treeRows.push(
      {
        class_id: "cs101-ai",
        created_at: "2026-04-02T00:00:00.000Z",
        file_mime_type: null,
        file_size: null,
        file_storage_path: null,
        id: "root:cs101-ai",
        kind: "root",
        note_id: null,
        order_index: 0,
        parent_id: null,
        title: "cs101-ai",
        updated_at: "2026-04-02T00:00:00.000Z",
        user_id: "user-123",
      },
      {
        class_id: "cs101-ai",
        created_at: "2026-04-02T00:00:00.000Z",
        file_mime_type: null,
        file_size: null,
        file_storage_path: null,
        id: "node-1",
        kind: "note",
        note_id: "note-1",
        order_index: 1,
        parent_id: "root:cs101-ai",
        title: "Stale title",
        updated_at: "2026-04-02T00:00:00.000Z",
        user_id: "user-123",
      },
    );
    fakeClient.noteRows.push({
      body: "<p>Hello</p>",
      created_at: "2026-04-02T00:00:00.000Z",
      id: "note-1",
      title: "Fresh title",
      updated_at: "2026-04-03T00:00:00.000Z",
      user_id: "user-123",
    });
    const repository = new SupabaseTreeRepository(fakeClient as never);

    const nodes = await repository.listTreeByClass("cs101-ai");

    expect(nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classId: "cs101-ai",
          id: "root:cs101-ai",
          kind: "root",
        }),
        expect.objectContaining({
          body: "<p>Hello</p>",
          id: "node-1",
          noteId: "note-1",
          title: "Fresh title",
          updatedAt: "2026-04-03T00:00:00.000Z",
        }),
      ]),
    );
  });

  test("replaceTree upserts nodes and notes and removes stale records for the class", async () => {
    const fakeClient = createFakeClient();
    fakeClient.treeRows.push(
      {
        class_id: "cs101-ai",
        created_at: "2026-04-01T00:00:00.000Z",
        file_mime_type: null,
        file_size: null,
        file_storage_path: null,
        id: "stale-node",
        kind: "note",
        note_id: "stale-note",
        order_index: 1,
        parent_id: "root:cs101-ai",
        title: "Old note",
        updated_at: "2026-04-01T00:00:00.000Z",
        user_id: "user-123",
      },
      {
        class_id: "other-class",
        created_at: "2026-04-01T00:00:00.000Z",
        file_mime_type: null,
        file_size: null,
        file_storage_path: null,
        id: "other-root",
        kind: "root",
        note_id: null,
        order_index: 0,
        parent_id: null,
        title: "other-class",
        updated_at: "2026-04-01T00:00:00.000Z",
        user_id: "user-123",
      },
    );
    fakeClient.noteRows.push(
      {
        body: "<p>Old body</p>",
        created_at: "2026-04-01T00:00:00.000Z",
        id: "stale-note",
        title: "Old note",
        updated_at: "2026-04-01T00:00:00.000Z",
        user_id: "user-123",
      },
      {
        body: "<p>Other body</p>",
        created_at: "2026-04-01T00:00:00.000Z",
        id: "other-note",
        title: "Other note",
        updated_at: "2026-04-01T00:00:00.000Z",
        user_id: "user-123",
      },
    );
    const repository = new SupabaseTreeRepository(fakeClient as never);

    await repository.replaceTree("cs101-ai", [
      {
        classId: "cs101-ai",
        createdAt: "2026-04-02T00:00:00.000Z",
        id: "root:cs101-ai",
        kind: "root",
        order: 0,
        parentId: null,
        title: "cs101-ai",
        updatedAt: "2026-04-02T00:00:00.000Z",
      },
      {
        body: "<p>Hello</p>",
        classId: "cs101-ai",
        createdAt: "2026-04-02T00:00:00.000Z",
        id: "node-1",
        kind: "note",
        noteId: "note-1",
        order: 1,
        parentId: "root:cs101-ai",
        title: "Fresh note",
        updatedAt: "2026-04-02T00:00:00.000Z",
      },
    ]);

    expect(fakeClient.treeRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          class_id: "cs101-ai",
          id: "node-1",
          note_id: "note-1",
          title: null,
        }),
        expect.objectContaining({
          class_id: "other-class",
          id: "other-root",
        }),
      ]),
    );
    expect(fakeClient.noteRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: "<p>Hello</p>",
          id: "note-1",
          title: "Fresh note",
        }),
        expect.objectContaining({
          id: "other-note",
          title: "Other note",
        }),
      ]),
    );
    expect(
      fakeClient.treeRows.find(
        (row) => row.class_id === "cs101-ai" && row.id === "stale-node",
      ),
    ).toBeUndefined();
    expect(fakeClient.noteRows.find((row) => row.id === "stale-note")).toBeUndefined();
  });
});
