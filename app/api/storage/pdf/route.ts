import { NextResponse } from "next/server";
import {
  getSupabaseServerClient,
  getSupabaseStorageBucket,
} from "@/lib/supabase-server";

function getStoragePath(request: Request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get("path");
}

export async function GET(request: Request) {
  const supabase = getSupabaseServerClient();
  const bucket = getSupabaseStorageBucket();
  const storagePath = getStoragePath(request);

  if (!supabase || !bucket) {
    return NextResponse.json(
      { error: "Supabase storage is not configured." },
      { status: 500 },
    );
  }

  if (!storagePath) {
    return NextResponse.json({ error: "Missing storage path." }, { status: 400 });
  }

  const { data, error } = await supabase.storage.from(bucket).download(storagePath);

  if (error || !data) {
    return NextResponse.json({ error: "PDF not found." }, { status: 404 });
  }

  return new NextResponse(data, {
    headers: {
      "Cache-Control": "private, max-age=3600",
      "Content-Type": data.type || "application/pdf",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(request: Request) {
  const supabase = getSupabaseServerClient();
  const bucket = getSupabaseStorageBucket();
  const storagePath = getStoragePath(request);

  if (!supabase || !bucket) {
    return NextResponse.json(
      { error: "Supabase storage is not configured." },
      { status: 500 },
    );
  }

  if (!storagePath) {
    return NextResponse.json({ error: "Missing storage path." }, { status: 400 });
  }

  const { error } = await supabase.storage.from(bucket).remove([storagePath]);

  if (error) {
    return NextResponse.json(
      { error: "Unable to delete PDF from Supabase Storage." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
