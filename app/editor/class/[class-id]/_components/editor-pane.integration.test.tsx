import { fireEvent, render, screen } from "@testing-library/react";
import { EditorPane } from "./editor-pane";

type UpdateHandler = ((payload: { editor: MockEditor }) => void) | undefined;

type MockEditor = {
  chain: () => {
    focus: () => ReturnType<MockEditor["chain"]>;
    toggleBold: () => ReturnType<MockEditor["chain"]>;
    toggleItalic: () => ReturnType<MockEditor["chain"]>;
    toggleUnderline: () => ReturnType<MockEditor["chain"]>;
    toggleHighlight: () => ReturnType<MockEditor["chain"]>;
    toggleBulletList: () => ReturnType<MockEditor["chain"]>;
    setFontSize: (value: string) => ReturnType<MockEditor["chain"]>;
    run: () => boolean;
  };
  commands: {
    setContent: (content: string) => void;
  };
  getAttributes: () => { fontSize: string };
  getHTML: () => string;
  isActive: (name: string) => boolean;
  off: (event: string, callback: () => void) => void;
  on: (event: string, callback: () => void) => void;
  setEditable: (value: boolean) => void;
};

jest.mock("@tiptap/react", () => {
  const React = require("react");

  function createEditor(onUpdate: UpdateHandler): MockEditor {
    const listeners = new Map<string, Set<() => void>>();
    const state = {
      bold: false,
      bulletList: false,
      highlight: false,
      html: "<p>Initial body</p>",
      italic: false,
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

    const chain = {
      focus: () => chain,
      toggleBold: () => {
        state.bold = !state.bold;
        state.html = state.bold ? "<p><strong>Bold body</strong></p>" : "<p>Bold body</p>";
        return chain;
      },
      toggleItalic: () => {
        state.italic = !state.italic;
        return chain;
      },
      toggleUnderline: () => {
        state.underline = !state.underline;
        return chain;
      },
      toggleHighlight: () => {
        state.highlight = !state.highlight;
        return chain;
      },
      toggleBulletList: () => {
        state.bulletList = !state.bulletList;
        return chain;
      },
      setFontSize: (value: string) => {
        state.fontSize = value;
        return chain;
      },
      run: () => {
        emit("transaction");
        state.updateHandler?.({ editor });
        return true;
      },
    };

    const editor: MockEditor = {
      chain: () => chain,
      commands: {
        setContent: (content) => {
          state.html = content;
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

    return editor;
  }

  return {
    EditorContent: () => <div data-testid="editor-content" />,
    useEditor: (options?: { onUpdate?: UpdateHandler }) => {
      const editorRef = React.useRef(null) as { current: MockEditor | null };

      if (!editorRef.current) {
        editorRef.current = createEditor(options?.onUpdate);
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
});
