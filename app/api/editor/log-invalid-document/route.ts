import { NextResponse } from "next/server";
import { getAuthenticatedAiRequest } from "@/lib/ai/server-context";
import { API_RATE_LIMITS } from "@/lib/api/rate-limit-rules";
import {
  buildRateLimitHeaders,
  consumeRateLimit,
  getRateLimitIdentity,
} from "@/lib/api/rate-limit";

type InvalidNoteDocumentBody = {
  classId?: unknown;
  error?: unknown;
  noteId?: unknown;
};

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clampErrorMessage(value: string) {
  return value.length > 500 ? value.slice(0, 500) : value;
}

export async function POST(request: Request) {
  const authResult = await getAuthenticatedAiRequest(request);

  if ("error" in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  const rateLimit = await consumeRateLimit({
    config: API_RATE_LIMITS.editorLogInvalidDocumentPost,
    identity: getRateLimitIdentity(request, authResult.user.id),
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: true, sampled: true },
      {
        status: 202,
        headers: buildRateLimitHeaders(rateLimit),
      },
    );
  }

  let body: InvalidNoteDocumentBody;

  try {
    body = (await request.json()) as InvalidNoteDocumentBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const classId = getString(body.classId);
  const noteId = getString(body.noteId);
  const error = clampErrorMessage(getString(body.error));

  if (!classId || !noteId || !error) {
    return NextResponse.json(
      { error: "classId, noteId, and error are required." },
      { status: 400 },
    );
  }

  console.error("Unsupported editor note document loaded.", {
    classId,
    error,
    noteId,
  });

  return NextResponse.json({ ok: true });
}
