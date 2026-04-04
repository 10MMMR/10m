import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WorkspaceShell } from "./workspace-shell";
import type { AssistantCommand } from "@/lib/ai/assistant-contract";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { moveNodeInTree } from "@/lib/tree-repository";

jest.mock("@/lib/supabase-browser", () => ({
  getSupabaseBrowserClient: jest.fn(),
}));

jest.mock("./topbar", () => ({
  Topbar: () => <div data-testid="topbar" />,
}));

jest.mock("./chat-pane", () => ({
  ChatPane: ({
    disabled,
    disabledMessage,
    inputValue,
    isStreaming,
    messages,
    onInputChange,
    onSubmit,
  }: {
    disabled: boolean;
    disabledMessage: string;
    inputValue: string;
    isStreaming: boolean;
    messages: Array<{ side: "assistant" | "user"; text: string }>;
    onInputChange: (value: string) => void;
    onSubmit: () => void;
  }) => (
    <div data-testid="chat-pane">
      <p data-testid="chat-disabled">{disabled ? "yes" : "no"}</p>
      <p data-testid="chat-disabled-message">{disabledMessage}</p>
      <p data-testid="chat-messages">
        {messages.map((message) => `${message.side}:${message.text}`).join(" | ") || "none"}
      </p>
      <input
        aria-label="Chat input"
        disabled={disabled || isStreaming}
        onChange={(event) => onInputChange(event.target.value)}
        value={inputValue}
      />
      <button
        disabled={disabled || isStreaming}
        onClick={onSubmit}
        type="button"
      >
        Send chat
      </button>
    </div>
  ),
}));

jest.mock("./editor-pane", () => ({
  EditorPane: ({
    isDirty,
    noteId,
    note,
    onBodyChange,
    onDelete,
    pdfDocument,
    onSave,
    onTitleChange,
  }: {
    isDirty: boolean;
    noteId: string | null;
    note: { title: string; body: string } | null;
    onBodyChange: (body: string) => void;
    onDelete: () => void;
    pdfDocument?: { dataUrl: string; title: string } | null;
    onSave: () => void;
    onTitleChange: (title: string) => void;
  }) => (
    <div>
      <p data-testid="draft-state">{isDirty ? "dirty" : "clean"}</p>
      <p data-testid="draft-id">{noteId ?? "none"}</p>
      <p data-testid="draft-title">{note?.title ?? "none"}</p>
      <p data-testid="draft-body">{note?.body ?? "none"}</p>
      <p data-testid="pdf-title">{pdfDocument?.title ?? "none"}</p>
      <p data-testid="pdf-url">{pdfDocument?.dataUrl ?? "none"}</p>
      <button onClick={() => onTitleChange("Fresh note")} type="button">
        Update draft title
      </button>
      <button onClick={() => onBodyChange("<p>Fresh body</p>")} type="button">
        Update draft body
      </button>
      <button onClick={onSave} type="button">
        Save draft
      </button>
      <button onClick={onDelete} type="button">
        Delete draft
      </button>
    </div>
  ),
}));

type SessionUser = {
  access_token?: string;
  email?: string;
  id: string;
};

type TreeRow = {
  class_id: string;
  created_at: string;
  file_mime_type: string | null;
  file_size: number | null;
  file_storage_path: string | null;
  id: string;
  kind: "root" | "folder" | "note" | "file";
  note_id: string | null;
  order_index: number;
  parent_id: string | null;
  title: string | null;
  updated_at: string;
  user_id: string;
};

type NoteRow = {
  body: string;
  created_at: string;
  id: string;
  title: string;
  updated_at: string;
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
      filteredRows = [...filteredRows].sort((left, right) => {
        const leftValue = left[this.orderField];
        const rightValue = right[this.orderField];
        return Number(leftValue) - Number(rightValue);
      });
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

    if (!this.columns || this.columns === "*") {
      return { data: filteredRows, error: null };
    }

    const selectedFields = this.columns
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean);

    return {
      data: filteredRows.map((row) =>
        Object.fromEntries(selectedFields.map((field) => [field, row[field as keyof TreeRow]])),
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

function createFakeSupabaseClient(user: SessionUser | null) {
  const treeRows: TreeRow[] = user
    ? [
        {
          class_id: "cs101-ai",
          created_at: "2026-04-01T00:00:00.000Z",
          file_mime_type: null,
          file_size: null,
          file_storage_path: null,
          id: "root:cs101-ai",
          kind: "root",
          note_id: null,
          order_index: 0,
          parent_id: null,
          title: "cs101-ai",
          updated_at: "2026-04-01T00:00:00.000Z",
          user_id: user.id,
        },
      ]
    : [];
  const noteRows: NoteRow[] = [];
  const uploadedFiles = new Map<string, File>();
  const removedPaths: string[][] = [];
  const signedUrlCalls: string[] = [];
  const upload = jest.fn().mockImplementation(async (path: string, file: File) => {
    uploadedFiles.set(path, file);
    return { error: null };
  });
  const remove = jest.fn().mockImplementation(async (paths: string[]) => {
    removedPaths.push(paths);
    paths.forEach((path) => uploadedFiles.delete(path));
    return { error: null };
  });
  const createSignedUrl = jest.fn().mockImplementation(async (path: string) => {
    signedUrlCalls.push(path);
    return {
      data: {
        signedUrl: `https://signed.example/${encodeURIComponent(path)}`,
      },
      error: null,
    };
  });
  const storageApi = {
    createSignedUrl,
    remove,
    upload,
  };
  let authStateChangeCallback:
    | ((event: string, session: { user: SessionUser } | null) => void)
    | null = null;

  return {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: user
            ? {
                access_token: user.access_token ?? "token-123",
                user,
              }
            : null,
        },
      }),
      onAuthStateChange: jest.fn().mockImplementation((callback) => {
        authStateChangeCallback = callback;
        callback("INITIAL_SESSION", user ? { user } : null);
        return {
          data: {
            subscription: {
              unsubscribe: jest.fn(),
            },
          },
        };
      }),
      signInWithOAuth: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn().mockImplementation((table: string) => {
      if (table === "editor_tree_nodes") {
        return {
          select: (columns: string) => new FakeTableQuery(treeRows, "select", columns),
          upsert: async (rows: Omit<TreeRow, "user_id">[]) => {
            rows.forEach((row) => {
              const fullRow: TreeRow = {
                ...row,
                user_id: user?.id ?? "anonymous",
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
          upsert: async (rows: Omit<NoteRow, "user_id">[]) => {
            rows.forEach((row) => {
              const fullRow: NoteRow = {
                ...row,
                user_id: user?.id ?? "anonymous",
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
    storage: {
      from: jest.fn().mockImplementation(() => storageApi),
    },
    __noteRows: noteRows,
    __treeRows: treeRows,
    __uploadedFiles: uploadedFiles,
    __removedPaths: removedPaths,
    __signedUrlCalls: signedUrlCalls,
    __emitAuthStateChange: (event: string, nextUser: SessionUser | null) => {
      authStateChangeCallback?.(event, nextUser ? { user: nextUser } : null);
    },
  };
}

function toTreeNodes(fakeSupabase: ReturnType<typeof createFakeSupabaseClient>) {
  return [...fakeSupabase.__treeRows]
    .sort((left, right) => left.order_index - right.order_index)
    .map((row) => {
      const note = row.note_id
        ? fakeSupabase.__noteRows.find((item) => item.id === row.note_id) ?? null
        : null;

      return {
        body: note?.body,
        classId: row.class_id,
        createdAt: row.created_at,
        fileMimeType: row.file_mime_type ?? undefined,
        fileSize: row.file_size ?? undefined,
        fileStoragePath: row.file_storage_path ?? undefined,
        id: row.id,
        kind: row.kind,
        noteId: row.note_id ?? undefined,
        order: row.order_index,
        parentId: row.parent_id,
        title: note?.title ?? row.title ?? "Untitled note",
        updatedAt: note?.updated_at ?? row.updated_at,
      };
    });
}

function applyTree(fakeSupabase: ReturnType<typeof createFakeSupabaseClient>, tree: ReturnType<typeof toTreeNodes>) {
  fakeSupabase.__treeRows.splice(0, fakeSupabase.__treeRows.length);
  fakeSupabase.__noteRows.splice(0, fakeSupabase.__noteRows.length);

  tree.forEach((node) => {
    fakeSupabase.__treeRows.push({
      class_id: node.classId,
      created_at: node.createdAt,
      file_mime_type: node.fileMimeType ?? null,
      file_size: node.fileSize ?? null,
      file_storage_path: node.fileStoragePath ?? null,
      id: node.id,
      kind: node.kind,
      note_id: node.kind === "note" ? node.noteId ?? null : null,
      order_index: node.order,
      parent_id: node.parentId,
      title: node.kind === "note" ? null : node.title,
      updated_at: node.updatedAt,
      user_id: "user-123",
    });

    if (node.kind === "note") {
      fakeSupabase.__noteRows.push({
        body: node.body ?? "<p></p>",
        created_at: node.createdAt,
        id: node.noteId ?? node.id,
        title: node.title,
        updated_at: node.updatedAt,
        user_id: "user-123",
      });
    }
  });
}

function seedTree(
  fakeSupabase: ReturnType<typeof createFakeSupabaseClient>,
  tree: ReturnType<typeof toTreeNodes>,
) {
  applyTree(fakeSupabase, tree);
}

describe("WorkspaceShell note flow", () => {
  let confirmSpy: jest.SpyInstance<boolean, [message?: string | undefined]>;
  let fakeSupabase: ReturnType<typeof createFakeSupabaseClient>;
  let originalFetch: typeof global.fetch | undefined;
  let idCounter = 0;
  let uploadShouldFailAfterStorage = false;
  let deleteShouldFailAfterTree = false;
  let chatShouldFail = false;
  let noteGenerationShouldFail = false;
  let nextAssistantCommand: AssistantCommand = {
    action: "reply",
    message: "Structured reply",
  };
  let nextGeneratedHtml = "<h1>Generated Study Note</h1><p>Focused summary.</p>";
  let nextGeneratedTitle: string | null = null;
  let lastChatBody: Record<string, unknown> | null = null;
  let lastGenerateBody: Record<string, unknown> | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    idCounter = 0;
    (globalThis.crypto.randomUUID as jest.Mock)
      .mockReset()
      .mockImplementation(() => `test-uuid-${++idCounter}`);

    fakeSupabase = createFakeSupabaseClient({
      access_token: "token-123",
      email: "student@example.com",
      id: "user-123",
    });
    jest.mocked(getSupabaseBrowserClient).mockReturnValue(fakeSupabase as never);
    uploadShouldFailAfterStorage = false;
    deleteShouldFailAfterTree = false;
    chatShouldFail = false;
    noteGenerationShouldFail = false;
    nextAssistantCommand = {
      action: "reply",
      message: "Structured reply",
    };
    nextGeneratedHtml = "<h1>Generated Study Note</h1><p>Focused summary.</p>";
    nextGeneratedTitle = null;
    lastChatBody = null;
    lastGenerateBody = null;
    originalFetch = global.fetch;
    global.fetch = jest.fn(async (input, init) => {
      if (input === "/api/chat") {
        lastChatBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;

        if (chatShouldFail) {
          return {
            json: async () => ({ error: "Unable to contact the chat assistant." }),
            ok: false,
          } as Response;
        }

        return {
          json: async () => ({ assistant: nextAssistantCommand }),
          ok: true,
        } as Response;
      }

      if (input === "/api/notes/generate") {
        lastGenerateBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;

        if (noteGenerationShouldFail) {
          return {
            json: async () => ({ error: "Unable to generate note." }),
            ok: false,
          } as Response;
        }

        return {
          json: async () => ({
            html: nextGeneratedHtml,
            ...(nextGeneratedTitle ? { title: nextGeneratedTitle } : {}),
          }),
          ok: true,
        } as Response;
      }

      if (input !== "/api/uploads/pdf") {
        throw new Error(`Unexpected fetch: ${String(input)}`);
      }

      if (init?.method === "POST") {
        const body = init.body as FormData;
        const classId = body.get("classId");
        const parentId = body.get("parentId");
        const file = body.get("file");

        if (
          typeof classId !== "string" ||
          typeof parentId !== "string" ||
          !(file instanceof File)
        ) {
          return {
            json: async () => ({ error: "Bad request." }),
            ok: false,
          } as Response;
        }

        const fileId = `test-uuid-${++idCounter}`;
        const storagePath = `user-123/${classId}/${fileId}/${file.name}`;
        fakeSupabase.__uploadedFiles.set(storagePath, file);

        if (uploadShouldFailAfterStorage) {
          fakeSupabase.__uploadedFiles.delete(storagePath);

          return {
            json: async () => ({ error: "Unable to save PDF metadata." }),
            ok: false,
          } as Response;
        }

        const tree = toTreeNodes(fakeSupabase);
        const timestamp = new Date().toISOString();
        const nextTree = [
          ...tree,
          {
            classId,
            createdAt: timestamp,
            fileMimeType: file.type || "application/pdf",
            fileSize: file.size,
            fileStoragePath: storagePath,
            id: fileId,
            kind: "file" as const,
            order: tree.filter((node) => node.parentId === parentId).length,
            parentId,
            title: file.name,
            updatedAt: timestamp,
          },
        ];
        applyTree(fakeSupabase, nextTree);

        return {
          json: async () => ({
            fileNode: nextTree.find((node) => node.id === fileId),
            tree: nextTree,
          }),
          ok: true,
        } as Response;
      }

      if (init?.method === "DELETE") {
        const body = JSON.parse(String(init.body)) as {
          classId: string;
          nodeIds: string[];
        };
        const currentTree = toTreeNodes(fakeSupabase);
        let nextTree = currentTree;

        body.nodeIds.forEach((nodeId) => {
          const deletedIds = new Set<string>([nodeId]);
          let changed = true;

          while (changed) {
            changed = false;

            nextTree.forEach((node) => {
              if (
                node.parentId &&
                deletedIds.has(node.parentId) &&
                !deletedIds.has(node.id)
              ) {
                deletedIds.add(node.id);
                changed = true;
              }
            });
          }

          nextTree = nextTree.filter((node) => !deletedIds.has(node.id));
        });

        const removedPaths = currentTree.flatMap((node) =>
          !nextTree.some((nextNode) => nextNode.id === node.id) &&
          node.kind === "file" &&
          node.fileStoragePath
            ? [node.fileStoragePath]
            : [],
        );
        applyTree(fakeSupabase, nextTree);

        if (deleteShouldFailAfterTree) {
          return {
            json: async () => ({
              error: "Tree updated, but failed to remove one or more PDFs from storage.",
              orphanedPaths: removedPaths,
              tree: nextTree,
              treeUpdated: true,
            }),
            ok: false,
          } as Response;
        }

        fakeSupabase.__removedPaths.push(removedPaths);
        removedPaths.forEach((path) => fakeSupabase.__uploadedFiles.delete(path));

        return {
          json: async () => ({
            removedPaths,
            tree: nextTree,
          }),
          ok: true,
        } as Response;
      }

      throw new Error(`Unexpected method: ${String(init?.method)}`);
    }) as typeof fetch;
  });

  afterEach(() => {
    confirmSpy.mockRestore();
    global.fetch = originalFetch as typeof fetch;
  });

  const renderWorkspace = (classId = "cs101-ai") =>
    render(
      <WorkspaceShell
        classId={classId}
        requestedClassId={classId}
        storageBucket="uploaded-pdfs"
        usedFallback={false}
      />,
    );

  const openRootAddMenu = async () => {
    const buttons = await screen.findAllByRole("button", { name: "Add item" });
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
  };

  const createRootNote = async () => {
    await openRootAddMenu();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "New note" }));
    });
  };

  const createRootFolder = async () => {
    await openRootAddMenu();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "New folder" }));
    });
  };

  const uploadPdfFromAddMenu = async (buttonIndex: number, fileName = "lecture.pdf") => {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pdf = new File(["pdf"], fileName, {
      type: "application/pdf",
    });
    const addButtons = await screen.findAllByRole("button", { name: "Add item" });

    await act(async () => {
      fireEvent.click(addButtons[buttonIndex]);
    });
    fireEvent.click(await screen.findByRole("button", { name: "Upload file" }));
    await act(async () => {
      fireEvent.change(input, {
        target: {
          files: [pdf],
        },
      });
    });

    await screen.findByText(`Uploaded ${fileName}`);
  };

  const findTreeRowLabel = async (label: string) => {
    const labels = await screen.findAllByText(label);
    const rowLabel = labels.find((element) => element.textContent === label);

    expect(rowLabel).toBeDefined();
    return rowLabel!;
  };

  const sendChatMessage = async (value: string) => {
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Chat input"), {
        target: { value },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send chat" }));
    });
  };

  test("creates and saves a note through Supabase", async () => {
    renderWorkspace();

    await createRootNote();

    expect(screen.getByTestId("draft-id")).toHaveTextContent("test-uuid-2");
    expect(screen.getByTestId("draft-title")).toHaveTextContent("Untitled note");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Update draft title" }));
      fireEvent.click(screen.getByRole("button", { name: "Update draft body" }));
    });

    expect(screen.getByTestId("draft-state")).toHaveTextContent("dirty");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("draft-state")).toHaveTextContent("clean");
    });

    expect(screen.getByRole("button", { name: /Fresh note/ })).toBeInTheDocument();
    expect(fakeSupabase.__treeRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          class_id: "cs101-ai",
          id: "test-uuid-2",
          note_id: "test-uuid-1",
          title: null,
          user_id: "user-123",
        }),
      ]),
    );
    expect(fakeSupabase.__noteRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: "<p>Fresh body</p>",
          id: "test-uuid-1",
          title: "Fresh note",
          user_id: "user-123",
        }),
      ]),
    );
  });

  test("deletes a note from Supabase", async () => {
    renderWorkspace();

    await createRootNote();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete draft" }));
    });
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(
        fakeSupabase.__treeRows.find((row) => row.id === "test-uuid-2"),
      ).toBeUndefined();
    });
    expect(
      fakeSupabase.__noteRows.find((row) => row.id === "test-uuid-1"),
    ).toBeUndefined();
  });

  test("uploads PDFs to Supabase storage, loads a signed URL, and removes storage on delete", async () => {
    renderWorkspace();

    await createRootFolder();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Add item" })).toHaveLength(2);
    });
    await uploadPdfFromAddMenu(1);
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "" })[1]);
    });

    const fileRow = await findTreeRowLabel("lecture.pdf");
    await act(async () => {
      fireEvent.click(fileRow);
    });

    await waitFor(() => {
      expect(screen.getByTestId("pdf-title")).toHaveTextContent("lecture.pdf");
    });

    expect(screen.getByTestId("pdf-url")).toHaveTextContent(
      "https://signed.example/user-123%2Fcs101-ai%2Ftest-uuid-2%2Flecture.pdf",
    );
    expect(
      fakeSupabase.__uploadedFiles.has("user-123/cs101-ai/test-uuid-2/lecture.pdf"),
    ).toBe(
      true,
    );

    await act(async () => {
      const buttons = screen.getAllByRole("button", { name: "Open menu" });
      fireEvent.click(buttons[buttons.length - 1]);
    });
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(fakeSupabase.__removedPaths).toContainEqual([
        "user-123/cs101-ai/test-uuid-2/lecture.pdf",
      ]);
    });
  });

  test("opens an empty folder when the first note is added under it", async () => {
    renderWorkspace();

    await createRootFolder();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Add item" })).toHaveLength(2);
    });

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Add item" })[1]);
    });
    fireEvent.click(await screen.findByRole("button", { name: "New note" }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /^Untitled note/ })).toHaveLength(1);
    });
    expect(screen.getByTestId("draft-title")).toHaveTextContent("Untitled note");
  });

  test("opens a pdf node when the first note is added under it", async () => {
    renderWorkspace();

    await uploadPdfFromAddMenu(0);
    const pdfRow = await findTreeRowLabel("lecture.pdf");
    await act(async () => {
      fireEvent.click(pdfRow);
    });

    await waitFor(() => {
      expect(screen.getByTestId("pdf-title")).toHaveTextContent("lecture.pdf");
    });

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Add item" })[1]);
    });
    fireEvent.click(await screen.findByRole("button", { name: "New note" }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /^Untitled note/ })).toHaveLength(1);
    });
    expect(screen.getByTestId("draft-title")).toHaveTextContent("Untitled note");
  });

  test("restores expanded tree state and selected pdf after remount in the same session", async () => {
    const { unmount } = renderWorkspace();

    await createRootFolder();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Add item" })).toHaveLength(2);
    });
    await uploadPdfFromAddMenu(1);

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "" })[1]);
    });

    const fileRow = await findTreeRowLabel("lecture.pdf");
    await act(async () => {
      fireEvent.click(fileRow);
    });

    await waitFor(() => {
      expect(screen.getByTestId("pdf-title")).toHaveTextContent("lecture.pdf");
    });
    await waitFor(() => {
      expect(
        window.localStorage.getItem("editor-tree-ui-state:user-123:cs101-ai"),
      ).toContain('"selectedNodeId":"test-uuid-2"');
    });

    const signedUrlCallCount = fakeSupabase.__signedUrlCalls.length;
    unmount();
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByTestId("pdf-title")).toHaveTextContent("lecture.pdf");
    });
    expect(screen.getByText("lecture.pdf")).toBeInTheDocument();
    expect(fakeSupabase.__signedUrlCalls.length).toBeGreaterThan(signedUrlCallCount);
  });

  test("restores the selected note after remount in the same session", async () => {
    const { unmount } = renderWorkspace();

    await createRootNote();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Update draft title" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("draft-title")).toHaveTextContent("Fresh note");
    });
    await waitFor(() => {
      expect(
        window.localStorage.getItem("editor-tree-ui-state:user-123:cs101-ai"),
      ).toContain('"selectedNodeId":"test-uuid-2"');
    });

    unmount();
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByTestId("draft-title")).toHaveTextContent("Fresh note");
    });
    expect(screen.getByRole("button", { name: /Fresh note/ })).toBeInTheDocument();
  });

  test("disables chat until a note or pdf is selected", async () => {
    renderWorkspace();

    expect(screen.getByTestId("chat-disabled")).toHaveTextContent("yes");

    await createRootNote();

    expect(screen.getByTestId("chat-disabled")).toHaveTextContent("no");
  });

  test("keeps separate chat sessions per active document", async () => {
    renderWorkspace();

    await createRootNote();
    await sendChatMessage("Question for note one");

    await waitFor(() => {
      expect(screen.getByTestId("chat-messages")).toHaveTextContent(
        "user:Question for note one | assistant:Structured reply",
      );
    });
    expect(lastChatBody).toMatchObject({
      activeNodeId: "test-uuid-2",
      classId: "cs101-ai",
    });

    await createRootNote();
    await sendChatMessage("Question for note two");

    await waitFor(() => {
      expect(screen.getByTestId("chat-messages")).toHaveTextContent(
        "user:Question for note two | assistant:Structured reply",
      );
    });

    const noteOneRow = await findTreeRowLabel("Untitled note");
    await act(async () => {
      fireEvent.click(noteOneRow);
    });

    await waitFor(() => {
      expect(screen.getByTestId("chat-messages")).toHaveTextContent(
        "user:Question for note one | assistant:Structured reply",
      );
    });
  });

  test("keeps unsupported requests as reply actions and does not generate notes", async () => {
    renderWorkspace();

    await uploadPdfFromAddMenu(0);
    const pdfRow = await findTreeRowLabel("lecture.pdf");
    await act(async () => {
      fireEvent.click(pdfRow);
    });

    nextAssistantCommand = {
      action: "reply",
      message: "I can't open PDFs for you yet.",
    };

    const beforeTreeCount = fakeSupabase.__treeRows.length;

    await sendChatMessage("Open this pdf");

    await waitFor(() => {
      expect(screen.getByTestId("chat-messages")).toHaveTextContent(
        "user:Open this pdf | assistant:I can't open PDFs for you yet.",
      );
    });
    expect(lastGenerateBody).toBeNull();
    expect(fakeSupabase.__treeRows).toHaveLength(beforeTreeCount);
    expect(screen.getByTestId("pdf-title")).toHaveTextContent("lecture.pdf");
  });

  test("routes chat generate_note to a new note and persists generated html", async () => {
    renderWorkspace();

    await createRootNote();

    nextAssistantCommand = {
      action: "generate_note",
      message: "Creating a fresh study note.",
      prompt: "Create sharp study notes from the current note.",
      target: "new_note",
      title: "AI Study Sheet",
    };
    nextGeneratedHtml = "<h1>AI Study Sheet</h1><p>Condensed concepts.</p>";
    nextGeneratedTitle = "AI Study Sheet";

    const sourceNoteId = screen.getByTestId("draft-id").textContent;

    await sendChatMessage("Make a new study note from this");

    await waitFor(() => {
      expect(screen.getByTestId("draft-title")).toHaveTextContent("AI Study Sheet");
    });
    expect(screen.getByTestId("draft-body")).toHaveTextContent(
      "<h1>AI Study Sheet</h1><p>Condensed concepts.</p>",
    );
    expect(screen.getByTestId("chat-messages")).toHaveTextContent(
      "user:Make a new study note from this | assistant:Creating a fresh study note.",
    );
    expect(lastGenerateBody).toMatchObject({
      classId: "cs101-ai",
      mode: "new_note",
      prompt: "Create sharp study notes from the current note.",
      sourceNodeIds: [sourceNoteId],
      title: "AI Study Sheet",
    });
  });

  test("overwrites the current note when chat returns generate_note with current_note target", async () => {
    renderWorkspace();

    await createRootNote();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Update draft title" }));
      fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    });

    nextAssistantCommand = {
      action: "generate_note",
      message: "Overwriting the current note.",
      prompt: "Rewrite the open note into premium study notes.",
      target: "current_note",
    };
    nextGeneratedHtml = "<h2>Overwritten</h2><p>New body.</p>";

    const noteId = screen.getByTestId("draft-id").textContent;

    await sendChatMessage("Overwrite this note with better study notes");

    await waitFor(() => {
      expect(screen.getByTestId("draft-body")).toHaveTextContent(
        "<h2>Overwritten</h2><p>New body.</p>",
      );
    });
    expect(screen.getByTestId("draft-id")).toHaveTextContent(noteId ?? "");
    expect(lastGenerateBody).toMatchObject({
      mode: "overwrite_note",
      targetNoteId: noteId,
    });
    expect(screen.getByTestId("chat-messages")).toHaveTextContent(
      "assistant:Overwriting the current note.",
    );
  });

  test("falls back to a new note when chat asks to overwrite while a pdf is active", async () => {
    renderWorkspace();

    await uploadPdfFromAddMenu(0);
    const pdfRow = await findTreeRowLabel("lecture.pdf");
    await act(async () => {
      fireEvent.click(pdfRow);
    });

    nextAssistantCommand = {
      action: "generate_note",
      message: "Creating a new note from the PDF.",
      prompt: "Turn this PDF into a study note.",
      target: "current_note",
      title: "PDF Notes",
    };
    nextGeneratedHtml = "<h1>PDF Notes</h1><p>PDF summary.</p>";

    await sendChatMessage("Overwrite this with notes");

    await waitFor(() => {
      expect(screen.getByTestId("draft-title")).toHaveTextContent("PDF Notes");
    });
    expect(screen.getByTestId("draft-body")).toHaveTextContent(
      "<h1>PDF Notes</h1><p>PDF summary.</p>",
    );
    expect(lastGenerateBody).toMatchObject({
      mode: "new_note",
      title: "PDF Notes",
    });
  });

  test("generates a new note from the tree menu using selected sources", async () => {
    seedTree(fakeSupabase, [
      {
        classId: "cs101-ai",
        createdAt: "2026-04-01T00:00:00.000Z",
        id: "root:cs101-ai",
        kind: "root",
        order: 0,
        parentId: null,
        title: "cs101-ai",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        body: "<p>Chapter note body</p>",
        classId: "cs101-ai",
        createdAt: "2026-04-01T00:00:00.000Z",
        id: "note-node-1",
        kind: "note",
        noteId: "note-1",
        order: 1,
        parentId: "root:cs101-ai",
        title: "Chapter note",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        classId: "cs101-ai",
        createdAt: "2026-04-01T00:00:00.000Z",
        fileMimeType: "application/pdf",
        fileSize: 2048,
        fileStoragePath: "user-123/cs101-ai/file-1/lecture.pdf",
        id: "file-1",
        kind: "file",
        order: 2,
        parentId: "root:cs101-ai",
        title: "lecture.pdf",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ]);

    renderWorkspace();

    const noteRow = await screen.findByRole("button", { name: /Chapter note/ });
    const pdfRow = await findTreeRowLabel("lecture.pdf");

    await act(async () => {
      fireEvent.click(noteRow);
    });
    await act(async () => {
      fireEvent.click(pdfRow, { ctrlKey: true });
    });

    const openMenuButtons = screen.getAllByRole("button", { name: "Open menu" });
    await act(async () => {
      fireEvent.click(openMenuButtons[openMenuButtons.length - 1]);
    });
    fireEvent.click(await screen.findByRole("button", { name: "Generate notes" }));

    await waitFor(() => {
      expect(screen.getByTestId("draft-title")).toHaveTextContent(
        "Study Notes - Chapter note + 1 more",
      );
    });
    expect(lastGenerateBody).toMatchObject({
      mode: "new_note",
      sourceNodeIds: ["note-node-1", "file-1"],
    });
  });

  test("shows a clear message and no tree when signed out", async () => {
    fakeSupabase = createFakeSupabaseClient(null);
    jest.mocked(getSupabaseBrowserClient).mockReturnValue(fakeSupabase as never);

    renderWorkspace();

    await screen.findByText("Sign in with Google to access notes.");
    expect(screen.queryByRole("button", { name: "Add item" })).not.toBeInTheDocument();
  });

  test("shows an error and does not create a tree for an unknown class id", async () => {
    render(
      <WorkspaceShell
        classId="unknown-class"
        requestedClassId="unknown-class"
        storageBucket="uploaded-pdfs"
        usedFallback={false}
      />,
    );

    await screen.findByText('Class "unknown-class" does not exist.');
    expect(
      fakeSupabase.__treeRows.find((row) => row.class_id === "unknown-class"),
    ).toBeUndefined();
    expect(screen.queryByRole("button", { name: "Add item" })).not.toBeInTheDocument();
  });

  test("clears remembered local tree state on sign in", async () => {
    fakeSupabase = createFakeSupabaseClient(null);
    fakeSupabase.__treeRows.push(
      {
        class_id: "cs101-ai",
        created_at: "2026-04-01T00:00:00.000Z",
        file_mime_type: null,
        file_size: null,
        file_storage_path: null,
        id: "root:cs101-ai",
        kind: "root",
        note_id: null,
        order_index: 0,
        parent_id: null,
        title: "cs101-ai",
        updated_at: "2026-04-01T00:00:00.000Z",
        user_id: "user-123",
      },
      {
        class_id: "cs101-ai",
        created_at: "2026-04-01T00:00:00.000Z",
        file_mime_type: null,
        file_size: null,
        file_storage_path: "user-123/cs101-ai/file-1/lecture.pdf",
        id: "file-1",
        kind: "file",
        note_id: null,
        order_index: 1,
        parent_id: "root:cs101-ai",
        title: "lecture.pdf",
        updated_at: "2026-04-01T00:00:00.000Z",
        user_id: "user-123",
      },
      {
        class_id: "cs101-ai",
        created_at: "2026-04-01T00:00:00.000Z",
        file_mime_type: null,
        file_size: null,
        file_storage_path: null,
        id: "folder-1",
        kind: "folder",
        note_id: null,
        order_index: 2,
        parent_id: "root:cs101-ai",
        title: "Folder 1",
        updated_at: "2026-04-01T00:00:00.000Z",
        user_id: "user-123",
      },
    );
    jest.mocked(getSupabaseBrowserClient).mockReturnValue(fakeSupabase as never);
    window.localStorage.setItem(
      "editor-tree-ui-state:user-123:cs101-ai",
      JSON.stringify({
        expandedIds: ["folder-1"],
        selectedNodeId: "file-1",
      }),
    );

    renderWorkspace();
    await screen.findByText("Sign in with Google to access notes.");

    await act(async () => {
      fakeSupabase.__emitAuthStateChange("SIGNED_IN", {
        email: "student@example.com",
        id: "user-123",
      });
    });

    await waitFor(() => {
      expect(screen.queryByTestId("pdf-title")).toHaveTextContent("none");
    });
    expect(window.localStorage.getItem("editor-tree-ui-state:user-123:cs101-ai")).toBe(
      JSON.stringify({
        expandedIds: [],
        selectedNodeId: null,
      }),
    );
  });

  test("shows an error and leaves no uploaded file behind when backend upload persistence fails", async () => {
    uploadShouldFailAfterStorage = true;
    renderWorkspace();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pdf = new File(["pdf"], "failed.pdf", {
      type: "application/pdf",
    });

    await openRootAddMenu();
    fireEvent.click(await screen.findByRole("button", { name: "Upload file" }));
    await act(async () => {
      fireEvent.change(input, {
        target: {
          files: [pdf],
        },
      });
    });

    await screen.findByText("Unable to save PDF metadata.");
    expect(fakeSupabase.__uploadedFiles.size).toBe(0);
    expect(screen.queryByText("failed.pdf")).not.toBeInTheDocument();
  });

  test("surfaces partial delete failure after tree update", async () => {
    renderWorkspace();

    await uploadPdfFromAddMenu(0);
    deleteShouldFailAfterTree = true;

    await act(async () => {
      const buttons = screen.getAllByRole("button", { name: "Open menu" });
      fireEvent.click(buttons[buttons.length - 1]);
    });
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await screen.findByText("Tree updated, but failed to remove one or more PDFs from storage. Retry cleanup for 1 file(s).");
    expect(screen.queryByText("lecture.pdf")).not.toBeInTheDocument();
    expect(fakeSupabase.__uploadedFiles.has("user-123/cs101-ai/test-uuid-1/lecture.pdf")).toBe(
      true,
    );
  });

  test("deletes a folder cascade including nested pdfs and notes", async () => {
    seedTree(fakeSupabase, [
      {
        classId: "cs101-ai",
        createdAt: "2026-04-01T00:00:00.000Z",
        id: "root:cs101-ai",
        kind: "root",
        order: 0,
        parentId: null,
        title: "cs101-ai",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        classId: "cs101-ai",
        createdAt: "2026-04-01T00:00:00.000Z",
        id: "folder-1",
        kind: "folder",
        order: 0,
        parentId: "root:cs101-ai",
        title: "Folder 1",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        classId: "cs101-ai",
        createdAt: "2026-04-01T00:00:00.000Z",
        fileMimeType: "application/pdf",
        fileSize: 3,
        fileStoragePath: "user-123/cs101-ai/file-1/lecture.pdf",
        id: "file-1",
        kind: "file",
        order: 0,
        parentId: "folder-1",
        title: "lecture.pdf",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        body: "<p>Nested</p>",
        classId: "cs101-ai",
        createdAt: "2026-04-01T00:00:00.000Z",
        id: "note-node-1",
        kind: "note",
        noteId: "note-1",
        order: 1,
        parentId: "folder-1",
        title: "Nested note",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ]);
    fakeSupabase.__uploadedFiles.set(
      "user-123/cs101-ai/file-1/lecture.pdf",
      new File(["pdf"], "lecture.pdf", { type: "application/pdf" }),
    );
    window.localStorage.setItem(
      "editor-tree-ui-state:user-123:cs101-ai",
      JSON.stringify({
        expandedIds: ["folder-1"],
        selectedNodeId: null,
      }),
    );

    const { unmount } = renderWorkspace();

    await screen.findByText("Folder 1");
    await screen.findByText("lecture.pdf");
    await screen.findByText("Nested note");

    await act(async () => {
      await global.fetch("/api/uploads/pdf", {
        body: JSON.stringify({
          classId: "cs101-ai",
          nodeIds: ["folder-1"],
        }),
        method: "DELETE",
      });
    });

    unmount();
    renderWorkspace();

    await waitFor(() => {
      expect(screen.queryByText("Folder 1")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("lecture.pdf")).not.toBeInTheDocument();
    expect(screen.queryByText("Nested note")).not.toBeInTheDocument();
    expect(fakeSupabase.__removedPaths).toContainEqual([
      "user-123/cs101-ai/file-1/lecture.pdf",
    ]);
    expect(fakeSupabase.__noteRows.find((row) => row.id === "note-1")).toBeUndefined();
  });

  test("shows a preview error when signed URL generation fails", async () => {
    seedTree(fakeSupabase, [
      {
        classId: "cs101-ai",
        createdAt: "2026-04-01T00:00:00.000Z",
        id: "root:cs101-ai",
        kind: "root",
        order: 0,
        parentId: null,
        title: "cs101-ai",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        classId: "cs101-ai",
        createdAt: "2026-04-01T00:00:00.000Z",
        fileMimeType: "application/pdf",
        fileSize: 3,
        fileStoragePath: "user-123/cs101-ai/file-1/lecture.pdf",
        id: "file-1",
        kind: "file",
        order: 0,
        parentId: "root:cs101-ai",
        title: "lecture.pdf",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ]);
    fakeSupabase.storage.from().createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    renderWorkspace();

    const fileRow = await findTreeRowLabel("lecture.pdf");
    await act(async () => {
      fireEvent.click(fileRow);
    });

    await screen.findByText("Unable to load PDF preview.");
    expect(screen.getByTestId("pdf-url")).toHaveTextContent("none");
    expect(screen.getByText("lecture.pdf")).toBeInTheDocument();
    expect(fakeSupabase.__treeRows.find((row) => row.id === "file-1")).toBeDefined();
  });

  test("persists a moved note after drag and drop", async () => {
    seedTree(fakeSupabase, [
      {
        classId: "cs101-ai",
        createdAt: "2026-04-01T00:00:00.000Z",
        id: "root:cs101-ai",
        kind: "root",
        order: 0,
        parentId: null,
        title: "cs101-ai",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        body: "<p>First</p>",
        classId: "cs101-ai",
        createdAt: "2026-04-01T00:00:00.000Z",
        id: "note-node-1",
        kind: "note",
        noteId: "note-1",
        order: 0,
        parentId: "root:cs101-ai",
        title: "First note",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        body: "<p>Second</p>",
        classId: "cs101-ai",
        createdAt: "2026-04-01T00:00:00.000Z",
        id: "note-node-2",
        kind: "note",
        noteId: "note-2",
        order: 1,
        parentId: "root:cs101-ai",
        title: "Second note",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ]);

    const nextTree = moveNodeInTree(
      toTreeNodes(fakeSupabase),
      "cs101-ai",
      "note-node-2",
      "note-node-1",
      "before",
    );
    applyTree(fakeSupabase, nextTree);

    const { unmount } = renderWorkspace();

    await screen.findByText("First note");
    await screen.findByText("Second note");

    const movedNote = fakeSupabase.__treeRows.find((row) => row.id === "note-node-2");
    const otherNote = fakeSupabase.__treeRows.find((row) => row.id === "note-node-1");
    expect(movedNote?.parent_id).toBe("root:cs101-ai");
    expect(movedNote?.order_index).toBe(0);
    expect(otherNote?.order_index).toBe(1);

    unmount();
    renderWorkspace();

    await screen.findByText("Second note");
    const remountedLabels = screen
      .getAllByText(/First note|Second note/)
      .map((element) => element.textContent);
    expect(remountedLabels.indexOf("Second note")).toBeLessThan(
      remountedLabels.indexOf("First note"),
    );
  });
});
