export const SUPPORTED_ASSISTANT_ACTIONS = ["reply", "generate_note"] as const;

export const SUPPORTED_NOTE_OPERATIONS = [
  "create_new_note",
  "overwrite_current_note",
] as const;

export type SupportedAssistantAction = (typeof SUPPORTED_ASSISTANT_ACTIONS)[number];
export type SupportedNoteOperation = (typeof SUPPORTED_NOTE_OPERATIONS)[number];

export const UNSUPPORTED_ACTION_REPLY_GUIDANCE =
  "If the user asks for something outside these capabilities, return action reply and clearly say you cannot do that yet.";

export const UNSUPPORTED_ACTION_EXAMPLES = [
  "open a pdf",
  "switch panes",
  "select a file in the tree",
  "navigate the UI",
  "move or delete files",
] as const;

export const AI_ACTION_REGISTRY = {
  assistantActions: SUPPORTED_ASSISTANT_ACTIONS,
  noteOperations: SUPPORTED_NOTE_OPERATIONS,
  unsupportedActionReplyGuidance: UNSUPPORTED_ACTION_REPLY_GUIDANCE,
  unsupportedExamples: UNSUPPORTED_ACTION_EXAMPLES,
} as const;
