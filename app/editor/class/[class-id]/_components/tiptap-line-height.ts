import { Extension } from "@tiptap/core";

const DEFAULT_LINE_HEIGHTS = ["1.0", "1.5", "2.0"] as const;

export type LineHeightValue = (typeof DEFAULT_LINE_HEIGHTS)[number];

type LineHeightOptions = {
  lineHeights: readonly string[];
  types: string[];
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (lineHeight: string) => ReturnType;
      unsetLineHeight: () => ReturnType;
    };
  }
}

export const LineHeight = Extension.create<LineHeightOptions>({
  name: "lineHeight",

  addOptions() {
    return {
      lineHeights: DEFAULT_LINE_HEIGHTS,
      types: [],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => {
              const lineHeight = element.style.lineHeight;

              return this.options.lineHeights.includes(lineHeight) ? lineHeight : null;
            },
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) {
                return {};
              }

              return {
                style: `line-height: ${attributes.lineHeight}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (lineHeight) =>
        ({ commands }) => {
          if (!this.options.lineHeights.includes(lineHeight)) {
            return false;
          }

          return this.options.types
            .map((type) => commands.updateAttributes(type, { lineHeight }))
            .some(Boolean);
        },
      unsetLineHeight:
        () =>
        ({ commands }) => {
          return this.options.types
            .map((type) => commands.resetAttributes(type, "lineHeight"))
            .some(Boolean);
        },
    };
  },
});
