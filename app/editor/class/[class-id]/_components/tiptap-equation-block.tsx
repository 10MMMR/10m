"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react";
import "mathlive";
import {
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export type EquationMathFieldElement = HTMLElement & {
  className: string;
  defaultMode: string;
  mathVirtualKeyboardPolicy: string;
  menuItems: unknown[];
  placeholder: string;
  readOnly: boolean;
  smartFence: boolean;
  smartMode: boolean;
  smartSuperscript: boolean;
  value: string;
  focus: () => void;
  getValue: (format?: string) => string;
  insert: (
    value: string,
    options?: {
      focus?: boolean;
      scrollIntoView?: boolean;
      selectionMode?: "placeholder" | "after" | "before" | "item";
    },
  ) => void;
};

type MathfieldElementConstructor = {
  fontsDirectory?: string | null;
};

type EquationEditPayload = {
  equationId: string;
  field: EquationMathFieldElement;
  rect: DOMRect;
};

export type EquationBlockOptions = {
  HTMLAttributes: Record<string, string>;
  onEquationEditStart: (payload: EquationEditPayload) => void;
  onEquationEditEnd: (equationId: string) => void;
  autoFocusEquationId: string | null;
  clearAutoFocusEquationId: (equationId: string) => void;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    equationBlock: {
      insertEquationBlock: (attrs?: { id?: string; latex?: string }) => ReturnType;
    };
  }
}

function MathPreview({
  className,
  latex,
}: {
  className?: string;
  latex: string;
}) {
  return createElement(
    "math-span",
    {
      className,
      mode: "math",
    },
    latex,
  );
}

function EquationBlockView(props: ReactNodeViewProps) {
  const { editor, extension, node, selected, updateAttributes } = props;
  const options = extension.options as EquationBlockOptions;
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<EquationMathFieldElement | null>(null);
  const [isEditing, setIsEditing] = useState(
    () => options.autoFocusEquationId === String(node.attrs.id ?? ""),
  );

  const equationId = String(node.attrs.id ?? "");
  const fontSize = typeof node.attrs.fontSize === "string" ? node.attrs.fontSize : null;
  const highlighted = Boolean(node.attrs.highlighted);
  const latex = String(node.attrs.latex ?? "");
  const inlineStyle = {
    backgroundColor: highlighted ? "rgba(193, 140, 93, 0.28)" : undefined,
    borderRadius: highlighted ? "0.2em" : undefined,
    fontSize: fontSize ?? undefined,
    lineHeight: "inherit",
    padding: highlighted ? "0.04em 0.12em" : undefined,
  };

  const endEditing = useCallback(() => {
    setIsEditing(false);
    options.onEquationEditEnd(equationId);
  }, [equationId, options]);

  const startEditing = useCallback(() => {
    setIsEditing(true);
  }, []);

  useEffect(() => {
    const constructor = (
      globalThis as typeof globalThis & {
        MathfieldElement?: MathfieldElementConstructor;
      }
    ).MathfieldElement;

    if (!constructor || constructor.fontsDirectory === "/mathlive/fonts") {
      return;
    }

    constructor.fontsDirectory = "/mathlive/fonts";
  }, []);

  useEffect(() => {
    if (!isEditing) {
      fieldRef.current = null;
      return;
    }

    const host = editorHostRef.current;

    if (!host) {
      return;
    }

    host.innerHTML = "";

    const field = document.createElement("math-field") as EquationMathFieldElement;
    field.className = "equation-block-field";

    const handleInput = () => {
      updateAttributes({
        latex: field.getValue("latex"),
      });
    };

    const handleBlur = () => {
      window.requestAnimationFrame(() => {
        if (field.matches(":focus-within")) {
          return;
        }

        endEditing();
      });
    };

    host.append(field);
    fieldRef.current = field;

    field.addEventListener("input", handleInput);
    field.addEventListener("blur", handleBlur);

    window.requestAnimationFrame(() => {
      field.defaultMode = "math";
      field.mathVirtualKeyboardPolicy = "manual";
      field.menuItems = [];
      field.placeholder = "\\placeholder{}";
      field.readOnly = false;
      field.smartFence = true;
      field.smartMode = true;
      field.smartSuperscript = true;
      field.value = latex;
      field.focus();
      options.onEquationEditStart({
        equationId,
        field,
        rect: host.getBoundingClientRect(),
      });

      if (options.autoFocusEquationId === equationId) {
        options.clearAutoFocusEquationId(equationId);
      }
    });

    return () => {
      field.removeEventListener("input", handleInput);
      field.removeEventListener("blur", handleBlur);
      host.innerHTML = "";
      fieldRef.current = null;
    };
  }, [equationId, isEditing, latex, options, updateAttributes, endEditing]);

  const handlePreviewClick = () => {
    if (!editor.isEditable) {
      return;
    }

    if (selected) {
      startEditing();
    }
  };

  return (
    <NodeViewWrapper
      as="span"
      className={`equation-block-node ${isEditing ? "equation-block-node-editing" : ""}`}
      data-equation-block=""
      data-equation-id={equationId}
      style={inlineStyle}
    >
      {isEditing ? (
        <span className="equation-block-editor-shell">
          <span className="equation-block-editor-host" ref={editorHostRef} />
        </span>
      ) : (
        <span
          className={`equation-block-preview-button ${
            editor.isEditable ? "" : "equation-block-preview-button-disabled"
          }`}
          onClick={handlePreviewClick}
          onDoubleClick={(event) => {
            event.preventDefault();

            if (!editor.isEditable) {
              return;
            }

            startEditing();
          }}
          role={editor.isEditable ? "button" : undefined}
          tabIndex={editor.isEditable ? 0 : undefined}
        >
          {latex ? (
            <MathPreview className="equation-block-preview" latex={latex} />
          ) : (
            <span className="equation-block-empty-label">Type an equation</span>
          )}
        </span>
      )}
    </NodeViewWrapper>
  );
}

export const EquationBlock = Node.create<EquationBlockOptions>({
  name: "equationBlock",

  group: "inline",

  marks: "_",

  inline: true,

  atom: true,

  selectable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      onEquationEditStart: () => {},
      onEquationEditEnd: () => {},
      autoFocusEquationId: null,
      clearAutoFocusEquationId: () => {},
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-equation-id"),
        renderHTML: (attributes) => {
          if (!attributes.id) {
            return {};
          }

          return {
            "data-equation-id": attributes.id,
          };
        },
      },
      latex: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-equation-latex") ?? "",
        renderHTML: (attributes) => ({
          "data-equation-latex": attributes.latex ?? "",
        }),
      },
      fontSize: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-equation-font-size"),
        renderHTML: (attributes) => {
          if (!attributes.fontSize) {
            return {};
          }

          return {
            "data-equation-font-size": attributes.fontSize,
          };
        },
      },
      highlighted: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-equation-highlighted") === "true",
        renderHTML: (attributes) => {
          if (!attributes.highlighted) {
            return {};
          }

          return {
            "data-equation-highlighted": "true",
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-equation-block]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-equation-block": "",
      }),
    ];
  },

  addCommands() {
    return {
      insertEquationBlock:
        (attrs = {}) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              id: attrs.id ?? crypto.randomUUID(),
              latex: attrs.latex ?? "",
            },
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(EquationBlockView) as never;
  },
});
