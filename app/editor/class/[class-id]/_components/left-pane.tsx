"use client";

import {
  ChevronDownIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronRightIcon,
  DocumentIcon,
  DocumentTextIcon,
  EllipsisVerticalIcon,
  FolderIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type MouseEvent,
} from "react";
import {
  canDropNode,
  type DropPosition,
  type TreeNode,
  type TreeNodeKind,
} from "@/lib/tree-repository";

type UploadFeedback = {
  type: "success" | "error";
  message: string;
};

export type TreeAddAction = "folder" | "note" | "upload";
export type TreeMenuAction = "add" | "delete";

type LeftPaneProps = {
  locked: boolean;
  collapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
  treeNodes: TreeNode[];
  selectedNodeId: string | null;
  selectedNodeKind: TreeNodeKind | null;
  classLabel: string;
  sessions: string[];
  uploadFeedback: UploadFeedback | null;
  isUploadingPdf: boolean;
  onSelectNode: (nodeId: string) => void;
  onCreateFolder: () => void;
  onAddAction: (nodeId: string, action: TreeAddAction) => void;
  onMenuAction: (nodeId: string, action: TreeMenuAction) => void;
  onMoveNode: (
    dragNodeId: string,
    targetNodeId: string,
    position: DropPosition,
  ) => void;
};

type DropIndicator = {
  targetId: string;
  position: DropPosition;
};

function getNodeIcon(kind: TreeNodeKind) {
  if (kind === "folder" || kind === "root") {
    return FolderIcon;
  }

  if (kind === "file") {
    return DocumentIcon;
  }

  return DocumentTextIcon;
}

function formatUpdatedAt(updatedAt: string) {
  const date = new Date(updatedAt);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getAddOptions(kind: TreeNodeKind): TreeAddAction[] {
  if (kind === "root" || kind === "folder") {
    return ["folder", "note", "upload"];
  }

  if (kind === "file") {
    return ["note"];
  }

  return [];
}

function getDefaultAddAction(kind: TreeNodeKind): TreeAddAction | null {
  if (kind === "root" || kind === "folder" || kind === "file") {
    return "note";
  }

  return null;
}

function getDepthPadding(depth: number) {
  return `${depth * 18}px`;
}

type RowActionsProps = {
  node: TreeNode;
  isAddMenuOpen: boolean;
  isRowMenuOpen: boolean;
  onToggleAddMenu: (nodeId: string) => void;
  onToggleRowMenu: (nodeId: string) => void;
  onCloseMenus: () => void;
  onAddAction: (nodeId: string, action: TreeAddAction) => void;
  onMenuAction: (nodeId: string, action: TreeMenuAction) => void;
};

function RowActions({
  node,
  isAddMenuOpen,
  isRowMenuOpen,
  onToggleAddMenu,
  onToggleRowMenu,
  onCloseMenus,
  onAddAction,
  onMenuAction,
}: RowActionsProps) {
  const addOptions = getAddOptions(node.kind);
  const defaultAddAction = getDefaultAddAction(node.kind);
  const canDelete = node.kind !== "root";

  const stopClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  return (
    <div className='flex items-center gap-0.5'>
      {addOptions.length > 0 ? (
        <div className='relative' data-tree-popover>
          <button
            className='inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-(--text-muted) transition-colors duration-150 hover:bg-(--surface-main-faint) hover:text-(--text-main)'
            onClick={(event) => {
              stopClick(event);
              onToggleAddMenu(node.id);
            }}
            type='button'
          >
            <PlusIcon className='h-3.5 w-3.5' aria-hidden='true' />
            <span className='sr-only'>Add item</span>
          </button>
          {isAddMenuOpen ? (
            <div className='absolute top-[calc(100%+4px)] right-0 z-10 w-36 rounded-xl border border-(--border-soft) bg-(--surface-base) p-1 shadow-(--shadow-floating)'>
              {addOptions.includes("folder") ? (
                <button
                  className='w-full rounded-lg px-2 py-1.5 text-left text-xs text-(--text-main) transition-colors duration-150 hover:bg-(--surface-main-faint)'
                  onClick={() => {
                    onAddAction(node.id, "folder");
                    onCloseMenus();
                  }}
                  type='button'
                >
                  New folder
                </button>
              ) : null}
              {addOptions.includes("note") ? (
                <button
                  className='w-full rounded-lg px-2 py-1.5 text-left text-xs text-(--text-main) transition-colors duration-150 hover:bg-(--surface-main-faint)'
                  onClick={() => {
                    onAddAction(node.id, "note");
                    onCloseMenus();
                  }}
                  type='button'
                >
                  New note
                </button>
              ) : null}
              {addOptions.includes("upload") ? (
                <button
                  className='w-full rounded-lg px-2 py-1.5 text-left text-xs text-(--text-main) transition-colors duration-150 hover:bg-(--surface-main-faint)'
                  onClick={() => {
                    onAddAction(node.id, "upload");
                    onCloseMenus();
                  }}
                  type='button'
                >
                  Upload file
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className='relative' data-tree-popover>
        <button
          className='inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-(--text-muted) transition-colors duration-150 hover:bg-(--surface-main-faint) hover:text-(--text-main)'
          onClick={(event) => {
            stopClick(event);
            onToggleRowMenu(node.id);
          }}
          type='button'
        >
          <EllipsisVerticalIcon className='h-4 w-4' aria-hidden='true' />
          <span className='sr-only'>Open menu</span>
        </button>
        {isRowMenuOpen ? (
          <div className='absolute top-[calc(100%+4px)] right-0 z-10 w-28 rounded-xl border border-(--border-soft) bg-(--surface-base) p-1 shadow-(--shadow-floating)'>
            <button
              className={`w-full rounded-lg px-2 py-1.5 text-left text-xs transition-colors duration-150 ${
                defaultAddAction
                  ? "text-(--text-main) hover:bg-(--surface-main-faint)"
                  : "cursor-not-allowed text-(--text-muted) opacity-50"
              }`}
              disabled={!defaultAddAction}
              onClick={() => {
                onMenuAction(node.id, "add");
                onCloseMenus();
              }}
              type='button'
            >
              Add
            </button>
            <button
              className={`w-full rounded-lg px-2 py-1.5 text-left text-xs transition-colors duration-150 ${
                canDelete
                  ? "text-(--text-main) hover:bg-(--surface-main-faint)"
                  : "cursor-not-allowed text-(--text-muted) opacity-50"
              }`}
              disabled={!canDelete}
              onClick={() => {
                onMenuAction(node.id, "delete");
                onCloseMenus();
              }}
              type='button'
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function LeftPane({
  locked,
  collapsed,
  onCollapse,
  onExpand,
  treeNodes,
  selectedNodeId,
  selectedNodeKind,
  classLabel,
  sessions,
  uploadFeedback,
  isUploadingPdf,
  onSelectNode,
  onCreateFolder,
  onAddAction,
  onMenuAction,
  onMoveNode,
}: LeftPaneProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(
    null,
  );
  const [openAddMenuForId, setOpenAddMenuForId] = useState<string | null>(null);
  const [openRowMenuForId, setOpenRowMenuForId] = useState<string | null>(null);

  useEffect(() => {
    const handleDocumentClick = (event: globalThis.MouseEvent) => {
      const target = event.target as Element | null;

      if (target?.closest("[data-tree-popover]")) {
        return;
      }

      setOpenAddMenuForId(null);
      setOpenRowMenuForId(null);
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  const closeAllMenus = () => {
    setOpenAddMenuForId(null);
    setOpenRowMenuForId(null);
  };

  const toggleAddMenu = (nodeId: string) => {
    setOpenRowMenuForId(null);
    setOpenAddMenuForId((current) => (current === nodeId ? null : nodeId));
  };

  const toggleRowMenu = (nodeId: string) => {
    setOpenAddMenuForId(null);
    setOpenRowMenuForId((current) => (current === nodeId ? null : nodeId));
  };

  const { rootNode, childrenByParent } = useMemo(() => {
    const sortedNodes = [...treeNodes].sort(
      (left, right) => left.order - right.order,
    );
    const childMap = new Map<string | null, TreeNode[]>();

    sortedNodes.forEach((node) => {
      const list = childMap.get(node.parentId) ?? [];
      list.push(node);
      childMap.set(node.parentId, list);
    });

    const root = sortedNodes.find((node) => node.kind === "root") ?? null;

    return {
      rootNode: root,
      childrenByParent: childMap,
    };
  }, [treeNodes]);

  const toggleExpanded = (nodeId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }

      return next;
    });
  };

  const asideClass = `flex min-h-0 flex-col overflow-hidden border-b border-(--border-soft) bg-(--surface-panel) backdrop-blur-xl lg:border-r lg:border-b-0 ${
    locked
      ? "pointer-events-none select-none opacity-[0.55] grayscale-[0.85] saturate-[0.7]"
      : ""
  }`;

  const resolveDropPosition = (
    event: DragEvent<HTMLDivElement>,
    node: TreeNode,
  ): DropPosition => {
    if (node.kind === "root") {
      return "inside";
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const offset = event.clientY - bounds.top;
    const ratio = offset / Math.max(bounds.height, 1);

    if (ratio < 0.3) {
      return "before";
    }

    if (ratio > 0.7) {
      return "after";
    }

    return "inside";
  };

  const getRowClasses = (node: TreeNode) => {
    const isSelected = selectedNodeId === node.id;
    const selectedTone =
      selectedNodeKind === "file"
        ? "bg-(--surface-main-faint)"
        : "bg-(--surface-main-faint)";

    return `flex min-w-0 flex-1 items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 ${
      isSelected ? selectedTone : "hover:bg-(--surface-main-faint)"
    }`;
  };

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const children = childrenByParent.get(node.id) ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = node.kind === "root" || expandedIds.has(node.id);
    const canToggle = hasChildren;
    const Icon = getNodeIcon(node.kind);
    const indent = getDepthPadding(depth);
    const dropBeforeActive =
      dropIndicator?.targetId === node.id &&
      dropIndicator.position === "before";
    const dropInsideActive =
      dropIndicator?.targetId === node.id &&
      dropIndicator.position === "inside";
    const dropAfterActive =
      dropIndicator?.targetId === node.id && dropIndicator.position === "after";

    return (
      <div key={node.id}>
        <div
          className='relative'
          draggable={node.kind !== "root"}
          onDragEnd={() => {
            setDragNodeId(null);
            setDropIndicator(null);
          }}
          onDragOver={(event) => {
            if (!dragNodeId) {
              return;
            }

            const position = resolveDropPosition(event, node);
            if (!canDropNode(treeNodes, dragNodeId, node.id, position)) {
              return;
            }

            event.preventDefault();
            setDropIndicator({ targetId: node.id, position });
          }}
          onDragStart={() => {
            setDragNodeId(node.id);
          }}
          onDrop={(event) => {
            event.preventDefault();

            if (
              !dragNodeId ||
              !dropIndicator ||
              dropIndicator.targetId !== node.id
            ) {
              return;
            }

            onMoveNode(
              dragNodeId,
              dropIndicator.targetId,
              dropIndicator.position,
            );
            setDragNodeId(null);
            setDropIndicator(null);
          }}
        >
          {dropBeforeActive ? (
            <div
              className='absolute top-0 right-0 left-0 h-[2px] bg-(--main)'
              aria-hidden='true'
            />
          ) : null}
          {dropAfterActive ? (
            <div
              className='absolute right-0 bottom-0 left-0 h-[2px] bg-(--main)'
              aria-hidden='true'
            />
          ) : null}

          <div
            className={`flex items-start gap-2 px-2 py-1.5 ${
              dropInsideActive ? "rounded-lg bg-(--surface-main-faint)" : ""
            }`}
            style={{ paddingLeft: `calc(${indent} + 8px)` }}
          >
            <button
              className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center text-(--text-muted) ${
                canToggle ? "" : "opacity-0"
              }`}
              onClick={() => {
                if (canToggle) {
                  toggleExpanded(node.id);
                }
              }}
              type='button'
            >
              {canToggle ? (
                isExpanded ? (
                  <ChevronDownIcon className='h-4 w-4' aria-hidden='true' />
                ) : (
                  <ChevronRightIcon className='h-4 w-4' aria-hidden='true' />
                )
              ) : null}
            </button>

            <button
              className={getRowClasses(node)}
              onClick={() => onSelectNode(node.id)}
              type='button'
            >
              <Icon
                className={`mt-1 h-4 w-4 shrink-0 ${
                  node.kind === "root"
                    ? "text-(--main)"
                    : node.kind === "folder"
                      ? "text-(--secondary)"
                      : node.kind === "file"
                        ? "text-(--text-secondary)"
                        : "text-(--text-muted)"
                }`}
                aria-hidden='true'
              />
              <span className='min-w-0'>
                <span className='block truncate text-[14px] text-(--text-main)'>
                  {node.kind === "root" ? classLabel : node.title}
                </span>
                {node.kind !== "root" ? (
                  <span className='block text-xs text-(--text-muted)'>
                    {formatUpdatedAt(node.updatedAt)}
                  </span>
                ) : null}
              </span>
            </button>

            <RowActions
              node={node}
              isAddMenuOpen={openAddMenuForId === node.id}
              isRowMenuOpen={openRowMenuForId === node.id}
              onToggleAddMenu={toggleAddMenu}
              onToggleRowMenu={toggleRowMenu}
              onCloseMenus={closeAllMenus}
              onAddAction={onAddAction}
              onMenuAction={onMenuAction}
            />
          </div>
        </div>

        {hasChildren && isExpanded
          ? children.map((child) => renderNode(child, depth + 1))
          : null}
      </div>
    );
  };

  if (collapsed) {
    return (
      <aside className={asideClass}>
        <div className='flex min-h-0 flex-1 flex-col items-center gap-3 p-3'>
          <button
            aria-label='Open notes pane'
            className='grid h-9 w-9 place-items-center rounded-xl border border-transparent bg-(--surface-main-soft) text-[13px] font-bold text-(--main) transition-colors duration-150 hover:bg-(--surface-main-faint)'
            onClick={onExpand}
            type='button'
          >
            <ChevronDoubleRightIcon className='h-5 w-5' aria-hidden='true' />
          </button>
          <button
            aria-label='Create folder'
            className='grid h-9 w-9 place-items-center rounded-xl border border-(--border-soft) bg-(--surface-panel-strong) text-(--text-muted) transition-colors duration-150 hover:bg-(--surface-main-faint) hover:text-(--text-main)'
            onClick={onCreateFolder}
            type='button'
          >
            <FolderIcon className='h-5 w-5' aria-hidden='true' />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className={asideClass}>
      <section className='flex min-h-0 flex-1 flex-col'>
        <div className='flex items-center gap-3 border-b border-(--border-soft) p-3'>
          <div className='grid h-9 w-9 place-items-center rounded-xl bg-(--surface-main-soft) text-[13px] font-bold text-(--main)'>
            N
          </div>
          <div className='flex-1'>
            <h2 className='m-0'>Notes</h2>
          </div>
          <button
            aria-label='Create folder'
            className='inline-flex h-9 items-center gap-1 rounded-lg border border-(--border-soft) bg-(--surface-panel-strong) px-2.5 text-[12px] text-(--text-muted) transition-colors duration-150 hover:bg-(--surface-main-faint) hover:text-(--text-main)'
            onClick={onCreateFolder}
            type='button'
          >
            <FolderIcon className='h-4 w-4' aria-hidden='true' />
            Folder
          </button>
          <button
            aria-label='Collapse notes pane'
            className='grid h-9 w-9 place-items-center rounded-lg border border-(--border-soft) bg-(--surface-panel-strong) text-(--text-muted) transition-colors duration-150 hover:bg-(--surface-main-faint) hover:text-(--text-main)'
            onClick={onCollapse}
            type='button'
          >
            <ChevronDoubleLeftIcon className='h-5 w-5' aria-hidden='true' />
          </button>
        </div>

        <div className='min-h-0 flex-1 overflow-auto p-3'>
          {uploadFeedback ? (
            <p
              className={`mb-3 rounded-xl border px-3 py-2 text-xs ${
                uploadFeedback.type === "error"
                  ? "border-(--border-accent) bg-(--surface-accent-soft) text-(--text-secondary)"
                  : "border-(--border-soft) bg-(--surface-main-soft) text-(--main)"
              }`}
            >
              {uploadFeedback.message}
            </p>
          ) : null}
          {isUploadingPdf ? (
            <p className='mb-2 text-xs text-(--text-muted)'>Uploading PDF…</p>
          ) : null}

          <div>{rootNode ? renderNode(rootNode, 0) : null}</div>
        </div>
      </section>

      <section className='border-t border-(--border-soft) bg-(--surface-panel-soft)'>
        <div className='mono-label px-4 pt-3 pb-2 text-[11px] font-medium uppercase tracking-[0.15em] text-(--text-muted)'>
          Sessions
        </div>
        <div className='max-h-40 overflow-auto px-2 pb-3'>
          {sessions.map((session) => (
            <div
              key={session}
              className='truncate rounded-lg px-2.5 py-1.5 text-[13px] text-(--text-muted)'
            >
              {session}
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
