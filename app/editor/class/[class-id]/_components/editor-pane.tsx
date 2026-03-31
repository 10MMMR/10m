"use client";

import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import Highlight from "@tiptap/extension-highlight";
import { FontSize, TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  createElement,
  type Dispatch,
  useEffect,
  useMemo,
  type PointerEvent as ReactPointerEvent,
  useRef,
  type SetStateAction,
  useState,
  type FocusEvent,
  type MouseEvent,
} from "react";
import {
  ArrowsUpDownIcon,
  Bars3Icon,
  BoldIcon,
  ChevronDownIcon,
  EllipsisHorizontalIcon,
  EyeIcon,
  ItalicIcon,
  ListBulletIcon,
  LockClosedIcon,
  MinusIcon,
  NumberedListIcon,
  PaintBrushIcon,
  PhotoIcon,
  PlusIcon,
  QueueListIcon,
  SwatchIcon,
  TableCellsIcon,
  TrashIcon,
  UnderlineIcon,
} from "@heroicons/react/24/outline";
import { LineHeight, type LineHeightValue } from "./tiptap-line-height";
import {
  EquationBlock,
  type EquationMathFieldElement,
} from "./tiptap-equation-block";
import styles from "./editor-pane.module.css";

type EditableDocument = {
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

type PdfDocument = {
  title: string;
  dataUrl: string;
  mimeType: string;
  size: number | null;
  createdAt: string;
  updatedAt: string;
};

type EditorPaneProps = {
  lockIn: boolean;
  onToggleLockIn: () => void;
  noteId: string | null;
  note: EditableDocument | null;
  pdfDocument?: PdfDocument | null;
  isDirty: boolean;
  onTitleChange: (title: string) => void;
  onBodyChange: (body: string) => void;
  onSave: () => void;
  onDelete: () => void;
  saveLabel?: string;
  titleLabel?: string;
  titlePlaceholder?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
};

type ToolbarAction =
  | "bold"
  | "italic"
  | "underline"
  | "highlight"
  | "textColor"
  | "insertImage"
  | "insertTable"
  | "alignText"
  | "bulletList"
  | "orderedList"
  | "letteredList"
  | "lineSpacing"
  | "preview";

type TableAction =
  | "insertTable"
  | "addRowBefore"
  | "addRowAfter"
  | "deleteRow"
  | "addColumnBefore"
  | "addColumnAfter"
  | "deleteColumn"
  | "toggleHeaderRow"
  | "deleteTable";

type EquationPaletteItem = {
  insertLatex: string;
  previewLatex: string;
  width?: "compact" | "wide";
};

type EquationPaletteGroup = {
  title: string;
  tone:
    | "main"
    | "accent"
    | "muted"
    | "secondary"
    | "warm"
    | "soft";
  items: EquationPaletteItem[];
};

const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 40;
const DEFAULT_FONT_SIZE = 17;
const DEFAULT_TEXT_ALIGN = "left";
const DEFAULT_LINE_HEIGHT = "1.5";
const EQUATION_PALETTE_WIDTH = 704;
const EQUATION_PALETTE_HEIGHT = 620;
const TEXT_ALIGN_OPTIONS = [
  { label: "Left", value: "left" },
  { label: "Center", value: "center" },
  { label: "Right", value: "right" },
  { label: "Justify", value: "justify" },
] as const;
const LINE_HEIGHT_OPTIONS: ReadonlyArray<{
  label: string;
  value: LineHeightValue;
}> = [
  { label: "1.0", value: "1.0" },
  { label: "1.5", value: "1.5" },
  { label: "2.0", value: "2.0" },
];
const EQUATION_PALETTE_GROUPS: EquationPaletteGroup[] = [
  {
    title: "Common operations",
    tone: "main",
    items: [
      { previewLatex: "\\frac{a}{b}", insertLatex: "\\frac{#0}{#0}", width: "wide" },
      { previewLatex: "x^2", insertLatex: "#0^{#0}" },
      { previewLatex: "x^y", insertLatex: "#0^{#0}" },
      { previewLatex: "x_y", insertLatex: "#0_{#0}" },
    ],
  },
  {
    title: "Roots & radicals",
    tone: "soft",
    items: [
      { previewLatex: "\\sqrt{x}", insertLatex: "\\sqrt{#0}", width: "wide" },
      { previewLatex: "\\sqrt[3]{x}", insertLatex: "\\sqrt[3]{#0}", width: "wide" },
      { previewLatex: "\\sqrt[n]{x}", insertLatex: "\\sqrt[#0]{#0}", width: "wide" },
    ],
  },
  {
    title: "Greek letters & constants",
    tone: "accent",
    items: [
      { previewLatex: "\\pi", insertLatex: "\\pi" },
      { previewLatex: "\\theta", insertLatex: "\\theta" },
      { previewLatex: "\\alpha", insertLatex: "\\alpha" },
      { previewLatex: "\\beta", insertLatex: "\\beta" },
      { previewLatex: "\\gamma", insertLatex: "\\gamma" },
      { previewLatex: "\\lambda", insertLatex: "\\lambda" },
      { previewLatex: "\\mu", insertLatex: "\\mu" },
      { previewLatex: "\\sigma", insertLatex: "\\sigma" },
      { previewLatex: "\\infty", insertLatex: "\\infty" },
    ],
  },
  {
    title: "Trigonometry",
    tone: "main",
    items: [
      { previewLatex: "\\sin", insertLatex: "\\sin\\left(#0\\right)" },
      { previewLatex: "\\cos", insertLatex: "\\cos\\left(#0\\right)" },
      { previewLatex: "\\tan", insertLatex: "\\tan\\left(#0\\right)" },
      { previewLatex: "\\sec", insertLatex: "\\sec\\left(#0\\right)" },
      { previewLatex: "\\csc", insertLatex: "\\csc\\left(#0\\right)" },
      { previewLatex: "\\cot", insertLatex: "\\cot\\left(#0\\right)" },
    ],
  },
  {
    title: "Functions",
    tone: "secondary",
    items: [
      { previewLatex: "\\log", insertLatex: "\\log\\left(#0\\right)", width: "wide" },
      { previewLatex: "\\ln", insertLatex: "\\ln\\left(#0\\right)", width: "wide" },
      { previewLatex: "\\exp", insertLatex: "\\exp\\left(#0\\right)", width: "wide" },
    ],
  },
  {
    title: "Calculus",
    tone: "warm",
    items: [
      { previewLatex: "\\lim", insertLatex: "\\lim_{#0\\to #0}" },
      { previewLatex: "\\sum", insertLatex: "\\sum_{#0}^{#0}" },
      { previewLatex: "\\prod", insertLatex: "\\prod_{#0}^{#0}" },
      { previewLatex: "\\int", insertLatex: "\\int_{#0}^{#0}" },
      { previewLatex: "\\partial", insertLatex: "\\partial" },
      { previewLatex: "\\nabla", insertLatex: "\\nabla" },
    ],
  },
];
const EQUATION_PALETTE_TONE_CLASS: Record<EquationPaletteGroup["tone"], string> = {
  main: styles.equationSymbolChipMain,
  accent: styles.equationSymbolChipAccent,
  muted: styles.equationSymbolChipMuted,
  secondary: styles.equationSymbolChipSecondary,
  warm: styles.equationSymbolChipWarm,
  soft: styles.equationSymbolChipSoft,
};

type EditorInstance = NonNullable<ReturnType<typeof useEditor>>;
type EditorExtension = NonNullable<
  NonNullable<Parameters<typeof useEditor>[0]>["extensions"]
>[number];
type EquationSession = {
  equationId: string;
  field: EquationMathFieldElement;
  rect: DOMRect;
};
type EquationInsertChain = {
  insertEquationBlock: (attrs: { id: string; latex: string }) => {
    run: () => boolean;
  };
};

function getBlockAttribute(editor: EditorInstance, attribute: "lineHeight" | "textAlign") {
  const paragraphValue = editor.getAttributes("paragraph")[attribute];

  if (typeof paragraphValue === "string" && paragraphValue.length > 0) {
    return paragraphValue;
  }

  const headingValue = editor.getAttributes("heading")[attribute];

  if (typeof headingValue === "string" && headingValue.length > 0) {
    return headingValue;
  }

  return null;
}

function getOrderedListType(editor: EditorInstance) {
  const orderedListType = editor.getAttributes("orderedList").type;

  if (typeof orderedListType !== "string" || orderedListType.length === 0) {
    return null;
  }

  return orderedListType.toLowerCase();
}

function getEquationAttribute(
  editor: EditorInstance,
  attribute: "fontSize" | "highlighted",
) {
  return editor.getAttributes("equationBlock")[attribute];
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function EquationPreview({
  className,
  latex,
}: {
  className?: string;
  latex: string;
}) {
  return createElement(
    "math-div",
    {
      className,
      mode: "displaystyle",
    },
    latex,
  );
}

export function EditorPane({
  lockIn,
  onToggleLockIn,
  noteId,
  note,
  pdfDocument = null,
  isDirty,
  onTitleChange,
  onBodyChange,
  onSave,
  onDelete,
  saveLabel = "Save note",
  titleLabel = "Note title",
  titlePlaceholder = "Untitled note",
  emptyStateTitle = "No note selected",
  emptyStateDescription = "Create a note from the left pane to start writing.",
}: EditorPaneProps) {
  const editorPaneRef = useRef<HTMLElement>(null);
  const toolbarRowRef = useRef<HTMLDivElement>(null);
  const equationPaletteRef = useRef<HTMLDivElement>(null);
  const activeEquationFieldRef = useRef<EquationMathFieldElement | null>(null);
  const bodyUpdateTimeoutRef = useRef<number | null>(null);
  const lastLocalBodyRef = useRef(note?.body ?? "<p></p>");
  const previousNoteIdRef = useRef<string | null>(noteId);
  const [useCompactToolbar, setUseCompactToolbar] = useState(false);
  const [isTableMenuOpen, setIsTableMenuOpen] = useState(false);
  const [isAlignMenuOpen, setIsAlignMenuOpen] = useState(false);
  const [isLineSpacingMenuOpen, setIsLineSpacingMenuOpen] = useState(false);
  const [isOverflowMenuOpen, setIsOverflowMenuOpen] = useState(false);
  const [isOverflowTableMenuOpen, setIsOverflowTableMenuOpen] = useState(false);
  const [isOverflowAlignMenuOpen, setIsOverflowAlignMenuOpen] = useState(false);
  const [isOverflowLineSpacingMenuOpen, setIsOverflowLineSpacingMenuOpen] =
    useState(false);
  const [isEquationPaletteOpen, setIsEquationPaletteOpen] = useState(false);
  const [equationPalettePosition, setEquationPalettePosition] = useState({
    x: 140,
    y: 180,
  });
  const [activeEquationId, setActiveEquationId] = useState<string | null>(null);
  const [autoFocusEquationId, setAutoFocusEquationId] = useState<string | null>(null);
  const [equationSession, setEquationSession] = useState<EquationSession | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const canEdit = Boolean(note) && !lockIn;
  const noteBody = note?.body ?? "<p></p>";
  const hasActiveEquationField = Boolean(activeEquationId) && canEdit;
  const isEquationPaletteVisible = isEquationPaletteOpen && canEdit && Boolean(noteId);
  const isPdfView = Boolean(pdfDocument) && !note;

  const getPaletteBounds = () => {
    const hostRect = editorPaneRef.current?.getBoundingClientRect();

    if (!hostRect) {
      return {
        left: 16,
        top: 16,
        right: window.innerWidth - 16,
        bottom: window.innerHeight - 16,
      };
    }

    return {
      left: hostRect.left + 16,
      top: hostRect.top + 16,
      right: hostRect.right - 16,
      bottom: hostRect.bottom - 16,
    };
  };

  const getInitialPalettePosition = (rect: DOMRect) => {
    const paletteWidth = Math.min(EQUATION_PALETTE_WIDTH, window.innerWidth - 32);
    const paletteHeight = Math.min(EQUATION_PALETTE_HEIGHT, window.innerHeight - 32);

    return {
      x: Math.min(
        Math.max(16, rect.right + 20),
        window.innerWidth - paletteWidth - 16,
      ),
      y: Math.min(
        Math.max(16, rect.top - 8),
        window.innerHeight - paletteHeight - 16,
      ),
    };
  };

  const clampPalettePosition = (nextX: number, nextY: number) => {
    const bounds = getPaletteBounds();
    const paletteRect = equationPaletteRef.current?.getBoundingClientRect();
    const paletteWidth = paletteRect?.width ?? 380;
    const paletteHeight = paletteRect?.height ?? 620;

    return {
      x: Math.min(Math.max(bounds.left, nextX), bounds.right - paletteWidth),
      y: Math.min(Math.max(bounds.top, nextY), bounds.bottom - paletteHeight),
    };
  };

  const handleEquationEditStart = ({
    equationId,
    field,
    rect,
  }: EquationSession) => {
    setActiveEquationId(equationId);
    setEquationSession({ equationId, field, rect });
    setIsEquationPaletteOpen(true);
    setEquationPalettePosition(getInitialPalettePosition(rect));
  };

  const handleEquationEditEnd = (equationId: string) => {
    setActiveEquationId((current) =>
      current === equationId ? null : current,
    );
    setEquationSession((current) =>
      current?.equationId === equationId ? null : current,
    );
    setIsEquationPaletteOpen(false);
  };

  const lineHeightExtension = LineHeight.configure({
    types: ["heading", "paragraph"],
  }) as unknown as EditorExtension;

  const equationBlockExtension = EquationBlock.configure({
    autoFocusEquationId,
    clearAutoFocusEquationId: (equationId) =>
      setAutoFocusEquationId((current) =>
        current === equationId ? null : current,
      ),
    onEquationEditEnd: handleEquationEditEnd,
    onEquationEditStart: handleEquationEditStart,
  }) as unknown as EditorExtension;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: false }),
      TextStyle,
      FontSize,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      lineHeightExtension,
      equationBlockExtension,
      Table.configure({
        renderWrapper: true,
        resizable: false,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: note?.body ?? "<p></p>",
    immediatelyRender: false,
    editable: canEdit,
    onUpdate: ({ editor: currentEditor }) => {
      if (bodyUpdateTimeoutRef.current) {
        window.clearTimeout(bodyUpdateTimeoutRef.current);
      }

      const body = currentEditor.getHTML();
      lastLocalBodyRef.current = body;
      bodyUpdateTimeoutRef.current = window.setTimeout(() => {
        onBodyChange(body);
      }, 100);
    },
  });

  useEffect(() => {
    return () => {
      if (bodyUpdateTimeoutRef.current) {
        window.clearTimeout(bodyUpdateTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    activeEquationFieldRef.current = equationSession?.field ?? null;
  }, [equationSession]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const syncEditorState = () => {
      setEditorRevision((current) => current + 1);
    };

    editor.on("selectionUpdate", syncEditorState);
    editor.on("transaction", syncEditorState);
    editor.on("focus", syncEditorState);
    editor.on("blur", syncEditorState);

    return () => {
      editor.off("selectionUpdate", syncEditorState);
      editor.off("transaction", syncEditorState);
      editor.off("focus", syncEditorState);
      editor.off("blur", syncEditorState);
    };
  }, [editor]);

  useEffect(() => {
    const node = toolbarRowRef.current;
    if (!node) {
      return;
    }

    const updateToolbarDensity = () => {
      const nextUseCompactToolbar = node.clientWidth < 1180;

      setUseCompactToolbar((current) => {
        if (current === nextUseCompactToolbar) {
          return current;
        }

        if (nextUseCompactToolbar) {
          setIsTableMenuOpen(false);
          setIsAlignMenuOpen(false);
          setIsLineSpacingMenuOpen(false);
        } else {
          setIsOverflowMenuOpen(false);
          setIsOverflowTableMenuOpen(false);
          setIsOverflowAlignMenuOpen(false);
          setIsOverflowLineSpacingMenuOpen(false);
        }

        return nextUseCompactToolbar;
      });
    };

    updateToolbarDensity();

    const observer = new ResizeObserver(updateToolbarDensity);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleDocumentClick = (event: globalThis.MouseEvent) => {
      const target = event.target as Element | null;

      if (!target?.closest("[data-editor-overflow-menu]")) {
        setIsOverflowMenuOpen(false);
        setIsOverflowTableMenuOpen(false);
        setIsOverflowAlignMenuOpen(false);
        setIsOverflowLineSpacingMenuOpen(false);
      }

      if (!target?.closest("[data-editor-table-menu]")) {
        setIsTableMenuOpen(false);
      }

      if (!target?.closest("[data-editor-align-menu]")) {
        setIsAlignMenuOpen(false);
      }

      if (!target?.closest("[data-editor-line-spacing-menu]")) {
        setIsLineSpacingMenuOpen(false);
      }
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(canEdit);
  }, [canEdit, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const noteChanged = previousNoteIdRef.current !== noteId;
    const externalBodyChange = lastLocalBodyRef.current !== noteBody;

    if (!noteChanged && !externalBodyChange) {
      return;
    }

    previousNoteIdRef.current = noteId;

    if (!noteId) {
      if (bodyUpdateTimeoutRef.current) {
        window.clearTimeout(bodyUpdateTimeoutRef.current);
        bodyUpdateTimeoutRef.current = null;
      }

      lastLocalBodyRef.current = "<p></p>";
      editor.commands.setContent("<p></p>", { emitUpdate: false });
      return;
    }

    if (bodyUpdateTimeoutRef.current) {
      window.clearTimeout(bodyUpdateTimeoutRef.current);
      bodyUpdateTimeoutRef.current = null;
    }

    lastLocalBodyRef.current = noteBody;

    if (editor.getHTML() !== noteBody) {
      editor.commands.setContent(noteBody, { emitUpdate: false });
    }
  }, [editor, noteBody, noteId]);

  const toolbarState = useMemo(
    () => {
      void editorRevision;

      const equationIsActive = editor ? editor.isActive("equationBlock") : false;
      const equationFontSize = editor
        ? Number.parseFloat(String(getEquationAttribute(editor, "fontSize") ?? ""))
        : Number.NaN;
      const equationHighlighted = editor
        ? Boolean(getEquationAttribute(editor, "highlighted"))
        : false;

      return {
        bold: editor ? editor.isActive("bold") : false,
        italic: editor ? editor.isActive("italic") : false,
        underline: editor ? editor.isActive("underline") : false,
        highlight: equationIsActive
          ? equationHighlighted
          : editor
            ? editor.isActive("highlight")
            : false,
        bulletList: editor ? editor.isActive("bulletList") : false,
        orderedList: editor ? editor.isActive("orderedList") : false,
        table: editor ? editor.isActive("table") : false,
        tableHeader: editor ? editor.isActive("tableHeader") : false,
        orderedListType: editor ? getOrderedListType(editor) : null,
        textAlign: editor
          ? getBlockAttribute(editor, "textAlign") ?? DEFAULT_TEXT_ALIGN
          : DEFAULT_TEXT_ALIGN,
        lineHeight: editor
          ? getBlockAttribute(editor, "lineHeight") ?? DEFAULT_LINE_HEIGHT
          : DEFAULT_LINE_HEIGHT,
        fontSize: equationIsActive
          ? equationFontSize || DEFAULT_FONT_SIZE
          : editor
            ? Number.parseFloat(editor.getAttributes("textStyle").fontSize || "") ||
              DEFAULT_FONT_SIZE
            : DEFAULT_FONT_SIZE,
      };
    },
    [editor, editorRevision],
  );

  const toolbarButtonClass = ({
    active = false,
    disabled = false,
  }: {
    active?: boolean;
    disabled?: boolean;
  }) => {
    return `h-11 w-11 shrink-0 place-items-center rounded-xl border border-transparent transition-colors duration-150 ${
      disabled
        ? "cursor-not-allowed text-(--text-muted) opacity-45"
      : ""
    } ${
      active
        ? "bg-(--main) text-(--text-contrast) hover:bg-(--main-deep)"
        : "text-(--text-main) hover:bg-(--surface-main-soft)"
    }`;
  };

  const runToolbarCommand = (
    event: MouseEvent<HTMLButtonElement>,
    action: ToolbarAction,
  ) => {
    event.preventDefault();

    if (!editor || !canEdit) {
      return;
    }

    if (action === "bold") editor.chain().focus().toggleBold().run();
    if (action === "italic") editor.chain().focus().toggleItalic().run();
    if (action === "underline") editor.chain().focus().toggleUnderline().run();
    if (action === "highlight") {
      if (editor.isActive("equationBlock")) {
        editor.commands.updateAttributes("equationBlock", {
          highlighted: !toolbarState.highlight,
        });
        return;
      }

      editor.chain().focus().toggleHighlight().run();
    }
    if (action === "bulletList") editor.chain().focus().toggleBulletList().run();
    if (action === "orderedList") {
      const isNumberedListActive =
        editor.isActive("orderedList") && getOrderedListType(editor) !== "a";

      if (isNumberedListActive) {
        editor.chain().focus().toggleOrderedList().run();
        return;
      }

      editor
        .chain()
        .focus()
        .toggleOrderedList()
        .updateAttributes("orderedList", { type: null })
        .run();
    }

    if (action === "letteredList") {
      const isLetteredListActive =
        editor.isActive("orderedList") && getOrderedListType(editor) === "a";

      if (isLetteredListActive) {
        editor.chain().focus().toggleOrderedList().run();
        return;
      }

      editor
        .chain()
        .focus()
        .toggleOrderedList()
        .updateAttributes("orderedList", { type: "a" })
        .run();
    }
  };

  const increaseFontSize = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (!editor || !canEdit) {
      return;
    }

    const nextFontSize = Math.min(MAX_FONT_SIZE, Math.round(toolbarState.fontSize) + 1);

    if (editor.isActive("equationBlock")) {
      editor.commands.updateAttributes("equationBlock", {
        fontSize: `${nextFontSize}px`,
      });
      return;
    }

    editor.chain().focus().setFontSize(`${nextFontSize}px`).run();
  };

  const applyTextAlign = (
    event: MouseEvent<HTMLButtonElement>,
    value: (typeof TEXT_ALIGN_OPTIONS)[number]["value"],
  ) => {
    event.preventDefault();

    if (!editor || !canEdit) {
      return;
    }

    editor.chain().focus().setTextAlign(value).run();
  };

  const applyLineHeight = (
    event: MouseEvent<HTMLButtonElement>,
    value: LineHeightValue,
  ) => {
    event.preventDefault();

    if (!editor || !canEdit) {
      return;
    }

    editor.chain().focus().setLineHeight(value).run();
  };

  const insertEquationLatex = (latex: string) => {
    const field = activeEquationFieldRef.current;

    if (!field) {
      return;
    }

    field.insert(latex, {
      focus: true,
      scrollIntoView: true,
      selectionMode: "placeholder",
    });
    field.focus();
  };

  const openEquationEditor = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (!editor || !canEdit) {
      return;
    }

    const equationId = `equation-${crypto.randomUUID()}`;
    setAutoFocusEquationId(equationId);

    (editor.chain().focus() as unknown as EquationInsertChain)
      .insertEquationBlock({
        id: equationId,
        latex: "",
      })
      .run();

    closeOverflowMenus();
  };

  const canRunTableAction = (action: TableAction) => {
    if (!editor || !canEdit) {
      return false;
    }

    const chain = editor.can().chain().focus();

    if (action === "insertTable") {
      return chain
        .insertTable({
          rows: 3,
          cols: 3,
          withHeaderRow: true,
        })
        .run();
    }

    if (action === "addRowBefore") return chain.addRowBefore().run();
    if (action === "addRowAfter") return chain.addRowAfter().run();
    if (action === "deleteRow") return chain.deleteRow().run();
    if (action === "addColumnBefore") return chain.addColumnBefore().run();
    if (action === "addColumnAfter") return chain.addColumnAfter().run();
    if (action === "deleteColumn") return chain.deleteColumn().run();
    if (action === "toggleHeaderRow") return chain.toggleHeaderRow().run();
    if (action === "deleteTable") return chain.deleteTable().run();

    return false;
  };

  const runTableCommand = (
    event: MouseEvent<HTMLButtonElement>,
    action: TableAction,
  ) => {
    event.preventDefault();

    if (!editor || !canEdit) {
      return;
    }

    const chain = editor.chain().focus();

    if (action === "insertTable") {
      chain
        .insertTable({
          rows: 3,
          cols: 3,
          withHeaderRow: true,
        })
        .run();
      return;
    }

    if (action === "addRowBefore") chain.addRowBefore().run();
    if (action === "addRowAfter") chain.addRowAfter().run();
    if (action === "deleteRow") chain.deleteRow().run();
    if (action === "addColumnBefore") chain.addColumnBefore().run();
    if (action === "addColumnAfter") chain.addColumnAfter().run();
    if (action === "deleteColumn") chain.deleteColumn().run();
    if (action === "toggleHeaderRow") chain.toggleHeaderRow().run();
    if (action === "deleteTable") chain.deleteTable().run();
  };

  const tableControlClass = ({
    active = false,
    disabled = false,
    destructive = false,
  }: {
    active?: boolean;
    disabled?: boolean;
    destructive?: boolean;
  }) => {
    if (disabled) {
      return "flex w-full cursor-not-allowed items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-(--text-muted) opacity-45";
    }

    if (active) {
      return "flex w-full items-center gap-2 rounded-xl bg-(--main) px-3 py-2 text-left text-sm text-(--text-contrast) transition-colors duration-150 hover:bg-(--main-deep)";
    }

    if (destructive) {
      return "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-600 transition-colors duration-150 hover:bg-red-50";
    }

    return "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-(--text-main) transition-colors duration-150 hover:bg-(--surface-main-soft)";
  };

  const closeDesktopTableMenu = () => {
    setIsTableMenuOpen(false);
  };

  const closeDesktopAlignMenu = () => {
    setIsAlignMenuOpen(false);
  };

  const closeDesktopLineSpacingMenu = () => {
    setIsLineSpacingMenuOpen(false);
  };

  const closeOverflowMenus = () => {
    setIsOverflowMenuOpen(false);
    setIsOverflowTableMenuOpen(false);
    setIsOverflowAlignMenuOpen(false);
    setIsOverflowLineSpacingMenuOpen(false);
  };

  const handleEquationPaletteDragStart = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!isEquationPaletteVisible || event.button !== 0) {
      return;
    }

    event.preventDefault();

    const paletteRect = equationPaletteRef.current?.getBoundingClientRect();

    if (!paletteRect) {
      return;
    }

    const offsetX = event.clientX - paletteRect.left;
    const offsetY = event.clientY - paletteRect.top;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      setEquationPalettePosition(
        clampPalettePosition(
          moveEvent.clientX - offsetX,
          moveEvent.clientY - offsetY,
        ),
      );
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handleTableAction =
    (action: TableAction, closeMenu: () => void) =>
    (event: MouseEvent<HTMLButtonElement>) => {
      runTableCommand(event, action);
      closeMenu();
    };

  const handleOverflowTableFocus = () => {
    setIsOverflowTableMenuOpen(true);
  };

  const handleOverflowTableBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;

    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsOverflowTableMenuOpen(false);
  };

  const handleOverflowAlignFocus = () => {
    setIsOverflowAlignMenuOpen(true);
  };

  const handleOverflowAlignBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;

    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsOverflowAlignMenuOpen(false);
  };

  const handleOverflowLineSpacingFocus = () => {
    setIsOverflowLineSpacingMenuOpen(true);
  };

  const handleOverflowLineSpacingBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;

    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsOverflowLineSpacingMenuOpen(false);
  };

  const toggleDesktopMenu = (
    setter: Dispatch<SetStateAction<boolean>>,
  ) => {
    setIsTableMenuOpen(false);
    setIsAlignMenuOpen(false);
    setIsLineSpacingMenuOpen(false);
    setter((current) => !current);
  };

  const alignMenu = (closeMenu: () => void) => (
    <div className="w-44 rounded-2xl border border-(--border-soft) bg-(--surface-base) p-1.5 shadow-(--shadow-floating)">
      {TEXT_ALIGN_OPTIONS.map((option) => (
        <button
          key={option.value}
          className={tableControlClass({
            active: toolbarState.textAlign === option.value,
            disabled: !canEdit,
          })}
          type="button"
          aria-label={option.label}
          aria-pressed={toolbarState.textAlign === option.value}
          aria-disabled={!canEdit}
          disabled={!canEdit}
          onMouseDown={(event) => {
            applyTextAlign(event, option.value);
            closeMenu();
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  const lineSpacingMenu = (closeMenu: () => void) => (
    <div className="w-36 rounded-2xl border border-(--border-soft) bg-(--surface-base) p-1.5 shadow-(--shadow-floating)">
      {LINE_HEIGHT_OPTIONS.map((option) => (
        <button
          key={option.value}
          className={tableControlClass({
            active: toolbarState.lineHeight === option.value,
            disabled: !canEdit,
          })}
          type="button"
          aria-label={`Line spacing ${option.label}`}
          aria-pressed={toolbarState.lineHeight === option.value}
          aria-disabled={!canEdit}
          disabled={!canEdit}
          onMouseDown={(event) => {
            applyLineHeight(event, option.value);
            closeMenu();
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  const tableMenu = (closeMenu: () => void) => (
    <div className="w-52 rounded-2xl border border-(--border-soft) bg-(--surface-base) p-1.5 shadow-(--shadow-floating)">
      <button
        className={tableControlClass({ disabled: !canRunTableAction("insertTable") })}
        type="button"
        aria-label="Insert table"
        aria-disabled={!canRunTableAction("insertTable")}
        disabled={!canRunTableAction("insertTable")}
        onMouseDown={handleTableAction("insertTable", closeMenu)}
      >
        <TableCellsIcon className="h-4 w-4" aria-hidden="true" />
        Insert 3x3 table
      </button>
      <button
        className={tableControlClass({ disabled: !canRunTableAction("addRowBefore") })}
        type="button"
        aria-label="Add row above"
        aria-disabled={!canRunTableAction("addRowBefore")}
        disabled={!canRunTableAction("addRowBefore")}
        onMouseDown={handleTableAction("addRowBefore", closeMenu)}
      >
        Add row above
      </button>
      <button
        className={tableControlClass({ disabled: !canRunTableAction("addRowAfter") })}
        type="button"
        aria-label="Add row below"
        aria-disabled={!canRunTableAction("addRowAfter")}
        disabled={!canRunTableAction("addRowAfter")}
        onMouseDown={handleTableAction("addRowAfter", closeMenu)}
      >
        Add row below
      </button>
      <button
        className={tableControlClass({ disabled: !canRunTableAction("deleteRow") })}
        type="button"
        aria-label="Delete row"
        aria-disabled={!canRunTableAction("deleteRow")}
        disabled={!canRunTableAction("deleteRow")}
        onMouseDown={handleTableAction("deleteRow", closeMenu)}
      >
        Delete row
      </button>
      <button
        className={tableControlClass({ disabled: !canRunTableAction("addColumnBefore") })}
        type="button"
        aria-label="Add column left"
        aria-disabled={!canRunTableAction("addColumnBefore")}
        disabled={!canRunTableAction("addColumnBefore")}
        onMouseDown={handleTableAction("addColumnBefore", closeMenu)}
      >
        Add column left
      </button>
      <button
        className={tableControlClass({ disabled: !canRunTableAction("addColumnAfter") })}
        type="button"
        aria-label="Add column right"
        aria-disabled={!canRunTableAction("addColumnAfter")}
        disabled={!canRunTableAction("addColumnAfter")}
        onMouseDown={handleTableAction("addColumnAfter", closeMenu)}
      >
        Add column right
      </button>
      <button
        className={tableControlClass({ disabled: !canRunTableAction("deleteColumn") })}
        type="button"
        aria-label="Delete column"
        aria-disabled={!canRunTableAction("deleteColumn")}
        disabled={!canRunTableAction("deleteColumn")}
        onMouseDown={handleTableAction("deleteColumn", closeMenu)}
      >
        Delete column
      </button>
      <button
        className={tableControlClass({
          active: toolbarState.tableHeader,
          disabled: !canRunTableAction("toggleHeaderRow"),
        })}
        type="button"
        aria-label="Toggle header row"
        aria-pressed={toolbarState.tableHeader}
        aria-disabled={!canRunTableAction("toggleHeaderRow")}
        disabled={!canRunTableAction("toggleHeaderRow")}
        onMouseDown={handleTableAction("toggleHeaderRow", closeMenu)}
      >
        Toggle header row
      </button>
      <button
        className={tableControlClass({
          destructive: true,
          disabled: !canRunTableAction("deleteTable"),
        })}
        type="button"
        aria-label="Delete table"
        aria-disabled={!canRunTableAction("deleteTable")}
        disabled={!canRunTableAction("deleteTable")}
        onMouseDown={handleTableAction("deleteTable", closeMenu)}
      >
        Delete table
      </button>
    </div>
  );

  const decreaseFontSize = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (!editor || !canEdit) {
      return;
    }

    const nextFontSize = Math.max(MIN_FONT_SIZE, Math.round(toolbarState.fontSize) - 1);

    if (editor.isActive("equationBlock")) {
      editor.commands.updateAttributes("equationBlock", {
        fontSize: `${nextFontSize}px`,
      });
      return;
    }

    editor.chain().focus().setFontSize(`${nextFontSize}px`).run();
  };

  return (
    <section
      ref={editorPaneRef}
      className="relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-(--surface-editor)"
    >
      {isEquationPaletteVisible ? (
        <div
          ref={equationPaletteRef}
          className={styles.equationPalette}
          style={{
            left: `${equationPalettePosition.x}px`,
            top: `${equationPalettePosition.y}px`,
          }}
        >
          <div
            className={styles.equationPaletteHeader}
            onPointerDown={handleEquationPaletteDragStart}
          >
            <div>
              <p className={styles.equationPaletteTitle}>Equation tools</p>
              <p className={styles.equationPaletteSubtitle}>Drag to reposition</p>
            </div>
            <button
              className={styles.equationPaletteClose}
              type="button"
              aria-label="Close equation tools"
              onMouseDown={(event) => {
                event.preventDefault();
                setIsEquationPaletteOpen(false);
              }}
            >
              Cancel
            </button>
          </div>
          <div className={styles.equationPaletteBody}>
            {EQUATION_PALETTE_GROUPS.map((group) => (
              <section className={styles.equationPaletteSection} key={group.title}>
                <h3 className={styles.equationPaletteSectionTitle}>{group.title}</h3>
                <div className={styles.equationPaletteGrid}>
                  {group.items.map((item) => (
                    <button
                      key={`${group.title}-${item.previewLatex}`}
                      className={`${styles.equationSymbolChip} ${EQUATION_PALETTE_TONE_CLASS[group.tone]} ${
                        item.width === "wide" ? styles.equationSymbolChipWide : ""
                      }`}
                      type="button"
                      aria-disabled={!hasActiveEquationField}
                      disabled={!hasActiveEquationField}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        insertEquationLatex(item.insertLatex);
                      }}
                    >
                      <EquationPreview
                        className={styles.equationSymbolChipPreview}
                        latex={item.previewLatex}
                      />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : null}
      {!isPdfView ? (
        <div
          ref={toolbarRowRef}
          className="absolute top-4 left-1/2 z-20 hidden w-[calc(100%-32px)] max-w-[1400px] -translate-x-1/2 items-center justify-center gap-3 md:flex"
        >
          <div
            className={`flex max-w-full items-center gap-1 rounded-[20px] bg-(--surface-toolbar-float) px-3 py-2 shadow-(--shadow-floating) backdrop-blur-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              useCompactToolbar ? "overflow-visible" : "overflow-x-auto"
            }`}
          >
            <button
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-transparent px-3 text-[15px] text-(--text-main) transition-colors duration-150 hover:bg-(--surface-main-soft)"
              type="button"
              aria-label="Select font family"
              disabled
            >
              <span>Clarika</span>
              <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="mx-2 h-8 w-px shrink-0 bg-(--border-soft)" aria-hidden="true" />
            <button
              className={`grid ${toolbarButtonClass({ disabled: !canEdit })}`}
              type="button"
              aria-label="Decrease font size"
              aria-disabled={!canEdit}
              disabled={!canEdit}
              onMouseDown={decreaseFontSize}
            >
              <MinusIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="grid h-11 min-w-[58px] shrink-0 place-items-center rounded-xl border border-(--border-floating) bg-(--surface-base) px-3 text-lg font-semibold text-(--text-main)">
              {Math.round(toolbarState.fontSize)}
            </div>
            <button
              className={`grid ${toolbarButtonClass({ disabled: !canEdit })}`}
              type="button"
              aria-label="Increase font size"
              aria-disabled={!canEdit}
              disabled={!canEdit}
              onMouseDown={increaseFontSize}
            >
              <PlusIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="mx-2 h-8 w-px shrink-0 bg-(--border-soft)" aria-hidden="true" />
            <button
              className={`grid ${toolbarButtonClass({ active: toolbarState.bold, disabled: !canEdit })}`}
              type="button"
              aria-label="Bold"
              aria-pressed={toolbarState.bold}
              aria-disabled={!canEdit}
              disabled={!canEdit}
              onMouseDown={(event) => runToolbarCommand(event, "bold")}
            >
              <BoldIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              className={`grid ${toolbarButtonClass({ active: toolbarState.italic, disabled: !canEdit })}`}
              type="button"
              aria-label="Italic"
              aria-pressed={toolbarState.italic}
              aria-disabled={!canEdit}
              disabled={!canEdit}
              onMouseDown={(event) => runToolbarCommand(event, "italic")}
            >
              <ItalicIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              className={`grid ${toolbarButtonClass({ active: toolbarState.underline, disabled: !canEdit })}`}
              type="button"
              aria-label="Underline"
              aria-pressed={toolbarState.underline}
              aria-disabled={!canEdit}
              disabled={!canEdit}
              onMouseDown={(event) => runToolbarCommand(event, "underline")}
            >
              <UnderlineIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              className={`grid ${toolbarButtonClass({ disabled: true })}`}
              type="button"
              aria-label="Text color"
              aria-disabled="true"
              disabled
            >
              <SwatchIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              className={`grid ${toolbarButtonClass({
                active: toolbarState.highlight,
                disabled: !canEdit,
              })}`}
              type="button"
              aria-label="Text highlight"
              aria-pressed={toolbarState.highlight}
              aria-disabled={!canEdit}
              disabled={!canEdit}
              onMouseDown={(event) => runToolbarCommand(event, "highlight")}
            >
              <PaintBrushIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="mx-2 h-8 w-px shrink-0 bg-(--border-soft)" aria-hidden="true" />
            <button
              className={`${useCompactToolbar ? "hidden" : "grid"} ${toolbarButtonClass({ disabled: true })}`}
              type="button"
              aria-label="Insert image"
              aria-disabled="true"
              disabled
            >
              <PhotoIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              className={`${useCompactToolbar ? "hidden" : "grid"} ${toolbarButtonClass({
                active: isEquationPaletteVisible,
                disabled: !canEdit,
              })}`}
              type="button"
              aria-label="Insert equation"
              aria-pressed={isEquationPaletteVisible}
              aria-disabled={!canEdit}
              disabled={!canEdit}
              onMouseDown={openEquationEditor}
            >
              <span className="text-xl leading-none" aria-hidden="true">
                Σ
              </span>
            </button>
            <button
              className={`${useCompactToolbar ? "hidden" : "grid"} ${toolbarButtonClass({
                disabled: !canRunTableAction("insertTable"),
              })}`}
              type="button"
              aria-label="Insert table"
              aria-disabled={!canRunTableAction("insertTable")}
              disabled={!canRunTableAction("insertTable")}
              onMouseDown={(event) => runTableCommand(event, "insertTable")}
            >
              <TableCellsIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <div
              className={`relative ${useCompactToolbar ? "hidden" : "block"}`}
              data-editor-table-menu
            >
              <button
                className="flex h-11 items-center gap-1.5 rounded-xl border border-transparent px-3 text-[15px] text-(--text-main) transition-colors duration-150 hover:bg-(--surface-main-soft)"
                type="button"
                aria-label="Table"
                aria-expanded={isTableMenuOpen}
                onClick={() => toggleDesktopMenu(setIsTableMenuOpen)}
              >
                <span>Table</span>
                <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              {isTableMenuOpen ? (
                <div className="absolute top-[calc(100%+8px)] right-0 z-10">{tableMenu(closeDesktopTableMenu)}</div>
              ) : null}
            </div>
            <div
              className={`relative ${useCompactToolbar ? "hidden" : "block"}`}
              data-editor-align-menu
            >
              <button
                className={`grid ${toolbarButtonClass({
                  active: toolbarState.textAlign !== DEFAULT_TEXT_ALIGN,
                  disabled: !canEdit,
                })}`}
                type="button"
                aria-label="Align text"
                aria-expanded={isAlignMenuOpen}
                aria-disabled={!canEdit}
                disabled={!canEdit}
                onClick={() => toggleDesktopMenu(setIsAlignMenuOpen)}
              >
                <Bars3Icon className="h-5 w-5" aria-hidden="true" />
              </button>
              {isAlignMenuOpen ? (
                <div className="absolute top-[calc(100%+8px)] right-0 z-10">
                  {alignMenu(closeDesktopAlignMenu)}
                </div>
              ) : null}
            </div>
            <button
              className={`${useCompactToolbar ? "hidden" : "grid"} ${toolbarButtonClass({
                active: toolbarState.bulletList,
                disabled: !canEdit,
              })}`}
              type="button"
              aria-label="Bullet list"
              aria-pressed={toolbarState.bulletList}
              aria-disabled={!canEdit}
              disabled={!canEdit}
              onMouseDown={(event) => runToolbarCommand(event, "bulletList")}
            >
              <ListBulletIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              className={`${useCompactToolbar ? "hidden" : "grid"} ${toolbarButtonClass({
                active:
                  toolbarState.orderedList && toolbarState.orderedListType !== "a",
                disabled: !canEdit,
              })}`}
              type="button"
              aria-label="Numbered list"
              aria-pressed={
                toolbarState.orderedList && toolbarState.orderedListType !== "a"
              }
              aria-disabled={!canEdit}
              disabled={!canEdit}
              onMouseDown={(event) => runToolbarCommand(event, "orderedList")}
            >
              <NumberedListIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              className={`${useCompactToolbar ? "hidden" : "grid"} ${toolbarButtonClass({
                active:
                  toolbarState.orderedList && toolbarState.orderedListType === "a",
                disabled: !canEdit,
              })}`}
              type="button"
              aria-label="Lettered list"
              aria-pressed={
                toolbarState.orderedList && toolbarState.orderedListType === "a"
              }
              aria-disabled={!canEdit}
              disabled={!canEdit}
              onMouseDown={(event) => runToolbarCommand(event, "letteredList")}
            >
              <QueueListIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <div
              className={`relative ${useCompactToolbar ? "hidden" : "block"}`}
              data-editor-line-spacing-menu
            >
              <button
                className={`grid ${toolbarButtonClass({
                  active: toolbarState.lineHeight !== DEFAULT_LINE_HEIGHT,
                  disabled: !canEdit,
                })}`}
                type="button"
                aria-label="Line spacing"
                aria-expanded={isLineSpacingMenuOpen}
                aria-disabled={!canEdit}
                disabled={!canEdit}
                onClick={() => toggleDesktopMenu(setIsLineSpacingMenuOpen)}
              >
                <ArrowsUpDownIcon className="h-5 w-5" aria-hidden="true" />
              </button>
              {isLineSpacingMenuOpen ? (
                <div className="absolute top-[calc(100%+8px)] right-0 z-10">
                  {lineSpacingMenu(closeDesktopLineSpacingMenu)}
                </div>
              ) : null}
            </div>
            <span
              className={`mx-2 h-8 w-px shrink-0 bg-(--border-soft) ${useCompactToolbar ? "hidden" : "block"}`}
              aria-hidden="true"
            />
            <div
              className={`relative ${useCompactToolbar ? "block" : "hidden"}`}
              data-editor-overflow-menu
            >
              <button
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-transparent text-(--text-main) transition-colors duration-150 hover:bg-(--surface-main-soft)"
                type="button"
                aria-label="More tools"
                aria-expanded={isOverflowMenuOpen}
                onClick={() => {
                  setIsOverflowMenuOpen((current) => !current);
                  setIsOverflowTableMenuOpen(false);
                  setIsOverflowAlignMenuOpen(false);
                  setIsOverflowLineSpacingMenuOpen(false);
                }}
              >
                <EllipsisHorizontalIcon className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only">More tools</span>
              </button>
              {isOverflowMenuOpen ? (
                <div className="absolute top-[calc(100%+8px)] right-0 z-10 w-44 rounded-2xl border border-(--border-soft) bg-(--surface-base) p-1.5 shadow-(--shadow-floating)">
                  <button
                    className="flex w-full cursor-not-allowed items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-(--text-muted) opacity-45"
                    type="button"
                    aria-label="Insert image"
                    aria-disabled="true"
                    disabled
                  >
                    <PhotoIcon className="h-4 w-4" aria-hidden="true" />
                    Insert image
                  </button>
                  <button
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150 ${
                      isEquationPaletteVisible
                        ? "bg-(--main) text-(--text-contrast) hover:bg-(--main-deep)"
                        : "text-(--text-main) hover:bg-(--surface-main-soft)"
                    }`}
                    type="button"
                    aria-label="Insert equation"
                    aria-pressed={isEquationPaletteVisible}
                    aria-disabled={!canEdit}
                    disabled={!canEdit}
                    onMouseDown={openEquationEditor}
                  >
                    <span className="w-4 text-center text-base leading-none" aria-hidden="true">
                      Σ
                    </span>
                    Insert equation
                  </button>
                  <div
                    className="relative pr-2 -mr-2"
                    data-editor-overflow-table-menu
                    onBlur={handleOverflowTableBlur}
                    onFocus={handleOverflowTableFocus}
                    onMouseEnter={handleOverflowTableFocus}
                    onMouseLeave={() => setIsOverflowTableMenuOpen(false)}
                  >
                    <button
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-(--text-main) transition-colors duration-150 hover:bg-(--surface-main-soft)"
                      type="button"
                      aria-label="Table"
                      aria-expanded={isOverflowTableMenuOpen}
                      onClick={(event) => event.preventDefault()}
                      onFocus={handleOverflowTableFocus}
                    >
                      <span className="flex items-center gap-2">
                        <TableCellsIcon className="h-4 w-4" aria-hidden="true" />
                        Table
                      </span>
                      <ChevronDownIcon className="-rotate-90 h-4 w-4" aria-hidden="true" />
                    </button>
                    {isOverflowTableMenuOpen ? (
                      <div className="absolute top-0 left-full z-20">
                        {tableMenu(closeOverflowMenus)}
                      </div>
                    ) : null}
                  </div>
                  <div
                    className="relative pr-2 -mr-2"
                    data-editor-overflow-align-menu
                    onBlur={handleOverflowAlignBlur}
                    onFocus={handleOverflowAlignFocus}
                    onMouseEnter={handleOverflowAlignFocus}
                    onMouseLeave={() => setIsOverflowAlignMenuOpen(false)}
                  >
                    <button
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-(--text-main) transition-colors duration-150 hover:bg-(--surface-main-soft)"
                      type="button"
                      aria-label="Align text"
                      aria-expanded={isOverflowAlignMenuOpen}
                      aria-disabled={!canEdit}
                      disabled={!canEdit}
                      onClick={(event) => event.preventDefault()}
                      onFocus={handleOverflowAlignFocus}
                    >
                      <span className="flex items-center gap-2">
                        <Bars3Icon className="h-4 w-4" aria-hidden="true" />
                        Align text
                      </span>
                      <ChevronDownIcon className="-rotate-90 h-4 w-4" aria-hidden="true" />
                    </button>
                    {isOverflowAlignMenuOpen ? (
                      <div className="absolute top-0 left-full z-20">
                        {alignMenu(closeOverflowMenus)}
                      </div>
                    ) : null}
                  </div>
                  <button
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150 ${
                      toolbarState.bulletList
                        ? "bg-(--main) text-(--text-contrast) hover:bg-(--main-deep)"
                        : "text-(--text-main) hover:bg-(--surface-main-soft)"
                    }`}
                    type="button"
                    aria-label="Bullet list"
                    aria-pressed={toolbarState.bulletList}
                    aria-disabled={!canEdit}
                    disabled={!canEdit}
                    onMouseDown={(event) => runToolbarCommand(event, "bulletList")}
                  >
                    <ListBulletIcon className="h-4 w-4" aria-hidden="true" />
                    Bullet list
                  </button>
                  <button
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150 ${
                      toolbarState.orderedList && toolbarState.orderedListType !== "a"
                        ? "bg-(--main) text-(--text-contrast) hover:bg-(--main-deep)"
                        : "text-(--text-main) hover:bg-(--surface-main-soft)"
                    }`}
                    type="button"
                    aria-label="Numbered list"
                    aria-pressed={
                      toolbarState.orderedList && toolbarState.orderedListType !== "a"
                    }
                    aria-disabled={!canEdit}
                    disabled={!canEdit}
                    onMouseDown={(event) => runToolbarCommand(event, "orderedList")}
                  >
                    <NumberedListIcon className="h-4 w-4" aria-hidden="true" />
                    Numbered list
                  </button>
                  <button
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150 ${
                      toolbarState.orderedList && toolbarState.orderedListType === "a"
                        ? "bg-(--main) text-(--text-contrast) hover:bg-(--main-deep)"
                        : "text-(--text-main) hover:bg-(--surface-main-soft)"
                    }`}
                    type="button"
                    aria-label="Lettered list"
                    aria-pressed={
                      toolbarState.orderedList && toolbarState.orderedListType === "a"
                    }
                    aria-disabled={!canEdit}
                    disabled={!canEdit}
                    onMouseDown={(event) => runToolbarCommand(event, "letteredList")}
                  >
                    <QueueListIcon className="h-4 w-4" aria-hidden="true" />
                    Lettered list
                  </button>
                  <div
                    className="relative pr-2 -mr-2"
                    data-editor-overflow-line-spacing-menu
                    onBlur={handleOverflowLineSpacingBlur}
                    onFocus={handleOverflowLineSpacingFocus}
                    onMouseEnter={handleOverflowLineSpacingFocus}
                    onMouseLeave={() => setIsOverflowLineSpacingMenuOpen(false)}
                  >
                    <button
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-(--text-main) transition-colors duration-150 hover:bg-(--surface-main-soft)"
                      type="button"
                      aria-label="Line spacing"
                      aria-expanded={isOverflowLineSpacingMenuOpen}
                      aria-disabled={!canEdit}
                      disabled={!canEdit}
                      onClick={(event) => event.preventDefault()}
                      onFocus={handleOverflowLineSpacingFocus}
                    >
                      <span className="flex items-center gap-2">
                        <ArrowsUpDownIcon className="h-4 w-4" aria-hidden="true" />
                        Line spacing
                      </span>
                      <ChevronDownIcon className="-rotate-90 h-4 w-4" aria-hidden="true" />
                    </button>
                    {isOverflowLineSpacingMenuOpen ? (
                      <div className="absolute top-0 left-full z-20">
                        {lineSpacingMenu(closeOverflowMenus)}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
            <button
              className={`grid ${toolbarButtonClass({ disabled: true })}`}
              type="button"
              aria-label="Preview"
              aria-disabled="true"
              disabled
            >
              <EyeIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <button
            aria-pressed={lockIn}
            className={`inline-flex h-14 items-center gap-2 rounded-2xl px-4 text-[15px] font-medium transition-all duration-200 ${
              lockIn
                ? "bg-(--main) text-(--text-contrast) shadow-(--shadow-accent)"
                : "bg-(--surface-toolbar-float) text-(--text-main) shadow-(--shadow-floating)"
            }`}
            onClick={onToggleLockIn}
            type="button"
          >
            <LockClosedIcon className="h-5 w-5" aria-hidden="true" />
            Lock in
          </button>
        </div>
      ) : null}

      <div
        className="relative z-10 flex-1 overflow-auto overscroll-auto"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className={isPdfView ? "h-full" : "min-h-full pt-7 pb-10 md:pt-28"}>
          <div
            className={`min-h-full w-full bg-(--surface-editor-card) backdrop-blur-xl ${
              isPdfView ? "h-full" : ""
            }`}
          >
            <div
              className={`${isPdfView ? "h-full p-0" : "px-8 pt-11 pb-14 max-[860px]:px-[18px]"} ${
                lockIn
                  ? "[font-family:'Sans_Forgetica','Trebuchet_MS','Segoe_UI',sans-serif]"
                  : ""
              }`}
            >
              {note ? (
                <>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="mono-label text-[12px] font-medium uppercase tracking-[0.15em] text-(--main)">
                      {isDirty ? "Unsaved changes" : "Saved"}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-xl border border-(--border-soft) bg-(--surface-base) px-3 py-2 text-sm text-(--text-main) transition-colors duration-150 hover:bg-(--surface-main-faint)"
                        onClick={onSave}
                        type="button"
                      >
                        {saveLabel}
                      </button>
                      <button
                        className="inline-flex items-center gap-1 rounded-xl border border-(--border-soft) bg-(--surface-base) px-3 py-2 text-sm text-(--text-muted) transition-colors duration-150 hover:bg-(--surface-main-faint) hover:text-(--text-main)"
                        onClick={onDelete}
                        type="button"
                      >
                        <TrashIcon className="h-4 w-4" aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                  </div>

                  <label className="sr-only" htmlFor="note-title-input">
                    {titleLabel}
                  </label>
                  <input
                    id="note-title-input"
                    className="w-full border-0 bg-transparent p-0 font-[Georgia,'Times_New_Roman',serif] text-[clamp(2rem,5vw,3.6rem)] leading-[0.98] text-(--text-main) outline-none"
                    onChange={(event) => onTitleChange(event.target.value)}
                    placeholder={titlePlaceholder}
                    value={note.title}
                  />

                  <div className="mt-4 mb-6 text-sm text-(--text-muted)">
                    <span>Created {formatTimestamp(note.createdAt)}</span>
                    <span className="mx-2">•</span>
                    <span>Updated {formatTimestamp(note.updatedAt)}</span>
                  </div>

                  <div
                    className={`${styles.noteBodyEditor} min-h-[420px] rounded-[22px] bg-(--surface-base)`}
                  >
                    <EditorContent editor={editor} />
                  </div>
                </>
              ) : pdfDocument ? (
                <iframe
                  className="h-full min-h-full w-full border-0"
                  src={pdfDocument.dataUrl}
                  title={pdfDocument.title}
                />
              ) : (
                <div className="grid min-h-[320px] place-items-center rounded-[22px] border border-dashed border-(--border-soft) bg-(--surface-base)">
                  <div className="text-center">
                    <p className="m-0 text-lg text-(--text-main)">{emptyStateTitle}</p>
                    <p className="mt-2 mb-0 text-sm text-(--text-muted)">
                      {emptyStateDescription}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
