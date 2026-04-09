"use client";

import { ChatBubbleLeftEllipsisIcon } from "@heroicons/react/24/outline";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { ChatPane } from "./chat-pane";
import { EditorPane } from "./editor-pane";
import {
  LeftPane,
  type SelectTreeNodeOptions,
  type TreeAddAction,
  type TreeMenuAction,
} from "./left-pane";
import { getWorkspaceSeed, type Message } from "../_lib/workspace-data";
import type { AssistantCommand } from "@/lib/ai/assistant-contract";
import {
  EMPTY_NOTE_DOCUMENT,
  parseNoteDocument,
  serializeNoteDocumentForComparison,
  type NoteDocument,
} from "@/lib/note-document";
import {
  SupabaseNoteSessionRepository,
  type NoteSession,
} from "@/lib/supabase-note-session-repository";
import { SupabaseTreeRepository } from "@/lib/supabase-tree-repository";
import {
  clearTreeUiState,
  loadTreeUiState,
  saveTreeUiState,
} from "@/lib/tree-ui-state";
import {
  canDropNode,
  canParentContainChild,
  createNodeInTree,
  createTreeFolderNode,
  createTreeNoteNode,
  deleteNodeCascadeFromTree,
  moveNodeInTree,
  type DropPosition,
  type TreeNode,
  type TreeNodeKind,
  updateNodeInTree,
} from "@/lib/tree-repository";

import { supabase } from "../../../../_global/authentication/supabaseClient";

const MAX_PDF_UPLOAD_BYTES = 50 * 1024 * 1024;
const PDF_SIGNED_URL_TTL_SECONDS = 60 * 60;
const AUTH_REQUIRED_MESSAGE = "Sign in with Google to access notes.";
const STORAGE_NOT_CONFIGURED_MESSAGE = "Supabase storage is not configured.";

type WorkspaceShellProps = {
  classId: string;
  imageStorageBucket: string | null;
  pdfStorageBucket: string | null;
};

type UploadFeedback = {
  type: "success" | "error";
  message: string;
};

type DeleteConfirmationState = {
  directDeleteIds: string[];
  cascadeDeleteIds: string[];
  message: string;
};

type SessionDeleteConfirmationState = {
  sessionId: string;
  message: string;
};

type UploadPdfResponse = {
  error?: string;
  fileNode?: TreeNode;
  tree?: TreeNode[];
};

type DeletePdfResponse = {
  error?: string;
  orphanedPaths?: string[];
  removedPaths?: string[];
  tree?: TreeNode[];
  treeUpdated?: boolean;
};

type SelectedPdfDocument = {
  title: string;
  dataUrl: string;
  mimeType: string;
  size: number | null;
  createdAt: string;
  updatedAt: string;
};

type ChatRequestMessage = {
  role: "user" | "assistant";
  content: string;
};

type DraftNoteContext = {
  nodeId: string;
  title: string;
  body: string;
};

type ChatResponse = {
  assistant?: AssistantCommand;
  error?: string;
};

type GenerateNoteResponse = {
  error?: string;
  html?: string;
  title?: string;
};

type AuthStatus = "loading" | "signed-out" | "signed-in" | "unavailable";

type GenerationSourceSnapshot = {
  noteTitles: string[];
  pdfTitles: string[];
  unitTitles: string[];
};

function getSelectableFiles(nodes: TreeNode[], selectedIds: string[]) {
  const childrenByParent = new Map<string, TreeNode[]>();
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const sourceIds = new Set<string>();

  nodes.forEach((node) => {
    if (!node.parentId) {
      return;
    }

    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  });

  const collectDescendants = (nodeId: string) => {
    const stack = [...(childrenByParent.get(nodeId) ?? [])];

    while (stack.length > 0) {
      const node = stack.pop();

      if (!node) {
        continue;
      }

      if (node.kind === "note" || node.kind === "file") {
        sourceIds.add(node.id);
      }

      const children = childrenByParent.get(node.id);

      if (children?.length) {
        stack.push(...children);
      }
    }
  };

  selectedIds.forEach((selectedId) => {
    const node = nodeById.get(selectedId);

    if (!node) {
      return;
    }

    if (node.kind === "note" || node.kind === "file") {
      sourceIds.add(node.id);
      return;
    }

    if (node.kind === "folder" || node.kind === "root") {
      collectDescendants(node.id);
    }
  });

  return nodes.filter(
    (node) =>
      sourceIds.has(node.id) && (node.kind === "note" || node.kind === "file"),
  );
}

function buildGenerationSourceSnapshot(
  nodes: TreeNode[],
  selectedIds: string[],
) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const sourceNodes = getSelectableFiles(nodes, selectedIds);
  const unitTitles: string[] = [];
  const seenUnitTitles = new Set<string>();

  selectedIds.forEach((selectedId) => {
    const node = nodeById.get(selectedId);

    if (!node || node.kind !== "folder") {
      return;
    }

    const nextTitle = node.title.trim();

    if (!nextTitle || seenUnitTitles.has(nextTitle)) {
      return;
    }

    seenUnitTitles.add(nextTitle);
    unitTitles.push(nextTitle);
  });

  const noteTitles = sourceNodes
    .filter((node) => node.kind === "note")
    .map((node) => node.title);
  const pdfTitles = sourceNodes
    .filter((node) => node.kind === "file")
    .map((node) => node.title);

  return {
    sourceNodes,
    snapshot: {
      noteTitles,
      pdfTitles,
      unitTitles,
    } satisfies GenerationSourceSnapshot,
  };
}

function formatMessageTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function createMessage(
  side: Message["side"],
  text: string,
  createdAt = new Date(),
): Message {
  return {
    author: side === "user" ? "You" : "StudyAI",
    time: formatMessageTime(createdAt),
    side,
    text,
  };
}

function toChatRequestMessages(messages: Message[]): ChatRequestMessage[] {
  return messages
    .map((message) => ({
      role: message.side === "assistant" ? "assistant" : "user",
      content: message.text.trim(),
    }))
    .filter((message) => message.content.length > 0);
}

function buildUpdatedNote(
  node: TreeNode,
  updates: Partial<Pick<TreeNode, "title" | "body">>,
) {
  return {
    ...node,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
}

function createNoteGenerationError({
  kind,
  message,
  retryInSeconds,
  targetContextId,
}: {
  kind: NoteGenerationErrorKind;
  message: string;
  retryInSeconds?: number;
  targetContextId?: string;
}) {
  const error = new Error(message) as NoteGenerationError;
  error.kind = kind;
  error.retryInSeconds = retryInSeconds;
  error.targetContextId = targetContextId;
  return error;
}

function isNoteGenerationError(value: unknown): value is NoteGenerationError {
  if (!value || typeof value !== "object") {
    return false;
  }

  const kind = Reflect.get(value, "kind");
  return kind === "error" || kind === "rate_limited";
}

function isSessionTableUnavailableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("editor_note_sessions");
}

function mapNoteDocument(
  node: NoteDocument,
  mapper: (node: NoteDocument) => NoteDocument,
): NoteDocument {
  const nextNode = mapper(node);

  if (!nextNode.content?.length) {
    return nextNode;
  }

  const nextContent = nextNode.content.map((child) =>
    mapNoteDocument(child, mapper),
  );

  return {
    ...nextNode,
    content: nextContent,
  };
}

function collectImageStoragePaths(document: NoteDocument) {
  const storagePaths = new Set<string>();

  mapNoteDocument(document, (node) => {
    if (
      (node.type === "image" || node.type === "inlineImage") &&
      typeof node.attrs?.storagePath === "string" &&
      node.attrs.storagePath.length > 0
    ) {
      storagePaths.add(node.attrs.storagePath);
    }

    return node;
  });

  return Array.from(storagePaths);
}

function replaceImageSources(
  document: NoteDocument,
  signedUrlByPath: Map<string, string>,
) {
  let changed = false;

  const nextDocument = mapNoteDocument(document, (node) => {
    if (node.type !== "image" && node.type !== "inlineImage") {
      return node;
    }

    const storagePath = node.attrs?.storagePath;

    if (typeof storagePath !== "string" || storagePath.length === 0) {
      return node;
    }

    const nextSrc = signedUrlByPath.get(storagePath);

    if (!nextSrc || node.attrs?.src === nextSrc) {
      return node;
    }

    changed = true;

    return {
      ...node,
      attrs: {
        ...node.attrs,
        src: nextSrc,
      },
    };
  });

  return changed ? nextDocument : document;
}

function sanitizeImageSourcesForPersistence(document: NoteDocument) {
  let changed = false;

  const nextDocument = mapNoteDocument(document, (node) => {
    if (node.type !== "image" && node.type !== "inlineImage") {
      return node;
    }

    const storagePath = node.attrs?.storagePath;

    if (typeof storagePath !== "string" || storagePath.length === 0) {
      return node;
    }

    if (node.attrs?.src === storagePath) {
      return node;
    }

    changed = true;

    return {
      ...node,
      attrs: {
        ...node.attrs,
        src: storagePath,
      },
    };
  });

  return changed ? nextDocument : document;
}

function isPdfFile(file: File) {
  const fileName = file.name.toLowerCase();
  return file.type === "application/pdf" || fileName.endsWith(".pdf");
}

function parentHasChildren(nodes: TreeNode[], parentId: string) {
  return nodes.some((node) => node.parentId === parentId);
}

function collectAncestorIds(nodes: TreeNode[], nodeId: string) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const expandedAncestorIds = new Set<string>();
  let current = nodeMap.get(nodeId);

  while (current?.parentId) {
    expandedAncestorIds.add(current.parentId);
    current = nodeMap.get(current.parentId);
  }

  return expandedAncestorIds;
}

function collectNodeAndDescendantIds(nodes: TreeNode[], nodeId: string) {
  const childrenByParent = new Map<string, string[]>();

  nodes.forEach((node) => {
    if (!node.parentId) {
      return;
    }

    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node.id);
    childrenByParent.set(node.parentId, children);
  });

  const ids = new Set<string>([nodeId]);
  const stack = [...(childrenByParent.get(nodeId) ?? [])];

  while (stack.length > 0) {
    const childId = stack.pop();

    if (!childId) {
      continue;
    }

    ids.add(childId);
    const children = childrenByParent.get(childId);

    if (children?.length) {
      stack.push(...children);
    }
  }

  return ids;
}

function expandSelectionWithDescendants(
  nodes: TreeNode[],
  selectedIds: string[],
) {
  const childrenByParent = new Map<string, string[]>();
  const allNodeIds = new Set(nodes.map((node) => node.id));
  const expandedIds: string[] = [];
  const seenIds = new Set<string>();

  nodes.forEach((node) => {
    if (!node.parentId) {
      return;
    }

    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node.id);
    childrenByParent.set(node.parentId, children);
  });

  const appendWithDescendants = (nodeId: string) => {
    if (!allNodeIds.has(nodeId)) {
      return;
    }

    const stack = [nodeId];

    while (stack.length > 0) {
      const currentId = stack.pop();

      if (!currentId || seenIds.has(currentId)) {
        continue;
      }

      seenIds.add(currentId);
      expandedIds.push(currentId);
      const children = childrenByParent.get(currentId);

      if (children?.length) {
        stack.push(...children);
      }
    }
  };

  selectedIds.forEach((nodeId) => appendWithDescendants(nodeId));

  return expandedIds;
}

function collectCascadeDeleteIds(nodes: TreeNode[], nodeIds: string[]) {
  const selectedIds = new Set(nodeIds);
  const directDeleteIds = nodeIds.filter((nodeId) => {
    const node = nodes.find((item) => item.id === nodeId);
    let parentId = node?.parentId ?? null;

    while (parentId) {
      if (selectedIds.has(parentId)) {
        return false;
      }

      parentId = nodes.find((item) => item.id === parentId)?.parentId ?? null;
    }

    return true;
  });

  const cascadeDeleteIds = new Set<string>();

  directDeleteIds.forEach((nodeId) => {
    cascadeDeleteIds.add(nodeId);

    nodes.forEach((node) => {
      let parentId = node.parentId;

      while (parentId) {
        if (parentId === nodeId) {
          cascadeDeleteIds.add(node.id);
          return;
        }

        parentId = nodes.find((item) => item.id === parentId)?.parentId ?? null;
      }
    });
  });

  return {
    directDeleteIds,
    cascadeDeleteIds: Array.from(cascadeDeleteIds),
  };
}

function buildGeneratedNoteTitle(
  sourceNodes: TreeNode[],
  overrideTitle?: string,
) {
  if (overrideTitle?.trim()) {
    return overrideTitle.trim();
  }

  const [firstNode] = sourceNodes;

  if (!firstNode) {
    return "Study Notes";
  }

  if (sourceNodes.length === 1) {
    return `Study Notes - ${firstNode.title}`;
  }

  return `Study Notes - ${firstNode.title} + ${sourceNodes.length - 1} more`;
}

function buildGeneratingNoteHtml() {
  return "<p><strong>Generating study notes...</strong></p><p>StudyAI is building a structured note from the selected material.</p>";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildGenerationFailureHtml(message: string) {
  return `<p><strong>Unable to generate note.</strong></p><p>${escapeHtml(message)}</p>`;
}

export function WorkspaceShell({
  classId,
  imageStorageBucket,
  pdfStorageBucket,
}: WorkspaceShellProps) {
  const workspace = getWorkspaceSeed(classId);
  // const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const treeRepository = useRef<SupabaseTreeRepository | null>(
    supabase ? new SupabaseTreeRepository(supabase) : null,
  );
  const noteSessionRepository = useRef<SupabaseNoteSessionRepository | null>(
    supabase ? new SupabaseNoteSessionRepository(supabase) : null,
  );
  const chatAbortControllerRef = useRef<AbortController | null>(null);
  const pdfUploadInputRef = useRef<HTMLInputElement>(null);
  const treeNodesRef = useRef<TreeNode[]>([]);
  const [lockIn, setLockIn] = useState(false);
  const [isLeftPaneCollapsed, setIsLeftPaneCollapsed] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isLgViewport, setIsLgViewport] = useState(false);
  const [isXlViewport, setIsXlViewport] = useState(false);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeKind, setSelectedNodeKind] = useState<TreeNodeKind | null>(
    null,
  );
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(
    null,
  );
  const [draftNoteNode, setDraftNoteNode] = useState<TreeNode | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] =
    useState<DeleteConfirmationState | null>(null);
  const [sessionDeleteConfirmation, setSessionDeleteConfirmation] =
    useState<SessionDeleteConfirmationState | null>(null);
  const [noteSessions, setNoteSessions] = useState<NoteSession[]>([]);
  const [isSessionStorageAvailable, setIsSessionStorageAvailable] =
    useState(true);
  const [chatSessions, setChatSessions] = useState<Record<string, Message[]>>(
    {},
  );
  const [chatInput, setChatInput] = useState("");
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<UploadFeedback | null>(
    null,
  );
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    supabase ? "loading" : "unavailable",
  );
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const pendingSignInUiResetUserIdRef = useRef<string | null>(null);
  const restoredTreeUiStateKeyRef = useRef<string | null>(null);
  const [pendingUploadParentId, setPendingUploadParentId] = useState<
    string | null
  >(null);

  const desktopGridColumns = isLeftPaneCollapsed
    ? isChatOpen
      ? "xl:grid-cols-[60px_minmax(0,1fr)_340px]"
      : "xl:grid-cols-[60px_minmax(0,1fr)]"
    : isChatOpen
      ? "xl:grid-cols-[280px_minmax(0,1fr)_340px]"
      : "xl:grid-cols-[280px_minmax(0,1fr)]";

  const desktopGridTemplateColumns = isLeftPaneCollapsed
    ? isXlViewport && isChatOpen
      ? "60px minmax(0,1fr) 340px"
      : "60px minmax(0,1fr)"
    : isXlViewport && isChatOpen
      ? "280px minmax(0,1fr) 340px"
      : isXlViewport
        ? "280px minmax(0,1fr)"
        : "250px minmax(0,1fr)";

  const rootNode = useMemo(
    () => treeNodes.find((node) => node.kind === "root") ?? null,
    [treeNodes],
  );
  const sessionById = useMemo(
    () => new Map(noteSessions.map((session) => [session.id, session])),
    [noteSessions],
  );
  const sessionNoteNodeIds = useMemo(
    () => new Set(noteSessions.map((session) => session.noteNodeId)),
    [noteSessions],
  );
  const visibleTreeNodes = useMemo(
    () =>
      treeNodes.filter(
        (node) => !(node.kind === "note" && sessionNoteNodeIds.has(node.id)),
      ),
    [sessionNoteNodeIds, treeNodes],
  );

  const activeEditorNote = selectedNodeKind === "note" ? draftNoteNode : null;
  const selectedFileNode = useMemo(() => {
    if (selectedNodeKind !== "file" || !selectedNodeId) {
      return null;
    }

    return treeNodes.find((node) => node.id === selectedNodeId) ?? null;
  }, [selectedNodeId, selectedNodeKind, treeNodes]);
  const activePdfDocument = useMemo(() => {
    if (!selectedFileNode || !selectedPdfUrl) {
      return null;
    }

    return {
      title: selectedFileNode.title,
      dataUrl: selectedPdfUrl,
      mimeType: selectedFileNode.fileMimeType || "application/pdf",
      size: selectedFileNode.fileSize ?? null,
      createdAt: selectedFileNode.createdAt,
      updatedAt: selectedFileNode.updatedAt,
    } satisfies SelectedPdfDocument;
  }, [selectedFileNode, selectedPdfUrl]);
  const activeAiContextId =
    selectedNodeKind === "note" || selectedNodeKind === "file"
      ? selectedNodeId
      : null;
  const activeChatMessages = activeAiContextId
    ? (chatSessions[activeAiContextId] ?? [])
    : [];
  const activeDraftContext = useMemo(() => {
    if (!draftNoteNode || draftNoteNode.kind !== "note") {
      return null;
    }

    return {
      nodeId: draftNoteNode.id,
      title: draftNoteNode.title,
      body: draftNoteNode.body || "<p></p>",
    } satisfies DraftNoteContext;
  }, [draftNoteNode]);

  const resetWorkspaceState = useCallback(() => {
    setTreeNodes([]);
    setNoteSessions([]);
    setIsSessionStorageAvailable(true);
    setSelectedNodeIds([]);
    setSelectedNodeId(null);
    setSelectedNodeKind(null);
    setSelectionAnchorId(null);
    setDraftNoteNode(null);
    setExpandedIds(new Set());
    setSelectedPdfUrl(null);
    setIsDirty(false);
    setUploadFeedback(null);
    setIsUploadingPdf(false);
    setPendingUploadParentId(null);
  }, []);

  const refreshTree = useCallback(async () => {
    if (
      !treeRepository.current ||
      !noteSessionRepository.current ||
      !authUser
    ) {
      resetWorkspaceState();
      return {
        nodes: [],
        sessions: [],
      };
    }

    const nodesPromise = treeRepository.current.listTreeByClass(classId, {
      includeNoteContent: false,
    });
    const sessionsPromise = noteSessionRepository.current
      .listByClass(classId)
      .then((sessions) => ({
        available: true,
        sessions,
      }))
      .catch((error) => {
        if (isSessionTableUnavailableError(error)) {
          return {
            available: false,
            sessions: [] as NoteSession[],
          };
        }

        throw error;
      });
    const [nodes, sessionResult] = await Promise.all([
      nodesPromise,
      sessionsPromise,
    ]);
    const sessions = sessionResult.sessions;

    setTreeNodes(nodes);
    setIsSessionStorageAvailable(sessionResult.available);
    setNoteSessions(sessions);
    treeNodesRef.current = nodes;
    return { nodes, sessions };
  }, [authUser, classId, resetWorkspaceState]);

  const persistTree = useCallback(
    async (nextNodes: TreeNode[]) => {
      if (!treeRepository.current || !authUser) {
        throw new Error("Sign in with Google to save notes.");
      }

      const savedNodes = await treeRepository.current.replaceTree(
        classId,
        nextNodes,
      );
      setTreeNodes(savedNodes);
      treeNodesRef.current = savedNodes;
      return savedNodes;
    },
    [authUser, classId],
  );

  // const getAccessToken = useCallback(async () => {
  //   if (!supabase) {
  //     return null;
  //   }

  //   const {
  //     data: { session },
  //   } = await supabase.auth.getSession();

  //   return session?.access_token ?? null;
  // }, [supabase]);

  const syncSelectionState = useCallback(
    (
      nodes: TreeNode[],
      nextSelectedIds: string[],
      nextActiveId: string | null,
    ) => {
      const availableIds = new Set(nodes.map((node) => node.id));
      const uniqueSelectedIds = Array.from(new Set(nextSelectedIds)).filter(
        (id) => availableIds.has(id),
      );
      const activeId =
        nextActiveId && availableIds.has(nextActiveId)
          ? nextActiveId
          : (uniqueSelectedIds.at(-1) ?? null);
      const activeNode = activeId
        ? (nodes.find((node) => node.id === activeId) ?? null)
        : null;

      setSelectedNodeIds(uniqueSelectedIds);
      setSelectedNodeId(activeNode?.id ?? null);
      setSelectedNodeKind(activeNode?.kind ?? null);

      if (activeNode?.kind === "note") {
        setDraftNoteNode({
          ...activeNode,
          body: activeNode.body || "<p></p>",
        });
      } else {
        setDraftNoteNode(null);
      }

      setIsDirty(false);
    },
    [],
  );

  const setMessagesForContext = useCallback(
    (contextId: string, nextMessages: Message[]) => {
      setChatSessions((current) => ({
        ...current,
        [contextId]: nextMessages,
      }));
    },
    [],
  );

  useEffect(() => {
    treeNodesRef.current = treeNodes;
  }, [treeNodes]);

  useEffect(() => {
    if (!deleteConfirmation) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDeleteConfirmation(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [deleteConfirmation]);

  useEffect(() => {
    if (!deleteConfirmation) {
      return;
    }

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [deleteConfirmation]);

  useEffect(() => {
    if (authStatus !== "signed-in") {
      restoredTreeUiStateKeyRef.current = null;
      return;
    }
  }, [authStatus]);

  useEffect(() => {
    if (!authUser || treeNodes.length === 0) {
      return;
    }

    const restoreKey = `${authUser.id}:${classId}`;

    if (restoredTreeUiStateKeyRef.current !== restoreKey) {
      return;
    }

    if (pendingSignInUiResetUserIdRef.current === authUser.id) {
      return;
    }

    saveTreeUiState(authUser.id, classId, {
      expandedIds: Array.from(expandedIds),
      selectedNodeId: selectedNodeId,
    });
  }, [
    authUser,
    classId,
    expandedIds,
    selectedNodeId,
    selectedNodeKind,
    treeNodes.length,
  ]);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 767px)");

    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setLockIn(false);
      }
    };

    mobileQuery.addEventListener("change", handleViewportChange);
    return () =>
      mobileQuery.removeEventListener("change", handleViewportChange);
  }, []);

  useEffect(() => {
    const lgQuery = window.matchMedia("(min-width: 1024px)");
    const xlQuery = window.matchMedia("(min-width: 1280px)");

    const syncViewport = () => {
      setIsLgViewport(lgQuery.matches);
      setIsXlViewport(xlQuery.matches);
    };

    syncViewport();
    lgQuery.addEventListener("change", syncViewport);
    xlQuery.addEventListener("change", syncViewport);

    return () => {
      lgQuery.removeEventListener("change", syncViewport);
      xlQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  useEffect(() => {
    resetWorkspaceState();
    setIsDirty(false);
    chatAbortControllerRef.current?.abort();
    chatAbortControllerRef.current = null;
    setChatSessions({});
    setChatInput("");
    setIsChatStreaming(false);
  }, [classId, resetWorkspaceState]);

  useEffect(() => {
    chatAbortControllerRef.current?.abort();
    chatAbortControllerRef.current = null;
    setChatInput("");
    setIsChatStreaming(false);
  }, [activeAiContextId]);

  useEffect(
    () => () => {
      chatAbortControllerRef.current?.abort();
      chatAbortControllerRef.current = null;
    },
    [],
  );

  useEffect(() => {
    restoredTreeUiStateKeyRef.current = null;
  }, [classId]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const syncAuthSession = (session: Session | null) => {
      const nextUser = session?.user ?? null;
      setAuthUser(nextUser);
      setAuthStatus(nextUser ? "signed-in" : "signed-out");
    };

    void supabase.auth.getSession().then(({ data }) => {
      syncAuthSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (event === "SIGNED_IN" && session?.user?.id) {
          pendingSignInUiResetUserIdRef.current = session.user.id;
        }
        syncAuthSession(session);
      },
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (authStatus !== "signed-in" || !authUser) {
      return;
    }

    if (pendingSignInUiResetUserIdRef.current !== authUser.id) {
      return;
    }

    clearTreeUiState(authUser.id, classId);
    setExpandedIds(new Set());
    pendingSignInUiResetUserIdRef.current = null;
  }, [authStatus, authUser, classId]);

  useEffect(() => {
    if (authStatus !== "signed-in") {
      resetWorkspaceState();
      if (authStatus === "signed-out") {
        setUploadFeedback({
          type: "error",
          message: AUTH_REQUIRED_MESSAGE,
        });
      }
      return;
    }

    void refreshTree().catch((error) => {
      resetWorkspaceState();
      setUploadFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load notes from Supabase.",
      });
    });
  }, [authStatus, refreshTree, resetWorkspaceState]);

  useEffect(() => {
    if (authStatus !== "signed-in" || !authUser || treeNodes.length === 0) {
      return;
    }

    const restoreKey = `${authUser.id}:${classId}`;

    if (restoredTreeUiStateKeyRef.current === restoreKey) {
      return;
    }

    const persistedState = loadTreeUiState(authUser.id, classId);
    const nodeIds = new Set(treeNodes.map((node) => node.id));
    const nextExpandedIds = new Set(
      persistedState.expandedIds.filter((nodeId) => nodeIds.has(nodeId)),
    );

    setExpandedIds(nextExpandedIds);
    restoredTreeUiStateKeyRef.current = restoreKey;

    if (
      !persistedState.selectedNodeId ||
      !nodeIds.has(persistedState.selectedNodeId)
    ) {
      return;
    }

    const selectedNode = treeNodes.find(
      (node) => node.id === persistedState.selectedNodeId,
    );

    if (!selectedNode) {
      return;
    }

    syncSelectionState(treeNodes, [selectedNode.id], selectedNode.id);
    setSelectionAnchorId(selectedNode.id);
  }, [authStatus, authUser, classId, syncSelectionState, treeNodes]);

  useEffect(() => {
    if (!supabase || !storageBucket || !selectedFileNode?.fileStoragePath) {
      setSelectedPdfUrl(null);
      return;
    }

    let cancelled = false;

    void supabase.storage
      .from(storageBucket)
      .createSignedUrl(
        selectedFileNode.fileStoragePath,
        PDF_SIGNED_URL_TTL_SECONDS,
      )
      .then(({ data, error }) => {
        if (cancelled) {
          return;
        }

        if (error || !data?.signedUrl) {
          setSelectedPdfUrl(null);
          setUploadFeedback({
            type: "error",
            message: "Unable to load PDF preview.",
          });
          return;
        }

        setSelectedPdfUrl(data.signedUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFileNode, storageBucket, supabase]);

  const handleHideChat = () => {
    if (isChatOpen) {
      setIsChatOpen(false);
    }
  };

  const handleRestoreChat = () => {
    if (!isChatOpen) {
      setIsChatOpen(true);
    }
  };

  const handleSelectNode = (nodeId: string, options: SelectTreeNodeOptions) => {
    const node = treeNodes.find((item) => item.id === nodeId);

    if (!node) {
      return;
    }

    if (options.mode === "single") {
      const nextSelectedIds = expandSelectionWithDescendants(treeNodes, [
        node.id,
      ]);
      syncSelectionState(treeNodes, nextSelectedIds, node.id);
      setSelectionAnchorId(node.id);
      return;
    }

    if (options.mode === "toggle") {
      const isSelected = selectedNodeIds.includes(node.id);
      const nodeTreeIds = collectNodeAndDescendantIds(treeNodes, node.id);
      const nextSelectedIds = isSelected
        ? selectedNodeIds.filter((id) => !nodeTreeIds.has(id))
        : [...selectedNodeIds, node.id];
      const expandedSelectedIds = expandSelectionWithDescendants(
        treeNodes,
        nextSelectedIds,
      );
      const nextActiveId = isSelected
        ? selectedNodeId === node.id
          ? (expandedSelectedIds.at(-1) ?? null)
          : selectedNodeId
        : selectedNodeId && selectedNodeIds.includes(selectedNodeId)
          ? selectedNodeId
          : node.id;

      syncSelectionState(treeNodes, expandedSelectedIds, nextActiveId);
      setSelectionAnchorId(node.id);
      return;
    }

    const anchorId = selectionAnchorId ?? selectedNodeId ?? node.id;
    const anchorIndex = options.orderedNodeIds.indexOf(anchorId);
    const nodeIndex = options.orderedNodeIds.indexOf(node.id);

    if (anchorIndex < 0 || nodeIndex < 0) {
      syncSelectionState(treeNodes, [node.id], node.id);
      setSelectionAnchorId(node.id);
      return;
    }

    const start = Math.min(anchorIndex, nodeIndex);
    const end = Math.max(anchorIndex, nodeIndex);
    const nextSelectedIds = expandSelectionWithDescendants(
      treeNodes,
      options.orderedNodeIds.slice(start, end + 1),
    );
    const nextActiveId =
      selectedNodeId && nextSelectedIds.includes(selectedNodeId)
        ? selectedNodeId
        : node.id;

    syncSelectionState(treeNodes, nextSelectedIds, nextActiveId);
    setSelectionAnchorId(anchorId);
  };

  const handleToggleExpanded = useCallback((nodeId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }

      return next;
    });
  }, []);

  const persistNoteNode = useCallback(
    async (node: TreeNode) => {
      const savedNodes = await persistTree(
        updateNodeInTree(treeNodesRef.current, node),
      );
      syncSelectionState(savedNodes, [node.id], node.id);
      setSelectionAnchorId(node.id);
      setIsDirty(false);

      return savedNodes.find((item) => item.id === node.id) ?? node;
    },
    [persistTree, syncSelectionState],
  );

  const upsertNoteSession = useCallback(
    async ({
      noteNode,
      snapshot,
    }: {
      noteNode: TreeNode;
      snapshot: GenerationSourceSnapshot;
    }) => {
      if (!noteSessionRepository.current || noteNode.kind !== "note") {
        return null;
      }

      let session: NoteSession;

      try {
        session = await noteSessionRepository.current.upsertByNoteNode({
          classId,
          noteNodeId: noteNode.id,
          noteTitles: snapshot.noteTitles,
          pdfTitles: snapshot.pdfTitles,
          title: noteNode.title,
          unitTitles: snapshot.unitTitles,
        });
      } catch (error) {
        if (isSessionTableUnavailableError(error)) {
          setIsSessionStorageAvailable(false);
          throw new Error(
            "Session storage is unavailable. Run the latest migrations before generating notes.",
          );
        }

        throw error;
      }

      setNoteSessions((current) => {
        const next = [
          session,
          ...current.filter((item) => item.id !== session.id),
        ];
        return next.sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() -
            new Date(left.updatedAt).getTime(),
        );
      });

      return session;
    },
    [classId],
  );

  const createNoteUnderParent = async (
    parentId: string,
    options?: {
      markDirty?: boolean;
      title?: string;
    },
  ) => {
    if (!authUser) {
      setUploadFeedback({
        type: "error",
        message: AUTH_REQUIRED_MESSAGE,
      });
      return;
    }

    const parentNode = treeNodesRef.current.find(
      (node) => node.id === parentId,
    );

    if (!parentNode || !canParentContainChild(parentNode.kind, "note")) {
      return;
    }

    const created = createTreeNoteNode(
      classId,
      parentId,
      options?.title?.trim() || "Untitled note",
    );
    const nextNodes = createNodeInTree(treeNodesRef.current, created);
    const shouldOpenParent = !parentHasChildren(treeNodesRef.current, parentId);

    try {
      const savedNodes = await persistTree(nextNodes);
      const expandedAncestorIds = collectAncestorIds(savedNodes, created.id);
      if (shouldOpenParent) {
        expandedAncestorIds.add(parentId);
      }
      setExpandedIds(
        (current) => new Set([...current, ...expandedAncestorIds]),
      );
      syncSelectionState(savedNodes, [created.id], created.id);
      setSelectionAnchorId(created.id);
      setIsDirty(options?.markDirty ?? true);
      return savedNodes.find((node) => node.id === created.id) ?? created;
    } catch (error) {
      setUploadFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to create note.",
      });
    }

    return null;
  };

  const createFolderUnderParent = async (parentId: string) => {
    if (!authUser) {
      setUploadFeedback({
        type: "error",
        message: AUTH_REQUIRED_MESSAGE,
      });
      return;
    }

    const parentNode = treeNodesRef.current.find(
      (node) => node.id === parentId,
    );

    if (!parentNode || !canParentContainChild(parentNode.kind, "folder")) {
      return;
    }

    const created = createTreeFolderNode(classId, parentId);
    const nextNodes = createNodeInTree(treeNodesRef.current, created);
    const shouldOpenParent = !parentHasChildren(treeNodesRef.current, parentId);

    try {
      const savedNodes = await persistTree(nextNodes);
      const expandedAncestorIds = collectAncestorIds(savedNodes, created.id);
      if (shouldOpenParent) {
        expandedAncestorIds.add(parentId);
      }
      setExpandedIds(
        (current) => new Set([...current, ...expandedAncestorIds]),
      );
      syncSelectionState(savedNodes, [created.id], created.id);
      setSelectionAnchorId(created.id);
    } catch (error) {
      setUploadFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to create folder.",
      });
    }
  };

  const handleCreateFolder = () => {
    if (!rootNode) {
      return;
    }

    void createFolderUnderParent(rootNode.id);
  };

  const triggerUploadUnderParent = (parentId: string) => {
    const parentNode = treeNodes.find((node) => node.id === parentId);

    if (!parentNode || !canParentContainChild(parentNode.kind, "file")) {
      return;
    }

    setPendingUploadParentId(parentId);
    setUploadFeedback(null);
    pdfUploadInputRef.current?.click();
  };

  const handleAddAction = (nodeId: string, action: TreeAddAction) => {
    if (action === "note") {
      void createNoteUnderParent(nodeId);
      return;
    }

    if (action === "folder") {
      void createFolderUnderParent(nodeId);
      return;
    }

    triggerUploadUnderParent(nodeId);
  };

  const generateNoteFromSources = async ({
    chatSeedMessages,
    mode,
    prompt,
    sourceSnapshot,
    sourceNodes,
    targetNoteId,
    title,
  }: {
    chatSeedMessages?: Message[];
    mode: "new_note" | "overwrite_note";
    prompt: string;
    sourceSnapshot: GenerationSourceSnapshot;
    sourceNodes: TreeNode[];
    targetNoteId?: string;
    title?: string;
  }) => {
    if (!supabase || authStatus !== "signed-in") {
      throw new Error("Sign in with Google to use AI note generation.");
    }

    if (!rootNode) {
      throw new Error("Class root is unavailable.");
    }

    const accessToken = await getAccessToken();

    if (!accessToken) {
      throw new Error("Sign in with Google to use AI note generation.");
    }

    let effectiveMode = mode;
    const overwriteTargetNode =
      effectiveMode === "overwrite_note" && targetNoteId
        ? (treeNodesRef.current.find((node) => node.id === targetNoteId) ??
          null)
        : null;
    let targetContextId = overwriteTargetNode?.id ?? chatContextId;

    const fallbackTitle =
      overwriteTargetNode?.kind === "note" && !title
        ? overwriteTargetNode.title
        : buildGeneratedNoteTitle(sourceNodes, title);

    if (!overwriteTargetNode || overwriteTargetNode.kind !== "note") {
      effectiveMode = "new_note";
    }

    if (
      effectiveMode === "new_note" &&
      (!isSessionStorageAvailable || !noteSessionRepository.current)
    ) {
      const message =
        "Session storage is unavailable. Run the latest migrations before generating notes.";
      setUploadFeedback({
        type: "error",
        message,
      });
      throw createNoteGenerationError({
        kind: "error",
        message,
        targetContextId,
      });
    }

    const response = await fetch("/api/notes/generate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        classId,
        draftContext:
          activeDraftContext &&
          sourceNodes.some((node) => node.id === activeDraftContext.nodeId)
            ? activeDraftContext
            : null,
        mode: effectiveMode,
        prompt,
        sourceNodeIds: sourceNodes.map((node) => node.id),
        targetNoteId:
          effectiveMode === "overwrite_note" &&
          overwriteTargetNode &&
          overwriteTargetNode.kind === "note"
            ? overwriteTargetNode.id
            : undefined,
        title: fallbackTitle,
      }),
    });
    const payload = (await response
      .json()
      .catch(() => null)) as GenerateNoteResponse | null;

    if (!response.ok || !payload?.html) {
      const errorMessage = payload?.error || "Unable to generate note.";
      const failedNode = buildUpdatedNote(targetNode, {
        body: buildGenerationFailureHtml(errorMessage),
        title: fallbackTitle,
      });
      await persistNoteNode(failedNode);
      throw new Error(errorMessage);
    }

    let targetNode = overwriteTargetNode;

    if (
      effectiveMode === "new_note" ||
      !targetNode ||
      targetNode.kind !== "note"
    ) {
      targetNode =
        (await createNoteUnderParent(rootNode.id, {
          markDirty: false,
          title: fallbackTitle,
        })) ?? null;

      if (!targetNode || targetNode.kind !== "note") {
        throw createNoteGenerationError({
          kind: "error",
          message: "Unable to create a note for AI generation.",
          targetContextId: chatContextId,
        });
      }
    }

    targetContextId = targetNode.id;

    const completedNode = buildUpdatedNote(targetNode, {
      body: payload.html,
      title: payload.title?.trim() || fallbackTitle,
    });

    const savedNode = await persistNoteNode(completedNode);
    const isSessionNote = sessionNoteNodeIds.has(savedNode.id);
    const shouldUpsertSession =
      effectiveMode === "new_note" ||
      (effectiveMode === "overwrite_note" && isSessionNote);

    if (shouldUpsertSession) {
      await upsertNoteSession({
        noteNode: savedNode,
        snapshot: sourceSnapshot,
      });
    }

    return savedNode;
  };

  const handleMenuAction = async (nodeId: string, action: TreeMenuAction) => {
    const node = treeNodesRef.current.find((item) => item.id === nodeId);

    if (!node) {
      return;
    }

    if (action === "add") {
      if (
        node.kind === "root" ||
        node.kind === "folder" ||
        node.kind === "file"
      ) {
        await createNoteUnderParent(node.id);
      }
      return;
    }

    if (action === "generate-notes") {
      const selectedIds = selectedNodeIds.includes(node.id)
        ? selectedNodeIds
        : [node.id];
      const { sourceNodes: selectedSources, snapshot } =
        buildGenerationSourceSnapshot(treeNodesRef.current, selectedIds);

      if (selectedSources.length === 0) {
        return;
      }

      try {
        await generateNoteFromSources({
          mode: "new_note",
          prompt:
            "Create a premium-quality study note from the selected sources. Be concise, highly structured, exam-focused, and use tables or lists where they add clarity.",
          sourceSnapshot: snapshot,
          sourceNodes: selectedSources,
          title: buildGeneratedNoteTitle(selectedSources),
        });
      } catch (error) {
        setUploadFeedback({
          type: "error",
          message:
            error instanceof Error ? error.message : "Unable to generate note.",
        });
      }
      return;
    }

    if (node.kind === "root") {
      return;
    }

    const targetIds = selectedNodeIds.includes(node.id)
      ? selectedNodeIds.filter((selectedId) => {
          const selectedNode = treeNodesRef.current.find(
            (item) => item.id === selectedId,
          );
          return selectedNode?.kind !== "root";
        })
      : [node.id];
    const { directDeleteIds, cascadeDeleteIds } = collectCascadeDeleteIds(
      treeNodesRef.current,
      targetIds,
    );

    if (directDeleteIds.length === 0) {
      return;
    }

    const directDeleteNodes = directDeleteIds
      .map((deleteId) =>
        treeNodesRef.current.find((item) => item.id === deleteId),
      )
      .filter((item): item is TreeNode => Boolean(item));
    const nestedDeleteCount =
      cascadeDeleteIds.length - directDeleteNodes.length;
    const confirmMessage =
      directDeleteNodes.length === 1
        ? nestedDeleteCount > 0
          ? `Delete ${directDeleteNodes[0].title} and ${nestedDeleteCount} nested item(s)?`
          : `Delete ${directDeleteNodes[0].title}?`
        : nestedDeleteCount > 0
          ? `Delete ${directDeleteNodes.length} selected item(s) and ${nestedDeleteCount} nested item(s)?`
          : `Delete ${directDeleteNodes.length} selected item(s)?`;

    setDeleteConfirmation({
      directDeleteIds,
      cascadeDeleteIds,
      message: confirmMessage,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) {
      return;
    }

    const { directDeleteIds, cascadeDeleteIds } = deleteConfirmation;
    setDeleteConfirmation(null);

    const fileNodesToDelete = cascadeDeleteIds
      .map((deleteId) =>
        treeNodesRef.current.find((item) => item.id === deleteId),
      )
      .filter((item): item is TreeNode =>
        Boolean(item?.kind === "file" && item.fileStoragePath),
      );

    try {
      let nextNodes = treeNodesRef.current;

      if (fileNodesToDelete.length > 0) {
        const accessToken = await getAccessToken();

        if (!accessToken) {
          throw new Error(AUTH_REQUIRED_MESSAGE);
        }

        const response = await fetch("/api/uploads/pdf", {
          body: JSON.stringify({
            classId,
            nodeIds: directDeleteIds,
          }),
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          method: "DELETE",
        });
        const payload = (await response
          .json()
          .catch(() => null)) as DeletePdfResponse | null;

        if (!response.ok) {
          if (payload?.treeUpdated && payload.tree) {
            setTreeNodes(payload.tree);
            treeNodesRef.current = payload.tree;
            nextNodes = payload.tree;
          }

          throw new Error(
            payload?.orphanedPaths?.length
              ? `${payload.error} Retry cleanup for ${payload.orphanedPaths.length} file(s).`
              : payload?.error || "Unable to delete item.",
          );
        }

        nextNodes = payload?.tree ?? [];
      } else {
        directDeleteIds.forEach((deleteId) => {
          nextNodes = deleteNodeCascadeFromTree(nextNodes, classId, deleteId);
        });

        nextNodes = await persistTree(nextNodes);
      }

      const remainingSelectedIds = selectedNodeIds.filter((selectedId) =>
        nextNodes.some((item) => item.id === selectedId),
      );
      const nextActiveId =
        selectedNodeId && remainingSelectedIds.includes(selectedNodeId)
          ? selectedNodeId
          : (remainingSelectedIds.at(-1) ?? null);

      syncSelectionState(nextNodes, remainingSelectedIds, nextActiveId);

      if (
        selectionAnchorId &&
        !nextNodes.some((item) => item.id === selectionAnchorId)
      ) {
        setSelectionAnchorId(nextActiveId);
      }
    } catch (error) {
      setUploadFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to delete item.",
      });
      return;
    }
  };

  const handlePrepareRowMenu = (nodeId: string) => {
    if (selectedNodeIds.includes(nodeId)) {
      setSelectionAnchorId(nodeId);
    }
  };

  const handleMoveNode = (
    dragNodeId: string,
    targetNodeId: string,
    position: DropPosition,
  ) => {
    const nextNodes = moveNodeInTree(
      treeNodesRef.current,
      classId,
      dragNodeId,
      targetNodeId,
      position,
    );

    void persistTree(nextNodes).catch((error) => {
      setUploadFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to move item.",
      });
    });
  };

  const handleMoveSessionToTree = (
    sessionId: string,
    targetNodeId: string,
    position: DropPosition,
  ) => {
    const session = sessionById.get(sessionId);
    const sessionRepository = noteSessionRepository.current;

    if (!session || !sessionRepository) {
      return;
    }

    const dragNodeId = session.noteNodeId;

    if (
      !canDropNode(treeNodesRef.current, dragNodeId, targetNodeId, position)
    ) {
      return;
    }

    const nextNodes = moveNodeInTree(
      treeNodesRef.current,
      classId,
      dragNodeId,
      targetNodeId,
      position,
    );

    void persistTree(nextNodes)
      .then(async (savedNodes) => {
        if (typeof sessionRepository.deleteById === "function") {
          await sessionRepository.deleteById({
            classId,
            sessionId,
          });
        } else if (supabase) {
          const { error } = await supabase
            .from("editor_note_sessions")
            .delete()
            .eq("class_id", classId)
            .eq("id", sessionId);

          if (error) {
            throw error;
          }
        } else {
          throw new Error("Session storage is unavailable.");
        }

        setNoteSessions((current) =>
          current.filter((item) => item.id !== sessionId),
        );
        syncSelectionState(savedNodes, [dragNodeId], dragNodeId);
        setSelectionAnchorId(dragNodeId);
      })
      .catch((error) => {
        if (isSessionTableUnavailableError(error)) {
          setIsSessionStorageAvailable(false);
        }
        setUploadFeedback({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to move session note into tree.",
        });
      });
  };

  const handleRequestDeleteSession = (sessionId: string) => {
    const session = sessionById.get(sessionId);

    if (!session) {
      return;
    }

    setDeleteConfirmation(null);
    setSessionDeleteConfirmation({
      sessionId,
      message: `Delete ${session.title} from Sessions?`,
    });
  };

  const handleConfirmDeleteSession = async () => {
    if (!sessionDeleteConfirmation) {
      return;
    }

    const { sessionId } = sessionDeleteConfirmation;
    const sessionRepository = noteSessionRepository.current;
    setSessionDeleteConfirmation(null);

    try {
      if (typeof sessionRepository?.deleteById === "function") {
        await sessionRepository.deleteById({
          classId,
          sessionId,
        });
      } else if (supabase) {
        const { error } = await supabase
          .from("editor_note_sessions")
          .delete()
          .eq("class_id", classId)
          .eq("id", sessionId);

        if (error) {
          throw error;
        }
      } else {
        throw new Error("Session storage is unavailable.");
      }

      setNoteSessions((current) =>
        current.filter((item) => item.id !== sessionId),
      );
    } catch (error) {
      if (isSessionTableUnavailableError(error)) {
        setIsSessionStorageAvailable(false);
      }
      setUploadFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to delete session.",
      });
    }
  };

  const handleUploadPdfFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!file || !pendingUploadParentId) {
      return;
    }

    if (!isPdfFile(file)) {
      setUploadFeedback({
        type: "error",
        message: "Only PDF files can be uploaded.",
      });
      return;
    }

    if (file.size > MAX_PDF_UPLOAD_BYTES) {
      setUploadFeedback({
        type: "error",
        message: "PDF exceeds the 50 MB limit.",
      });
      return;
    }

    if (!authUser) {
      setUploadFeedback({
        type: "error",
        message: AUTH_REQUIRED_MESSAGE,
      });
      return;
    }

    if (!supabase || !storageBucket) {
      setUploadFeedback({
        type: "error",
        message: STORAGE_NOT_CONFIGURED_MESSAGE,
      });
      return;
    }

    setIsUploadingPdf(true);
    setUploadFeedback(null);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error(AUTH_REQUIRED_MESSAGE);
      }

      const formData = new FormData();
      formData.append("classId", classId);
      formData.append("parentId", pendingUploadParentId);
      formData.append("file", file);

      const response = await fetch("/api/uploads/pdf", {
        body: formData,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        method: "POST",
      });
      const payload = (await response
        .json()
        .catch(() => null)) as UploadPdfResponse | null;

      if (!response.ok || !payload?.tree || !payload.fileNode) {
        throw new Error(
          payload?.error || "Unable to upload PDF to Supabase Storage.",
        );
      }

      const shouldOpenParent = !parentHasChildren(
        treeNodesRef.current,
        pendingUploadParentId,
      );
      const savedNodes = payload.tree;
      const fileId = payload.fileNode.id;
      setTreeNodes(savedNodes);
      treeNodesRef.current = savedNodes;
      const expandedAncestorIds = collectAncestorIds(savedNodes, fileId);
      if (shouldOpenParent) {
        expandedAncestorIds.add(pendingUploadParentId);
      }
      setExpandedIds(
        (current) => new Set([...current, ...expandedAncestorIds]),
      );
      syncSelectionState(savedNodes, [fileId], fileId);
      setSelectionAnchorId(fileId);
      setUploadFeedback({
        type: "success",
        message: `Uploaded ${file.name}`,
      });
    } catch (error) {
      setUploadFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to upload PDF to Supabase Storage.",
      });
    } finally {
      setPendingUploadParentId(null);
      setIsUploadingPdf(false);
    }
  };

  const handleTitleChange = (title: string) => {
    setDraftNoteNode((current) => {
      if (!current || current.kind !== "note") {
        return current;
      }

      const next = buildUpdatedNote(current, { title });
      setIsDirty(true);
      return next;
    });
  };

  const handleBodyChange = (body: string) => {
    setDraftNoteNode((current) => {
      if (!current || current.kind !== "note" || current.body === body) {
        return current;
      }

      const next = buildUpdatedNote(current, { body });
      setIsDirty(true);
      return next;
    });
  };

  const handleUploadImage = useCallback(
    async (file: File, noteId: string) => {
      const uploadImageCooldownSeconds = getRemainingCooldown("uploadImage");

      if (uploadImageCooldownSeconds > 0) {
        throw new Error(
          `Image upload is temporarily rate limited. Try again in ${formatRetryDelay(uploadImageCooldownSeconds)}.`,
        );
      }

      if (!authUser) {
        throw new Error(AUTH_REQUIRED_MESSAGE);
      }

      if (!imageStorageBucket) {
        throw new Error(STORAGE_NOT_CONFIGURED_MESSAGE);
      }

      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error(AUTH_REQUIRED_MESSAGE);
      }

      const formData = new FormData();
      formData.append("classId", classId);
      formData.append("noteId", noteId);
      formData.append("file", file);

      const response = await fetch("/api/uploads/image", {
        body: formData,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        method: "POST",
      });
      const payload = (await response
        .json()
        .catch(() => null)) as UploadImageResponse | null;
      const uploadImageRateLimit = parseRateLimit(
        response,
        payload?.error ||
          "Too many image uploads. Please wait before retrying.",
      );

      if (uploadImageRateLimit.isRateLimited) {
        setCooldown("uploadImage", uploadImageRateLimit);
        throw new Error(
          `${uploadImageRateLimit.message} Try again in ${formatRetryDelay(uploadImageRateLimit.retryInSeconds)}.`,
        );
      }

      if (!response.ok || !payload?.signedUrl || !payload.storagePath) {
        throw new Error(payload?.error || "Unable to upload image.");
      }

      return {
        alt: payload.fileName ?? file.name,
        aspectRatio: null,
        mimeType: payload.mimeType ?? file.type ?? null,
        src: payload.signedUrl,
        storagePath: payload.storagePath,
        title: payload.fileName ?? file.name,
        width: null,
      };
    },
    [
      authUser,
      classId,
      getAccessToken,
      getRemainingCooldown,
      imageStorageBucket,
      setCooldown,
    ],
  );

  const handleSaveNote = async () => {
    if (!draftNoteNode || draftNoteNode.kind !== "note") {
      return;
    }

    try {
      const savedNodes = await persistTree(
        updateNodeInTree(treeNodesRef.current, {
          ...draftNoteNode,
          body: draftNoteNode.body || "<p></p>",
        }),
      );

      syncSelectionState(savedNodes, [draftNoteNode.id], draftNoteNode.id);
      setIsDirty(false);
    } catch (error) {
      setUploadFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to save note.",
      });
    }
  };

  const handleDeleteCurrentNote = () => {
    if (!draftNoteNode || draftNoteNode.kind !== "note") {
      return;
    }

    void handleMenuAction(draftNoteNode.id, "delete");
  };

  // const handleGoogleSignIn = () => {
  //   if (!supabase) {
  //     return;
  //   }

  //   void supabase.auth.signInWithOAuth({
  //     provider: "google",
  //     options: {
  //       redirectTo: window.location.href,
  //     },
  //   });
  // };

  // const handleSignOut = () => {
  //   if (!supabase) {
  //     return;
  //   }

  //   void supabase.auth.signOut();
  // };

  const handleChatSubmit = async () => {
    const trimmedInput = chatInput.trim();

    if (!trimmedInput || isChatStreaming || !activeAiContextId) {
      return;
    }

    const userMessage = createMessage("user", trimmedInput);
    const sourceContextId = activeAiContextId;
    const nextMessages = [...activeChatMessages, userMessage];

    if (!supabase || authStatus !== "signed-in") {
      setMessagesForContext(sourceContextId, [
        ...nextMessages,
        createMessage(
          "assistant",
          "Sign in with Google to use the chat assistant.",
        ),
      ]);
      setChatInput("");
      return;
    }

    setMessagesForContext(sourceContextId, nextMessages);
    setChatInput("");
    setIsChatStreaming(true);

    try {
      const controller = new AbortController();
      chatAbortControllerRef.current?.abort();
      chatAbortControllerRef.current = controller;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("Sign in with Google to use the chat assistant.");
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          activeNodeId: sourceContextId,
          classId,
          draftContext:
            activeDraftContext?.nodeId === sourceContextId
              ? activeDraftContext
              : null,
          messages: toChatRequestMessages(nextMessages),
        }),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as ChatResponse | null;

      if (!response.ok || !payload?.assistant) {
        throw new Error(
          payload?.error || "Unable to contact the chat assistant.",
        );
      }
      const assistantMessage = createMessage(
        "assistant",
        payload.assistant.message,
      );

      if (payload.assistant.action === "reply") {
        setMessagesForContext(sourceContextId, [
          ...nextMessages,
          assistantMessage,
        ]);
        return;
      }

      const { sourceNodes, snapshot } = buildGenerationSourceSnapshot(
        treeNodesRef.current,
        [sourceContextId],
      );

      if (sourceNodes.length === 0) {
        throw new Error("No note or PDF is available for note generation.");
      }

      const shouldOverwriteCurrent =
        payload.assistant.target === "current_note" &&
        selectedNodeKind === "note";

      if (shouldOverwriteCurrent) {
        setMessagesForContext(sourceContextId, [
          ...nextMessages,
          assistantMessage,
        ]);
      }

      await generateNoteFromSources({
        chatSeedMessages: shouldOverwriteCurrent
          ? undefined
          : [userMessage, assistantMessage],
        mode: shouldOverwriteCurrent ? "overwrite_note" : "new_note",
        prompt: payload.assistant.prompt,
        sourceSnapshot: snapshot,
        sourceNodes,
        targetNoteId: shouldOverwriteCurrent ? sourceContextId : undefined,
        title: payload.assistant.title,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      console.error("[chat] request error:", error);
      setUploadFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to contact the chat assistant.",
      });
    } finally {
      chatAbortControllerRef.current = null;
      setIsChatStreaming(false);
    }
  };

  const chatCooldownSeconds = getRemainingCooldown("chat");
  const isChatRateLimited = chatCooldownSeconds > 0;
  const isChatDisabled = !activeAiContextId || isChatRateLimited;
  const chatDisabledMessage = activeAiContextId
    ? `Chat is temporarily rate limited. Try again in ${formatRetryDelay(chatCooldownSeconds)}.`
    : "Open a note or PDF to chat with StudyAI.";
  const floatingPopupMessage =
    isUploadingPdf && !isUploadProgressDismissed
      ? "Uploading PDF..."
      : (uploadFeedback?.message ?? "");
  const floatingPopupVariant =
    isUploadingPdf && !isUploadProgressDismissed
      ? "info"
      : uploadFeedback?.type === "success"
        ? "success"
        : uploadFeedback?.type === "error"
          ? "error"
          : "info";
  const floatingPopupAutoDismissMs =
    isUploadingPdf && !isUploadProgressDismissed ? null : 8_000;
  const handleCloseFloatingPopup = () => {
    if (isUploadingPdf) {
      setIsUploadProgressDismissed(true);
      return;
    }

    setUploadFeedback(null);
  };

  const handleSelectSession = (sessionId: string) => {
    const session = sessionById.get(sessionId);

    if (!session) {
      return;
    }

    const targetNode = treeNodesRef.current.find(
      (node) => node.id === session.noteNodeId && node.kind === "note",
    );

    if (!targetNode) {
      return;
    }

    syncSelectionState(treeNodesRef.current, [targetNode.id], targetNode.id);
    setSelectionAnchorId(targetNode.id);
  };

  const handleClearSelectionToActive = () => {
    if (!selectedNodeId) {
      syncSelectionState(treeNodesRef.current, [], null);
      setSelectionAnchorId(null);
      return;
    }

    syncSelectionState(treeNodesRef.current, [selectedNodeId], selectedNodeId);
    setSelectionAnchorId(selectedNodeId);
  };

  return (
    <main className='workspace-shell flex h-screen flex-col overflow-hidden'>
      <FloatingPopupBanner
        autoDismissMs={floatingPopupAutoDismissMs}
        message={floatingPopupMessage}
        onClose={handleCloseFloatingPopup}
        open={Boolean(floatingPopupMessage)}
        testId='workspace-feedback'
        variant={floatingPopupVariant}
      />
      <input
        ref={pdfUploadInputRef}
        accept='application/pdf,.pdf'
        className='hidden'
        onChange={handleUploadPdfFile}
        type='file'
      />
      <div
        className={`grid min-h-0 flex-1 grid-cols-1 transition-[grid-template-columns] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isLeftPaneCollapsed ? "lg:grid-cols-[60px_minmax(0,1fr)]" : "lg:grid-cols-[250px_minmax(0,1fr)]"} ${desktopGridColumns}`}
        style={
          isLgViewport
            ? {
                gridTemplateColumns: desktopGridTemplateColumns,
              }
            : undefined
        }
      >
        <LeftPane
          key={`left-${classId}`}
          locked={lockIn}
          collapsed={isLeftPaneCollapsed}
          isLgViewport={isLgViewport}
          onCollapse={() => setIsLeftPaneCollapsed(true)}
          onExpand={() => setIsLeftPaneCollapsed(false)}
          treeNodes={visibleTreeNodes}
          allTreeNodesForDrop={treeNodes}
          expandedIds={expandedIds}
          selectedNodeIds={selectedNodeIds}
          selectedNodeId={selectedNodeId}
          classLabel={workspace.classLabel}
          sessions={noteSessions}
          onSelectSession={handleSelectSession}
          onRequestDeleteSession={handleRequestDeleteSession}
          onSelectNode={handleSelectNode}
          onClearSelectionToActive={handleClearSelectionToActive}
          onCreateFolder={handleCreateFolder}
          onAddAction={handleAddAction}
          onMenuAction={handleMenuAction}
          onPrepareRowMenu={handlePrepareRowMenu}
          onToggleExpanded={handleToggleExpanded}
          onMoveNode={handleMoveNode}
          onMoveSessionToTree={handleMoveSessionToTree}
        />
        <EditorPane
          lockIn={lockIn}
          onToggleLockIn={() => setLockIn((current) => !current)}
          noteId={activeEditorNote?.id ?? null}
          note={
            activeEditorNote
              ? {
                  title: activeEditorNote.title,
                  body: activeEditorNote.body || "<p></p>",
                  createdAt: activeEditorNote.createdAt,
                  updatedAt: activeEditorNote.updatedAt,
                }
              : null
          }
          pdfDocument={activePdfDocument}
          isDirty={isDirty}
          onTitleChange={handleTitleChange}
          onBodyChange={handleBodyChange}
          onSave={handleSaveNote}
          onDelete={handleDeleteCurrentNote}
          saveLabel='Save note'
          titleLabel='Note title'
          titlePlaceholder='Untitled note'
          emptyStateTitle='No note selected'
          emptyStateDescription='Create or select a note from the tree to start writing.'
        />
        {isChatOpen ? (
          <div className='relative h-full min-h-0 min-w-0 overflow-hidden lg:col-span-2 xl:col-span-1'>
            <ChatPane
              disabled={!activeAiContextId}
              disabledMessage='Open a note or PDF to chat with StudyAI.'
              locked={lockIn}
              isStreaming={isChatStreaming}
              onHide={handleHideChat}
              messages={activeChatMessages}
              inputValue={chatInput}
              onInputChange={setChatInput}
              onSubmit={handleChatSubmit}
            />
          </div>
        ) : null}
      </div>

      {!isChatOpen ? (
        <button
          className='fixed right-15 bottom-10 z-50 grid h-14 w-14 place-items-center rounded-full border border-(--border-strong) bg-(--main) text-(--text-contrast) shadow-(--shadow-accent) transition-transform duration-200 hover:scale-105 hover:shadow-(--shadow-accent-strong)'
          onClick={handleRestoreChat}
          type='button'
          aria-label='Show chat'
        >
          <ChatBubbleLeftEllipsisIcon className='h-6 w-6' aria-hidden='true' />
        </button>
      ) : null}

      {deleteConfirmation ? (
        <div
          aria-modal='true'
          className='fixed inset-0 z-50 flex items-center justify-center bg-(--overlay-scrim) p-4 backdrop-blur-sm'
          onClick={() => setDeleteConfirmation(null)}
          role='dialog'
        >
          <div
            className='w-full max-w-md rounded-3xl border border-(--border-floating) bg-(--surface-base) p-6 shadow-(--shadow-floating)'
            onClick={(event) => event.stopPropagation()}
          >
            <p className='text-xs font-semibold uppercase tracking-widest text-(--text-muted)'>
              Confirm deletion
            </p>
            <h2 className='mt-3 text-2xl font-semibold leading-tight text-(--text-main)'>
              {deleteConfirmation.message}
            </h2>
            <p className='mt-3 text-sm leading-6 text-(--text-body)'>
              This action permanently removes the selected note, folder, or file
              from this class workspace.
            </p>
            <div className='mt-6 flex items-center justify-end gap-3'>
              <button
                className='rounded-full border border-(--border-soft) bg-(--surface-input) px-5 py-2.5 text-sm font-semibold text-(--text-main) transition-colors duration-200 hover:bg-(--surface-main-faint)'
                onClick={() => setDeleteConfirmation(null)}
                type='button'
              >
                Cancel
              </button>
              <button
                className='rounded-full border border-(--destructive) bg-(--destructive) px-5 py-2.5 text-sm font-semibold text-(--destructive-foreground) transition-transform duration-200 hover:-translate-y-0.5'
                onClick={() => void handleConfirmDelete()}
                type='button'
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {sessionDeleteConfirmation ? (
        <div
          aria-modal='true'
          className='fixed inset-0 z-50 flex items-center justify-center bg-(--overlay-scrim) p-4 backdrop-blur-sm'
          onClick={() => setSessionDeleteConfirmation(null)}
          role='dialog'
        >
          <div
            className='w-full max-w-md rounded-3xl border border-(--border-floating) bg-(--surface-base) p-6 shadow-(--shadow-floating)'
            onClick={(event) => event.stopPropagation()}
          >
            <p className='text-xs font-semibold uppercase tracking-widest text-(--text-muted)'>
              Confirm deletion
            </p>
            <h2 className='mt-3 text-2xl font-semibold leading-tight text-(--text-main)'>
              {sessionDeleteConfirmation.message}
            </h2>
            <p className='mt-3 text-sm leading-6 text-(--text-body)'>
              This removes the session from this list but keeps its linked note
              in the class tree.
            </p>
            <div className='mt-6 flex items-center justify-end gap-3'>
              <button
                className='rounded-full border border-(--border-soft) bg-(--surface-input) px-5 py-2.5 text-sm font-semibold text-(--text-main) transition-colors duration-200 hover:bg-(--surface-main-faint)'
                onClick={() => setSessionDeleteConfirmation(null)}
                type='button'
              >
                Cancel
              </button>
              <button
                className='rounded-full border border-(--destructive) bg-(--destructive) px-5 py-2.5 text-sm font-semibold text-(--destructive-foreground) transition-transform duration-200 hover:-translate-y-0.5'
                onClick={() => void handleConfirmDeleteSession()}
                type='button'
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
