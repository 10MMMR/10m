"use client";

import Highlight from "@tiptap/extension-highlight";
import { FontSize, TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
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
  PaintBrushIcon,
  PhotoIcon,
  PlusIcon,
  SwatchIcon,
  TableCellsIcon,
  TrashIcon,
  UnderlineIcon,
} from "@heroicons/react/24/outline";

type EditableDocument = {
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

type EditorPaneProps = {
  lockIn: boolean;
  onToggleLockIn: () => void;
  note: EditableDocument | null;
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
  | "lineSpacing"
  | "preview";

const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 40;
const DEFAULT_FONT_SIZE = 17;

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

export function EditorPane({
  lockIn,
  onToggleLockIn,
  note,
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
  const toolbarRowRef = useRef<HTMLDivElement>(null);
  const bodyUpdateTimeoutRef = useRef<number | null>(null);
  const [useCompactToolbar, setUseCompactToolbar] = useState(false);
  const [editorRevision, setEditorRevision] = useState(0);
  const canEdit = Boolean(note) && !lockIn;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight.configure({ multicolor: false }),
      TextStyle,
      FontSize,
    ],
    content: note?.body ?? "<p></p>",
    immediatelyRender: false,
    editable: canEdit,
    onUpdate: ({ editor: currentEditor }) => {
      if (bodyUpdateTimeoutRef.current) {
        window.clearTimeout(bodyUpdateTimeoutRef.current);
      }

      const body = currentEditor.getHTML();
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
      setUseCompactToolbar(node.clientWidth < 1180);
    };

    updateToolbarDensity();

    const observer = new ResizeObserver(updateToolbarDensity);
    observer.observe(node);

    return () => observer.disconnect();
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

    if (!note) {
      editor.commands.setContent("<p></p>", { emitUpdate: false });
      return;
    }

    if (editor.getHTML() !== note.body) {
      editor.commands.setContent(note.body, { emitUpdate: false });
    }
  }, [editor, note]);

  const toolbarState = useMemo(
    () => {
      void editorRevision;

      return {
        bold: editor ? editor.isActive("bold") : false,
        italic: editor ? editor.isActive("italic") : false,
        underline: editor ? editor.isActive("underline") : false,
        highlight: editor ? editor.isActive("highlight") : false,
        bulletList: editor ? editor.isActive("bulletList") : false,
        fontSize: editor
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
    if (action === "highlight") editor.chain().focus().toggleHighlight().run();
    if (action === "bulletList") editor.chain().focus().toggleBulletList().run();
  };

  const increaseFontSize = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (!editor || !canEdit) {
      return;
    }

    const nextFontSize = Math.min(MAX_FONT_SIZE, Math.round(toolbarState.fontSize) + 1);
    editor.chain().focus().setFontSize(`${nextFontSize}px`).run();
  };

  const decreaseFontSize = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (!editor || !canEdit) {
      return;
    }

    const nextFontSize = Math.max(MIN_FONT_SIZE, Math.round(toolbarState.fontSize) - 1);
    editor.chain().focus().setFontSize(`${nextFontSize}px`).run();
  };

  return (
    <section className="relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-(--surface-editor)">
      <div
        ref={toolbarRowRef}
        className="absolute top-4 left-1/2 z-20 hidden w-[calc(100%-32px)] max-w-[1400px] -translate-x-1/2 items-center justify-center gap-3 md:flex"
      >
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-[20px] bg-(--surface-toolbar-float) px-3 py-2 shadow-(--shadow-floating) backdrop-blur-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
            className={`${useCompactToolbar ? "hidden" : "grid"} ${toolbarButtonClass({ disabled: true })}`}
            type="button"
            aria-label="Insert table"
            aria-disabled="true"
            disabled
          >
            <TableCellsIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            className={`${useCompactToolbar ? "hidden" : "grid"} ${toolbarButtonClass({ disabled: true })}`}
            type="button"
            aria-label="Align text"
            aria-disabled="true"
            disabled
          >
            <Bars3Icon className="h-5 w-5" aria-hidden="true" />
          </button>
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
            className={`${useCompactToolbar ? "hidden" : "grid"} ${toolbarButtonClass({ disabled: true })}`}
            type="button"
            aria-label="Line spacing"
            aria-disabled="true"
            disabled
          >
            <ArrowsUpDownIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <span
            className={`mx-2 h-8 w-px shrink-0 bg-(--border-soft) ${useCompactToolbar ? "hidden" : "block"}`}
            aria-hidden="true"
          />
          <details className={`relative ${useCompactToolbar ? "block" : "hidden"}`}>
            <summary className="grid h-11 w-11 shrink-0 cursor-pointer list-none place-items-center rounded-xl border border-transparent text-(--text-main) transition-colors duration-150 hover:bg-(--surface-main-soft)">
              <EllipsisHorizontalIcon className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">More tools</span>
            </summary>
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
                className="flex w-full cursor-not-allowed items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-(--text-muted) opacity-45"
                type="button"
                aria-label="Insert table"
                aria-disabled="true"
                disabled
              >
                <TableCellsIcon className="h-4 w-4" aria-hidden="true" />
                Insert table
              </button>
              <button
                className="flex w-full cursor-not-allowed items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-(--text-muted) opacity-45"
                type="button"
                aria-label="Align text"
                aria-disabled="true"
                disabled
              >
                <Bars3Icon className="h-4 w-4" aria-hidden="true" />
                Align text
              </button>
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
                className="flex w-full cursor-not-allowed items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-(--text-muted) opacity-45"
                type="button"
                aria-label="Line spacing"
                aria-disabled="true"
                disabled
              >
                <ArrowsUpDownIcon className="h-4 w-4" aria-hidden="true" />
                Line spacing
              </button>
            </div>
          </details>
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

      <div
        className="relative z-10 flex-1 overflow-auto overscroll-auto"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="min-h-full pt-7 pb-10 md:pt-28">
          <div className="min-h-full w-full bg-(--surface-editor-card) backdrop-blur-xl">
            <div
              className={`px-8 pt-11 pb-14 max-[860px]:px-[18px] ${
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

                  <div className="note-body-editor min-h-[420px] rounded-[22px] bg-(--surface-base)">
                    <EditorContent editor={editor} />
                  </div>
                </>
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
