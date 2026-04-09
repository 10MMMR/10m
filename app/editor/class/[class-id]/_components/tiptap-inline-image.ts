import { mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";

const MIN_IMAGE_WIDTH = 96;
const MAX_IMAGE_WIDTH = 1600;

type InlineImageAttrs = {
  alt?: string | null;
  aspectRatio?: number | null;
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

function getImageAspectRatio(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value * 1000000) / 1000000;
}

function applyImageAttributes(image: HTMLImageElement, attrs: InlineImageAttrs) {
  image.src = attrs.src;
  image.alt = attrs.alt ?? "";
  image.title = attrs.title ?? "";
  image.draggable = false;
  image.style.width = "100%";
}

function applyWrapperDimensions(wrapper: HTMLElement, attrs: InlineImageAttrs) {
  wrapper.style.width = `${getImageWidth(attrs.width) ?? 320}px`;
  const aspectRatio = getImageAspectRatio(attrs.aspectRatio);

  if (aspectRatio) {
    wrapper.style.aspectRatio = String(aspectRatio);
    return;
  }

  wrapper.style.removeProperty("aspect-ratio");
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
      aspectRatio: {
        default: null,
        parseHTML: (element) => {
          const aspectRatioValue = element.getAttribute("data-aspect-ratio");

          if (!aspectRatioValue) {
            return null;
          }

          return getImageAspectRatio(Number.parseFloat(aspectRatioValue));
        },
        renderHTML: (attributes) => {
          const aspectRatio = getImageAspectRatio(attributes.aspectRatio);

          if (!aspectRatio) {
            return {};
          }

          return {
            "data-aspect-ratio": String(aspectRatio),
          };
        },
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
            aspectRatio: getImageAspectRatio(
              Number.parseFloat(element.dataset.aspectRatio ?? ""),
            ),
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
    const aspectRatio = getImageAspectRatio(HTMLAttributes.aspectRatio);
    const style = aspectRatio
      ? `width: ${width}px; aspect-ratio: ${aspectRatio};`
      : `width: ${width}px;`;

    return [
      "span",
      mergeAttributes(
        {
          "data-aspect-ratio": aspectRatio ? String(aspectRatio) : undefined,
          "data-inline-image": "true",
          "data-mime-type": HTMLAttributes.mimeType ?? undefined,
          "data-storage-path": HTMLAttributes.storagePath ?? undefined,
          class: "inline-image-node",
          "data-width": String(width),
          style,
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

      const placeholder = document.createElement("span");
      placeholder.className = "inline-image-placeholder";
      placeholder.setAttribute("aria-hidden", "true");

      const handle = document.createElement("span");
      handle.className = "inline-image-handle";
      handle.tabIndex = editor.isEditable ? 0 : -1;
      handle.setAttribute("aria-hidden", "true");

      wrapper.append(placeholder, image, handle);

      let dragSession: DragSession | null = null;
      let currentAttrs = node.attrs as InlineImageAttrs;
      let currentWidth = getImageWidth(node.attrs.width) ?? 320;

      const syncLoadingState = (attrs: InlineImageAttrs) => {
        if (!getImageAspectRatio(attrs.aspectRatio)) {
          wrapper.dataset.imageLoading = "false";
          return;
        }

        wrapper.dataset.imageLoading =
          image.complete && image.naturalWidth > 0 ? "false" : "true";
      };

      const handleImageLoad = () => {
        if (!getImageAspectRatio(currentAttrs.aspectRatio)) {
          return;
        }

        wrapper.dataset.imageLoading = "false";
      };

      const handleImageError = () => {
        if (!getImageAspectRatio(currentAttrs.aspectRatio)) {
          wrapper.dataset.imageLoading = "false";
          return;
        }

        wrapper.dataset.imageLoading = "true";
      };

      const syncNode = (attrs: InlineImageAttrs) => {
        currentAttrs = attrs;
        currentWidth = getImageWidth(attrs.width) ?? 320;
        wrapper.dataset.width = String(currentWidth);
        applyWrapperDimensions(wrapper, attrs);

        const aspectRatio = getImageAspectRatio(attrs.aspectRatio);

        if (aspectRatio) {
          wrapper.dataset.aspectRatio = String(aspectRatio);
          wrapper.dataset.imageLoading = "true";
        } else {
          delete wrapper.dataset.aspectRatio;
          wrapper.dataset.imageLoading = "false";
        }

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
        syncLoadingState(attrs);
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
        applyWrapperDimensions(wrapper, {
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

      image.addEventListener("load", handleImageLoad);
      image.addEventListener("error", handleImageError);
      syncNode(node.attrs as InlineImageAttrs);

      return {
        dom: wrapper,
        ignoreMutation: () => true,
        destroy: () => {
          window.removeEventListener("pointermove", handlePointerMove);
          window.removeEventListener("pointerup", handlePointerUp);
          image.removeEventListener("load", handleImageLoad);
          image.removeEventListener("error", handleImageError);
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
