import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WorkspaceShell } from "./workspace-shell";

jest.mock("./topbar", () => ({
  Topbar: () => <div data-testid="topbar" />,
}));

jest.mock("./chat-pane", () => ({
  ChatPane: () => <div data-testid="chat-pane" />,
}));

jest.mock("./editor-pane", () => ({
  EditorPane: ({
    isDirty,
    noteId,
    note,
    onBodyChange,
    pdfDocument,
    onSave,
    onTitleChange,
  }: {
    isDirty: boolean;
    noteId: string | null;
    note: { title: string } | null;
    onBodyChange: (body: string) => void;
    pdfDocument?: { dataUrl: string; title: string } | null;
    onSave: () => void;
    onTitleChange: (title: string) => void;
  }) => (
    <div>
      <p data-testid="draft-state">{isDirty ? "dirty" : "clean"}</p>
      <p data-testid="draft-id">{noteId ?? "none"}</p>
      <p data-testid="draft-title">{note?.title ?? "none"}</p>
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
    </div>
  ),
}));

describe("WorkspaceShell note flow", () => {
  let idCounter = 0;
  let confirmSpy: jest.SpyInstance<boolean, [message?: string | undefined]>;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    idCounter = 0;
    (globalThis.crypto.randomUUID as jest.Mock).mockImplementation(
      () => `test-uuid-${++idCounter}`,
    );
    confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ({ ok: true }),
      ok: true,
    } as Response);
  });

  afterEach(() => {
    confirmSpy.mockRestore();
    fetchSpy.mockRestore();
  });

  const openRootAddMenu = () => {
    fireEvent.click(screen.getAllByRole("button", { name: "Add item" })[0]);
  };

  const createRootNote = () => {
    openRootAddMenu();
    fireEvent.click(screen.getByRole("button", { name: "New note" }));
  };

  const createRootFolder = () => {
    openRootAddMenu();
    fireEvent.click(screen.getByRole("button", { name: "New folder" }));
  };

  test("creates a note from the left pane and updates the draft state", () => {
    render(
      <WorkspaceShell
        classId="cs101-ai"
        requestedClassId="cs101-ai"
        usedFallback={false}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Add item" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "New note" }));

    expect(screen.getByTestId("draft-state")).toHaveTextContent("dirty");
    expect(screen.getByTestId("draft-id")).not.toHaveTextContent("none");
    expect(screen.getByTestId("draft-title")).toHaveTextContent("Untitled note");

    fireEvent.click(screen.getByRole("button", { name: "Update draft title" }));
    fireEvent.click(screen.getByRole("button", { name: "Update draft body" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    expect(screen.getByTestId("draft-state")).toHaveTextContent("clean");
    expect(screen.getByTestId("draft-title")).toHaveTextContent("Fresh note");
    expect(screen.getByRole("button", { name: /Fresh note/ })).toBeInTheDocument();
  });

  test("ctrl-click delete uses the full multi-selection", () => {
    confirmSpy.mockReturnValue(false);

    render(
      <WorkspaceShell
        classId="cs101-ai"
        requestedClassId="cs101-ai"
        usedFallback={false}
      />,
    );

    createRootNote();
    createRootNote();

    const notes = screen.getAllByRole("button", { name: "Untitled note" });
    fireEvent.click(notes[0]);
    fireEvent.click(notes[1], { ctrlKey: true });

    fireEvent.click(screen.getAllByRole("button", { name: "Open menu" })[2]);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(confirmSpy).toHaveBeenCalledWith("Delete 2 selected item(s)?");
    expect(screen.getAllByRole("button", { name: "Untitled note" })).toHaveLength(2);
  });

  test("shift-click delete uses the visible selection range", () => {
    confirmSpy.mockReturnValue(false);

    render(
      <WorkspaceShell
        classId="cs101-ai"
        requestedClassId="cs101-ai"
        usedFallback={false}
      />,
    );

    createRootNote();
    createRootNote();
    createRootNote();

    const notes = screen.getAllByRole("button", { name: "Untitled note" });
    fireEvent.click(notes[0]);
    fireEvent.click(notes[2], { shiftKey: true });

    fireEvent.click(screen.getAllByRole("button", { name: "Open menu" })[3]);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(confirmSpy).toHaveBeenCalledWith("Delete 3 selected item(s)?");
    expect(screen.getAllByRole("button", { name: "Untitled note" })).toHaveLength(3);
  });

  test("deleting a selected parent and child only cascades once from the parent", () => {
    render(
      <WorkspaceShell
        classId="cs101-ai"
        requestedClassId="cs101-ai"
        usedFallback={false}
      />,
    );

    createRootFolder();

    fireEvent.click(screen.getAllByRole("button", { name: "Add item" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "New note" }));

    fireEvent.click(screen.getByRole("button", { name: "Untitled folder" }));
    fireEvent.click(screen.getByRole("button", { name: "Untitled note" }), {
      ctrlKey: true,
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Open menu" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(confirmSpy).toHaveBeenCalledWith(
      "Delete Untitled folder and 1 nested item(s)?",
    );
    expect(screen.queryByRole("button", { name: "Untitled folder" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Untitled note" })).not.toBeInTheDocument();
  });

  test("deleting a folder removes stored PDFs from storage", async () => {
    fetchSpy.mockResolvedValueOnce({
      json: async () => ({
        fileId: "uploaded-file-1",
        mimeType: "application/pdf",
        size: 128,
        storagePath: "cs101-ai/uploaded-file-1/lesson-notes.pdf",
        title: "lesson-notes.pdf",
      }),
      ok: true,
    } as Response);

    render(
      <WorkspaceShell
        classId="cs101-ai"
        requestedClassId="cs101-ai"
        usedFallback={false}
      />,
    );

    createRootFolder();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pdf = new File(["pdf"], "lesson-notes.pdf", {
      type: "application/pdf",
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Add item" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
    fireEvent.change(input, {
      target: {
        files: [pdf],
      },
    });

    expect(await screen.findByRole("button", { name: "lesson-notes.pdf" })).toBeInTheDocument();

    fetchSpy.mockClear();

    fireEvent.click(screen.getAllByRole("button", { name: "Open menu" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/storage/pdf?path=cs101-ai%2Fuploaded-file-1%2Flesson-notes.pdf",
        { method: "DELETE" },
      );
    });
  });

  test("rejects non-pdf and oversize uploads before calling the API", () => {
    render(
      <WorkspaceShell
        classId="cs101-ai"
        requestedClassId="cs101-ai"
        usedFallback={false}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const textFile = new File(["hello"], "notes.txt", {
      type: "text/plain",
    });

    openRootAddMenu();
    fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
    fireEvent.change(input, {
      target: {
        files: [textFile],
      },
    });

    expect(screen.getByText("Only PDF files can be uploaded.")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    const largePdf = new File(["pdf"], "huge.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(largePdf, "size", {
      configurable: true,
      value: 50 * 1024 * 1024 + 1,
    });

    openRootAddMenu();
    fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
    fireEvent.change(input, {
      target: {
        files: [largePdf],
      },
    });

    expect(screen.getByText("PDF exceeds the 50 MB limit.")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("stores uploaded PDFs with storage-backed viewer metadata", async () => {
    fetchSpy.mockResolvedValueOnce({
      json: async () => ({
        fileId: "uploaded-file-2",
        mimeType: "application/pdf",
        size: 512,
        storagePath: "cs101-ai/uploaded-file-2/lecture.pdf",
        title: "lecture.pdf",
      }),
      ok: true,
    } as Response);

    render(
      <WorkspaceShell
        classId="cs101-ai"
        requestedClassId="cs101-ai"
        usedFallback={false}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pdf = new File(["pdf"], "lecture.pdf", {
      type: "application/pdf",
    });

    openRootAddMenu();
    fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
    fireEvent.change(input, {
      target: {
        files: [pdf],
      },
    });

    const fileRow = await screen.findByRole("button", { name: "lecture.pdf" });
    expect(screen.getByText("Uploaded lecture.pdf")).toBeInTheDocument();

    fireEvent.click(fileRow);

    expect(screen.getByTestId("draft-id")).toHaveTextContent("none");
    expect(screen.getByTestId("pdf-title")).toHaveTextContent("lecture.pdf");
    expect(screen.getByTestId("pdf-url")).toHaveTextContent(
      "/api/storage/pdf?path=cs101-ai%2Fuploaded-file-2%2Flecture.pdf",
    );
  });
});
