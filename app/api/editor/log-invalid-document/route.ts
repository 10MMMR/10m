import { NextResponse } from "next/server";

type InvalidNoteDocumentBody = {
  classId?: unknown;
  error?: unknown;
  noteId?: unknown;
};

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
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
  const error = getString(body.error);

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
