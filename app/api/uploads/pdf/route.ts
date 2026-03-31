import { NextResponse } from "next/server";
import {
  getSupabaseServerClient,
  getSupabaseStorageBucket,
} from "@/lib/supabase-server";

const MAX_PDF_UPLOAD_BYTES = 50 * 1024 * 1024;

function isPdfFile(file: File) {
  const fileName = file.name.toLowerCase();
  return file.type === "application/pdf" || fileName.endsWith(".pdf");
}

function buildPdfStoragePath(classId: string, fileId: string, fileName: string) {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${classId}/${fileId}/${safeName || "document.pdf"}`;
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  const bucket = getSupabaseStorageBucket();

  if (!supabase || !bucket) {
    return NextResponse.json(
      { error: "Supabase storage is not configured." },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const classId = formData.get("classId");
  const file = formData.get("file");

  if (typeof classId !== "string" || classId.length === 0) {
    return NextResponse.json({ error: "Missing classId." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }

  if (!isPdfFile(file)) {
    return NextResponse.json(
      { error: "Only PDF files can be uploaded." },
      { status: 400 },
    );
  }

  if (file.size > MAX_PDF_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "PDF exceeds the 50 MB limit." },
      { status: 400 },
    );
  }

  const fileId = crypto.randomUUID();
  const storagePath = buildPdfStoragePath(classId, fileId, file.name);
  const { error } = await supabase.storage.from(bucket).upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type || "application/pdf",
    upsert: false,
  });

  if (error) {
    return NextResponse.json(
      { error: "Unable to upload PDF to Supabase Storage." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    fileId,
    mimeType: file.type || "application/pdf",
    size: file.size,
    storagePath,
    title: file.name,
  });
}
