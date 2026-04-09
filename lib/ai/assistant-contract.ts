import {
  AI_ACTION_REGISTRY,
  SUPPORTED_ASSISTANT_ACTIONS,
} from "./actions";
import {
  parseAiNoteDocument,
  type NoteDocument,
} from "@/lib/note-document";

export type AssistantAction = "reply" | "generate_note";
export type NoteGenerationTarget = "current_note" | "new_note";

export type AssistantCommand =
  | {
      action: "reply";
      message: string;
    }
  | {
      action: "generate_note";
      message: string;
      prompt: string;
      target: NoteGenerationTarget;
      title?: string;
    };

export type NoteGenerationMode = "new_note" | "overwrite_note";

export const ASSISTANT_COMMAND_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: {
      type: "string",
      enum: [...SUPPORTED_ASSISTANT_ACTIONS],
      description: "The next client action to perform.",
    },
    message: {
      type: "string",
      description: "Short user-facing chat text to render in the assistant pane.",
    },
    target: {
      type: "string",
      enum: ["current_note", "new_note"],
      description: "Only used when action is generate_note.",
    },
    title: {
      type: "string",
      description: "Optional suggested note title when creating or overwriting notes.",
    },
    prompt: {
      type: "string",
      description: "Normalized note-generation instruction for the note generator.",
    },
  },
  required: ["action", "message"],
  propertyOrdering: ["action", "message", "target", "title", "prompt"],
} satisfies Record<string, unknown>;

export const ASSISTANT_ACTION_BEHAVIOR = {
  supportedTransportActions: AI_ACTION_REGISTRY.assistantActions,
  supportedNoteOperations: AI_ACTION_REGISTRY.noteOperations,
  unsupportedActionHandling: AI_ACTION_REGISTRY.unsupportedActionReplyGuidance,
} as const;

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stripCodeFence(raw: string) {
  const trimmed = raw.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const withoutStart = trimmed.replace(/^```[a-zA-Z0-9_-]*\s*/, "");
  return withoutStart.replace(/\s*```$/, "").trim();
}

function tryParseJson(raw: string): unknown {
  const fenced = stripCodeFence(raw);

  try {
    return JSON.parse(fenced);
  } catch {
    const start = fenced.indexOf("{");
    const end = fenced.lastIndexOf("}");

    if (start < 0 || end <= start) {
      throw new Error("AI returned invalid JSON for note content.");
    }

    try {
      return JSON.parse(fenced.slice(start, end + 1));
    } catch {
      throw new Error("AI returned invalid JSON for note content.");
    }
  }
}

function unwrapNoteDocument(value: unknown): unknown {
  const record = asRecord(value);

  if (!record) {
    return value;
  }

  if (record.type === "doc" && Array.isArray(record.content)) {
    return record;
  }

  const directCandidates = [
    record.contentJson,
    record.noteDocument,
    record.document,
    record.doc,
    record.note,
  ];

  for (const candidate of directCandidates) {
    const candidateRecord = asRecord(candidate);

    if (candidateRecord?.type === "doc" && Array.isArray(candidateRecord.content)) {
      return candidateRecord;
    }
  }

  return value;
}

export function parseAssistantCommand(raw: string): AssistantCommand {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Assistant returned invalid JSON.");
  }

  const record = asRecord(parsed);

  if (!record) {
    throw new Error("Assistant response must be a JSON object.");
  }

  const action = getString(Reflect.get(record, "action"));
  const message = getString(Reflect.get(record, "message"));

  if ((action !== "reply" && action !== "generate_note") || !message) {
    throw new Error("Assistant response is missing a valid action or message.");
  }

  if (action === "reply") {
    return {
      action,
      message,
    };
  }

  const prompt = getString(Reflect.get(record, "prompt"));
  const targetValue = getString(Reflect.get(record, "target"));
  const title = getString(Reflect.get(record, "title"));

  if (!prompt) {
    throw new Error("Assistant generate_note action is missing a prompt.");
  }

  return {
    action,
    message,
    prompt,
    target: targetValue === "current_note" ? "current_note" : "new_note",
    ...(title ? { title } : {}),
  };
}

export function normalizeGeneratedNoteDocument(raw: string): NoteDocument {
  const parsed = tryParseJson(raw);
  const document = unwrapNoteDocument(parsed);
  return parseAiNoteDocument(document);
}
