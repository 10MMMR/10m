import { fireEvent, render, screen } from "@testing-library/react";
import { EditorPane } from "./editor-pane";

jest.mock("@tiptap/extension-table", () => ({
  __esModule: true,
  Table: {
    configure: jest.fn(() => ({ name: "table" })),
  },
}));

jest.mock("@tiptap/extension-table-cell", () => ({
  __esModule: true,
  default: { name: "tableCell" },
}));

jest.mock("@tiptap/extension-table-header", () => ({
  __esModule: true,
  default: { name: "tableHeader" },
}));

jest.mock("@tiptap/extension-table-row", () => ({
  __esModule: true,
  default: { name: "tableRow" },
}));

type UpdateHandler = ((payload: { editor: MockEditor }) => void) | undefined;

type MockChain = {
  focus: () => MockChain;
  toggleBold: () => MockChain;
  toggleItalic: () => MockChain;
  toggleUnderline: () => MockChain;
  toggleHighlight: () => MockChain;
  toggleBulletList: () => MockChain;
  setFontSize: (value: string) => MockChain;
  insertTable: (options?: { rows?: number; cols?: number; withHeaderRow?: boolean }) => MockChain;
  addRowBefore: () => MockChain;
  addRowAfter: () => MockChain;
  deleteRow: () => MockChain;
  addColumnBefore: () => MockChain;
  addColumnAfter: () => MockChain;
  deleteColumn: () => MockChain;
  toggleHeaderRow: () => MockChain;
  deleteTable: () => MockChain;
  run: () => boolean;
};

type MockEditor = {
  can: () => {
    chain: () => MockChain;
  };
  chain: () => MockChain;
  commands: {
    setContent: (content: string, options?: { emitUpdate?: boolean }) => void;
  };
  getAttributes: () => { fontSize: string };
  getHTML: () => string;
  isActive: (name: string) => boolean;
  off: (event: string, callback: () => void) => void;
  on: (event: string, callback: () => void) => void;
  setEditable: (value: boolean) => void;
};

jest.mock("@tiptap/react", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  function createEditor(onUpdate: UpdateHandler, initialContent = "<p>Initial body</p>"): MockEditor {
    const listeners = new Map<string, Set<() => void>>();

    const buildTableHtml = (rows: number, cols: number, withHeaderRow: boolean) => {
      const headerCells = Array.from({ length: cols }, (_, index) => `<th>Header ${index + 1}</th>`)
        .join("");
      const bodyRows = Array.from({ length: Math.max(rows - (withHeaderRow ? 1 : 0), 0) }, (_, row) => (
        `<tr>${Array.from({ length: cols }, (_, col) => `<td>Cell ${row + 1}-${col + 1}</td>`).join("")}</tr>`
      )).join("");

      return withHeaderRow
        ? `<table><tbody><tr>${headerCells}</tr>${bodyRows}</tbody></table>`
        : `<table><tbody>${Array.from({ length: rows }, (_, row) => (
            `<tr>${Array.from({ length: cols }, (_, col) => `<td>Cell ${row + 1}-${col + 1}</td>`).join("")}</tr>`
          )).join("")}</tbody></table>`;
    };

    const state = {
      bold: false,
      bulletList: false,
      highlight: false,
      html: initialContent,
      italic: false,
      table: false,
      tableCols: 0,
      tableHeader: false,
      tableRows: 0,
      underline: false,
      updateHandler: onUpdate,
      fontSize: "17px",
    };

    const emit = (event: string) => {
      const callbacks = listeners.get(event);
      if (!callbacks) {
        return;
      }

      callbacks.forEach((callback) => callback());
    };

    const syncTableHtml = () => {
      if (!state.table || state.tableRows < 1 || state.tableCols < 1) {
        state.table = false;
        state.tableHeader = false;
        state.tableRows = 0;
        state.tableCols = 0;
        state.html = "<p>Table removed</p>";
        return;
      }

      state.html = buildTableHtml(state.tableRows, state.tableCols, state.tableHeader);
    };

    const setTableContent = (content: string) => {
      state.html = content;
      state.table = content.includes("<table");
      state.tableHeader = content.includes("<th");
      state.tableRows = state.table ? Math.max((content.match(/<tr>/g) || []).length, 1) : 0;
      const headerCells = (content.match(/<th>/g) || []).length;
      const dataCells = (content.match(/<td>/g) || []).length;
      state.tableCols = state.table ? Math.max(headerCells, dataCells > 0 && state.tableRows > 0 ? dataCells / Math.max(state.tableRows - (state.tableHeader ? 1 : 0), 1) : 0, 1) : 0;
    };

    const createChain = (mutates: boolean): MockChain => {
      let canRun = true;

      const apply = (allowed: boolean, callback?: () => void) => {
        canRun = canRun && allowed;
        if (mutates && allowed && callback) {
          callback();
        }

        return chain;
      };

      const chain: MockChain = {
        focus: () => chain,
        toggleBold: () =>
          apply(true, () => {
            state.bold = !state.bold;
            state.html = state.bold ? "<p><strong>Bold body</strong></p>" : "<p>Bold body</p>";
          }),
        toggleItalic: () =>
          apply(true, () => {
            state.italic = !state.italic;
          }),
        toggleUnderline: () =>
          apply(true, () => {
            state.underline = !state.underline;
          }),
        toggleHighlight: () =>
          apply(true, () => {
            state.highlight = !state.highlight;
          }),
        toggleBulletList: () =>
          apply(true, () => {
            state.bulletList = !state.bulletList;
          }),
        setFontSize: (value: string) =>
          apply(true, () => {
            state.fontSize = value;
          }),
        insertTable: (options) =>
          apply(true, () => {
            state.table = true;
            state.tableRows = options?.rows ?? 3;
            state.tableCols = options?.cols ?? 3;
            state.tableHeader = options?.withHeaderRow ?? true;
            syncTableHtml();
          }),
        addRowBefore: () =>
          apply(state.table, () => {
            state.tableRows += 1;
            syncTableHtml();
          }),
        addRowAfter: () =>
          apply(state.table, () => {
            state.tableRows += 1;
            syncTableHtml();
          }),
        deleteRow: () =>
          apply(state.table, () => {
            state.tableRows -= 1;
            syncTableHtml();
          }),
        addColumnBefore: () =>
          apply(state.table, () => {
            state.tableCols += 1;
            syncTableHtml();
          }),
        addColumnAfter: () =>
          apply(state.table, () => {
            state.tableCols += 1;
            syncTableHtml();
          }),
        deleteColumn: () =>
          apply(state.table, () => {
            state.tableCols -= 1;
            syncTableHtml();
          }),
        toggleHeaderRow: () =>
          apply(state.table, () => {
            state.tableHeader = !state.tableHeader;
            syncTableHtml();
          }),
        deleteTable: () =>
          apply(state.table, () => {
            state.table = false;
            syncTableHtml();
          }),
        run: () => {
          if (!canRun) {
            return false;
          }

          if (mutates) {
            emit("transaction");
            state.updateHandler?.({ editor });
          }

          return true;
        },
      };

      return chain;
    };

    const editor: MockEditor = {
      can: () => ({
        chain: () => createChain(false),
      }),
      chain: () => createChain(true),
      commands: {
        setContent: (content) => {
          setTableContent(content);
        },
      },
      getAttributes: () => ({ fontSize: state.fontSize }),
      getHTML: () => state.html,
      isActive: (name: string) => {
        if (name === "bold") return state.bold;
        if (name === "italic") return state.italic;
        if (name === "underline") return state.underline;
        if (name === "highlight") return state.highlight;
        if (name === "bulletList") return state.bulletList;
        if (name === "table") return state.table;
        if (name === "tableHeader") return state.tableHeader;
        return false;
      },
      off: (event, callback) => {
        listeners.get(event)?.delete(callback);
      },
      on: (event, callback) => {
        const callbacks = listeners.get(event) ?? new Set<() => void>();
        callbacks.add(callback);
        listeners.set(event, callbacks);
      },
      setEditable: () => {},
    };

    setTableContent(initialContent);

    return editor;
  }

  return {
    EditorContent: () => <div data-testid="editor-content" />,
    useEditor: (options?: { content?: string; onUpdate?: UpdateHandler }) => {
      const editorRef = React.useRef(null) as { current: MockEditor | null };

      if (!editorRef.current) {
        editorRef.current = createEditor(options?.onUpdate, options?.content);
      }

      return editorRef.current;
    },
  };
});

const defaultProps = {
  emptyStateDescription: "Create a note from the left pane to start writing.",
  emptyStateTitle: "No note selected",
  isDirty: false,
  lockIn: false,
  note: {
    title: "My note",
    body: "<p>My note body</p>",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  onBodyChange: jest.fn(),
  onDelete: jest.fn(),
  onSave: jest.fn(),
  onTitleChange: jest.fn(),
  onToggleLockIn: jest.fn(),
};

describe("EditorPane", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("renders the empty state when no note is selected", () => {
    render(
      <EditorPane
        {...defaultProps}
        note={null}
      />,
    );

    expect(screen.getByText("No note selected")).toBeInTheDocument();
    expect(screen.getByText("Create a note from the left pane to start writing.")).toBeInTheDocument();
  });

  test("disables toolbar controls when editing is locked", () => {
    render(
      <EditorPane
        {...defaultProps}
        lockIn
      />,
    );

    expect(screen.getByRole("button", { name: "Bold" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Increase font size" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decrease font size" })).toBeDisabled();
  });

  test("calls onTitleChange when the title input changes", () => {
    const onTitleChange = jest.fn();

    render(
      <EditorPane
        {...defaultProps}
        onTitleChange={onTitleChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "Renamed note" },
    });

    expect(onTitleChange).toHaveBeenCalledWith("Renamed note");
  });

  test("runs toolbar formatting and triggers debounced body updates", () => {
    jest.useFakeTimers();
    const onBodyChange = jest.fn();

    render(
      <EditorPane
        {...defaultProps}
        onBodyChange={onBodyChange}
      />,
    );

    fireEvent.mouseDown(screen.getByRole("button", { name: "Bold" }));

    expect(onBodyChange).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);

    expect(onBodyChange).toHaveBeenCalledWith("<p><strong>Bold body</strong></p>");
  });

  test("calls save and delete handlers from action buttons", () => {
    const onSave = jest.fn();
    const onDelete = jest.fn();

    render(
      <EditorPane
        {...defaultProps}
        onDelete={onDelete}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  test("inserts a default table and triggers a debounced body update", () => {
    jest.useFakeTimers();
    const onBodyChange = jest.fn();

    render(
      <EditorPane
        {...defaultProps}
        onBodyChange={onBodyChange}
      />,
    );

    fireEvent.mouseDown(screen.getAllByRole("button", { name: "Insert table" })[0]);

    expect(onBodyChange).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);

    expect(onBodyChange).toHaveBeenCalledWith(
      "<table><tbody><tr><th>Header 1</th><th>Header 2</th><th>Header 3</th></tr><tr><td>Cell 1-1</td><td>Cell 1-2</td><td>Cell 1-3</td></tr><tr><td>Cell 2-1</td><td>Cell 2-2</td><td>Cell 2-3</td></tr></tbody></table>",
    );
  });

  test("enables table actions only when the selection is inside a table", () => {
    render(<EditorPane {...defaultProps} />);

    expect(screen.getAllByRole("button", { name: "Delete table" })[0]).toBeDisabled();

    fireEvent.mouseDown(screen.getAllByRole("button", { name: "Insert table" })[0]);

    expect(screen.getAllByRole("button", { name: "Delete table" })[0]).toBeEnabled();
    expect(screen.getAllByRole("button", { name: "Add row above" })[0]).toBeEnabled();
  });

  test("deletes a table and persists the updated html", () => {
    jest.useFakeTimers();
    const onBodyChange = jest.fn();

    render(
      <EditorPane
        {...defaultProps}
        note={{
          ...defaultProps.note,
          body: "<table><tbody><tr><th>Header 1</th></tr><tr><td>Cell 1-1</td></tr></tbody></table>",
        }}
        onBodyChange={onBodyChange}
      />,
    );

    fireEvent.mouseDown(screen.getAllByRole("button", { name: "Delete table" })[0]);
    jest.advanceTimersByTime(100);

    expect(onBodyChange).toHaveBeenCalledWith("<p>Table removed</p>");
  });

  test("keeps table controls disabled when editing is locked", () => {
    render(
      <EditorPane
        {...defaultProps}
        lockIn
      />,
    );

    expect(screen.getAllByRole("button", { name: "Insert table" })[0]).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Delete table" })[0]).toBeDisabled();
  });

  test("does not reapply stale note html after a local table edit", () => {
    const { rerender } = render(<EditorPane {...defaultProps} />);

    fireEvent.mouseDown(screen.getAllByRole("button", { name: "Insert table" })[0]);
    expect(screen.getAllByRole("button", { name: "Delete table" })[0]).toBeEnabled();

    rerender(
      <EditorPane
        {...defaultProps}
        note={{
          ...defaultProps.note,
          body: "<p>My note body</p>",
        }}
      />,
    );

    expect(screen.getAllByRole("button", { name: "Delete table" })[0]).toBeEnabled();
  });
});
