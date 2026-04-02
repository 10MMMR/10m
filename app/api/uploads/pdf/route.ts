import { NextResponse } from "next/server";
import { normalizeClassId } from "@/app/editor/class/[class-id]/_lib/workspace-data";
import { SupabaseTreeRepository } from "@/lib/supabase-tree-repository";
import {
  canParentContainChild,
  createNodeInTree,
  deleteNodeCascadeFromTree,
  type TreeNode,
} from "@/lib/tree-repository";
import {
  getSupabaseServerClient,
  getSupabaseStorageBucket,
} from "@/lib/supabase-server";

const MAX_PDF_UPLOAD_BYTES = 50 * 1024 * 1024;
const NODE_ID_PATTERN = /^[a-z0-9:_-]+$/i;

type DeleteRequestBody = {
  classId?: unknown;
  nodeIds?: unknown;
};

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim() || null;
}

async function getAuthenticatedUser(request: Request) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return { error: "Supabase storage is not configured.", status: 500, supabase: null };
  }

  const token = getBearerToken(request);

  if (!token) {
    return { error: "Unauthorized.", status: 401, supabase };
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

function sanitizePdfFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildPdfStoragePath(
  userId: string,
  classId: string,
  fileId: string,
  fileName: string,
) {
  const safeName = sanitizePdfFileName(fileName);
  return `${userId}/${classId}/${fileId}/${safeName || "document.pdf"}`;
}

function isPdfFile(file: File) {
  const fileName = file.name.toLowerCase();
  return file.type === "application/pdf" || fileName.endsWith(".pdf");
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

function getNodeId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue || !NODE_ID_PATTERN.test(normalizedValue)) {
    return null;
  }

  return normalizedValue;
}

function getParentId(value: FormDataEntryValue | unknown) {
  return getNodeId(value);
}

function getNodeIds(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const nextNodeIds: string[] = [];
  const seenNodeIds = new Set<string>();

  for (const entry of value) {
    const nodeId = getNodeId(entry);

    if (!nodeId) {
      return null;
    }

    if (seenNodeIds.has(nodeId)) {
      continue;
    }

    seenNodeIds.add(nodeId);
    nextNodeIds.push(nodeId);
  }

  return nextNodeIds;
}

function createFileNode(
  classId: string,
  fileId: string,
  file: File,
  parentId: string,
  storagePath: string,
): TreeNode {
  const timestamp = new Date().toISOString();

  return {
    id: fileId,
    classId,
    parentId,
    kind: "file",
    title: file.name,
    createdAt: timestamp,
    updatedAt: timestamp,
    fileStoragePath: storagePath,
    fileMimeType: file.type || "application/pdf",
    fileSize: file.size,
    order: 0,
  };
}

export async function POST(request: Request) {
  const authResult = await getAuthenticatedUser(request);

  if ("error" in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  const bucket = getSupabaseStorageBucket();

  if (!bucket) {
    return NextResponse.json(
      { error: "Supabase storage is not configured." },
      { status: 500 },
    );
  }

  const { supabase, user } = authResult;
  const formData = await request.formData();
  const classId = getClassId(formData.get("classId"));
  const parentId = getParentId(formData.get("parentId"));
  const file = formData.get("file");

  if (!classId) {
    return NextResponse.json({ error: "Invalid classId." }, { status: 400 });
  }

  if (!parentId) {
    return NextResponse.json({ error: "Missing parentId." }, { status: 400 });
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

  const repository = new SupabaseTreeRepository(supabase, user.id);
  let currentTree: TreeNode[];

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

  const parentNode = currentTree.find((node) => node.id === parentId);

  if (!parentNode) {
    return NextResponse.json({ error: "Invalid parentId." }, { status: 400 });
  }

  if (!canParentContainChild(parentNode.kind, "file")) {
    return NextResponse.json(
      { error: "Parent node cannot contain files." },
      { status: 400 },
    );
  }

  const fileId = crypto.randomUUID();
  const storagePath = buildPdfStoragePath(user.id, classId, fileId, file.name);
  const fileNode = createFileNode(classId, fileId, file, parentId, storagePath);
  const nextTree = createNodeInTree(currentTree, fileNode);
  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type || "application/pdf",
    upsert: false,
  });

  if (uploadError) {
    return NextResponse.json(
      { error: "Unable to upload PDF to Supabase Storage." },
      { status: 500 },
    );
  }

  try {
    const savedTree = await repository.replaceTree(classId, nextTree);
    const savedFileNode = savedTree.find((node) => node.id === fileId) ?? fileNode;

    return NextResponse.json({
      fileNode: savedFileNode,
      tree: savedTree,
    });
  } catch (error) {
    await supabase.storage.from(bucket).remove([storagePath]);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save PDF metadata.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const authResult = await getAuthenticatedUser(request);

  if ("error" in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  const bucket = getSupabaseStorageBucket();

  if (!bucket) {
    return NextResponse.json(
      { error: "Supabase storage is not configured." },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as DeleteRequestBody | null;
  const classId = getClassId(body?.classId);
  const nodeIds = getNodeIds(body?.nodeIds);

  if (!classId) {
    return NextResponse.json({ error: "Invalid classId." }, { status: 400 });
  }

  if (!nodeIds) {
    return NextResponse.json({ error: "Invalid nodeIds." }, { status: 400 });
  }

  const { supabase, user } = authResult;
  const repository = new SupabaseTreeRepository(supabase, user.id);
  let currentTree: TreeNode[];

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

  let nextTree = currentTree;

  nodeIds.forEach((nodeId) => {
    nextTree = deleteNodeCascadeFromTree(nextTree, classId, nodeId);
  });

  const removedIds = new Set(
    currentTree
      .map((node) => node.id)
      .filter((id) => !nextTree.some((node) => node.id === id)),
  );
  const filePaths = currentTree.flatMap((node) =>
    removedIds.has(node.id) && node.kind === "file" && node.fileStoragePath
      ? [node.fileStoragePath]
      : [],
  );

  let savedTree: TreeNode[];

  try {
    savedTree = await repository.replaceTree(classId, nextTree);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to delete item.",
      },
      { status: 500 },
    );
  }

  if (filePaths.length === 0) {
    return NextResponse.json({ removedPaths: [], tree: savedTree });
  }

  const { error: removeError } = await supabase.storage.from(bucket).remove(filePaths);

  if (removeError) {
    return NextResponse.json(
      {
        error: "Tree updated, but failed to remove one or more PDFs from storage.",
        orphanedPaths: filePaths,
        tree: savedTree,
        treeUpdated: true,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    removedPaths: filePaths,
    tree: savedTree,
  });
}
