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
import { Topbar } from "./topbar";
import { getWorkspaceSeed, type Message } from "../_lib/workspace-data";
import type { AssistantCommand } from "@/lib/ai/assistant-contract";
import {
  EMPTY_NOTE_DOCUMENT,
  parseNoteDocument,
  serializeNoteDocumentForComparison,
  type NoteDocument,
} from "@/lib/note-document";
import { SupabaseTreeRepository } from "@/lib/supabase-tree-repository";
import {
  clearTreeUiState,
  loadTreeUiState,
  saveTreeUiState,
} from "@/lib/tree-ui-state";
import {
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
import { handleGoogleSignIn } from "../../../../_global/authentication/authentication";
import { handleSignOut } from "../../../../_global/authentication/authentication";

const MAX_PDF_UPLOAD_BYTES = 50 * 1024 * 1024;
const PDF_SIGNED_URL_TTL_SECONDS = 60 * 60;
const AUTH_REQUIRED_MESSAGE = "Sign in with Google to access notes.";
const STORAGE_NOT_CONFIGURED_MESSAGE = "Supabase storage is not configured.";

type WorkspaceShellProps = {
  classId: string;
  imageStorageBucket: string | null;
  pdfStorageBucket: string | null;
  requestedClassId: string;
  usedFallback: boolean;
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

type UploadPdfResponse = {
  error?: string;
  fileNode?: TreeNode;
  tree?: TreeNode[];
};

type UploadImageResponse = {
  error?: string;
  fileName?: string;
  mimeType?: string;
  signedUrl?: string;
  storagePath?: string;
};

const IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 5;

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

type InvalidNoteDocumentLogPayload = {
  classId: string;
  error: string;
  noteId: string;
};

type DraftNoteContext = {
  nodeId: string;
  title: string;
  contentJson: NoteDocument;
};

type ChatResponse = {
  assistant?: AssistantCommand;
  error?: string;
};

type GenerateNoteResponse = {
  contentJson?: NoteDocument;
  error?: string;
  title?: string;
};

type AuthStatus = "loading" | "signed-out" | "signed-in" | "unavailable";

function getSelectableFiles(nodes: TreeNode[], selectedIds: string[]) {
  const selectedIdSet = new Set(selectedIds);

  return nodes.filter(
    (node) =>
      selectedIdSet.has(node.id) &&
      (node.kind === "note" || node.kind === "file"),
  );
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
      role: (message.side === "assistant" ? "assistant" : "user") as ChatRequestMessage["role"],
      content: message.text.trim(),
    }))
    .filter((message) => message.content.length > 0);
}

function buildUpdatedNote(
  node: TreeNode,
  updates: Partial<Pick<TreeNode, "contentJson" | "title">>,
  options?: {
    touchUpdatedAt?: boolean;
  },
) {
  return {
    ...node,
    ...updates,
    updatedAt:
      options?.touchUpdatedAt === false ? node.updatedAt : new Date().toISOString(),
  };
}

function mapNoteDocument(
  node: NoteDocument,
  mapper: (node: NoteDocument) => NoteDocument,
): NoteDocument {
  const nextNode = mapper(node);

  if (!nextNode.content?.length) {
    return nextNode;
  }

  const nextContent = nextNode.content.map((child) => mapNoteDocument(child, mapper));

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

function buildGeneratingNoteDocument(): NoteDocument {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", marks: [{ type: "bold" }], text: "Generating study notes..." }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "StudyAI is building a structured note from the selected material.",
          },
        ],
      },
    ],
  };
}

function buildGenerationFailureDocument(message: string): NoteDocument {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", marks: [{ type: "bold" }], text: "Unable to generate note." }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: message }],
      },
    ],
  };
}

export function WorkspaceShell({
  classId,
  imageStorageBucket,
  pdfStorageBucket,
  requestedClassId,
  usedFallback,
}: WorkspaceShellProps) {
  const workspace = getWorkspaceSeed(classId);
  const treeRepository = useRef<SupabaseTreeRepository | null>(
    supabase ? new SupabaseTreeRepository(supabase) : null,
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
  const [isLoadingSelectedNote, setIsLoadingSelectedNote] = useState(false);
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
      contentJson: draftNoteNode.contentJson ?? EMPTY_NOTE_DOCUMENT,
    } satisfies DraftNoteContext;
  }, [draftNoteNode]);
  const draftNoteId = draftNoteNode?.kind === "note" ? draftNoteNode.id : null;
  const draftNoteImageStoragePaths = useMemo(() => {
    if (!draftNoteNode || draftNoteNode.kind !== "note") {
      return [];
    }

    return collectImageStoragePaths(draftNoteNode.contentJson ?? EMPTY_NOTE_DOCUMENT);
  }, [draftNoteNode]);
  const draftNoteImageStoragePathKey = useMemo(
    () => draftNoteImageStoragePaths.join("|"),
    [draftNoteImageStoragePaths],
  );
  const draftNoteImageStoragePathsRef = useRef(draftNoteImageStoragePaths);

  const resetWorkspaceState = useCallback(() => {
    setTreeNodes([]);
    setSelectedNodeIds([]);
    setSelectedNodeId(null);
    setSelectedNodeKind(null);
    setSelectionAnchorId(null);
    setDraftNoteNode(null);
    setIsLoadingSelectedNote(false);
    setExpandedIds(new Set());
    setSelectedPdfUrl(null);
    setIsDirty(false);
    setUploadFeedback(null);
    setIsUploadingPdf(false);
    setPendingUploadParentId(null);
  }, []);

  const refreshTree = useCallback(async () => {
    if (!treeRepository.current || !authUser) {
      resetWorkspaceState();
      return [];
    }
    const nodes = await treeRepository.current.listTreeByClass(classId, {
      includeNoteContent: false,
    });
    setTreeNodes(nodes);
    treeNodesRef.current = nodes;
    return nodes;
  }, [authUser, classId, resetWorkspaceState]);

  const logInvalidNoteDocument = useCallback(async ({
    classId,
    error,
    noteId,
  }: InvalidNoteDocumentLogPayload) => {
    try {
      await fetch("/api/editor/log-invalid-document", {
        body: JSON.stringify({
          classId,
          error,
          noteId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
    } catch {
      // Logging should never block the editor from loading.
    }
  }, []);

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

  const getAccessToken = useCallback(async () => {
    if (!supabase) {
      return null;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  }, []);

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
        });
      } else {
        setDraftNoteNode(null);
      }

      setIsDirty(false);
    },
    [],
  );

  useEffect(() => {
    if (!treeRepository.current || selectedNodeKind !== "note" || !selectedNodeId) {
      setIsLoadingSelectedNote(false);
      return;
    }

    const selectedNote = treeNodes.find((node) => node.id === selectedNodeId);

    if (!selectedNote || selectedNote.kind !== "note") {
      setIsLoadingSelectedNote(false);
      return;
    }

    if (selectedNote.contentJson !== undefined) {
      setIsLoadingSelectedNote(false);
      return;
    }

    if (!selectedNote.noteId) {
      setIsLoadingSelectedNote(false);
      return;
    }

    let cancelled = false;
    setIsLoadingSelectedNote(true);

    void treeRepository.current.loadNoteById(classId, selectedNote.noteId, {
      onInvalidNoteDocument: logInvalidNoteDocument,
    }).then((loadedNote) => {
      if (cancelled) {
        return;
      }

      if (!loadedNote?.content_json) {
        throw new Error("Unable to load note.");
      }

      const hydratedNote: TreeNode = {
        ...selectedNote,
        contentJson: loadedNote.content_json,
        createdAt: loadedNote.created_at,
        title: loadedNote.title,
        updatedAt: loadedNote.updated_at,
      };

      setTreeNodes((current) => {
        const nextNodes = updateNodeInTree(current, hydratedNote);
        treeNodesRef.current = nextNodes;
        return nextNodes;
      });
      setDraftNoteNode((current) =>
        current?.kind === "note" && current.id === hydratedNote.id ? hydratedNote : current,
      );
      setIsLoadingSelectedNote(false);
    }).catch((error) => {
      if (cancelled) {
        return;
      }

      setIsLoadingSelectedNote(false);
      setUploadFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load note.",
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    classId,
    logInvalidNoteDocument,
    selectedNodeId,
    selectedNodeKind,
    treeNodes,
  ]);

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
  }, [classId, resetWorkspaceState, workspace.messages]);

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
  }, []);

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
    if (!supabase || !pdfStorageBucket || !selectedFileNode?.fileStoragePath) {
      setSelectedPdfUrl(null);
      return;
    }

    let cancelled = false;

    void supabase.storage
      .from(pdfStorageBucket)
      .createSignedUrl(selectedFileNode.fileStoragePath, PDF_SIGNED_URL_TTL_SECONDS)
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
  }, [pdfStorageBucket, selectedFileNode]);

  useEffect(() => {
    draftNoteImageStoragePathsRef.current = draftNoteImageStoragePaths;
  }, [draftNoteImageStoragePathKey, draftNoteImageStoragePaths]);

  useEffect(() => {
    if (!supabase || !imageStorageBucket || !draftNoteId) {
      return;
    }

    const storagePaths = draftNoteImageStoragePathsRef.current;

    if (storagePaths.length === 0) {
      return;
    }

    let cancelled = false;

    void supabase.storage
      .from(imageStorageBucket)
      .createSignedUrls(storagePaths, IMAGE_SIGNED_URL_TTL_SECONDS)
      .then(({ data, error }) => {
        if (cancelled || error || !data) {
          return;
        }

        const signedUrlByPath = new Map<string, string>();

        data.forEach((entry, index) => {
          const storagePath = storagePaths[index];

          if (storagePath && entry?.signedUrl) {
            signedUrlByPath.set(storagePath, entry.signedUrl);
          }
        });

        if (signedUrlByPath.size === 0) {
          return;
        }

        setDraftNoteNode((current) => {
          if (!current || current.kind !== "note" || current.id !== draftNoteId) {
            return current;
          }

          const currentDocument = current.contentJson ?? EMPTY_NOTE_DOCUMENT;
          const nextDocument = replaceImageSources(currentDocument, signedUrlByPath);

          if (
            serializeNoteDocumentForComparison(currentDocument) ===
            serializeNoteDocumentForComparison(nextDocument)
          ) {
            return current;
          }

          return buildUpdatedNote(
            current,
            {
              contentJson: nextDocument,
            },
            {
              touchUpdatedAt: false,
            },
          );
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    draftNoteId,
    draftNoteImageStoragePathKey,
    imageStorageBucket,
  ]);

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
      syncSelectionState(treeNodes, [node.id], node.id);
      setSelectionAnchorId(node.id);
      return;
    }

    if (options.mode === "toggle") {
      const isSelected = selectedNodeIds.includes(node.id);
      const nextSelectedIds = isSelected
        ? selectedNodeIds.filter((id) => id !== node.id)
        : [...selectedNodeIds, node.id];
      const nextActiveId = isSelected
        ? selectedNodeId === node.id
          ? (nextSelectedIds.at(-1) ?? null)
          : selectedNodeId
        : selectedNodeId && selectedNodeIds.includes(selectedNodeId)
          ? selectedNodeId
          : node.id;

      syncSelectionState(treeNodes, nextSelectedIds, nextActiveId);
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
    const nextSelectedIds = options.orderedNodeIds.slice(start, end + 1);
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
      const noteToPersist =
        node.kind === "note"
          ? {
              ...node,
              contentJson: sanitizeImageSourcesForPersistence(
                node.contentJson ?? EMPTY_NOTE_DOCUMENT,
              ),
            }
          : node;

      const savedNodes = await persistTree(updateNodeInTree(treeNodesRef.current, noteToPersist));
      syncSelectionState(savedNodes, [noteToPersist.id], noteToPersist.id);
      setSelectionAnchorId(noteToPersist.id);
      setIsDirty(false);

      return savedNodes.find((item) => item.id === noteToPersist.id) ?? noteToPersist;
    },
    [persistTree, syncSelectionState],
  );

  const setDraftNoteContent = useCallback((
    noteId: string,
    title: string,
    contentJson: NoteDocument,
  ) => {
    setDraftNoteNode((current) => {
      if (!current || current.kind !== "note" || current.id !== noteId) {
        return current;
      }

      return buildUpdatedNote(
        current,
        { contentJson, title },
        { touchUpdatedAt: false },
      );
    });
  }, []);

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
    sourceNodes,
    targetNoteId,
    title,
  }: {
    chatSeedMessages?: Message[];
    mode: "new_note" | "overwrite_note";
    prompt: string;
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
    let targetNode: TreeNode | null =
      effectiveMode === "overwrite_note" && targetNoteId
        ? (treeNodesRef.current.find((node) => node.id === targetNoteId) ??
          null)
        : null;

    const fallbackTitle =
      targetNode?.kind === "note" && !title
        ? targetNode.title
        : buildGeneratedNoteTitle(sourceNodes, title);

    if (!targetNode || targetNode.kind !== "note") {
      effectiveMode = "new_note";
      targetNode = (await createNoteUnderParent(rootNode.id, {
        markDirty: false,
        title: fallbackTitle,
      })) ?? null;

      if (!targetNode || targetNode.kind !== "note") {
        throw new Error("Unable to create a note for AI generation.");
      }

      if (chatSeedMessages) {
        setMessagesForContext(targetNode.id, chatSeedMessages);
      }
    }

    setDraftNoteContent(targetNode.id, fallbackTitle, buildGeneratingNoteDocument());
    setIsDirty(false);

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
        targetNoteId: targetNode.id,
        title: fallbackTitle,
      }),
    });
    const payload = (await response
      .json()
      .catch(() => null)) as GenerateNoteResponse | null;

    if (!response.ok || !payload?.contentJson) {
      const errorMessage = payload?.error || "Unable to generate note.";
      const failedNode = buildUpdatedNote(targetNode, {
        contentJson: buildGenerationFailureDocument(errorMessage),
        title: fallbackTitle,
      });
      await persistNoteNode(failedNode);
      throw new Error(errorMessage);
    }

    const completedNode = buildUpdatedNote(targetNode, {
      contentJson: parseNoteDocument(payload.contentJson),
      title: payload.title?.trim() || fallbackTitle,
    });

    await persistNoteNode(completedNode);
    return completedNode;
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
      const selectedSources = getSelectableFiles(
        treeNodesRef.current,
        selectedIds,
      );

      if (selectedSources.length === 0) {
        return;
      }

      try {
        await generateNoteFromSources({
          mode: "new_note",
          prompt:
            "Create a premium-quality study note from the selected sources. Be concise, highly structured, exam-focused, and use tables or lists where they add clarity.",
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
      return;
    }

    syncSelectionState(treeNodes, [nodeId], nodeId);
    setSelectionAnchorId(nodeId);
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

    if (!supabase || !pdfStorageBucket) {
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

      const next = buildUpdatedNote(current, { title }, { touchUpdatedAt: false });
      setIsDirty(true);
      return next;
    });
  };

  const handleBodyChange = (contentJson: NoteDocument) => {
    setDraftNoteNode((current) => {
      if (!current || current.kind !== "note") {
        return current;
      }

      if (
        serializeNoteDocumentForComparison(current.contentJson ?? EMPTY_NOTE_DOCUMENT) ===
        serializeNoteDocumentForComparison(contentJson)
      ) {
        return current;
      }

      const next = buildUpdatedNote(current, { contentJson }, { touchUpdatedAt: false });
      setIsDirty(true);
      return next;
    });
  };

  const handleUploadImage = useCallback(
    async (file: File, noteId: string) => {
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
      const payload = (await response.json().catch(() => null)) as UploadImageResponse | null;

      if (!response.ok || !payload?.signedUrl || !payload.storagePath) {
        throw new Error(payload?.error || "Unable to upload image.");
      }

      return {
        alt: payload.fileName ?? file.name,
        mimeType: payload.mimeType ?? file.type ?? null,
        src: payload.signedUrl,
        storagePath: payload.storagePath,
        title: payload.fileName ?? file.name,
        width: null,
      };
    },
    [authUser, classId, getAccessToken, imageStorageBucket],
  );

  const handleSaveNote = async () => {
    if (!draftNoteNode || draftNoteNode.kind !== "note") {
      return;
    }

    try {
      const currentDraft = draftNoteNode;
      const persistedContentJson = sanitizeImageSourcesForPersistence(
        currentDraft.contentJson ?? EMPTY_NOTE_DOCUMENT,
      );
      const savedNodes = await persistTree(
        updateNodeInTree(treeNodesRef.current, {
          ...currentDraft,
          contentJson: persistedContentJson,
        }),
      );

      syncSelectionState(savedNodes, [currentDraft.id], currentDraft.id);
      setDraftNoteNode((current) => {
        if (!current || current.kind !== "note" || current.id !== currentDraft.id) {
          return current;
        }

        return buildUpdatedNote(
          current,
          {
            contentJson: currentDraft.contentJson ?? EMPTY_NOTE_DOCUMENT,
            title: currentDraft.title,
          },
          { touchUpdatedAt: false },
        );
      });
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

      const sourceNodes = getSelectableFiles(treeNodesRef.current, [
        sourceContextId,
      ]);

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

  const authLabel =
    authStatus === "loading"
      ? "Checking auth..."
      : authStatus === "unavailable"
        ? "Supabase unavailable"
        : authStatus === "signed-in"
          ? authUser?.email || authUser?.id || "Signed in"
          : "Continue with Google";

  return (
    <main className='workspace-shell flex h-screen flex-col overflow-hidden'>
      <Topbar
        classId={classId}
        requestedClassId={requestedClassId}
        usedFallback={usedFallback}
        workspaceName={workspace.workspaceName}
        classLabel={workspace.classLabel}
        lockIn={lockIn}
        isAuthReady={authStatus !== "loading" && authStatus !== "unavailable"}
        isSignedIn={authStatus === "signed-in"}
        authLabel={authLabel}
        onSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
      />
      {isUploadingPdf || uploadFeedback ? (
        <div className="border-b border-(--border-soft) bg-(--surface-panel-strong) px-4 py-2">
          <p
            className={`text-sm ${
              uploadFeedback?.type === "error"
                ? "text-(--accent)"
                : uploadFeedback?.type === "success"
                  ? "text-(--main)"
                  : "text-(--text-main)"
            }`}
            data-testid="workspace-feedback"
          >
            {isUploadingPdf
              ? "Uploading PDF..."
              : uploadFeedback?.message ?? ""}
          </p>
        </div>
      ) : null}
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
          onCollapse={() => setIsLeftPaneCollapsed(true)}
          onExpand={() => setIsLeftPaneCollapsed(false)}
          treeNodes={treeNodes}
          expandedIds={expandedIds}
          selectedNodeIds={selectedNodeIds}
          selectedNodeId={selectedNodeId}
          classLabel={workspace.classLabel}
          sessions={workspace.sessions}
          onSelectNode={handleSelectNode}
          onCreateFolder={handleCreateFolder}
          onAddAction={handleAddAction}
          onMenuAction={handleMenuAction}
          onPrepareRowMenu={handlePrepareRowMenu}
          onToggleExpanded={handleToggleExpanded}
          onMoveNode={handleMoveNode}
        />
        <EditorPane
          lockIn={lockIn}
          onToggleLockIn={() => setLockIn((current) => !current)}
          isNoteLoading={isLoadingSelectedNote}
          noteId={selectedNodeKind === "note" ? selectedNodeId : null}
          note={
            activeEditorNote && activeEditorNote.contentJson !== undefined
              ? {
                  title: activeEditorNote.title,
                  contentJson: activeEditorNote.contentJson,
                  createdAt: activeEditorNote.createdAt,
                  updatedAt: activeEditorNote.updatedAt,
                }
              : null
          }
          pdfDocument={activePdfDocument}
          isDirty={isDirty}
          onTitleChange={handleTitleChange}
          onBodyChange={handleBodyChange}
          onUploadImage={handleUploadImage}
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
    </main>
  );
}
