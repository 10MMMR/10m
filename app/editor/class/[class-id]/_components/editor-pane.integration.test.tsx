import { fireEvent, render, screen, within } from "@testing-library/react";
import { EditorPane } from "./editor-pane";
import type { NoteDocument } from "@/lib/note-document";

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
  toggleOrderedList: () => MockChain;
  updateAttributes: (
    type: string,
    attributes: Record<string, string | null | boolean>,
  ) => MockChain;
  setTextAlign: (value: string) => MockChain;
  setLineHeight: (value: string) => MockChain;
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
  __testAppendToBullet: (text: string) => void;
  __testAppendToTableCell: (text: string) => void;
  can: () => {
    chain: () => MockChain;
  };
  chain: () => MockChain;
  commands: {
    setContent: (content: NoteDocument, options?: { emitUpdate?: boolean }) => void;
    updateAttributes: (
      type: string,
      attributes: Record<string, string | null | boolean>,
    ) => void;
  };
  getAttributes: (name?: string) => Record<string, string | null | boolean>;
  getHTML: () => string;
  getJSON: () => NoteDocument;
  isActive: (name: string) => boolean;
  off: (event: string, callback: () => void) => void;
  on: (event: string, callback: () => void) => void;
  setEditable: (value: boolean) => void;
};

jest.mock("@tiptap/react", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  function htmlToDocument(html: string): NoteDocument {
    if (html.startsWith("<table")) {
      const rows = Array.from(html.matchAll(/<tr>(.*?)<\/tr>/g)).map((match) => match[1] ?? "");

      return {
        type: "doc",
        content: [{
          type: "table",
          content: rows.map((row, rowIndex) => {
            const headerMatches = Array.from(row.matchAll(/<th>(.*?)<\/th>/g)).map((match) => match[1] ?? "");
            const cellMatches = Array.from(row.matchAll(/<td>(.*?)<\/td>/g)).map((match) => match[1] ?? "");
            const cells = (headerMatches.length > 0 ? headerMatches : cellMatches).map((text) => ({
              type: headerMatches.length > 0 ? "tableHeader" : "tableCell",
              content: [{ type: "paragraph", content: [{ type: "text", text }] }],
            }));

            return {
              type: "tableRow",
              content: cells.length > 0 ? cells : [{
                type: rowIndex === 0 ? "tableHeader" : "tableCell",
                content: [{ type: "paragraph" }],
              }],
            };
          }),
        }],
      };
    }

    if (html.startsWith("<ol")) {
      const type = html.includes('type="a"') ? "a" : undefined;
      return {
        type: "doc",
        content: [{
          type: "orderedList",
          ...(type ? { attrs: { type } } : {}),
          content: [{
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "First item" }] }],
          }],
        }],
      };
    }

    if (html.startsWith("<ul")) {
      const text = (html.match(/<p>(.*?)<\/p>/)?.[1] ?? "Alpha").replaceAll(/<[^>]+>/g, "");
      return {
        type: "doc",
        content: [{
          type: "bulletList",
          content: [{
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text }] }],
          }],
        }],
      };
    }

    const heading = html.match(/^<h([1-3])>(.*?)<\/h\1><p>(.*?)<\/p>$/);
    if (heading) {
      return {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: Number(heading[1]) }, content: [{ type: "text", text: heading[2] }] },
          { type: "paragraph", content: [{ type: "text", text: heading[3] }] },
        ],
      };
    }

    const bold = html.match(/^<p><strong>(.*?)<\/strong><\/p>$/);
    if (bold) {
      return {
        type: "doc",
        content: [{
          type: "paragraph",
          content: [{ type: "text", text: bold[1], marks: [{ type: "bold" }] }],
        }],
      };
    }

    const plain = html.match(/^<p>(.*?)<\/p>$/);
    return {
      type: "doc",
      content: [{
        type: "paragraph",
        ...(plain?.[1] ? { content: [{ type: "text", text: plain[1] }] } : {}),
      }],
    };
  }

  function documentToHtml(content: NoteDocument): string {
    const firstNode = content.content?.[0];

    if (!firstNode) {
      return "<p></p>";
    }

    if (firstNode.type === "table") {
      const rows = firstNode.content ?? [];
      return `<table><tbody>${rows.map((row) => `<tr>${(row.content ?? []).map((cell) => {
        const text = cell.content?.[0]?.content?.[0]?.text ?? "";
        return cell.type === "tableHeader" ? `<th>${text}</th>` : `<td>${text}</td>`;
      }).join("")}</tr>`).join("")}</tbody></table>`;
    }

    if (firstNode.type === "orderedList") {
      const type = firstNode.attrs?.type === "a" ? ' type="a"' : "";
      return `<ol${type}><li><p>First item</p></li></ol>`;
    }

    if (firstNode.type === "bulletList") {
      const text = firstNode.content?.[0]?.content?.[0]?.content?.[0]?.text ?? "Alpha";
      return `<ul><li><p>${text}</p></li></ul>`;
    }

    if (
      firstNode.type === "heading" &&
      content.content?.[1]?.type === "paragraph"
    ) {
      const title = firstNode.content?.[0]?.text ?? "";
      const body = content.content[1]?.content?.[0]?.text ?? "";
      return `<h${firstNode.attrs?.level ?? 1}>${title}</h${firstNode.attrs?.level ?? 1}><p>${body}</p>`;
    }

    const textNode = firstNode.content?.[0];
    if (textNode?.marks?.some((mark) => mark.type === "bold")) {
      return `<p><strong>${textNode.text ?? ""}</strong></p>`;
    }

    return `<p>${textNode?.text ?? ""}</p>`;
  }

  function createEditor(
    onUpdate: UpdateHandler,
    initialContent: NoteDocument = htmlToDocument("<p>Initial body</p>"),
  ): MockEditor {
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
      html: documentToHtml(initialContent),
      italic: false,
      lineHeight: "1.5",
      table: false,
      tableCols: 0,
      tableHeader: false,
      tableRows: 0,
      orderedList: false,
      orderedListType: null as string | null,
      textAlign: "left",
      underline: false,
      updateHandler: onUpdate,
      fontSize: "17px",
      json: initialContent,
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
        state.json = htmlToDocument(state.html);
        return;
      }

      state.html = buildTableHtml(state.tableRows, state.tableCols, state.tableHeader);
      state.json = htmlToDocument(state.html);
    };

    const setTableContent = (content: NoteDocument) => {
      state.json = content;
      state.html = documentToHtml(content);
      state.bulletList = state.html.includes("<ul") || state.html.includes("<ol");
      state.orderedList = state.html.includes("<ol");
      state.orderedListType = state.html.includes('<ol type="a">') ? "a" : null;
      state.table = state.html.includes("<table");
      state.tableHeader = state.html.includes("<th");
      state.tableRows = state.table ? Math.max((state.html.match(/<tr>/g) || []).length, 1) : 0;
      const headerCells = (state.html.match(/<th>/g) || []).length;
      const dataCells = (state.html.match(/<td>/g) || []).length;
      state.tableCols = state.table ? Math.max(headerCells, dataCells > 0 && state.tableRows > 0 ? dataCells / Math.max(state.tableRows - (state.tableHeader ? 1 : 0), 1) : 0, 1) : 0;
    };

    const syncOrderedListHtml = () => {
      if (!state.orderedList) {
        state.html = "<p>Ordered list removed</p>";
        state.json = htmlToDocument(state.html);
        state.orderedListType = null;
        return;
      }

      const typeAttribute =
        state.orderedListType === "a" ? ' type="a"' : "";
      state.html = `<ol${typeAttribute}><li><p>First item</p></li></ol>`;
      state.json = htmlToDocument(state.html);
    };

    const updateNodeAttributes = (
      type: string,
      attributes: Record<string, string | null | boolean>,
    ) => {
      if (type === "orderedList") {
        state.orderedList = true;
        state.orderedListType =
          typeof attributes.type === "string" ? attributes.type : null;
        syncOrderedListHtml();
      }

      if (type === "paragraph" || type === "heading") {
        if (typeof attributes.textAlign === "string") {
          state.textAlign = attributes.textAlign;
        }

        if (typeof attributes.lineHeight === "string") {
          state.lineHeight = attributes.lineHeight;
        }
      }
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
            state.json = htmlToDocument(state.html);
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
        toggleOrderedList: () =>
          apply(true, () => {
            state.orderedList = !state.orderedList;
            if (state.orderedList) {
              state.orderedListType ??= null;
            }
            syncOrderedListHtml();
          }),
        updateAttributes: (type, attributes) =>
          apply(true, () => {
            updateNodeAttributes(type, attributes);
          }),
        setTextAlign: (value) =>
          apply(true, () => {
            state.textAlign = value;
          }),
        setLineHeight: (value) =>
          apply(true, () => {
            state.lineHeight = value;
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
      __testAppendToBullet: (text) => {
        if (state.html.includes("</p></li>")) {
          state.html = state.html.replace("</p></li>", `${text}</p></li>`);
        } else {
          state.html = `<p>${text}</p>`;
        }

        state.json = htmlToDocument(state.html);
        state.bulletList = state.html.includes("<ul") || state.html.includes("<ol");
        emit("transaction");
        state.updateHandler?.({ editor });
      },
      __testAppendToTableCell: (text) => {
        if (state.html.includes("</td>")) {
          state.html = state.html.replace("</td>", `${text}</td>`);
        } else if (state.html.includes("</th>")) {
          state.html = state.html.replace("</th>", `${text}</th>`);
        } else {
          state.html = `<p>${text}</p>`;
        }

        state.json = htmlToDocument(state.html);
        state.table = state.html.includes("<table");
        emit("transaction");
        state.updateHandler?.({ editor });
      },
      can: () => ({
        chain: () => createChain(false),
      }),
      chain: () => createChain(true),
      commands: {
        setContent: (content) => {
          setTableContent(content);
          emit("transaction");
        },
        updateAttributes: (type, attributes) => {
          updateNodeAttributes(type, attributes);
          emit("transaction");
          state.updateHandler?.({ editor });
        },
      },
      getAttributes: (name) => {
        if (name === "textStyle") {
          return { fontSize: state.fontSize } as Record<string, string | boolean | null>;
        }

        if (name === "orderedList") {
          return { type: state.orderedListType } as Record<string, string | boolean | null>;
        }

        if (name === "paragraph" || name === "heading") {
          return {
            lineHeight: state.lineHeight,
            textAlign: state.textAlign,
          } as Record<string, string | boolean | null>;
        }

        return { fontSize: state.fontSize } as Record<string, string | boolean | null>;
      },
      getHTML: () => state.html,
      getJSON: () => state.json,
      isActive: (name: string) => {
        if (name === "bold") return state.bold;
        if (name === "italic") return state.italic;
        if (name === "underline") return state.underline;
        if (name === "highlight") return state.highlight;
        if (name === "bulletList") return state.bulletList;
        if (name === "orderedList") return state.orderedList;
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
    EditorContent: ({ editor }: { editor: MockEditor | null }) => (
      <div>
        <div data-testid="editor-content" />
        <div data-testid="editor-html">{editor?.getHTML() ?? ""}</div>
        <button
          aria-label="Type in bullet item"
          onClick={() => editor?.__testAppendToBullet("x")}
          type="button"
        >
          Type in bullet item
        </button>
        <button
          aria-label="Type in table cell"
          onClick={() => editor?.__testAppendToTableCell("x")}
          type="button"
        >
          Type in table cell
        </button>
      </div>
    ),
    useEditor: (options?: { content?: NoteDocument; onUpdate?: UpdateHandler }) => {
      const editorRef = React.useRef(null) as { current: MockEditor | null };

      if (!editorRef.current) {
        editorRef.current = createEditor(options?.onUpdate, options?.content);
      }

      return editorRef.current;
    },
  };
});

function createParagraphDocument(text: string): NoteDocument {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

const defaultProps = {
  emptyStateDescription: "Create a note from the left pane to start writing.",
  emptyStateTitle: "No note selected",
  isDirty: false,
  lockIn: false,
  noteId: "note-1",
  note: {
    contentJson: createParagraphDocument("My note body"),
    title: "My note",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  onBodyChange: jest.fn(),
  onDelete: jest.fn(),
  onSave: jest.fn(),
  onTitleChange: jest.fn(),
  onToggleLockIn: jest.fn(),
};

function setToolbarWidth(width: number) {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => width,
  });
}

function getDesktopTableMenu() {
  return document.querySelector("[data-editor-table-menu]") as HTMLElement;
}

function getOverflowMenu() {
  const menus = document.querySelectorAll("[data-floating-menu] [data-editor-overflow-menu]");
  return menus[menus.length - 1] as HTMLElement;
}

function queryOverflowMenu() {
  const menus = document.querySelectorAll("[data-floating-menu] [data-editor-overflow-menu]");
  return (menus[menus.length - 1] as HTMLElement | undefined) ?? null;
}

function getFloatingDesktopTableMenu() {
  const menus = document.querySelectorAll("[data-floating-menu] [data-editor-table-menu]");
  return menus[menus.length - 1] as HTMLElement;
}

describe("EditorPane", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setToolbarWidth(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("renders the empty state when no note is selected", () => {
    render(
      <EditorPane
        {...defaultProps}
        noteId={null}
        note={null}
      />,
    );

    expect(screen.getByText("No note selected")).toBeInTheDocument();
    expect(screen.getByText("Create a note from the left pane to start writing.")).toBeInTheDocument();
  });

  test("renders a pdf iframe when a file is selected", () => {
    render(
      <EditorPane
        {...defaultProps}
        noteId={null}
        note={null}
        pdfDocument={{
          title: "Lecture packet",
          dataUrl: "https://example.supabase.co/storage/v1/object/sign/uploaded-pdfs/user-id/class-id/file-id/lecture-packet.pdf?token=signed-token",
          mimeType: "application/pdf",
          size: 512,
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByTitle("Lecture packet")).toHaveAttribute(
      "src",
      "https://example.supabase.co/storage/v1/object/sign/uploaded-pdfs/user-id/class-id/file-id/lecture-packet.pdf?token=signed-token",
    );
    expect(screen.queryByText("No note selected")).not.toBeInTheDocument();
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

    expect(onBodyChange).toHaveBeenCalledWith({
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: "Bold body", marks: [{ type: "bold" }] }],
      }],
    });
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

  test("switches between numbered and lettered ordered list modes", () => {
    render(<EditorPane {...defaultProps} />);

    const numberedButton = screen.getByRole("button", { name: "Numbered list" });
    const letteredButton = screen.getByRole("button", { name: "Lettered list" });

    fireEvent.mouseDown(numberedButton);
    expect(numberedButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("editor-html")).toHaveTextContent(
      "<ol><li><p>First item</p></li></ol>",
    );

    fireEvent.mouseDown(letteredButton);
    expect(numberedButton).toHaveAttribute("aria-pressed", "false");
    expect(letteredButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("editor-html")).toHaveTextContent(
      '<ol type="a"><li><p>First item</p></li></ol>',
    );

    fireEvent.mouseDown(letteredButton);
    expect(letteredButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("editor-html")).toHaveTextContent(
      "<p>Ordered list removed</p>",
    );
  });

  test("applies text alignment from the desktop menu", () => {
    setToolbarWidth(1400);
    render(<EditorPane {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Align text" }));
    fireEvent.mouseDown(screen.getByRole("button", { name: "Center" }));

    fireEvent.click(screen.getByRole("button", { name: "Align text" }));

    expect(screen.getByRole("button", { name: "Center" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
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

    expect(onBodyChange).toHaveBeenCalledWith({
      type: "doc",
      content: [{
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Header 1" }] }] },
              { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Header 2" }] }] },
              { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Header 3" }] }] },
            ],
          },
          {
            type: "tableRow",
            content: [
              { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Cell 1-1" }] }] },
              { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Cell 1-2" }] }] },
              { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Cell 1-3" }] }] },
            ],
          },
          {
            type: "tableRow",
            content: [
              { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Cell 2-1" }] }] },
              { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Cell 2-2" }] }] },
              { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Cell 2-3" }] }] },
            ],
          },
        ],
      }],
    });
  });

  test("enables table actions only when the selection is inside a table", () => {
    setToolbarWidth(1400);
    render(<EditorPane {...defaultProps} />);

    fireEvent.click(within(getDesktopTableMenu()).getByRole("button", { name: "Table" }));
    expect(within(getFloatingDesktopTableMenu()).getByRole("button", { name: "Delete table" })).toBeDisabled();

    fireEvent.mouseDown(screen.getAllByRole("button", { name: "Insert table" })[0]);

    expect(within(getFloatingDesktopTableMenu()).getByRole("button", { name: "Delete table" })).toBeEnabled();
    expect(within(getFloatingDesktopTableMenu()).getByRole("button", { name: "Add row above" })).toBeEnabled();
  });

  test("deletes a table and persists the updated html", () => {
    jest.useFakeTimers();
    setToolbarWidth(1400);
    const onBodyChange = jest.fn();

    render(
      <EditorPane
        {...defaultProps}
        note={{
          ...defaultProps.note,
          contentJson: {
            type: "doc",
            content: [{
              type: "table",
              content: [
                {
                  type: "tableRow",
                  content: [{ type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Header 1" }] }] }],
                },
                {
                  type: "tableRow",
                  content: [{ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Cell 1-1" }] }] }],
                },
              ],
            }],
          },
        }}
        onBodyChange={onBodyChange}
      />,
    );

    fireEvent.click(within(getDesktopTableMenu()).getByRole("button", { name: "Table" }));
    fireEvent.mouseDown(within(getFloatingDesktopTableMenu()).getByRole("button", { name: "Delete table" }));
    jest.advanceTimersByTime(100);

    expect(onBodyChange).toHaveBeenCalledWith(createParagraphDocument("Table removed"));
  });

  test("opens the desktop table dropdown and runs table actions", () => {
    jest.useFakeTimers();
    setToolbarWidth(1400);
    const onBodyChange = jest.fn();

    render(
      <EditorPane
        {...defaultProps}
        onBodyChange={onBodyChange}
      />,
    );

    fireEvent.click(within(getDesktopTableMenu()).getByRole("button", { name: "Table" }));
    expect(within(getFloatingDesktopTableMenu()).getByRole("button", { name: "Add row above" })).toBeDisabled();

    fireEvent.mouseDown(within(getFloatingDesktopTableMenu()).getByRole("button", { name: "Insert table" }));
    jest.advanceTimersByTime(100);

    expect(onBodyChange).toHaveBeenLastCalledWith(expect.objectContaining({
      type: "doc",
    }));
    expect(screen.queryByRole("button", { name: "Add row above" })).not.toBeInTheDocument();
  });

  test("opens compact overflow on click and keeps table actions out of the root list", () => {
    render(<EditorPane {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "More tools" }));

    expect(within(getOverflowMenu()).getByRole("button", { name: "Table" })).toBeInTheDocument();
    expect(within(getOverflowMenu()).queryByRole("button", { name: "Add row above" })).not.toBeInTheDocument();
    expect(within(getOverflowMenu()).queryByRole("button", { name: "Delete table" })).not.toBeInTheDocument();
  });

  test("renders Lock in inside overflow only at tight width and keeps it outside at non-tight compact width", () => {
    const onToggleLockIn = jest.fn();
    setToolbarWidth(900);
    const { unmount } = render(
      <EditorPane
        {...defaultProps}
        onToggleLockIn={onToggleLockIn}
      />,
    );

    expect(screen.queryByRole("button", { name: "Lock in" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "More tools" }));
    fireEvent.click(within(getOverflowMenu()).getByRole("button", { name: "Lock in" }));
    expect(onToggleLockIn).toHaveBeenCalledTimes(1);

    unmount();
    setToolbarWidth(1000);
    render(
      <EditorPane
        {...defaultProps}
        onToggleLockIn={onToggleLockIn}
      />,
    );

    expect(screen.getByRole("button", { name: "Lock in" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "More tools" }));
    expect(within(getOverflowMenu()).queryByRole("button", { name: "Lock in" })).not.toBeInTheDocument();
  });

  test("opens the compact table side submenu on hover and runs table actions", () => {
    jest.useFakeTimers();
    const onBodyChange = jest.fn();

    render(
      <EditorPane
        {...defaultProps}
        onBodyChange={onBodyChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "More tools" }));
    fireEvent.mouseEnter(within(getOverflowMenu()).getByRole("button", { name: "Table" }));

    expect(within(getOverflowMenu()).getByRole("button", { name: "Insert table" })).toBeInTheDocument();

    fireEvent.mouseDown(within(getOverflowMenu()).getByRole("button", { name: "Insert table" }));
    jest.advanceTimersByTime(100);

    expect(onBodyChange).toHaveBeenLastCalledWith(expect.objectContaining({
      type: "doc",
    }));
    expect(screen.queryByRole("button", { name: "More tools" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add row above" })).not.toBeInTheDocument();
  });

  test("closes desktop and compact menus on outside click", () => {
    setToolbarWidth(1400);
    const { rerender } = render(<EditorPane {...defaultProps} />);

    fireEvent.click(within(getDesktopTableMenu()).getByRole("button", { name: "Table" }));
    expect(within(getFloatingDesktopTableMenu()).getByRole("button", { name: "Add row above" })).toBeInTheDocument();

    fireEvent.click(document.body);
    expect(screen.queryByRole("button", { name: "Add row above" })).not.toBeInTheDocument();

    setToolbarWidth(0);
    rerender(<EditorPane {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "More tools" }));
    expect(within(getOverflowMenu()).getByRole("button", { name: "Bullet list" })).toBeInTheDocument();

    fireEvent.click(document.body);
    expect(queryOverflowMenu()).toBeNull();
  });

  test("keeps table controls disabled when editing is locked", () => {
    setToolbarWidth(1400);
    render(
      <EditorPane
        {...defaultProps}
        lockIn
      />,
    );

    expect(screen.getAllByRole("button", { name: "Insert table" })[0]).toBeDisabled();
    fireEvent.click(within(getDesktopTableMenu()).getByRole("button", { name: "Table" }));
    expect(within(getFloatingDesktopTableMenu()).getByRole("button", { name: "Delete table" })).toBeDisabled();
  });

  test("does not reapply stale note html after a local table edit", () => {
    setToolbarWidth(1400);
    const { rerender } = render(<EditorPane {...defaultProps} />);

    fireEvent.mouseDown(screen.getAllByRole("button", { name: "Insert table" })[0]);
    fireEvent.click(within(getDesktopTableMenu()).getByRole("button", { name: "Table" }));
    expect(within(getFloatingDesktopTableMenu()).getByRole("button", { name: "Delete table" })).toBeEnabled();

    rerender(
      <EditorPane
        {...defaultProps}
        note={{
          ...defaultProps.note,
          contentJson: createParagraphDocument("My note body"),
        }}
      />,
    );

    expect(within(getFloatingDesktopTableMenu()).getByRole("button", { name: "Delete table" })).toBeEnabled();
  });

  test("keeps typing inside the same bullet item across same-note rerenders", () => {
    jest.useFakeTimers();
    const onBodyChange = jest.fn();
    const listNote = {
      ...defaultProps.note,
      contentJson: {
        type: "doc",
        content: [{
          type: "bulletList",
          content: [{
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Alpha" }] }],
          }],
        }],
      },
    };
    const { rerender } = render(
      <EditorPane
        {...defaultProps}
        note={listNote}
        onBodyChange={onBodyChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Type in bullet item" }));
    jest.advanceTimersByTime(100);

    rerender(
      <EditorPane
        {...defaultProps}
        note={{
          ...listNote,
          updatedAt: "2025-01-01T00:00:01.000Z",
        }}
        onBodyChange={onBodyChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Type in bullet item" }));
    jest.advanceTimersByTime(100);

    expect(screen.getByTestId("editor-html")).toHaveTextContent(
      "<ul><li><p>Alphaxx</p></li></ul>",
    );
    expect(onBodyChange).toHaveBeenLastCalledWith({
      type: "doc",
      content: [{
        type: "bulletList",
        content: [{
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Alphaxx" }] }],
        }],
      }],
    });
  });

  test("keeps typing inside the same table cell across same-note rerenders", () => {
    jest.useFakeTimers();
    const onBodyChange = jest.fn();
    const tableNote = {
      ...defaultProps.note,
      contentJson: {
        type: "doc",
        content: [{
          type: "table",
          content: [{
            type: "tableRow",
            content: [{ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Cell" }] }] }],
          }],
        }],
      },
    };
    const { rerender } = render(
      <EditorPane
        {...defaultProps}
        note={tableNote}
        onBodyChange={onBodyChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Type in table cell" }));
    jest.advanceTimersByTime(100);

    rerender(
      <EditorPane
        {...defaultProps}
        note={{
          ...tableNote,
          updatedAt: "2025-01-01T00:00:01.000Z",
        }}
        onBodyChange={onBodyChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Type in table cell" }));
    jest.advanceTimersByTime(100);

    expect(screen.getByTestId("editor-html")).toHaveTextContent(
      "<table><tbody><tr><td>Cellxx</td></tr></tbody></table>",
    );
    expect(onBodyChange).toHaveBeenLastCalledWith({
      type: "doc",
      content: [{
        type: "table",
        content: [{
          type: "tableRow",
          content: [{ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Cellxx" }] }] }],
        }],
      }],
    });
  });

  test("loads a newly selected note body and clears the editor when selection resets", () => {
    const { rerender } = render(<EditorPane {...defaultProps} />);

    expect(screen.getByTestId("editor-html")).toHaveTextContent("<p>My note body</p>");

    rerender(
      <EditorPane
        {...defaultProps}
        noteId="note-2"
        note={{
          ...defaultProps.note,
          contentJson: createParagraphDocument("Second note body"),
          title: "Second note",
        }}
      />,
    );

    expect(screen.getByTestId("editor-html")).toHaveTextContent("<p>Second note body</p>");

    rerender(
      <EditorPane
        {...defaultProps}
        noteId={null}
        note={null}
      />,
    );

    expect(screen.queryByTestId("editor-html")).not.toBeInTheDocument();
    expect(screen.getByText("No note selected")).toBeInTheDocument();
  });

  test("clears a pending body update when switching notes", () => {
    jest.useFakeTimers();
    const onBodyChange = jest.fn();
    const listNote = {
      ...defaultProps.note,
      contentJson: {
        type: "doc",
        content: [{
          type: "bulletList",
          content: [{
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Alpha" }] }],
          }],
        }],
      },
    };
    const { rerender } = render(
      <EditorPane
        {...defaultProps}
        note={listNote}
        onBodyChange={onBodyChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Type in bullet item" }));

    rerender(
      <EditorPane
        {...defaultProps}
        noteId="note-2"
        note={{
          ...defaultProps.note,
          title: "Second note",
          contentJson: createParagraphDocument("Second note body"),
          updatedAt: "2025-01-01T00:00:02.000Z",
        }}
        onBodyChange={onBodyChange}
      />,
    );

    jest.advanceTimersByTime(100);

    expect(onBodyChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("editor-html")).toHaveTextContent("<p>Second note body</p>");
  });
});
