import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeClassId } from "@/app/editor/class/[class-id]/_lib/workspace-data";
import {
  EMPTY_NOTE_DOCUMENT,
  noteDocumentToPlainText,
  parseNoteDocument,
  type NoteDocument,
} from "@/lib/note-document";
import { SupabaseTreeRepository } from "@/lib/supabase-tree-repository";
import type { AiMessage, AiPart } from "@/lib/ai/types";
import type { TreeNode } from "@/lib/tree-repository";
import {
  createSupabaseServerClient,
  getSupabasePdfStorageBucket,
} from "@/lib/supabase-server";

const NODE_ID_PATTERN = /^[a-z0-9:_-]+$/i;

export type DraftNoteContext = {
  nodeId: string;
  title: string;
  contentJson: NoteDocument;
};

export function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim() || null;
}

export async function getAuthenticatedAiRequest(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return { error: "Unauthorized.", status: 401 as const };
  }

  const supabase = createSupabaseServerClient(token);

  if (!supabase) {
    return { error: "Supabase auth is not configured.", status: 500 as const };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: "Unauthorized.", status: 401 as const };
  }

  return { supabase, user };
}

export function getClassId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = normalizeClassId(value);
  return /^[a-z0-9-]+$/.test(normalizedValue) ? normalizedValue : null;
}

export function getNodeId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue && NODE_ID_PATTERN.test(normalizedValue)
    ? normalizedValue
    : null;
}

export function getNodeIds(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const nextNodeIds: string[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    const nodeId = getNodeId(entry);

    if (!nodeId) {
      return null;
    }

    if (!seen.has(nodeId)) {
      seen.add(nodeId);
      nextNodeIds.push(nodeId);
    }
  }

  return nextNodeIds;
}

async function loadClassTree(
  supabase: SupabaseClient,
  classId: string,
) {
  const repository = new SupabaseTreeRepository(supabase);
  return repository.listTreeByClass(classId, { includeNoteContent: false });
}

function getEffectiveNoteNode(node: TreeNode, draftContext?: DraftNoteContext | null) {
  if (node.kind !== "note" || !draftContext || draftContext.nodeId !== node.id) {
    return node;
  }

  return {
    ...node,
    title: draftContext.title,
    contentJson: draftContext.contentJson,
  } satisfies TreeNode;
}

async function downloadPdfAsBase64(
  supabase: SupabaseClient,
  storagePath: string,
) {
  const bucket = getSupabasePdfStorageBucket();

  if (!bucket) {
    throw new Error("Supabase storage is not configured.");
  }

  const { data, error } = await supabase.storage.from(bucket).download(storagePath);

  if (error || !data) {
    throw new Error("Unable to load PDF context.");
  }

  return Buffer.from(await data.arrayBuffer()).toString("base64");
}

export async function buildSourceContextParts({
  classId,
  draftContext,
  nodeIds,
  supabase,
}: {
  classId: string;
  draftContext?: DraftNoteContext | null;
  nodeIds: string[];
  supabase: SupabaseClient;
}) {
  const tree = await loadClassTree(supabase, classId);
  const repository = new SupabaseTreeRepository(supabase);
  const noteIds = tree
    .filter((node) => node.kind === "note" && nodeIds.includes(node.id))
    .flatMap((node) => (node.noteId ? [node.noteId] : []));
  const noteMap = await repository.loadNotesByIds(classId, noteIds);
  const sourceNodes = nodeIds.map((nodeId) => {
    const node = tree.find((item) => item.id === nodeId);

    if (!node || (node.kind !== "note" && node.kind !== "file")) {
      throw new Error("One or more source nodes are invalid.");
    }

    if (node.kind !== "note") {
      return node;
    }

    const loadedNote = node.noteId ? noteMap.get(node.noteId) : null;

    return getEffectiveNoteNode({
      ...node,
      contentJson: loadedNote?.content_json,
      createdAt: loadedNote?.created_at ?? node.createdAt,
      title: loadedNote?.title ?? node.title,
      updatedAt: loadedNote?.updated_at ?? node.updatedAt,
    }, draftContext);
  });

  const parts: AiPart[] = [
    {
      text: [
        "Workspace source context:",
        ...sourceNodes.map(
          (node, index) => `${index + 1}. ${node.kind === "note" ? "Note" : "PDF"}: ${node.title}`,
        ),
      ].join("\n"),
    },
  ];

  for (const [index, node] of sourceNodes.entries()) {
    if (node.kind === "note") {
      parts.push({
        text: [
          `Source ${index + 1} note title: ${node.title}`,
          "Note text:",
          noteDocumentToPlainText(parseNoteDocument(node.contentJson ?? EMPTY_NOTE_DOCUMENT)),
        ].join("\n"),
      });
      continue;
    }

    if (!node.fileStoragePath) {
      throw new Error("PDF source is missing its storage path.");
    }

    const base64Data = await downloadPdfAsBase64(supabase, node.fileStoragePath);

    parts.push({
      text: `Source ${index + 1} PDF title: ${node.title}`,
    });
    parts.push({
      inlineData: {
        mimeType: node.fileMimeType ?? "application/pdf",
        data: base64Data,
      },
    });
  }

  return {
    parts,
    sourceNodes,
  };
}

export function buildChatMessagesWithContext({
  contextParts,
  messages,
}: {
  contextParts: AiPart[];
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  return [
    {
      role: "user",
      parts: contextParts,
    },
    ...messages.map(
      (message) =>
        ({
          role: message.role,
          parts: [{ text: message.content }],
        }) satisfies AiMessage,
    ),
  ] satisfies AiMessage[];
}
