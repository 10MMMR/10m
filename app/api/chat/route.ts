import { NextResponse } from "next/server";
import { getAiProvider } from "@/lib/ai";
import { parseNoteDocument } from "@/lib/note-document";
import {
  ASSISTANT_COMMAND_RESPONSE_JSON_SCHEMA,
  parseAssistantCommand,
} from "@/lib/ai/assistant-contract";
import { STUDY_ASSISTANT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  buildChatMessagesWithContext,
  buildSourceContextParts,
  getAuthenticatedAiRequest,
  getClassId,
  getNodeId,
  type DraftNoteContext,
} from "@/lib/ai/server-context";
import type { ChatMessage } from "@/lib/ai/types";
import { getAiConfig } from "@/lib/ai/config";
import { API_RATE_LIMITS } from "@/lib/api/rate-limit-rules";
import {
  consumeRateLimit,
  createRateLimitResponse,
  getRateLimitIdentity,
} from "@/lib/api/rate-limit";

type ChatRequestBody = {
  activeNodeId?: unknown;
  classId?: unknown;
  draftContext?: unknown;
  messages?: unknown;
};

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const role = Reflect.get(value, "role");
  const content = Reflect.get(value, "content");

  return (
    (role === "user" || role === "assistant") &&
    typeof content === "string" &&
    content.trim().length > 0
  );
}

function getMessages(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const messages = value.filter(isChatMessage);

  if (messages.length !== value.length) {
    return null;
  }

  return messages.map((message) => ({
    role: message.role,
    content: message.content.trim(),
  }));
}

function getDraftContext(value: unknown): DraftNoteContext | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const nodeId = getNodeId(Reflect.get(value, "nodeId"));
  const title = typeof Reflect.get(value, "title") === "string"
    ? Reflect.get(value, "title").trim()
    : "";
  const contentJson = Reflect.get(value, "contentJson");

  if (!nodeId || !title) {
    return null;
  }

  try {
    return {
      nodeId,
      title,
      contentJson: parseNoteDocument(contentJson),
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    getAiConfig();
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI config is invalid.",
      },
      { status: 500 },
    );
  }

  const authResult = await getAuthenticatedAiRequest(request);

  if ("error" in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  const rateLimit = await consumeRateLimit({
    config: API_RATE_LIMITS.chatPost,
    identity: getRateLimitIdentity(request, authResult.user.id),
  });

  if (!rateLimit.allowed) {
    return createRateLimitResponse(
      rateLimit,
      "Too many chat requests. Please try again shortly.",
    );
  }

  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const classId = getClassId(body.classId);
  const activeNodeId = getNodeId(body.activeNodeId);
  const messages = getMessages(body.messages);
  const draftContext = getDraftContext(body.draftContext);

  if (!classId) {
    return NextResponse.json({ error: "Invalid classId." }, { status: 400 });
  }

  if (!activeNodeId) {
    return NextResponse.json({ error: "Invalid activeNodeId." }, { status: 400 });
  }

  if (!messages) {
    return NextResponse.json({ error: "Invalid messages payload." }, { status: 400 });
  }

  let provider;

  try {
    provider = getAiProvider();
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI provider is unavailable.",
      },
      { status: 500 },
    );
  }

  try {
    const { parts } = await buildSourceContextParts({
      classId,
      draftContext,
      nodeIds: [activeNodeId],
      supabase: authResult.supabase,
    });

    const rawAssistant = await provider.generateText({
      messages: buildChatMessagesWithContext({
        contextParts: [
          {
            text: [
              "Active workspace context for this chat turn.",
              "Use the provided sources when answering the user.",
            ].join("\n"),
          },
          ...parts,
        ],
        messages,
      }),
      responseJsonSchema: ASSISTANT_COMMAND_RESPONSE_JSON_SCHEMA,
      responseMimeType: "application/json",
      systemInstruction: STUDY_ASSISTANT_SYSTEM_PROMPT,
    });

    const assistant = parseAssistantCommand(rawAssistant);
    return NextResponse.json({ assistant });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to contact the chat assistant.",
      },
      { status: 500 },
    );
  }
}
