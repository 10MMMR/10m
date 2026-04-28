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
  chunkId: string;
  content: string;
  materialId: string | null;
  materialTitle: string | null;
  pageEnd: number | null;
  pageStart: number | null;
  similarity: number;
};

type ClassMaterial = {
  id: string;
  title: string;
};

type ChatRow = {
  class_id: string | null;
  id: string;
};

const CLASS_CHUNK_MATCH_COUNT = 6;
const CLASS_CHUNK_SIMILARITY_THRESHOLD = 0.5;
const CLASS_MATERIAL_FETCH_LIMIT = 100;
const CLASS_CHUNK_SCAN_LIMIT = 1000;

const POPUP_STUDY_ASSISTANT_SYSTEM_PROMPT = [
  "You are an AI study assistant.",
  "You can answer general questions, casual small talk, and class-specific questions.",
  "If the user asks about uploaded class materials or studying for a linked class, use the provided class context.",
  "If the user is making small talk, respond naturally without using class materials.",
  "If the user asks a follow-up question, use previous messages from the same chat.",
  "Do not pretend class materials contain information if the retrieved context does not support it.",
].join("\n");

const POPUP_GENERAL_ASSISTANT_SYSTEM_PROMPT = [
  "You are a helpful AI assistant.",
  "Use the previous messages from the same chat for conversation continuity.",
  "Answer from general knowledge without retrieved class material context.",
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

async function embedUserQuery(message: string) {
  const apiKey = getOpenAiApiKey();
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: message,
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

function getChunkId(row: Record<string, unknown>) {
  const value = typeof row.id === "string" && row.id.trim().length > 0
    ? row.id
    : row.chunk_id;

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return "unknown-chunk";
}

function getMaterialId(row: Record<string, unknown>) {
  const value = row.material_id;

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return null;
}

function getMaterialTitle(row: Record<string, unknown>) {
  const candidates = [
    row.material_title,
    row.title,
    row.file_name,
    row.filename,
    row.name,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  const material = row.material ?? row.materials;

  if (material && typeof material === "object" && !Array.isArray(material)) {
    const title = (material as Record<string, unknown>).title;

    if (typeof title === "string" && title.trim().length > 0) {
      return title.trim();
    }
  }

  return null;
}

function getNumericValue(row: Record<string, unknown>, key: string) {
  const value = row[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function getSimilarityScore(row: Record<string, unknown>) {
  const similarityKeys = ["similarity", "score", "sim_score", "match_score"];

  for (const key of similarityKeys) {
    const similarity = getNumericValue(row, key);

    if (similarity !== null) {
      return similarity;
    }
  }

  const distanceKeys = ["distance", "cosine_distance"];

  for (const key of distanceKeys) {
    const distance = getNumericValue(row, key);

    if (distance !== null) {
      return 1 - distance;
    }
  }

  return null;
}

function toClassChunk(row: Record<string, unknown>) {
  return {
    chunkId: getChunkId(row),
    content: getChunkContent(row),
    materialId: getMaterialId(row),
    materialTitle: getMaterialTitle(row),
    pageEnd: getNumericValue(row, "page_end"),
    pageStart: getNumericValue(row, "page_start"),
    similarity: getSimilarityScore(row) ?? 0,
  };
}

function withMaterialTitles(chunks: ClassChunk[], materials: ClassMaterial[]) {
  if (chunks.length === 0 || materials.length === 0) {
    return chunks;
  }

  const titlesById = new Map(materials.map((material) => [material.id, material.title]));

  return chunks.map((chunk) => {
    if (chunk.materialTitle || !chunk.materialId) {
      return chunk;
    }

    return {
      ...chunk,
      materialTitle: titlesById.get(chunk.materialId) ?? null,
    };
  });
}

function scoreStoredChunkRows({
  matchCount,
  queryEmbedding,
  rows,
  threshold,
}: {
  matchCount: number;
  queryEmbedding: number[];
  rows: unknown[];
  threshold: number;
}) {
  return rows
    .map((row) => {
      const normalizedRow = (row as Record<string, unknown>) ?? {};
      const storedEmbedding =
        parseEmbeddingValue(normalizedRow.vector) ??
        parseEmbeddingValue(normalizedRow.embedding);
      const similarity = storedEmbedding ? cosineSimilarity(queryEmbedding, storedEmbedding) : 0;

      return {
        ...toClassChunk(normalizedRow),
        similarity,
      };
    })
    .filter((chunk) => chunk.content.length > 0)
    .filter((chunk) => chunk.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);
}

async function matchChunksByClassColumn({
  classId,
  matchCount,
  queryEmbedding,
  threshold,
  supabase,
}: {
  classId: string;
  matchCount: number;
  queryEmbedding: number[];
  threshold: number;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from("material_chunks")
    .select("id, content, material_id, page_start, page_end, vector")
    .eq("class_id", classId)
    .limit(CLASS_CHUNK_SCAN_LIMIT);

  if (error || !Array.isArray(data)) {
    return [];
  }

  return scoreStoredChunkRows({
    matchCount,
    queryEmbedding,
    rows: data,
    threshold,
  });
}

async function getClassMaterials({
  classId,
  supabase,
}: {
  classId: string;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from("materials")
    .select("id, title")
    .eq("class_id", classId)
    .limit(CLASS_MATERIAL_FETCH_LIMIT);

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data
    .map((row) => {
      const material = (row as Record<string, unknown>) ?? {};
      const id = material.id;
      const title = material.title;

      if (
        typeof id !== "string" ||
        id.trim().length === 0 ||
        typeof title !== "string" ||
        title.trim().length === 0
      ) {
        return null;
      }

      return {
        id: id.trim(),
        title: title.trim(),
      };
    })
    .filter((material): material is ClassMaterial => material !== null);
}

async function matchMaterialChunks({
  classId,
  matchCount,
  queryEmbedding,
  threshold,
  supabase,
}: {
  classId: string;
  matchCount: number;
  queryEmbedding: number[];
  threshold: number;
  supabase: SupabaseClient;
}) {
  const chunksByClassColumn = await matchChunksByClassColumn({
    classId,
    matchCount,
    queryEmbedding,
    threshold,
    supabase,
  });

  return withMaterialTitles(
    chunksByClassColumn,
    await getClassMaterials({ classId, supabase }),
  );
}

function formatChunkPages(chunk: ClassChunk) {
  if (chunk.pageStart !== null && chunk.pageEnd !== null) {
    if (chunk.pageStart === chunk.pageEnd) {
      return `${chunk.pageStart}`;
    }

    return `${chunk.pageStart}-${chunk.pageEnd}`;
  }

  if (chunk.pageStart !== null) {
    return `${chunk.pageStart}`;
  }

  if (chunk.pageEnd !== null) {
    return `${chunk.pageEnd}`;
  }

  return "unknown";
}

function formatReferencePage(chunk: ClassChunk) {
  const pages = formatChunkPages(chunk);

  return pages === "unknown" ? "Page unknown" : `Page ${pages}`;
}

function getReferencePageNumber(chunk: ClassChunk) {
  return chunk.pageStart ?? chunk.pageEnd;
}

function escapeMarkdownLinkText(value: string) {
  return value.replace(/([\\[\]])/g, "\\$1");
}

function buildReferenceHref({
  chunk,
  classId,
  title,
}: {
  chunk: ClassChunk;
  classId: string;
  title: string;
}) {
  if (!chunk.materialId) {
    return null;
  }

  const params = new URLSearchParams({
    classId,
    materialId: chunk.materialId,
    title,
  });
  const page = getReferencePageNumber(chunk);

  if (page !== null) {
    params.set("page", String(page));
  }

  return `#pdf-reference?${params.toString()}`;
}

function buildClassReferences(chunks: ClassChunk[], classId: string) {
  const references: string[] = [];
  const seen = new Set<string>();

  for (const chunk of chunks) {
    const title = chunk.materialTitle ?? chunk.materialId ?? "Unknown PDF";
    const referenceText = `${title} - ${formatReferencePage(chunk)}`;
    const href = buildReferenceHref({ chunk, classId, title });
    const reference = href
      ? `[${escapeMarkdownLinkText(referenceText)}](${href})`
      : referenceText;

    if (seen.has(referenceText)) {
      continue;
    }

    seen.add(referenceText);
    references.push(reference);
  }

  if (references.length === 0) {
    return "";
  }

  return ["References", ...references].join("\n");
}

function removeChunkIdMentions(answer: string) {
  return answer
    .replace(/\s*\((?:chunk|Chunk)\s+[a-z0-9:_-]+\)/g, "")
    .replace(/\s*\[(?:chunk|Chunk)\s+[a-z0-9:_-]+\]/g, "");
}

function appendClassReferences(answer: string, chunks: ClassChunk[], classId: string) {
  const references = buildClassReferences(chunks, classId);
  const cleanAnswer = removeChunkIdMentions(answer).trim();

  if (!references) {
    return cleanAnswer;
  }

  return `${cleanAnswer}\n\n${references}`;
}

function buildClassContext(chunks: ClassChunk[]) {
  if (chunks.length === 0) {
    return "Relevant uploaded class materials:\n(none)";
  }

  return [
    "Relevant uploaded class materials:",
    ...chunks.map((chunk, index) =>
      [
        `[${index + 1}] Class material excerpt`,
        `PDF name: ${chunk.materialTitle ?? "unknown"}`,
        `Page(s): ${formatChunkPages(chunk)}`,
        `Similarity: ${chunk.similarity.toFixed(3)}`,
        `Content: ${chunk.content}`,
      ].join("\n"),
    ),
  ].join("\n\n");
}

async function getChatById({
  chatId,
  supabase,
  userId,
}: {
  chatId: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  const { data, error } = await supabase
    .from("chats")
    .select("id, class_id")
    .eq("id", chatId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Chat not found.");
  }

  return data as ChatRow;
}

async function getOwnedClassId({
  classId,
  supabase,
  userId,
}: {
  classId: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  const { data, error } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load linked class.");
  }

  return typeof data?.id === "string" ? data.id : null;
}

async function saveChatClassId({
  chatId,
  classId,
  supabase,
  userId,
}: {
  chatId: string;
  classId: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  const { error } = await supabase
    .from("chats")
    .update({ class_id: classId })
    .eq("id", chatId)
    .eq("user_id", userId);

  if (error) {
    throw new Error("Unable to link chat to class.");
  }
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

async function answerWithClassMaterials({
  chunks,
  message,
  recentMessages,
}: {
  chunks: ClassChunk[];
  message: string;
  recentMessages: StoredChatMessage[];
}) {
  const classSection = buildClassContext(chunks);
  const userMessageWithContext = [
    "Context:",
    classSection,
    "",
    "Student question:",
    message,
  ].join("\n");
  const inputMessages = [
    ...recentMessages,
    { content: userMessageWithContext, messageIndex: -1, role: "user" as const },
  ];

  return callOpenAiResponse({
    input: toOpenAiConversationInput(inputMessages),
    instructions: [
      "You are an AI study assistant. Use the provided class material context to answer the student's question.",
      "Use previous chat messages for follow-up context when helpful.",
      "Answer primarily using the uploaded class materials.",
      "Do not include a references section; source references are appended separately.",
      "Never mention chunk IDs or internal source IDs in the student-facing answer.",
      "If the context does not contain enough relevant information, say so clearly.",
      "Do not invent facts that are not supported by the retrieved context.",
      "If there is not enough relevant class context, optionally provide a brief general explanation after stating that limitation.",
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
    instructions: POPUP_GENERAL_ASSISTANT_SYSTEM_PROMPT,
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
  classId,
  message,
  supabase,
  userId,
}: {
  chatId: string;
  classId?: string | null;
  message: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  const chatRow = await getChatById({ chatId, supabase, userId });
  const storedClassId = typeof chatRow.class_id === "string"
    ? chatRow.class_id.trim()
    : "";
  let linkedClassId = storedClassId;

  if (classId && classId !== storedClassId) {
    const ownedClassId = await getOwnedClassId({ classId, supabase, userId });

    if (ownedClassId) {
      await saveChatClassId({
        chatId,
        classId: ownedClassId,
        supabase,
        userId,
      });
      linkedClassId = ownedClassId;
    }
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
  const priorMessages = recentMessages.slice(0, -1);
  const hasLinkedClass = linkedClassId.length > 0;
  let intent: ChatIntent = "generic_question";
  let assistantText = "";

  if (!hasLinkedClass) {
    assistantText = await answerGeneric({
      message,
      recentMessages: priorMessages,
    });
  } else {
    intent = await classifyChatIntent({
      hasLinkedClass,
      message,
      recentMessages: priorMessages,
    });
  }

  if (hasLinkedClass && intent === "small_talk") {
    assistantText = await answerSmallTalk({ message, recentMessages: priorMessages });
  } else if (hasLinkedClass && intent === "web_lookup_needed") {
    assistantText = await answerWithWebSearch({
      message,
      recentMessages: priorMessages,
    });
  } else if (hasLinkedClass && intent === "class_material_question") {
    const queryEmbedding = await embedUserQuery(message);
    const chunks = await matchMaterialChunks({
      classId: linkedClassId,
      matchCount: CLASS_CHUNK_MATCH_COUNT,
      queryEmbedding,
      threshold: CLASS_CHUNK_SIMILARITY_THRESHOLD,
      supabase,
    });

    if (chunks.length === 0) {
      assistantText = await callOpenAiResponse({
        input: toOpenAiConversationInput([
          ...priorMessages,
          { content: message, messageIndex: -1, role: "user" as const },
        ]),
        instructions: [
          "You are an AI study assistant.",
          "Tell the student clearly that the uploaded class materials do not contain enough relevant information for this question.",
          "Then optionally provide a short general explanation that may still help.",
        ].join("\n\n"),
      });
    } else {
      const classAnswer = await answerWithClassMaterials({
        chunks,
        message,
        recentMessages: priorMessages,
      });
      assistantText = appendClassReferences(classAnswer, chunks, linkedClassId);
    }
  } else if (hasLinkedClass && intent === "unclear") {
    assistantText = await callOpenAiResponse({
      input: toOpenAiConversationInput([
        ...priorMessages,
        { content: message, messageIndex: -1, role: "user" as const },
      ]),
      instructions: [
        POPUP_STUDY_ASSISTANT_SYSTEM_PROMPT,
        "If the request is unclear, ask one short clarifying question.",
        "If you can still safely answer generally, do so briefly without class material lookup.",
      ].join("\n\n"),
    });
  } else if (hasLinkedClass) {
    assistantText = await answerGeneric({
      message,
      recentMessages: priorMessages,
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

async function saveGeneratedChatTitle({
  chatId,
  supabase,
  title,
  userId,
}: {
  chatId: string;
  supabase: SupabaseClient;
  title: string;
  userId: string;
}) {
  const { error } = await supabase
    .from("chats")
    .update({ title })
    .eq("id", chatId)
    .eq("user_id", userId);

  if (error) {
    throw new Error("Unable to save generated chat title.");
  }
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
      if (chatId) {
        await saveGeneratedChatTitle({
          chatId,
          supabase: authResult.supabase,
          title,
          userId: authResult.user.id,
        });
      }

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
        classId,
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
