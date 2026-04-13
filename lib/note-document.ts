import type { JSONContent } from "@tiptap/core";

export type NoteDocument = JSONContent;

const BLOCK_NODES = new Set([
  "bulletList",
  "doc",
  "hardBreak",
  "heading",
  "listItem",
  "orderedList",
  "paragraph",
  "table",
  "tableCell",
  "tableHeader",
  "tableRow",
]);
const INLINE_NODES = new Set(["text", "equationBlock", "image", "inlineImage"]);
const FULL_NODE_TYPES = new Set([...BLOCK_NODES, ...INLINE_NODES]);
const AI_NODE_TYPES = new Set([...BLOCK_NODES, "text", "image", "inlineImage"]);
const FULL_MARK_TYPES = new Set(["bold", "highlight", "italic", "textStyle", "underline"]);
const AI_MARK_TYPES = new Set(["bold", "highlight", "italic", "underline"]);
const HEADING_LEVELS = new Set([1, 2, 3]);
const TEXT_ALIGNS = new Set(["left", "center", "right", "justify"]);
const LINE_HEIGHTS = new Set(["1.0", "1.5", "2.0"]);
const TABLE_CELL_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
]);

const EMPTY_PARAGRAPH: NoteDocument = {
  type: "paragraph",
};

export const EMPTY_NOTE_DOCUMENT: NoteDocument = {
  type: "doc",
  content: [EMPTY_PARAGRAPH],
};

export const AI_NOTE_DOCUMENT_JSON_SCHEMA = {
  $ref: "#/$defs/docNode",
  $defs: {
    textMark: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          type: "string",
          enum: ["bold", "highlight", "italic", "underline"],
        },
      },
      required: ["type"],
    },
    textNode: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          const: "text",
        },
        text: {
          type: "string",
          minLength: 1,
        },
        marks: {
          type: "array",
          items: {
            $ref: "#/$defs/textMark",
          },
        },
      },
      required: ["type", "text"],
    },
    hardBreakNode: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          const: "hardBreak",
        },
      },
      required: ["type"],
    },
    imageNode: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          enum: ["image", "inlineImage"],
        },
        attrs: {
          type: "object",
          additionalProperties: false,
          properties: {
            alt: {
              type: "string",
            },
            aspectRatio: {
              type: "number",
              exclusiveMinimum: 0,
            },
            mimeType: {
              type: "string",
            },
            src: {
              type: "string",
              minLength: 1,
            },
            storagePath: {
              type: "string",
            },
            title: {
              type: "string",
            },
            width: {
              type: "integer",
              minimum: 96,
              maximum: 1600,
            },
          },
          required: ["src"],
        },
      },
      required: ["type", "attrs"],
    },
    inlineNode: {
      anyOf: [
        {
          $ref: "#/$defs/textNode",
        },
        {
          $ref: "#/$defs/hardBreakNode",
        },
        {
          $ref: "#/$defs/imageNode",
        },
      ],
    },
    paragraphNode: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          const: "paragraph",
        },
        content: {
          type: "array",
          items: {
            $ref: "#/$defs/inlineNode",
          },
        },
      },
      required: ["type"],
    },
    headingNode: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          const: "heading",
        },
        attrs: {
          type: "object",
          additionalProperties: false,
          properties: {
            level: {
              type: "integer",
              enum: [1, 2, 3],
            },
          },
          required: ["level"],
        },
        content: {
          type: "array",
          minItems: 1,
          items: {
            $ref: "#/$defs/inlineNode",
          },
        },
      },
      required: ["type", "attrs", "content"],
    },
    listItemNode: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          const: "listItem",
        },
        content: {
          type: "array",
          minItems: 1,
          items: {
            $ref: "#/$defs/paragraphNode",
          },
        },
      },
      required: ["type", "content"],
    },
    bulletListNode: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          const: "bulletList",
        },
        content: {
          type: "array",
          minItems: 1,
          items: {
            $ref: "#/$defs/listItemNode",
          },
        },
      },
      required: ["type", "content"],
    },
    orderedListNode: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          const: "orderedList",
        },
        attrs: {
          type: "object",
          additionalProperties: false,
          properties: {
            start: {
              type: "integer",
            },
            type: {
              type: "string",
              enum: ["a"],
            },
          },
        },
        content: {
          type: "array",
          minItems: 1,
          items: {
            $ref: "#/$defs/listItemNode",
          },
        },
      },
      required: ["type", "content"],
    },
    tableCellNode: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          enum: ["tableCell", "tableHeader"],
        },
        content: {
          type: "array",
          minItems: 1,
          items: {
            $ref: "#/$defs/paragraphNode",
          },
        },
      },
      required: ["type", "content"],
    },
    tableRowNode: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          const: "tableRow",
        },
        content: {
          type: "array",
          minItems: 1,
          items: {
            $ref: "#/$defs/tableCellNode",
          },
        },
      },
      required: ["type", "content"],
    },
    tableNode: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          const: "table",
        },
        content: {
          type: "array",
          minItems: 1,
          items: {
            $ref: "#/$defs/tableRowNode",
          },
        },
      },
      required: ["type", "content"],
    },
    blockNode: {
      anyOf: [
        {
          $ref: "#/$defs/headingNode",
        },
        {
          $ref: "#/$defs/paragraphNode",
        },
        {
          $ref: "#/$defs/bulletListNode",
        },
        {
          $ref: "#/$defs/orderedListNode",
        },
        {
          $ref: "#/$defs/tableNode",
        },
      ],
    },
    docNode: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          const: "doc",
        },
        content: {
          type: "array",
          minItems: 1,
          items: {
            $ref: "#/$defs/blockNode",
          },
        },
      },
      required: ["type", "content"],
    },
  },
} satisfies Record<string, unknown>;

export function serializeNoteDocumentForComparison(document: NoteDocument) {
  return JSON.stringify(document);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneNode(node: NoteDocument): NoteDocument {
  return JSON.parse(JSON.stringify(node)) as NoteDocument;
}

function isAbsent(value: unknown) {
  return value === undefined || value === null;
}

function isValidMark(
  value: unknown,
  allowedMarkTypes: Set<string>,
): value is NonNullable<JSONContent["marks"]>[number] {
  if (!isRecord(value) || typeof value.type !== "string" || !allowedMarkTypes.has(value.type)) {
    return false;
  }

  if (!("attrs" in value) || value.attrs == null) {
    return true;
  }

  if (!isRecord(value.attrs)) {
    return false;
  }

  if (value.type === "textStyle") {
    const attrs = value.attrs;
    const keys = Object.keys(attrs);

    if (keys.some((key) => key !== "fontSize" && key !== "fontFamily")) {
      return false;
    }

    if (!isAbsent(attrs.fontSize)) {
      if (typeof attrs.fontSize !== "string") {
        return false;
      }

      if (!/^\d+(?:\.\d+)?px$/.test(attrs.fontSize)) {
        return false;
      }
    }

    if (!isAbsent(attrs.fontFamily)) {
      if (typeof attrs.fontFamily !== "string") {
        return false;
      }

      if (attrs.fontFamily.trim().length === 0) {
        return false;
      }
    }

    return true;
  }

  return Object.keys(value.attrs).length === 0;
}

function hasValidChildren(
  value: unknown,
  options: ValidationOptions,
): value is JSONContent["content"] {
  if (value === undefined) {
    return true;
  }

  return Array.isArray(value) && value.every((item) => isValidNode(item, options));
}

type ValidationOptions = {
  allowedMarkTypes: Set<string>;
  allowedNodeTypes: Set<string>;
  allowEquationBlock: boolean;
};

function isValidNode(value: unknown, options: ValidationOptions): value is NoteDocument {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (!options.allowedNodeTypes.has(value.type)) {
    return false;
  }

  const attrs = value.attrs;

  switch (value.type) {
    case "doc":
      if (attrs !== undefined) {
        return false;
      }

      return Array.isArray(value.content) && value.content.length > 0 &&
        value.content.every((item) => isValidNode(item, options));
    case "paragraph":
      if (attrs !== undefined && !isRecord(attrs)) {
        return false;
      }

      if (isRecord(attrs)) {
        const keys = Object.keys(attrs);
        const textAlign = attrs.textAlign;
        const lineHeight = attrs.lineHeight;

        if (keys.some((key) => key !== "lineHeight" && key !== "textAlign")) {
          return false;
        }

        if (!isAbsent(textAlign) && !TEXT_ALIGNS.has(String(textAlign))) {
          return false;
        }

        if (!isAbsent(lineHeight) && !LINE_HEIGHTS.has(String(lineHeight))) {
          return false;
        }
      }

      return hasValidChildren(value.content, options) &&
        (value.marks === undefined ||
          (Array.isArray(value.marks) &&
            value.marks.every((mark) => isValidMark(mark, options.allowedMarkTypes))));
    case "heading":
      if (!isRecord(attrs)) {
        return false;
      }

      if (!HEADING_LEVELS.has(Number(attrs.level))) {
        return false;
      }

      if (
        (!isAbsent(attrs.textAlign) && !TEXT_ALIGNS.has(String(attrs.textAlign))) ||
        (!isAbsent(attrs.lineHeight) && !LINE_HEIGHTS.has(String(attrs.lineHeight)))
      ) {
        return false;
      }

      if (Object.keys(attrs).some((key) => key !== "level" && key !== "lineHeight" && key !== "textAlign")) {
        return false;
      }

      return Array.isArray(value.content) &&
        value.content.length > 0 &&
        value.content.every((item) => isValidNode(item, options));
    case "text":
      if (typeof value.text !== "string") {
        return false;
      }

      if (attrs !== undefined) {
        return false;
      }

      return value.content === undefined &&
        (value.marks === undefined ||
          (Array.isArray(value.marks) &&
            value.marks.every((mark) => isValidMark(mark, options.allowedMarkTypes))));
    case "hardBreak":
      return isAbsent(attrs) && value.content === undefined && value.marks === undefined;
    case "bulletList":
      return attrs === undefined &&
        Array.isArray(value.content) &&
        value.content.length > 0 &&
        value.content.every((item) => isValidNode(item, options));
    case "orderedList":
      if (attrs !== undefined && !isRecord(attrs)) {
        return false;
      }

      if (isRecord(attrs)) {
        const keys = Object.keys(attrs);

        if (keys.some((key) => key !== "start" && key !== "type")) {
          return false;
        }

        if (!isAbsent(attrs.start) && !Number.isInteger(attrs.start)) {
          return false;
        }

        if (!isAbsent(attrs.type) && attrs.type !== "a") {
          return false;
        }
      }

      return Array.isArray(value.content) &&
        value.content.length > 0 &&
        value.content.every((item) => isValidNode(item, options));
    case "listItem":
      return isAbsent(attrs) &&
        Array.isArray(value.content) &&
        value.content.length > 0 &&
        value.content.every((item) => isValidNode(item, options));
    case "table":
      return isAbsent(attrs) &&
        Array.isArray(value.content) &&
        value.content.length > 0 &&
        value.content.every((item) => isValidNode(item, options) && item.type === "tableRow");
    case "tableRow":
      return isAbsent(attrs) &&
        Array.isArray(value.content) &&
        value.content.length > 0 &&
        value.content.every((item) =>
          isValidNode(item, options) &&
          (item.type === "tableCell" || item.type === "tableHeader")
        );
    case "tableHeader":
    case "tableCell":
      if (attrs !== undefined && attrs !== null && !isRecord(attrs)) {
        return false;
      }

      if (isRecord(attrs)) {
        if (Object.keys(attrs).some((key) => key !== "colspan" && key !== "rowspan" && key !== "colwidth")) {
          return false;
        }

        if (!isAbsent(attrs.colspan) && !Number.isInteger(attrs.colspan)) {
          return false;
        }

        if (!isAbsent(attrs.rowspan) && !Number.isInteger(attrs.rowspan)) {
          return false;
        }

        if (
          !isAbsent(attrs.colwidth) &&
          (!Array.isArray(attrs.colwidth) ||
            !attrs.colwidth.every((value) => isAbsent(value) || Number.isInteger(value)))
        ) {
          return false;
        }
      }

      return Array.isArray(value.content) &&
        value.content.length > 0 &&
        value.content.every((item) =>
          isValidNode(item, options) && TABLE_CELL_BLOCK_TYPES.has(item.type)
        );
    case "equationBlock":
      if (!options.allowEquationBlock || !isRecord(attrs)) {
        return false;
      }

      if (
        typeof attrs.id !== "string" ||
        typeof attrs.latex !== "string" ||
        (!isAbsent(attrs.fontSize) && !/^\d+(?:\.\d+)?px$/.test(String(attrs.fontSize))) ||
        (!isAbsent(attrs.highlighted) && typeof attrs.highlighted !== "boolean")
      ) {
        return false;
      }

      return Object.keys(attrs).every((key) =>
        key === "fontSize" || key === "highlighted" || key === "id" || key === "latex"
      ) && value.content === undefined;
    case "image":
    case "inlineImage":
      if (!isRecord(attrs) || typeof attrs.src !== "string" || attrs.src.trim().length === 0) {
        return false;
      }

      if (
        (!isAbsent(attrs.alt) && typeof attrs.alt !== "string") ||
        (!isAbsent(attrs.aspectRatio) &&
          (typeof attrs.aspectRatio !== "number" ||
            !Number.isFinite(attrs.aspectRatio) ||
            attrs.aspectRatio <= 0)) ||
        (!isAbsent(attrs.title) && typeof attrs.title !== "string") ||
        (!isAbsent(attrs.mimeType) && typeof attrs.mimeType !== "string") ||
        (!isAbsent(attrs.storagePath) && typeof attrs.storagePath !== "string") ||
        (!isAbsent(attrs.width) &&
          (!Number.isInteger(attrs.width) || Number(attrs.width) < 96 || Number(attrs.width) > 1600))
      ) {
        return false;
      }

      return Object.keys(attrs).every((key) =>
        key === "alt" ||
        key === "aspectRatio" ||
        key === "mimeType" ||
        key === "src" ||
        key === "storagePath" ||
        key === "title" ||
        key === "width"
      ) && value.content === undefined;
    default:
      return false;
  }
}

function parseDocument(
  value: unknown,
  options: ValidationOptions,
  errorMessage: string,
): NoteDocument {
  if (!isValidNode(value, options) || value.type !== "doc") {
    throw new Error(errorMessage);
  }

  return cloneNode(value);
}

export function isNoteDocument(value: unknown) {
  return isValidNode(value, {
    allowEquationBlock: true,
    allowedMarkTypes: FULL_MARK_TYPES,
    allowedNodeTypes: FULL_NODE_TYPES,
  }) && isRecord(value) && value.type === "doc";
}

export function parseNoteDocument(value: unknown) {
  return parseDocument(
    value,
    {
      allowEquationBlock: true,
      allowedMarkTypes: FULL_MARK_TYPES,
      allowedNodeTypes: FULL_NODE_TYPES,
    },
    "Invalid note document.",
  );
}

export function parseAiNoteDocument(value: unknown) {
  return parseDocument(
    value,
    {
      allowEquationBlock: false,
      allowedMarkTypes: AI_MARK_TYPES,
      allowedNodeTypes: AI_NODE_TYPES,
    },
    "AI returned an invalid note document.",
  );
}

function collectText(node: NoteDocument, parts: string[]) {
  if (node.type === "text" && typeof node.text === "string") {
    parts.push(node.text);
    return;
  }

  if (node.type === "hardBreak") {
    parts.push("\n");
    return;
  }

  if (node.type === "equationBlock" && isRecord(node.attrs) && typeof node.attrs.latex === "string") {
    parts.push(node.attrs.latex);
  }

  node.content?.forEach((child) => collectText(child, parts));

  if (
    node.type === "heading" ||
    node.type === "listItem" ||
    node.type === "paragraph" ||
    node.type === "tableCell" ||
    node.type === "tableHeader" ||
    node.type === "tableRow"
  ) {
    parts.push("\n");
  }
}

export function noteDocumentToPlainText(document: NoteDocument) {
  const parts: string[] = [];
  collectText(document, parts);

  return parts
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
