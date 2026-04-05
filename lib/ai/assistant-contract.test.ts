import {
  ASSISTANT_ACTION_BEHAVIOR,
  normalizeGeneratedNoteDocument,
  parseAssistantCommand,
} from "./assistant-contract";
import {
  AI_ACTION_REGISTRY,
  SUPPORTED_ASSISTANT_ACTIONS,
  SUPPORTED_NOTE_OPERATIONS,
} from "./actions";

describe("assistant contract", () => {
  test("exposes the supported action registry", () => {
    expect(SUPPORTED_ASSISTANT_ACTIONS).toEqual(["reply", "generate_note"]);
    expect(SUPPORTED_NOTE_OPERATIONS).toEqual([
      "create_new_note",
      "overwrite_current_note",
    ]);
    expect(ASSISTANT_ACTION_BEHAVIOR.supportedTransportActions).toEqual(
      AI_ACTION_REGISTRY.assistantActions,
    );
    expect(ASSISTANT_ACTION_BEHAVIOR.supportedNoteOperations).toEqual(
      AI_ACTION_REGISTRY.noteOperations,
    );
  });

  test("parses reply actions", () => {
    expect(
      parseAssistantCommand(JSON.stringify({ action: "reply", message: "Hello" })),
    ).toEqual({
      action: "reply",
      message: "Hello",
    });
  });

  test("parses generate_note actions", () => {
    expect(
      parseAssistantCommand(
        JSON.stringify({
          action: "generate_note",
          message: "Creating notes",
          prompt: "Create study notes",
          target: "current_note",
          title: "Fresh title",
        }),
      ),
    ).toEqual({
      action: "generate_note",
      message: "Creating notes",
      prompt: "Create study notes",
      target: "current_note",
      title: "Fresh title",
    });
  });

  test("rejects invalid assistant payloads", () => {
    expect(() => parseAssistantCommand("{")).toThrow("Assistant returned invalid JSON.");
    expect(() =>
      parseAssistantCommand(JSON.stringify({ action: "generate_note", message: "x" })),
    ).toThrow("Assistant generate_note action is missing a prompt.");
  });

  test("normalizes note JSON and rejects invalid output", () => {
    expect(
      normalizeGeneratedNoteDocument(
        JSON.stringify({
          type: "doc",
          content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title" }] }],
        }),
      ),
    ).toEqual({
      type: "doc",
      content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title" }] }],
    });
    expect(() => normalizeGeneratedNoteDocument("# Markdown")).toThrow(
      "AI returned invalid JSON for note content.",
    );
  });

  test("reply remains the safe fallback for unsupported capabilities", () => {
    expect(
      parseAssistantCommand(
        JSON.stringify({
          action: "reply",
          message: "I can't open PDFs yet.",
        }),
      ),
    ).toEqual({
      action: "reply",
      message: "I can't open PDFs yet.",
    });
  });
});
