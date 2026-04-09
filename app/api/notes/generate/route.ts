import { NextResponse } from "next/server";
import {
  normalizeGeneratedNoteDocument,
  type NoteGenerationMode,
} from "@/lib/ai/assistant-contract";
import { getAiProvider } from "@/lib/ai";
import { NOTE_GENERATION_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  AI_NOTE_DOCUMENT_JSON_SCHEMA,
  parseNoteDocument,
} from "@/lib/note-document";
import {
  buildSourceContextParts,
  getAuthenticatedAiRequest,
  getClassId,
  getNodeId,
  getNodeIds,
  type DraftNoteContext,
} from "@/lib/ai/server-context";
import { getAiConfig } from "@/lib/ai/config";
import { API_RATE_LIMITS } from "@/lib/api/rate-limit-rules";
import {
  consumeRateLimit,
  createRateLimitResponse,
  getRateLimitIdentity,
} from "@/lib/api/rate-limit";

type GenerateNotesRequestBody = {
  classId?: unknown;
  draftContext?: unknown;
  mode?: unknown;
  prompt?: unknown;
  sourceNodeIds?: unknown;
  targetNoteId?: unknown;
  title?: unknown;
};

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

function getMode(value: unknown): NoteGenerationMode | null {
  return value === "new_note" || value === "overwrite_note" ? value : null;
}

function getPrompt(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function getTitle(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export async function POST(request: Request) {
  try {
    getAiConfig();
  } catch (error) {
    console.error("[api/notes/generate] Invalid AI config.", error);
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
    config: API_RATE_LIMITS.notesGeneratePost,
    identity: getRateLimitIdentity(request, authResult.user.id),
  });

  if (!rateLimit.allowed) {
    return createRateLimitResponse(
      rateLimit,
      "Too many note-generation requests. Please try again shortly.",
    );
  }

  let body: GenerateNotesRequestBody;

  try {
    body = (await request.json()) as GenerateNotesRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const classId = getClassId(body.classId);
  const sourceNodeIds = getNodeIds(body.sourceNodeIds);
  const prompt = getPrompt(body.prompt);
  const mode = getMode(body.mode);
  const title = getTitle(body.title);
  const draftContext = getDraftContext(body.draftContext);

  if (!classId) {
    return NextResponse.json({ error: "Invalid classId." }, { status: 400 });
  }

  if (!sourceNodeIds) {
    return NextResponse.json({ error: "Invalid sourceNodeIds." }, { status: 400 });
  }

  if (!mode) {
    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  }

  if (!prompt) {
    return NextResponse.json({ error: "Invalid prompt." }, { status: 400 });
  }

  if (body.targetNoteId !== undefined && !getNodeId(body.targetNoteId)) {
    return NextResponse.json({ error: "Invalid targetNoteId." }, { status: 400 });
  }

  let provider;

  try {
    provider = getAiProvider();
  } catch (error) {
    console.error("[api/notes/generate] AI provider unavailable.", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI provider is unavailable.",
      },
      { status: 500 },
    );
  }

  let generatedTextPreview = "";

  try {
    const { parts } = await buildSourceContextParts({
      classId,
      draftContext,
      nodeIds: sourceNodeIds,
      supabase: authResult.supabase,
    });

    const generatedText = await provider.generateText({
      messages: [
        {
          role: "user",
          parts: [
            {
              text: [
                `Generation mode: ${mode}.`,
                title ? `Suggested title: ${title}.` : "Suggested title: none.",
                `User instruction: ${prompt}`,
                "Follow the user instruction exactly for scope, length, and structure.",
                "Only invent a larger study-note structure if the user did not specify one.",
                "Use the source material to produce final JSON for the note body only.",
              ].join("\n"),
            },
            ...parts,
          ],
        },
      ],
      responseJsonSchema: AI_NOTE_DOCUMENT_JSON_SCHEMA,
      responseMimeType: "application/json",
      systemInstruction: NOTE_GENERATION_SYSTEM_PROMPT,
    });
    generatedTextPreview = generatedText.slice(0, 800);

    const contentJson = normalizeGeneratedNoteDocument(generatedText);

    return NextResponse.json({
      contentJson,
      ...(title ? { title } : {}),
    });
  } catch (error) {
    console.error("[api/notes/generate] Note generation failed.", {
      error,
      generatedTextPreview,
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to generate note.",
      },
      { status: 500 },
    );
  }
}
