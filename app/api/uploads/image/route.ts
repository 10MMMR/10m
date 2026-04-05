import { NextResponse } from "next/server";
import { normalizeClassId } from "@/app/editor/class/[class-id]/_lib/workspace-data";
import { SupabaseTreeRepository } from "@/lib/supabase-tree-repository";
import {
  createSupabaseServerClient,
  getSupabaseImageStorageBucket,
} from "@/lib/supabase-server";

const NODE_ID_PATTERN = /^[a-z0-9:_-]+$/i;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/gif",
  "image/heic",
  "image/heic-sequence",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);
const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".gif",
  ".heic",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);
const IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 5;

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim() || null;
}

async function getAuthenticatedUser(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return { error: "Unauthorized.", status: 401, supabase: null };
  }

  const supabase = createSupabaseServerClient(token);

  if (!supabase) {
    return { error: "Supabase storage is not configured.", status: 500, supabase: null };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: "Unauthorized.", status: 401, supabase };
  }

  return { supabase, user };
}

function getClassId(value: FormDataEntryValue | unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = normalizeClassId(value);

  if (!/^[a-z0-9-]+$/.test(normalizedValue)) {
    return null;
  }

  return normalizedValue;
}

function getNodeId(value: FormDataEntryValue | unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue || !NODE_ID_PATTERN.test(normalizedValue)) {
    return null;
  }

  return normalizedValue;
}

function sanitizeImageFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildImageStoragePath(
  userId: string,
  classId: string,
  noteId: string,
  uploadId: string,
  fileName: string,
) {
  const safeName = sanitizeImageFileName(fileName);
  return `${userId}/${classId}/${noteId}/images/${uploadId}-${safeName || "image"}`;
}

function getExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");

  if (lastDotIndex < 0) {
    return "";
  }

  return fileName.slice(lastDotIndex).toLowerCase();
}

function isAllowedImage(file: File) {
  return (
    ALLOWED_IMAGE_MIME_TYPES.has(file.type) ||
    ALLOWED_IMAGE_EXTENSIONS.has(getExtension(file.name))
  );
}

export async function POST(request: Request) {
  const authResult = await getAuthenticatedUser(request);

  if ("error" in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  const bucket = getSupabaseImageStorageBucket();

  if (!bucket) {
    return NextResponse.json(
      { error: "Supabase storage is not configured." },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const classId = getClassId(formData.get("classId"));
  const noteId = getNodeId(formData.get("noteId"));
  const file = formData.get("file");

  if (!classId) {
    return NextResponse.json({ error: "Invalid classId." }, { status: 400 });
  }

  if (!noteId) {
    return NextResponse.json({ error: "Invalid noteId." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }

  if (!isAllowedImage(file)) {
    return NextResponse.json(
      {
        error:
          "Only JPEG, PNG, GIF, WEBP, SVG, and HEIC images can be uploaded.",
      },
      { status: 400 },
    );
  }

  const { supabase, user } = authResult;
  const repository = new SupabaseTreeRepository(supabase);
  let currentTree;

  try {
    currentTree = await repository.listTreeByClass(classId);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load class tree.",
      },
      { status: 400 },
    );
  }

  const noteNode = currentTree.find((node) => node.id === noteId);

  if (!noteNode || noteNode.kind !== "note") {
    return NextResponse.json(
      { error: "Invalid noteId." },
      { status: 400 },
    );
  }

  const uploadId = crypto.randomUUID();
  const storagePath = buildImageStoragePath(user.id, classId, noteId, uploadId, file.name);
  const contentType = file.type || "application/octet-stream";
  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, file, {
    cacheControl: "31536000",
    contentType,
    upsert: false,
  });

  if (uploadError) {
    return NextResponse.json(
      { error: "Unable to upload image to Supabase Storage." },
      { status: 500 },
    );
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, IMAGE_SIGNED_URL_TTL_SECONDS);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    await supabase.storage.from(bucket).remove([storagePath]);

    return NextResponse.json(
      { error: "Unable to generate an image URL." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    fileName: file.name,
    mimeType: contentType,
    signedUrl: signedUrlData.signedUrl,
    storagePath,
  });
}
