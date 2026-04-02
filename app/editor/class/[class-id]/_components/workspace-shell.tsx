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
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
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

const MAX_PDF_UPLOAD_BYTES = 50 * 1024 * 1024;
const PDF_SIGNED_URL_TTL_SECONDS = 60 * 60;
const AUTH_REQUIRED_MESSAGE = "Sign in with Google to access notes.";
const STORAGE_NOT_CONFIGURED_MESSAGE = "Supabase storage is not configured.";
const GENERATED_NOTE_HTML_BY_COMMAND: Record<string, string> = {
  gen1: `
    <h1>Computer Science Review Packet</h1>
    <p><strong>Topic focus:</strong> algorithms, systems thinking, data organization, and the tradeoffs that show up when software moves from toy problems to production constraints.</p>
    <p><u>Core question:</u> how do we choose representations and processes that make programs both correct and efficient?</p>
    <h2>1. Data Structures and Why They Matter</h2>
    <p>Every data structure encodes a set of priorities. Arrays give fast indexed access, linked lists favor cheap local insertions, hash maps optimize expected lookup time, and trees help preserve ordering while keeping operations predictable.</p>
    <ul>
      <li><mark>Array:</mark> strong for contiguous storage and cache-friendly scans.</li>
      <li><mark>Hash table:</mark> strong for average-case lookup, but depends on a sound hashing strategy.</li>
      <li><mark>Balanced tree:</mark> useful when sorted traversal and logarithmic updates both matter.</li>
      <li><mark>Graph:</mark> the right model when relationships matter more than linear order.</li>
    </ul>
    <h2>2. Complexity as a Design Lens</h2>
    <p>Big-O notation does not tell the whole story, but it gives a disciplined way to compare growth. A linear scan can outperform a more complicated structure at small sizes, yet lose badly once inputs scale or queries become frequent.</p>
    <table>
      <tbody>
        <tr>
          <th>Operation</th>
          <th>Common target</th>
          <th>Typical structure</th>
        </tr>
        <tr>
          <td>Search by key</td>
          <td>Near constant time</td>
          <td>Hash map</td>
        </tr>
        <tr>
          <td>Maintain sorted order</td>
          <td>Logarithmic update</td>
          <td>Balanced tree</td>
        </tr>
        <tr>
          <td>Traverse neighbors</td>
          <td>Edge-aware exploration</td>
          <td>Adjacency list graph</td>
        </tr>
      </tbody>
    </table>
    <h2>3. Algorithms Beyond Memorization</h2>
    <p>Sorting, searching, and traversal patterns matter because they express broad ideas: divide and conquer, greedy local choice, dynamic programming, and state exploration under constraints.</p>
    <ol>
      <li><strong>Divide and conquer</strong> breaks a problem into smaller independent subproblems, then recombines answers.</li>
      <li><strong>Greedy design</strong> commits to the best local choice when the structure of the problem guarantees global optimality.</li>
      <li><strong>Dynamic programming</strong> stores overlapping subresults to avoid repeated work.</li>
      <li><strong>Graph traversal</strong> models reachability, dependency, cost, and path quality.</li>
    </ol>
    <p>When studying algorithms, ask what state is being tracked, what invariant is preserved, and what work is repeated or avoided.</p>
    <h2>4. Systems Perspective</h2>
    <p>Computer science is not only about code syntax. It also covers how memory, storage, networking, and concurrency shape software behavior. A correct algorithm can still feel slow if it causes too many cache misses, excessive allocation, or blocking I/O.</p>
    <p><strong>Takeaway:</strong> the best engineers match problem structure, data layout, and execution environment instead of optimizing a single metric in isolation.</p>
  `.trim(),
  gen2: `
    <h1>Calculus II Study Notes</h1>
    <p><strong>Topic focus:</strong> integration techniques, infinite processes, and the geometric meaning behind symbolic manipulation.</p>
    <p>Calculus becomes easier when each method answers a specific question: what pattern does the integrand resemble, and what transformation makes it simpler?</p>
    <h2>1. Choosing an Integration Strategy</h2>
    <p>You should identify structure before computing. Some integrals collapse under substitution, others require repeated decomposition, and some are best approached through symmetry or comparison.</p>
    <ul>
      <li><mark>Substitution</mark> works when part of the expression behaves like the derivative of another part.</li>
      <li><mark>Integration by parts</mark> helps when a product becomes simpler after differentiation of one factor.</li>
      <li><mark>Partial fractions</mark> is essential for rational functions with factorable denominators.</li>
      <li><mark>Trig identities</mark> help convert difficult powers and products into integrable forms.</li>
    </ul>
    <h2>2. Integration by Parts</h2>
    <p>The formula <strong>∫u dv = uv - ∫v du</strong> is more than a mechanical trick. It moves complexity from one factor to another. A good choice of <strong>u</strong> usually simplifies under differentiation.</p>
    <table>
      <tbody>
        <tr>
          <th>Integrand type</th>
          <th>Common choice for u</th>
          <th>Reason</th>
        </tr>
        <tr>
          <td>Polynomial times exponential</td>
          <td>Polynomial</td>
          <td>Repeated derivatives eventually vanish</td>
        </tr>
        <tr>
          <td>Logarithm</td>
          <td>Log term</td>
          <td>Its derivative becomes simpler than the original function</td>
        </tr>
        <tr>
          <td>Inverse trig</td>
          <td>Inverse trig term</td>
          <td>Differentiation produces an algebraic form</td>
        </tr>
      </tbody>
    </table>
    <h2>3. Infinite Series</h2>
    <p>Series ask whether infinitely many terms can combine to a finite value. Convergence tests are tools for recognizing behavior, not isolated facts to memorize.</p>
    <ol>
      <li><strong>Geometric series:</strong> converges when the ratio magnitude is less than 1.</li>
      <li><strong>p-series:</strong> converges when p is greater than 1.</li>
      <li><strong>Alternating series:</strong> often converges when term magnitudes decrease to zero.</li>
      <li><strong>Comparison and limit comparison:</strong> measure a new series against one you already understand.</li>
    </ol>
    <p><u>Warning:</u> a sequence approaching zero is necessary for convergence, but not sufficient. The harmonic series is the classic reminder.</p>
    <h2>4. Polar and Parametric Thinking</h2>
    <p>Some curves are easier to describe by motion or angle than by solving for y. Parametric and polar forms reveal structure that rectangular equations can hide, especially in loops, spirals, and symmetric regions.</p>
    <p><strong>Takeaway:</strong> good calculus work depends on pattern recognition, geometric interpretation, and choosing the method that reduces complexity fastest.</p>
  `.trim(),
  gen3: `
    <h1>Biology Deep Review</h1>
    <p><strong>Topic focus:</strong> cell biology, genetics, metabolism, and the way biological systems coordinate information, matter, and energy across scales.</p>
    <p><u>Guiding idea:</u> biology is easier to organize when you ask what a structure is made of, what process it performs, and how that process is regulated.</p>
    <h2>1. Cells as Coordinated Systems</h2>
    <p>The cell is not a random collection of organelles. It is a coordinated environment where membranes, transport systems, signaling molecules, and genetic instructions all interact to maintain function.</p>
    <ul>
      <li><mark>Nucleus:</mark> stores DNA and regulates gene access.</li>
      <li><mark>Ribosome:</mark> translates RNA instructions into proteins.</li>
      <li><mark>Mitochondrion:</mark> converts energy from food into ATP through respiration.</li>
      <li><mark>Membrane:</mark> controls exchange and enables signaling across boundaries.</li>
    </ul>
    <h2>2. Information Flow: DNA to Trait</h2>
    <p>Genes influence traits through expression, regulation, and interaction with the environment. DNA is transcribed into RNA, RNA is translated into proteins, and proteins shape structure, catalysis, and signaling.</p>
    <table>
      <tbody>
        <tr>
          <th>Stage</th>
          <th>Main event</th>
          <th>Biological importance</th>
        </tr>
        <tr>
          <td>Replication</td>
          <td>DNA copies itself</td>
          <td>Preserves hereditary information</td>
        </tr>
        <tr>
          <td>Transcription</td>
          <td>RNA is synthesized from DNA</td>
          <td>Creates a working copy of genetic instructions</td>
        </tr>
        <tr>
          <td>Translation</td>
          <td>Ribosomes assemble proteins</td>
          <td>Connects coded information to cell function</td>
        </tr>
      </tbody>
    </table>
    <h2>3. Metabolism and Energy Transfer</h2>
    <p>Metabolism includes all chemical reactions that sustain life. Catabolic pathways release energy by breaking molecules down, while anabolic pathways use energy to build the complex molecules cells need.</p>
    <ol>
      <li><strong>Glycolysis</strong> begins glucose breakdown in the cytoplasm.</li>
      <li><strong>Citric acid cycle</strong> extracts high-energy electrons from carbon intermediates.</li>
      <li><strong>Electron transport</strong> uses redox reactions and proton gradients to drive ATP synthesis.</li>
      <li><strong>Photosynthesis</strong> captures light energy and stores it in chemical bonds.</li>
    </ol>
    <p><mark>Key connection:</mark> ATP links energy release to energy demand across nearly every cellular process.</p>
    <h2>4. Homeostasis and Regulation</h2>
    <p>Biological systems survive by sensing change and adjusting. Feedback loops regulate temperature, glucose, hormones, and many other variables. Negative feedback stabilizes a system, while positive feedback amplifies a process until a specific endpoint is reached.</p>
    <p><strong>Takeaway:</strong> strong biology answers connect structure, mechanism, and regulation instead of listing isolated facts.</p>
  `.trim(),
};

type WorkspaceShellProps = {
  classId: string;
  requestedClassId: string;
  storageBucket: string | null;
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

function buildUpdatedNote(node: TreeNode, updates: Partial<Pick<TreeNode, "title" | "body">>) {
  return {
    ...node,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
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

export function WorkspaceShell({
  classId,
  requestedClassId,
  storageBucket,
  usedFallback,
}: WorkspaceShellProps) {
  const workspace = getWorkspaceSeed(classId);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const treeRepository = useRef<SupabaseTreeRepository | null>(
    supabase ? new SupabaseTreeRepository(supabase) : null,
  );
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
  const [selectedNodeKind, setSelectedNodeKind] = useState<TreeNodeKind | null>(null);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [draftNoteNode, setDraftNoteNode] = useState<TreeNode | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] =
    useState<DeleteConfirmationState | null>(null);
  const [messages, setMessages] = useState<Message[]>(workspace.messages);
  const [chatInput, setChatInput] = useState("");
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
  const [pendingUploadParentId, setPendingUploadParentId] = useState<string | null>(
    null,
  );

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

  const resetWorkspaceState = useCallback(() => {
    setTreeNodes([]);
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
    if (!treeRepository.current || !authUser) {
      resetWorkspaceState();
      return [];
    }

    const nodes = await treeRepository.current.listTreeByClass(classId);
    setTreeNodes(nodes);
    treeNodesRef.current = nodes;
    return nodes;
  }, [authUser, classId, resetWorkspaceState]);

  const persistTree = useCallback(
    async (nextNodes: TreeNode[]) => {
      if (!treeRepository.current || !authUser) {
        throw new Error("Sign in with Google to save notes.");
      }

      const savedNodes = await treeRepository.current.replaceTree(classId, nextNodes);
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
  }, [supabase]);

  const syncSelectionState = useCallback(
    (nodes: TreeNode[], nextSelectedIds: string[], nextActiveId: string | null) => {
      const availableIds = new Set(nodes.map((node) => node.id));
      const uniqueSelectedIds = Array.from(new Set(nextSelectedIds)).filter((id) =>
        availableIds.has(id),
      );
      const activeId =
        nextActiveId && availableIds.has(nextActiveId)
          ? nextActiveId
          : uniqueSelectedIds.at(-1) ?? null;
      const activeNode = activeId
        ? nodes.find((node) => node.id === activeId) ?? null
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
  }, [authUser, classId, expandedIds, selectedNodeId, selectedNodeKind, treeNodes.length]);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 767px)");

    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setLockIn(false);
      }
    };

    mobileQuery.addEventListener("change", handleViewportChange);
    return () => mobileQuery.removeEventListener("change", handleViewportChange);
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
    setMessages(workspace.messages);
    setChatInput("");
  }, [classId, resetWorkspaceState, workspace.messages]);

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

    if (!persistedState.selectedNodeId || !nodeIds.has(persistedState.selectedNodeId)) {
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
          ? nextSelectedIds.at(-1) ?? null
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

  const createNoteUnderParent = async (parentId: string) => {
    if (!authUser) {
      setUploadFeedback({
        type: "error",
        message: AUTH_REQUIRED_MESSAGE,
      });
      return;
    }

    const parentNode = treeNodesRef.current.find((node) => node.id === parentId);

    if (!parentNode || !canParentContainChild(parentNode.kind, "note")) {
      return;
    }

    const created = createTreeNoteNode(classId, parentId);
    const nextNodes = createNodeInTree(treeNodesRef.current, created);
    const shouldOpenParent = !parentHasChildren(treeNodesRef.current, parentId);

    try {
      const savedNodes = await persistTree(nextNodes);
      const expandedAncestorIds = collectAncestorIds(savedNodes, created.id);
      if (shouldOpenParent) {
        expandedAncestorIds.add(parentId);
      }
      setExpandedIds((current) => new Set([...current, ...expandedAncestorIds]));
      syncSelectionState(savedNodes, [created.id], created.id);
      setSelectionAnchorId(created.id);
      setIsDirty(true);
    } catch (error) {
      setUploadFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to create note.",
      });
    }
  };

  const createFolderUnderParent = async (parentId: string) => {
    if (!authUser) {
      setUploadFeedback({
        type: "error",
        message: AUTH_REQUIRED_MESSAGE,
      });
      return;
    }

    const parentNode = treeNodesRef.current.find((node) => node.id === parentId);

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
      setExpandedIds((current) => new Set([...current, ...expandedAncestorIds]));
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

  const handleMenuAction = async (nodeId: string, action: TreeMenuAction) => {
    const node = treeNodesRef.current.find((item) => item.id === nodeId);

    if (!node) {
      return;
    }

    if (action === "add") {
      if (node.kind === "root" || node.kind === "folder" || node.kind === "file") {
        await createNoteUnderParent(node.id);
      }
      return;
    }

    if (action === "generate-notes") {
      const selectedIds = selectedNodeIds.includes(node.id)
        ? selectedNodeIds
        : [node.id];
      const selectedFiles = getSelectableFiles(
        treeNodesRef.current,
        selectedIds,
      ).map((item) => ({
        id: item.id,
        title: item.title,
        kind: item.kind,
        parentId: item.parentId,
      }));

      console.log("Selected files for note generation:", selectedFiles);
      return;
    }

    if (node.kind === "root") {
      return;
    }

    const targetIds = selectedNodeIds.includes(node.id)
      ? selectedNodeIds.filter((selectedId) => {
          const selectedNode = treeNodesRef.current.find((item) => item.id === selectedId);
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
      .map((deleteId) => treeNodesRef.current.find((item) => item.id === deleteId))
      .filter((item): item is TreeNode => Boolean(item));
    const nestedDeleteCount = cascadeDeleteIds.length - directDeleteNodes.length;
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
      .map((deleteId) => treeNodesRef.current.find((item) => item.id === deleteId))
      .filter(
        (item): item is TreeNode =>
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
        const payload = (await response.json().catch(() => null)) as DeletePdfResponse | null;

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
          : remainingSelectedIds.at(-1) ?? null;

      syncSelectionState(nextNodes, remainingSelectedIds, nextActiveId);

      if (selectionAnchorId && !nextNodes.some((item) => item.id === selectionAnchorId)) {
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

  const handleUploadPdfFile = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
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
      const payload = (await response.json().catch(() => null)) as UploadPdfResponse | null;

      if (!response.ok || !payload?.tree || !payload.fileNode) {
        throw new Error(payload?.error || "Unable to upload PDF to Supabase Storage.");
      }

      const shouldOpenParent = !parentHasChildren(treeNodesRef.current, pendingUploadParentId);
      const savedNodes = payload.tree;
      const fileId = payload.fileNode.id;
      setTreeNodes(savedNodes);
      treeNodesRef.current = savedNodes;
      const expandedAncestorIds = collectAncestorIds(savedNodes, fileId);
      if (shouldOpenParent) {
        expandedAncestorIds.add(pendingUploadParentId);
      }
      setExpandedIds((current) => new Set([...current, ...expandedAncestorIds]));
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

  const handleGoogleSignIn = () => {
    if (!supabase) {
      return;
    }

    void supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.href,
      },
    });
  };

  const handleSignOut = () => {
    if (!supabase) {
      return;
    }

    void supabase.auth.signOut();
  };

  const handleChatSubmit = () => {
    const trimmedInput = chatInput.trim();

    if (!trimmedInput) {
      return;
    }

    setMessages((current) => [...current, createMessage("user", trimmedInput)]);

    const normalizedInput = trimmedInput.toLowerCase();
    const generatedNoteHtml = GENERATED_NOTE_HTML_BY_COMMAND[normalizedInput];

    if (!generatedNoteHtml) {
      setMessages((current) => [
        ...current,
        createMessage("assistant", 'Placeholder mode only supports the "gen1", "gen2", and "gen3" commands right now.'),
      ]);
      setChatInput("");
      return;
    }

    if (!activeEditorNote || activeEditorNote.kind !== "note") {
      setMessages((current) => [
        ...current,
        createMessage("assistant", "Select or create a note first, then try gen again."),
      ]);
      setChatInput("");
      return;
    }

    setDraftNoteNode((current) => {
      if (!current || current.kind !== "note") {
        return current;
      }

      return buildUpdatedNote(current, { body: generatedNoteHtml });
    });
    setIsDirty(true);
    setMessages((current) => [
      ...current,
      createMessage("assistant", `Generated placeholder HTML for ${normalizedInput} and replaced the current note draft.`),
    ]);
    setChatInput("");
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
    <main className="workspace-shell flex h-screen flex-col overflow-hidden">
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
      <input
        ref={pdfUploadInputRef}
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleUploadPdfFile}
        type="file"
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
          uploadFeedback={uploadFeedback}
          isUploadingPdf={isUploadingPdf}
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
          saveLabel="Save note"
          titleLabel="Note title"
          titlePlaceholder="Untitled note"
          emptyStateTitle="No note selected"
          emptyStateDescription="Create or select a note from the tree to start writing."
        />
        {isChatOpen ? (
          <div className="relative h-full min-h-0 min-w-0 overflow-hidden lg:col-span-2 xl:col-span-1">
            <ChatPane
              locked={lockIn}
              onHide={handleHideChat}
              messages={messages}
              inputValue={chatInput}
              onInputChange={setChatInput}
              onSubmit={handleChatSubmit}
            />
          </div>
        ) : null}
      </div>

      {!isChatOpen ? (
        <button
          className="fixed right-15 bottom-10 z-50 grid h-14 w-14 place-items-center rounded-full border border-(--border-strong) bg-(--main) text-(--text-contrast) shadow-(--shadow-accent) transition-transform duration-200 hover:scale-105 hover:shadow-(--shadow-accent-strong)"
          onClick={handleRestoreChat}
          type="button"
          aria-label="Show chat"
        >
          <ChatBubbleLeftEllipsisIcon className="h-6 w-6" aria-hidden="true" />
        </button>
      ) : null}

      {deleteConfirmation ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay-scrim) p-4 backdrop-blur-sm"
          onClick={() => setDeleteConfirmation(null)}
          role="dialog"
        >
          <div
            className="w-full max-w-md rounded-3xl border border-(--border-floating) bg-(--surface-base) p-6 shadow-(--shadow-floating)"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-(--text-muted)">
              Confirm deletion
            </p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-(--text-main)">
              {deleteConfirmation.message}
            </h2>
            <p className="mt-3 text-sm leading-6 text-(--text-body)">
              This action permanently removes the selected note, folder, or file from
              this class workspace.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                className="rounded-full border border-(--border-soft) bg-(--surface-input) px-5 py-2.5 text-sm font-semibold text-(--text-main) transition-colors duration-200 hover:bg-(--surface-main-faint)"
                onClick={() => setDeleteConfirmation(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-full border border-(--destructive) bg-(--destructive) px-5 py-2.5 text-sm font-semibold text-(--destructive-foreground) transition-transform duration-200 hover:-translate-y-0.5"
                onClick={() => void handleConfirmDelete()}
                type="button"
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
