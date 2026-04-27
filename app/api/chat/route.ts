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
import type { SupabaseClient } from "@supabase/supabase-js";

type ChatRequestBody = {
  activeNodeId?: unknown;
  chatId?: unknown;
  classId?: unknown;
  draftContext?: unknown;
  firstMessage?: unknown;
  message?: unknown;
  messages?: unknown;
  mode?: unknown;
};

type ChatIntent =
  | "small_talk"
  | "class_material_question"
  | "generic_question"
  | "web_lookup_needed"
  | "unclear";

type OpenAiResponse = {
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
  output_text?: string;
};

type StoredChatMessage = {
  content: string;
  messageIndex: number;
  role: "assistant" | "user";
};

type ClassChunk = {
  content: string;
};

const POPUP_STUDY_ASSISTANT_SYSTEM_PROMPT = [
  "You are an AI study assistant.",
  "You can answer general questions, casual small talk, and class-specific questions.",
  "If the user asks about uploaded class materials or studying for a linked class, use the provided class context.",
  "If the user is making small talk, respond naturally without using class materials.",
  "If the user asks a follow-up question, use previous messages from the same chat.",
  "Do not pretend class materials contain information if the retrieved context does not support it.",
].join("\n");

const OPENAI_MODEL = "gpt-4.1-mini";

function getOpenAiApiKey() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return apiKey;
}

function getChatId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function getUserMessage(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function extractOpenAiOutputText(payload: OpenAiResponse) {
  const directText = typeof payload.output_text === "string"
    ? payload.output_text.trim()
    : "";

  if (directText) {
    return directText;
  }

  const nestedText = payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((item) => item.text ?? "")
    .join("")
    .trim();

  return nestedText ?? "";
}

async function callOpenAiResponse({
  input,
  instructions,
  tools,
}: {
  input: Array<{ content: string; role: "assistant" | "user" }>;
  instructions: string;
  tools?: Array<Record<string, unknown>>;
}) {
  const apiKey = getOpenAiApiKey();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input,
      instructions,
      model: OPENAI_MODEL,
      ...(tools && tools.length > 0 ? { tools } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "OpenAI request failed.");
  }

  let payload: OpenAiResponse;

  try {
    payload = (await response.json()) as OpenAiResponse;
  } catch {
    throw new Error("OpenAI returned invalid JSON.");
  }

  const text = extractOpenAiOutputText(payload);

  if (!text) {
    throw new Error("OpenAI returned an empty response.");
  }

  return text;
}

function formatRecentMessagesForRouter(recentMessages: StoredChatMessage[]) {
  return recentMessages
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
}

async function classifyChatIntent({
  hasLinkedClass,
  message,
  recentMessages,
}: {
  hasLinkedClass: boolean;
  message: string;
  recentMessages: StoredChatMessage[];
}) {
  const classifierInstruction = [
    "Classify the user's latest message into exactly one label:",
    "small_talk, class_material_question, generic_question, web_lookup_needed, unclear.",
    "",
    "Rules:",
    "- small_talk: greetings, casual conversation, thanks, social chat.",
    "- class_material_question: asks about uploaded class PDFs/slides/notes/exams/flashcards/lecture content/studying for linked class.",
    "- web_lookup_needed: asks for current information, recent facts/prices/laws/schedules/news, or asks to search/look up/find online.",
    "- If chat has linked class, lean toward class_material_question unless obviously small_talk or obviously generic/current-web.",
    "- If chat has no linked class, normal questions should be generic_question unless web lookup is needed.",
    "- unclear: ambiguous requests where intent is not clear.",
    "",
    "Return only one label and no extra text.",
  ].join("\n");

  const routerInput = [
    {
      role: "user" as const,
      content: [
        `has_linked_class: ${hasLinkedClass ? "yes" : "no"}`,
        recentMessages.length > 0
          ? `recent_messages:\n${formatRecentMessagesForRouter(recentMessages)}`
          : "recent_messages: (none)",
        `latest_user_message: ${message}`,
      ].join("\n\n"),
    },
  ];

  try {
    const rawIntent = (await callOpenAiResponse({
      input: routerInput,
      instructions: classifierInstruction,
    })).trim() as ChatIntent;

    if (
      rawIntent === "small_talk" ||
      rawIntent === "class_material_question" ||
      rawIntent === "generic_question" ||
      rawIntent === "web_lookup_needed" ||
      rawIntent === "unclear"
    ) {
      return rawIntent;
    }
  } catch {
    // fallback to local rules below
  }

  const normalized = message.toLowerCase();
  const smallTalkPattern = /\b(hi|hello|hey|thanks|thank you|what's up|how are you|how was your day)\b/;
  const webPattern =
    /\b(today|latest|recent|current|news|price|prices|law|laws|schedule|schedules|look up|lookup|search online|find online)\b/;

  if (smallTalkPattern.test(normalized)) {
    return "small_talk";
  }

  if (webPattern.test(normalized)) {
    return "web_lookup_needed";
  }

  if (hasLinkedClass) {
    return "class_material_question";
  }

  return "generic_question";
}

async function getRecentChatMessages({
  chatId,
  supabase,
  userId,
}: {
  chatId: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("content, message_index, role")
    .eq("chat_id", chatId)
    .eq("user_id", userId)
    .gt("message_index", 0)
    .order("message_index", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error("Unable to load recent chat messages.");
  }

  const messages = (data ?? [])
    .filter(
      (row) =>
        typeof row.content === "string" &&
        typeof row.message_index === "number" &&
        (row.role === "assistant" || row.role === "user"),
    )
    .map((row) => ({
      content: row.content,
      messageIndex: row.message_index,
      role: row.role,
    }))
    .sort((a, b) => a.messageIndex - b.messageIndex);

  return messages;
}

async function getNextMessageIndex({
  chatId,
  supabase,
  userId,
}: {
  chatId: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("message_index")
    .eq("chat_id", chatId)
    .eq("user_id", userId)
    .order("message_index", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error("Unable to determine next message index.");
  }

  const maxIndex = typeof data?.[0]?.message_index === "number"
    ? data[0].message_index
    : 0;

  return maxIndex + 1;
}

function toOpenAiConversationInput(messages: StoredChatMessage[]) {
  return messages.map((message) => ({
    content: message.content,
    role: message.role,
  }));
}

async function createEmbedding(input: string) {
  const apiKey = getOpenAiApiKey();
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input,
      model: "text-embedding-3-small",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "OpenAI embeddings request failed.");
  }

  type EmbeddingsResponse = {
    data?: Array<{
      embedding?: number[];
    }>;
  };

  const payload = (await response.json()) as EmbeddingsResponse;
  const embedding = payload.data?.[0]?.embedding;

  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("OpenAI returned an invalid embedding.");
  }

  return embedding;
}

function getChunkContent(row: Record<string, unknown>) {
  const keys = ["content", "chunk", "chunk_text", "text", "body"];

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index]! * b[index]!;
    normA += a[index]! * a[index]!;
    normB += b[index]! * b[index]!;
  }

  if (normA <= 0 || normB <= 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function parseEmbeddingValue(value: unknown) {
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return value as number[];
  }

  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "number")) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

async function retrieveClassChunks({
  classId,
  supabase,
  userMessage,
}: {
  classId: string;
  supabase: SupabaseClient;
  userMessage: string;
}) {
  const queryEmbedding = await createEmbedding(userMessage);

  const rpcCandidates = [
    {
      fn: "match_material_chunks",
      params: {
        class_id: classId,
        match_count: 6,
        query_embedding: queryEmbedding,
      },
    },
    {
      fn: "match_material_chunks_by_class",
      params: {
        class_id: classId,
        match_count: 6,
        query_embedding: queryEmbedding,
      },
    },
    {
      fn: "match_class_material_chunks",
      params: {
        class_id: classId,
        match_count: 6,
        query_embedding: queryEmbedding,
      },
    },
  ];

  for (const candidate of rpcCandidates) {
    const { data, error } = await supabase.rpc(candidate.fn, candidate.params);

    if (error || !Array.isArray(data)) {
      continue;
    }

    const chunks = data
      .map((row) => getChunkContent((row as Record<string, unknown>) ?? {}))
      .filter((content) => content.length > 0)
      .slice(0, 6)
      .map((content) => ({ content }));

    if (chunks.length > 0) {
      return chunks;
    }
  }

  const { data, error } = await supabase
    .from("material_chunks")
    .select("*")
    .eq("class_id", classId)
    .limit(40);

  if (error || !Array.isArray(data)) {
    return [];
  }

  const ranked = data
    .map((row) => {
      const normalizedRow = (row as Record<string, unknown>) ?? {};
      const content = getChunkContent(normalizedRow);
      const storedEmbedding = parseEmbeddingValue(normalizedRow.embedding);
      const similarity = storedEmbedding ? cosineSimilarity(queryEmbedding, storedEmbedding) : 0;

      return {
        content,
        score: similarity,
      };
    })
    .filter((item) => item.content.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return ranked.map((item) => ({ content: item.content }));
}

async function answerSmallTalk({
  message,
  recentMessages,
}: {
  message: string;
  recentMessages: StoredChatMessage[];
}) {
  const inputMessages = [...recentMessages, { content: message, messageIndex: -1, role: "user" as const }];

  return callOpenAiResponse({
    input: toOpenAiConversationInput(inputMessages),
    instructions: [
      POPUP_STUDY_ASSISTANT_SYSTEM_PROMPT,
      "The user is making small talk.",
      "Respond naturally and briefly.",
      "Do not use class materials.",
    ].join("\n\n"),
  });
}

async function answerWithClassContext({
  chunks,
  message,
  recentMessages,
}: {
  chunks: ClassChunk[];
  message: string;
  recentMessages: StoredChatMessage[];
}) {
  const hasChunks = chunks.length > 0;
  const classSection = hasChunks
    ? [
        "Relevant class material:",
        ...chunks.map((chunk, index) => `[chunk ${index + 1}] ${chunk.content}`),
      ].join("\n")
    : "Relevant class material:\n(none found)";
  const userMessageWithContext = `${message}\n\n${classSection}`;
  const inputMessages = [
    ...recentMessages,
    { content: userMessageWithContext, messageIndex: -1, role: "user" as const },
  ];

  return callOpenAiResponse({
    input: toOpenAiConversationInput(inputMessages),
    instructions: [
      POPUP_STUDY_ASSISTANT_SYSTEM_PROMPT,
      "Use the class material first when answering.",
      "If relevant class material is missing, clearly say uploaded class materials do not contain enough information.",
      "After that, provide a brief general explanation if helpful.",
    ].join("\n\n"),
  });
}

async function answerGeneric({
  message,
  recentMessages,
}: {
  message: string;
  recentMessages: StoredChatMessage[];
}) {
  const inputMessages = [...recentMessages, { content: message, messageIndex: -1, role: "user" as const }];

  return callOpenAiResponse({
    input: toOpenAiConversationInput(inputMessages),
    instructions: POPUP_STUDY_ASSISTANT_SYSTEM_PROMPT,
  });
}

async function answerWithWebSearch({
  message,
  recentMessages,
}: {
  message: string;
  recentMessages: StoredChatMessage[];
}) {
  const inputMessages = [...recentMessages, { content: message, messageIndex: -1, role: "user" as const }];

  return callOpenAiResponse({
    input: toOpenAiConversationInput(inputMessages),
    instructions: [
      POPUP_STUDY_ASSISTANT_SYSTEM_PROMPT,
      "Use current online information to answer.",
      "Be explicit when information depends on recent updates.",
    ].join("\n\n"),
    tools: [{ type: "web_search_preview" }],
  });
}

async function handleChatMessage({
  chatId,
  message,
  supabase,
  userId,
}: {
  chatId: string;
  message: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  const { data: chatRow, error: chatError } = await supabase
    .from("chats")
    .select("id, class_id")
    .eq("id", chatId)
    .eq("user_id", userId)
    .maybeSingle();

  if (chatError || !chatRow) {
    throw new Error("Chat not found.");
  }

  const nextUserMessageIndex = await getNextMessageIndex({ chatId, supabase, userId });
  const timestamp = new Date().toISOString();

  const { error: insertUserError } = await supabase.from("chat_messages").insert({
    chat_id: chatId,
    content: message,
    message_index: nextUserMessageIndex,
    role: "user",
    user_id: userId,
  });

  if (insertUserError) {
    throw new Error("Unable to save your message.");
  }

  const recentMessages = await getRecentChatMessages({ chatId, supabase, userId });
  const hasLinkedClass =
    typeof chatRow.class_id === "string" && chatRow.class_id.trim().length > 0;
  const intent = await classifyChatIntent({
    hasLinkedClass,
    message,
    recentMessages: recentMessages.slice(0, -1),
  });

  let assistantText = "";

  if (intent === "small_talk") {
    assistantText = await answerSmallTalk({ message, recentMessages: recentMessages.slice(0, -1) });
  } else if (intent === "web_lookup_needed") {
    assistantText = await answerWithWebSearch({
      message,
      recentMessages: recentMessages.slice(0, -1),
    });
  } else if (intent === "class_material_question" && hasLinkedClass) {
    const chunks = await retrieveClassChunks({
      classId: chatRow.class_id as string,
      supabase,
      userMessage: message,
    });
    assistantText = await answerWithClassContext({
      chunks,
      message,
      recentMessages: recentMessages.slice(0, -1),
    });
  } else if (intent === "unclear") {
    assistantText = await callOpenAiResponse({
      input: toOpenAiConversationInput([
        ...recentMessages.slice(0, -1),
        { content: message, messageIndex: -1, role: "user" as const },
      ]),
      instructions: [
        POPUP_STUDY_ASSISTANT_SYSTEM_PROMPT,
        "If the request is unclear, ask one short clarifying question.",
        "If you can still safely answer generally, do so briefly without class material lookup.",
      ].join("\n\n"),
    });
  } else {
    assistantText = await answerGeneric({
      message,
      recentMessages: recentMessages.slice(0, -1),
    });
  }

  const assistantMessageIndex = nextUserMessageIndex + 1;

  const { error: insertAssistantError } = await supabase.from("chat_messages").insert({
    chat_id: chatId,
    content: assistantText,
    message_index: assistantMessageIndex,
    role: "assistant",
    user_id: userId,
  });

  if (insertAssistantError) {
    throw new Error("Unable to save assistant response.");
  }

  await supabase
    .from("chats")
    .update({ last_updated_at: timestamp })
    .eq("id", chatId)
    .eq("user_id", userId);

  return {
    assistant: {
      content: assistantText,
      messageIndex: assistantMessageIndex,
      role: "assistant" as const,
    },
    intent,
    userMessage: {
      content: message,
      messageIndex: nextUserMessageIndex,
      role: "user" as const,
    },
  };
}

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

function getGenerateTitleFirstMessage(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeShortTitle(value: string) {
  const normalized = value.trim().replace(/^["'`]+|["'`]+$/g, "").replace(/\s+/g, " ");

  if (!normalized) {
    return "New chat";
  }

  if (normalized.length <= 10) {
    return normalized;
  }

  return normalized.slice(0, 10).trimEnd();
}

export async function POST(request: Request) {
  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const mode =
    body.mode === "generate_title" || body.mode === "popup_assistant"
      ? body.mode
      : "assistant";
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

  if (mode !== "popup_assistant") {
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
  }

  const classId = getClassId(body.classId);
  const activeNodeId = getNodeId(body.activeNodeId);
  const messages = getMessages(body.messages);
  const draftContext = getDraftContext(body.draftContext);
  const firstMessage = getGenerateTitleFirstMessage(body.firstMessage);
  const chatId = getChatId(body.chatId);
  const userMessage = getUserMessage(body.message);

  if (mode === "generate_title") {
    if (!firstMessage) {
      return NextResponse.json({ error: "Invalid firstMessage." }, { status: 400 });
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
      const generatedTitleRaw = await provider.generateText({
        messages: [
          {
            parts: [{ text: `Create a concise chat title from this message: "${firstMessage}"` }],
            role: "user",
          },
        ],
        systemInstruction: [
          "You generate short chat titles.",
          "Return plain text only.",
          "Target around 7 to 10 characters.",
          "Never exceed 10 characters.",
          "No punctuation unless necessary.",
          "No quotes.",
        ].join("\n"),
      });

      const title = sanitizeShortTitle(generatedTitleRaw);
      return NextResponse.json({ title });
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Unable to generate title.",
        },
        { status: 500 },
      );
    }
  }

  if (mode === "popup_assistant") {
    if (!chatId || !userMessage) {
      return NextResponse.json({ error: "Invalid popup chat payload." }, { status: 400 });
    }

    try {
      const result = await handleChatMessage({
        chatId,
        message: userMessage,
        supabase: authResult.supabase,
        userId: authResult.user.id,
      });
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Unable to contact the chat assistant.",
        },
        { status: 500 },
      );
    }
  }

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
