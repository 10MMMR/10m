import { mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";

const MIN_IMAGE_WIDTH = 96;
const MAX_IMAGE_WIDTH = 1600;

type InlineImageAttrs = {
  alt?: string | null;
  mimeType?: string | null;
  src: string;
  storagePath?: string | null;
  title?: string | null;
  width?: number | null;
};

type DragSession = {
  startWidth: number;
  maxWidth: number;
  startX: number;
};

function getImageWidth(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const nextWidth = Math.round(value);

  if (nextWidth < MIN_IMAGE_WIDTH || nextWidth > MAX_IMAGE_WIDTH) {
    return null;
  }

  return nextWidth;
}

function applyImageAttributes(image: HTMLImageElement, attrs: InlineImageAttrs) {
  image.src = attrs.src;
  image.alt = attrs.alt ?? "";
  image.title = attrs.title ?? "";
  image.draggable = false;
  image.style.width = "100%";
}

function applyWrapperWidth(wrapper: HTMLElement, attrs: InlineImageAttrs) {
  wrapper.style.width = `${getImageWidth(attrs.width) ?? 320}px`;
}

function getContainerWidth(image: HTMLImageElement) {
  const editorRoot = image.closest(".tiptap");

  if (!editorRoot) {
    return MAX_IMAGE_WIDTH;
  }

  const nextWidth = Math.floor(editorRoot.getBoundingClientRect().width - 48);
  return Math.min(MAX_IMAGE_WIDTH, Math.max(MIN_IMAGE_WIDTH, nextWidth));
}

export const InlineImage = Image.extend({
  name: "image",

  inline: true,

  group: "inline",

  atom: true,

  selectable: true,

  addAttributes() {
    return {
      alt: {
        default: null,
      },
      mimeType: {
        default: null,
      },
      src: {
        default: "",
      },
      title: {
        default: null,
      },
      storagePath: {
        default: null,
      },
      width: {
        default: 320,
        parseHTML: (element) => {
          const widthValue =
            element.getAttribute("data-width") ?? element.getAttribute("width");

          if (!widthValue) {
            return 320;
          }

          const parsedWidth = Number.parseInt(widthValue, 10);
          return getImageWidth(parsedWidth) ?? 320;
        },
        renderHTML: (attributes) => ({
          "data-width": String(getImageWidth(attributes.width) ?? 320),
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-inline-image]",
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) {
            return false;
          }

          const image = element.querySelector("img");

          if (!image) {
            return false;
          }

          return {
            alt: image.getAttribute("alt"),
            mimeType: element.getAttribute("data-mime-type"),
            src: image.getAttribute("src") ?? "",
            storagePath: element.getAttribute("data-storage-path"),
            title: image.getAttribute("title"),
            width: getImageWidth(Number.parseInt(element.dataset.width ?? "", 10)) ?? 320,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const width = getImageWidth(HTMLAttributes.width) ?? 320;

    return [
      "span",
      mergeAttributes(
        {
          "data-inline-image": "true",
          "data-mime-type": HTMLAttributes.mimeType ?? undefined,
          "data-storage-path": HTMLAttributes.storagePath ?? undefined,
          class: "inline-image-node",
          "data-width": String(width),
          style: `width: ${width}px;`,
        },
      ),
      [
        "img",
        mergeAttributes({
          alt: HTMLAttributes.alt ?? "",
          class: "inline-image-asset",
          draggable: "false",
          src: HTMLAttributes.src,
          style: "width: 100%;",
          title: HTMLAttributes.title ?? "",
        }),
      ],
    ];
  },
  addNodeView() {
    return ({ editor, getPos, node }) => {
      const wrapper = document.createElement("span");
      wrapper.className = "inline-image-node";
      wrapper.contentEditable = "false";
      wrapper.dataset.inlineImage = "true";

      const image = document.createElement("img");
      image.className = "inline-image-asset";

      const handle = document.createElement("span");
      handle.className = "inline-image-handle";
      handle.tabIndex = editor.isEditable ? 0 : -1;
      handle.setAttribute("aria-hidden", "true");

      wrapper.append(image, handle);

      let dragSession: DragSession | null = null;
      let currentAttrs = node.attrs as InlineImageAttrs;
      let currentWidth = getImageWidth(node.attrs.width) ?? 320;

      const syncNode = (attrs: InlineImageAttrs) => {
        currentAttrs = attrs;
        currentWidth = getImageWidth(attrs.width) ?? 320;
        wrapper.dataset.width = String(currentWidth);
        applyWrapperWidth(wrapper, attrs);

        if (attrs.mimeType) {
          wrapper.dataset.mimeType = attrs.mimeType;
        } else {
          delete wrapper.dataset.mimeType;
        }

        if (attrs.storagePath) {
          wrapper.dataset.storagePath = attrs.storagePath;
        } else {
          delete wrapper.dataset.storagePath;
        }

        applyImageAttributes(image, attrs);
        handle.tabIndex = editor.isEditable ? 0 : -1;
        handle.hidden = !editor.isEditable;
      };

      const handlePointerMove = (event: PointerEvent) => {
        if (!dragSession) {
          return;
        }

        const nextWidth = Math.max(
          MIN_IMAGE_WIDTH,
          Math.min(
            dragSession.maxWidth,
            dragSession.startWidth + event.clientX - dragSession.startX,
          ),
        );

        const roundedWidth = Math.round(nextWidth);
        currentWidth = roundedWidth;
        applyWrapperWidth(wrapper, {
          ...currentAttrs,
          width: roundedWidth,
        });
        wrapper.dataset.width = String(roundedWidth);
      };

      const handlePointerUp = () => {
        if (!dragSession) {
          return;
        }

        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);

        const position = getPos();

        if (typeof position === "number") {
          const nextWidth = getImageWidth(currentWidth) ?? dragSession.startWidth;
          const transaction = editor.state.tr.setNodeMarkup(position, undefined, {
            ...currentAttrs,
            width: nextWidth,
          });
          editor.view.dispatch(transaction);
        }

        dragSession = null;
      };

      handle.addEventListener("pointerdown", (event) => {
        if (!editor.isEditable || event.button !== 0) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        dragSession = {
          maxWidth: getContainerWidth(image),
          startWidth: image.getBoundingClientRect().width || image.width || 320,
          startX: event.clientX,
        };

        handle.setPointerCapture(event.pointerId);
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
      });

      syncNode(node.attrs as InlineImageAttrs);

      return {
        dom: wrapper,
        ignoreMutation: () => true,
        destroy: () => {
          window.removeEventListener("pointermove", handlePointerMove);
          window.removeEventListener("pointerup", handlePointerUp);
          dragSession = null;
        },
        stopEvent: (event) => {
          const target = event.target;

          return target instanceof globalThis.Node && handle.contains(target);
        },
        update: (updatedNode) => {
          if (updatedNode.type.name !== node.type.name) {
            return false;
          }

          syncNode(updatedNode.attrs as InlineImageAttrs);
          return true;
        },
      };
    };
  },
});
