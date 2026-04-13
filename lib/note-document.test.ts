import { parseNoteDocument } from "./note-document";

function buildTextStyleDocument(attrs: Record<string, unknown>) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Styled",
            marks: [{ type: "textStyle", attrs }],
          },
        ],
      },
    ],
  };
}

describe("parseNoteDocument textStyle validation", () => {
  test("accepts a textStyle mark with fontSize only", () => {
    expect(() =>
      parseNoteDocument(
        buildTextStyleDocument({ fontSize: "17px" }),
      ),
    ).not.toThrow();
  });

  test("accepts a textStyle mark with fontFamily only", () => {
    expect(() =>
      parseNoteDocument(
        buildTextStyleDocument({ fontFamily: "var(--font-editor)" }),
      ),
    ).not.toThrow();
  });

  test("accepts a textStyle mark with both fontSize and fontFamily", () => {
    expect(() =>
      parseNoteDocument(
        buildTextStyleDocument({
          fontFamily: "'Times New Roman'",
          fontSize: "18px",
        }),
      ),
    ).not.toThrow();
  });

  test("rejects a textStyle mark with an empty fontFamily", () => {
    expect(() =>
      parseNoteDocument(buildTextStyleDocument({ fontFamily: "   " })),
    ).toThrow("Invalid note document.");
  });

  test("rejects unsupported textStyle attributes", () => {
    expect(() =>
      parseNoteDocument(
        buildTextStyleDocument({
          fontFamily: "Arial",
          letterSpacing: "1px",
        }),
      ),
    ).toThrow("Invalid note document.");
  });

  test("rejects invalid fontSize format on textStyle marks", () => {
    expect(() =>
      parseNoteDocument(
        buildTextStyleDocument({
          fontFamily: "Arial",
          fontSize: "large",
        }),
      ),
    ).toThrow("Invalid note document.");
  });
});
