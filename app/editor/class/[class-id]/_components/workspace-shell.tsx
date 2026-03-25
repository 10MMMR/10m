"use client";

import { ChatBubbleLeftEllipsisIcon } from "@heroicons/react/24/outline";
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
  type TreeAddAction,
  type TreeMenuAction,
} from "./left-pane";
import { Topbar } from "./topbar";
import { getWorkspaceSeed } from "../_lib/workspace-data";
import {
  canParentContainChild,
  createTreeFolderNode,
  createTreeNoteNode,
  LocalStorageTreeRepository,
  type DropPosition,
  type TreeNode,
  type TreeNodeKind,
} from "@/lib/tree-repository";

const MAX_PDF_UPLOAD_BYTES = 5 * 1024 * 1024;

type WorkspaceShellProps = {
  classId: string;
  requestedClassId: string;
  usedFallback: boolean;
};

type UploadFeedback = {
  type: "success" | "error";
  message: string;
};

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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unable to read PDF file."));
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => reject(new Error("Unable to read PDF file."));
    reader.readAsDataURL(file);
  });
}

function countDescendants(nodes: TreeNode[], nodeId: string) {
  const childrenByParent = new Map<string, TreeNode[]>();

  nodes.forEach((node) => {
    if (!node.parentId) {
      return;
    }

    const current = childrenByParent.get(node.parentId) ?? [];
    current.push(node);
    childrenByParent.set(node.parentId, current);
  });

  let count = 0;
  const stack = [...(childrenByParent.get(nodeId) ?? [])];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    count += 1;
    stack.push(...(childrenByParent.get(current.id) ?? []));
  }

  return count;
}

export function WorkspaceShell({
  classId,
  requestedClassId,
  usedFallback,
}: WorkspaceShellProps) {
  const workspace = getWorkspaceSeed(classId);
  const treeRepository = useRef(new LocalStorageTreeRepository());
  const pdfUploadInputRef = useRef<HTMLInputElement>(null);
  const [lockIn, setLockIn] = useState(false);
  const [isLeftPaneCollapsed, setIsLeftPaneCollapsed] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isLgViewport, setIsLgViewport] = useState(false);
  const [isXlViewport, setIsXlViewport] = useState(false);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeKind, setSelectedNodeKind] = useState<TreeNodeKind | null>(null);
  const [draftNoteNode, setDraftNoteNode] = useState<TreeNode | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<UploadFeedback | null>(
    null,
  );
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
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

  const refreshTree = useCallback(() => {
    const nodes = treeRepository.current.listTreeByClass(classId);
    setTreeNodes(nodes);
    return nodes;
  }, [classId]);

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
    refreshTree();
    setSelectedNodeId(null);
    setSelectedNodeKind(null);
    setDraftNoteNode(null);
    setIsDirty(false);
    setUploadFeedback(null);
    setIsUploadingPdf(false);
    setPendingUploadParentId(null);
  }, [classId, refreshTree]);

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

  const handleSelectNode = (nodeId: string) => {
    const node = treeNodes.find((item) => item.id === nodeId);

    if (!node) {
      return;
    }

    setSelectedNodeId(node.id);
    setSelectedNodeKind(node.kind);

    if (node.kind === "note") {
      setDraftNoteNode({
        ...node,
        body: node.body || "<p></p>",
      });
      setIsDirty(false);
      return;
    }

    setDraftNoteNode(null);
    setIsDirty(false);

    if (node.kind === "file" && node.fileDataUrl) {
      window.open(node.fileDataUrl, "_blank", "noopener,noreferrer");
    }
  };

  const createNoteUnderParent = (parentId: string) => {
    const parentNode = treeNodes.find((node) => node.id === parentId);

    if (!parentNode || !canParentContainChild(parentNode.kind, "note")) {
      return;
    }

    const created = treeRepository.current.createNode(createTreeNoteNode(classId, parentId));
    const nextNodes = refreshTree();

    setSelectedNodeId(created.id);
    setSelectedNodeKind("note");
    const latestCreated = nextNodes.find((node) => node.id === created.id) ?? created;
    setDraftNoteNode({
      ...latestCreated,
      body: latestCreated.body || "<p></p>",
    });
    setIsDirty(true);
  };

  const createFolderUnderParent = (parentId: string) => {
    const parentNode = treeNodes.find((node) => node.id === parentId);

    if (!parentNode || !canParentContainChild(parentNode.kind, "folder")) {
      return;
    }

    const created = treeRepository.current.createNode(
      createTreeFolderNode(classId, parentId),
    );

    refreshTree();
    setSelectedNodeId(created.id);
    setSelectedNodeKind("folder");
    setDraftNoteNode(null);
    setIsDirty(false);
  };

  const handleCreateFolder = () => {
    if (!rootNode) {
      return;
    }

    createFolderUnderParent(rootNode.id);
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
      createNoteUnderParent(nodeId);
      return;
    }

    if (action === "folder") {
      createFolderUnderParent(nodeId);
      return;
    }

    triggerUploadUnderParent(nodeId);
  };

  const handleMenuAction = (nodeId: string, action: TreeMenuAction) => {
    const node = treeNodes.find((item) => item.id === nodeId);

    if (!node) {
      return;
    }

    if (action === "add") {
      if (node.kind === "root" || node.kind === "folder" || node.kind === "file") {
        createNoteUnderParent(node.id);
      }
      return;
    }

    if (node.kind === "root") {
      return;
    }

    const descendants = countDescendants(treeNodes, node.id);
    const confirmMessage =
      descendants > 0
        ? `Delete ${node.title} and ${descendants} nested item(s)?`
        : `Delete ${node.title}?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    treeRepository.current.deleteNodeCascade(classId, node.id);
    const nextNodes = refreshTree();

    if (
      selectedNodeId &&
      !nextNodes.some((item) => item.id === selectedNodeId)
    ) {
      setSelectedNodeId(null);
      setSelectedNodeKind(null);
      setDraftNoteNode(null);
      setIsDirty(false);
    }
  };

  const handleMoveNode = (
    dragNodeId: string,
    targetNodeId: string,
    position: DropPosition,
  ) => {
    treeRepository.current.moveNode(classId, dragNodeId, targetNodeId, position);
    refreshTree();
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
        message: "PDF exceeds the 5 MB limit.",
      });
      return;
    }

    setIsUploadingPdf(true);
    setUploadFeedback(null);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const timestamp = new Date().toISOString();

      treeRepository.current.createNode({
        id: crypto.randomUUID(),
        classId,
        parentId: pendingUploadParentId,
        kind: "file",
        title: file.name,
        createdAt: timestamp,
        updatedAt: timestamp,
        fileDataUrl: dataUrl,
        fileMimeType: file.type || "application/pdf",
        fileSize: file.size,
      });

      refreshTree();
      setUploadFeedback({
        type: "success",
        message: `Uploaded ${file.name}`,
      });
    } catch {
      setUploadFeedback({
        type: "error",
        message: "Unable to upload PDF. Browser storage may be full.",
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

  const handleSaveNote = () => {
    if (!draftNoteNode || draftNoteNode.kind !== "note") {
      return;
    }

    treeRepository.current.updateNode({
      ...draftNoteNode,
      body: draftNoteNode.body || "<p></p>",
    });

    refreshTree();
    setIsDirty(false);
  };

  const handleDeleteCurrentNote = () => {
    if (!draftNoteNode || draftNoteNode.kind !== "note") {
      return;
    }

    handleMenuAction(draftNoteNode.id, "delete");
  };

  return (
    <main className="workspace-shell flex h-screen flex-col overflow-hidden">
      <Topbar
        classId={classId}
        requestedClassId={requestedClassId}
        usedFallback={usedFallback}
        workspaceName={workspace.workspaceName}
        classLabel={workspace.classLabel}
        lockIn={lockIn}
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
          selectedNodeId={selectedNodeId}
          selectedNodeKind={selectedNodeKind}
          classLabel={workspace.classLabel}
          sessions={workspace.sessions}
          uploadFeedback={uploadFeedback}
          isUploadingPdf={isUploadingPdf}
          onSelectNode={handleSelectNode}
          onCreateFolder={handleCreateFolder}
          onAddAction={handleAddAction}
          onMenuAction={handleMenuAction}
          onMoveNode={handleMoveNode}
        />
        <EditorPane
          lockIn={lockIn}
          onToggleLockIn={() => setLockIn((current) => !current)}
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
              messages={workspace.messages}
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
    </main>
  );
}
