"use client";

import {
  ChevronDownIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronRightIcon,
  DocumentIcon,
  EllipsisVerticalIcon,
  FolderIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  canDropNode,
  type DropPosition,
  type TreeNode,
  type TreeNodeKind,
} from "@/lib/tree-repository";
import type { NoteSession } from "@/lib/supabase-note-session-repository";

export type TreeAddAction = "folder" | "note" | "upload";
export type TreeMenuAction = "add" | "delete" | "generate-notes";
export type TreeSelectionMode = "single" | "toggle" | "range";

export type SelectTreeNodeOptions = {
  mode: TreeSelectionMode;
  orderedNodeIds: string[];
};

type LeftPaneProps = {
  locked: boolean;
  collapsed: boolean;
  isLgViewport: boolean;
  onCollapse: () => void;
  onExpand: () => void;
  treeNodes: TreeNode[];
  allTreeNodesForDrop: TreeNode[];
  expandedIds: Set<string>;
  selectedNodeIds: string[];
  selectedNodeId: string | null;
  classLabel: string;
  sessions: NoteSession[];
  onSelectSession: (sessionId: string) => void;
  onRequestDeleteSession: (sessionId: string) => void;
  onSelectNode: (nodeId: string, options: SelectTreeNodeOptions) => void;
  onClearSelectionToActive: () => void;
  onCreateFolder: () => void;
  onAddAction: (nodeId: string, action: TreeAddAction) => void;
  onMenuAction: (nodeId: string, action: TreeMenuAction) => void;
  onPrepareRowMenu: (nodeId: string) => void;
  onToggleExpanded: (nodeId: string) => void;
  onMoveNode: (
    dragNodeId: string,
    targetNodeId: string,
    position: DropPosition,
  ) => void;
  onMoveSessionToTree: (
    sessionId: string,
    targetNodeId: string,
    position: DropPosition,
  ) => void;
};

type DropIndicator = {
  targetId: string;
  position: DropPosition;
};

type DragSource =
  | {
      type: "tree";
      nodeId: string;
    }
  | {
      type: "session";
      sessionId: string;
      noteNodeId: string;
    };

const SPLIT_RATIO_STORAGE_KEY = "editor-left-pane-tree-split-ratio";
const DEFAULT_TREE_AREA_RATIO = 0.7;
const MIN_TREE_AREA_PX = 180;
const MIN_SESSIONS_AREA_PX = 120;

function clampTreeAreaRatio(ratio: number, containerHeight: number) {
  if (!Number.isFinite(ratio)) {
    return DEFAULT_TREE_AREA_RATIO;
  }

  if (!Number.isFinite(containerHeight) || containerHeight <= 0) {
    return Math.min(Math.max(ratio, 0), 1);
  }

  const minRatio = MIN_TREE_AREA_PX / containerHeight;
  const maxRatio = 1 - MIN_SESSIONS_AREA_PX / containerHeight;
  const lowerBound = Math.min(Math.max(minRatio, 0), 1);
  const upperBound = Math.max(Math.min(maxRatio, 1), 0);

  if (lowerBound > upperBound) {
    return DEFAULT_TREE_AREA_RATIO;
  }

  return Math.min(Math.max(ratio, lowerBound), upperBound);
}

function getNodeIcon(kind: TreeNodeKind) {
  if (kind === "folder" || kind === "root") {
    return FolderIcon;
  }

  if (kind === "file") {
    return DocumentIcon;
  }

  return null;
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
  buttonToneClass: string;
  onToggleAddMenu: (nodeId: string) => void;
  onToggleRowMenu: (nodeId: string) => void;
  onCloseMenus: () => void;
  onAddAction: (nodeId: string, action: TreeAddAction) => void;
  onMenuAction: (nodeId: string, action: TreeMenuAction) => void;
  onPrepareRowMenu: (nodeId: string) => void;
  canGenerateNotes: boolean;
};

function RowActions({
  node,
  isAddMenuOpen,
  isRowMenuOpen,
  buttonToneClass,
  onToggleAddMenu,
  onToggleRowMenu,
  onCloseMenus,
  onAddAction,
  onMenuAction,
  onPrepareRowMenu,
  canGenerateNotes,
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
            className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors duration-150 ${buttonToneClass}`}
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
          className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors duration-150 ${buttonToneClass}`}
          onClick={(event) => {
            stopClick(event);
            onPrepareRowMenu(node.id);
            onToggleRowMenu(node.id);
          }}
          type='button'
        >
          <EllipsisVerticalIcon className='h-4 w-4' aria-hidden='true' />
          <span className='sr-only'>Open menu</span>
        </button>
        {isRowMenuOpen ? (
          <div className='absolute top-[calc(100%+4px)] right-0 z-10 w-36 rounded-xl border border-(--border-soft) bg-(--surface-base) p-1 shadow-(--shadow-floating)'>
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
                canGenerateNotes
                  ? "text-(--text-main) hover:bg-(--surface-main-faint)"
                  : "cursor-not-allowed text-(--text-muted) opacity-50"
              }`}
              disabled={!canGenerateNotes}
              onClick={() => {
                onMenuAction(node.id, "generate-notes");
                onCloseMenus();
              }}
              type='button'
            >
              Generate notes
            </button>
            <button
              className={`w-full rounded-lg px-2 py-1.5 text-left text-xs transition-colors duration-150 ${
                canDelete
                  ? "text-(--destructive) hover:bg-(--surface-main-faint)"
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
  isLgViewport,
  onCollapse,
  onExpand,
  treeNodes,
  allTreeNodesForDrop,
  expandedIds,
  selectedNodeIds,
  selectedNodeId,
  classLabel,
  sessions,
  onSelectSession,
  onRequestDeleteSession,
  onSelectNode,
  onClearSelectionToActive,
  onCreateFolder,
  onAddAction,
  onMenuAction,
  onPrepareRowMenu,
  onToggleExpanded,
  onMoveNode,
  onMoveSessionToTree,
}: LeftPaneProps) {
  const asideRef = useRef<HTMLElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const splitPointerIdRef = useRef<number | null>(null);
  const [dragSource, setDragSource] = useState<DragSource | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(
    null,
  );
  const [openAddMenuForId, setOpenAddMenuForId] = useState<string | null>(null);
  const [openRowMenuForId, setOpenRowMenuForId] = useState<string | null>(null);
  const [openSessionMenuForId, setOpenSessionMenuForId] = useState<string | null>(
    null,
  );
  const [hasPaneFocus, setHasPaneFocus] = useState(true);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [treeAreaRatio, setTreeAreaRatio] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_TREE_AREA_RATIO;
    }

    const savedRatio = window.sessionStorage.getItem(SPLIT_RATIO_STORAGE_KEY);
    if (!savedRatio) {
      return DEFAULT_TREE_AREA_RATIO;
    }

    const parsedRatio = Number.parseFloat(savedRatio);
    if (!Number.isFinite(parsedRatio)) {
      return DEFAULT_TREE_AREA_RATIO;
    }

    return Math.min(Math.max(parsedRatio, 0), 1);
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(
      SPLIT_RATIO_STORAGE_KEY,
      String(treeAreaRatio),
    );
  }, [treeAreaRatio]);

  const updateTreeRatioFromPointer = useCallback(
    (clientY: number) => {
      if (!isLgViewport) {
        return;
      }

      const container = splitContainerRef.current;
      if (!container) {
        return;
      }

      const bounds = container.getBoundingClientRect();
      if (bounds.height <= 0) {
        return;
      }

      const rawRatio = (clientY - bounds.top) / bounds.height;
      setTreeAreaRatio(clampTreeAreaRatio(rawRatio, bounds.height));
    },
    [isLgViewport],
  );

  useEffect(() => {
    if (!isDraggingSplit) {
      return;
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";

    const handlePointerMove = (event: PointerEvent) => {
      if (
        splitPointerIdRef.current !== null &&
        splitPointerIdRef.current !== event.pointerId
      ) {
        return;
      }

      updateTreeRatioFromPointer(event.clientY);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (
        splitPointerIdRef.current !== null &&
        splitPointerIdRef.current !== event.pointerId
      ) {
        return;
      }

      splitPointerIdRef.current = null;
      setIsDraggingSplit(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDraggingSplit, updateTreeRatioFromPointer]);

  useEffect(() => {
    if (!isLgViewport) {
      return;
    }

    const container = splitContainerRef.current;
    if (!container) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setTreeAreaRatio((currentRatio) =>
        clampTreeAreaRatio(currentRatio, entry.contentRect.height),
      );
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isLgViewport]);

  useEffect(() => {
    const handleDocumentClick = (event: globalThis.MouseEvent) => {
      const target = event.target as Element | null;

      if (target?.closest("[data-tree-popover]")) {
        return;
      }

      setOpenAddMenuForId(null);
      setOpenRowMenuForId(null);
      setOpenSessionMenuForId(null);
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      setHasPaneFocus(Boolean(target && asideRef.current?.contains(target)));
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as Node | null;
      setHasPaneFocus(Boolean(target && asideRef.current?.contains(target)));
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, []);

  const closeAllMenus = () => {
    setOpenAddMenuForId(null);
    setOpenRowMenuForId(null);
    setOpenSessionMenuForId(null);
  };

  const toggleAddMenu = (nodeId: string) => {
    setOpenRowMenuForId(null);
    setOpenAddMenuForId((current) => (current === nodeId ? null : nodeId));
  };

  const toggleRowMenu = (nodeId: string) => {
    setOpenAddMenuForId(null);
    setOpenSessionMenuForId(null);
    setOpenRowMenuForId((current) => (current === nodeId ? null : nodeId));
  };

  const toggleSessionMenu = (sessionId: string) => {
    setOpenAddMenuForId(null);
    setOpenRowMenuForId(null);
    setOpenSessionMenuForId((current) =>
      current === sessionId ? null : sessionId,
    );
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

  const visibleNodeIds = useMemo(() => {
    if (!rootNode) {
      return [];
    }

    const ids: string[] = [];

    const walk = (node: TreeNode) => {
      ids.push(node.id);

      if (node.kind !== "root" && !expandedIds.has(node.id)) {
        return;
      }

      const children = childrenByParent.get(node.id) ?? [];
      children.forEach(walk);
    };

    walk(rootNode);
    return ids;
  }, [childrenByParent, expandedIds, rootNode]);

  const asideClass = `flex min-h-0 flex-col overflow-x-visible overflow-y-hidden border-b border-(--border-soft) bg-(--surface-panel) backdrop-blur-xl lg:border-r lg:border-b-0 ${
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

  const getRowClasses = (
    node: TreeNode,
    isSelected: boolean,
    isActive: boolean,
    dropInsideActive = false,
  ) => {
    const selectionTone = hasPaneFocus
      ? "bg-(--surface-selection-active) text-(--text-selection-active) shadow-(--shadow-accent)"
      : "bg-(--surface-selection-inactive) text-(--text-main)";
    const rowTone = dropInsideActive
      ? "bg-(--surface-main-faint)"
      : isSelected
        ? selectionTone
        : "hover:bg-(--surface-main-faint)";

    return `flex min-w-0 flex-1 items-start gap-2 px-2 py-1.5 text-left transition-colors duration-150 ${rowTone}`;
  };

  const hasGeneratableSources = (nodeId: string): boolean => {
    const node = treeNodes.find((item) => item.id === nodeId);

    if (!node) {
      return false;
    }

    if (node.kind === "note" || node.kind === "file") {
      return true;
    }

    const stack = [...(childrenByParent.get(node.id) ?? [])];

    while (stack.length > 0) {
      const child = stack.pop();

      if (!child) {
        continue;
      }

      if (child.kind === "note" || child.kind === "file") {
        return true;
      }

      const children = childrenByParent.get(child.id);

      if (children?.length) {
        stack.push(...children);
      }
    }

    return false;
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
    const isSelected = selectedNodeIds.includes(node.id);
    const isActive = selectedNodeId === node.id;
    const isPaneSelected = isSelected && hasPaneFocus;
    const isPaneMutedSelected = isSelected && !hasPaneFocus;
    const canGenerateNotes = isSelected
      ? selectedNodeIds.some((selectedId) => hasGeneratableSources(selectedId))
      : hasGeneratableSources(node.id);
    const toggleButtonTone = isPaneSelected
      ? "text-(--text-selection-active)"
      : "text-(--text-muted)";
    const rowActionTone = isPaneSelected
      ? "text-(--text-selection-active) hover:bg-(--surface-selection-active-hover) hover:text-(--text-selection-active)"
      : isPaneMutedSelected
        ? "text-(--text-main) hover:bg-(--surface-selection-inactive-hover) hover:text-(--text-main)"
        : "text-(--text-muted) hover:bg-(--surface-main-faint) hover:text-(--text-main)";
    const iconTone = isPaneSelected
      ? "text-(--text-selection-active)"
      : isPaneMutedSelected
        ? "text-(--text-main)"
        : node.kind === "root"
          ? "text-(--main)"
          : node.kind === "folder"
            ? "text-(--secondary)"
            : node.kind === "file"
              ? "text-(--text-secondary)"
              : "text-(--text-muted)";
    const titleTone = isPaneSelected
      ? "text-(--text-selection-active)"
      : "text-(--text-main)";
    const metaTone = isPaneSelected
      ? "text-(--text-selection-active) opacity-80"
      : isPaneMutedSelected
        ? "text-(--text-muted)"
        : "text-(--text-muted)";

    return (
      <div key={node.id}>
        <div
          className='relative'
          draggable={node.kind !== "root"}
          onDragEnd={() => {
            setDragSource(null);
            setDropIndicator(null);
          }}
          onDragOver={(event) => {
            if (!dragSource) {
              return;
            }

            const position = resolveDropPosition(event, node);
            const dragNodeId =
              dragSource.type === "tree" ? dragSource.nodeId : dragSource.noteNodeId;

            if (!canDropNode(allTreeNodesForDrop, dragNodeId, node.id, position)) {
              return;
            }

            event.preventDefault();
            setDropIndicator({ targetId: node.id, position });
          }}
          onDragStart={() => {
            setDragSource({
              type: "tree",
              nodeId: node.id,
            });
          }}
          onDrop={(event) => {
            event.preventDefault();

            if (
              !dragSource ||
              !dropIndicator ||
              dropIndicator.targetId !== node.id
            ) {
              return;
            }

            if (dragSource.type === "tree") {
              onMoveNode(
                dragSource.nodeId,
                dropIndicator.targetId,
                dropIndicator.position,
              );
            } else {
              onMoveSessionToTree(
                dragSource.sessionId,
                dropIndicator.targetId,
                dropIndicator.position,
              );
            }

            setDragSource(null);
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
            className={getRowClasses(node, isSelected, isActive, dropInsideActive)}
            style={{ paddingLeft: `calc(${indent} + 16px)` }}
          >
            <button
              className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center ${toggleButtonTone} ${
                canToggle ? "" : "opacity-0"
              }`}
              onClick={() => {
                if (canToggle) {
                  onToggleExpanded(node.id);
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
              className='flex min-w-0 flex-1 items-start gap-2 text-left'
              onClick={(event) =>
                onSelectNode(node.id, {
                  mode: event.shiftKey
                    ? "range"
                    : event.metaKey || event.ctrlKey
                      ? "toggle"
                      : "single",
                  orderedNodeIds: visibleNodeIds,
                })
              }
              type='button'
            >
              {Icon ? (
                <Icon className={`mt-1 h-4 w-4 shrink-0 ${iconTone}`} aria-hidden='true' />
              ) : (
                <span
                  className='mt-1.5 h-2 w-2 shrink-0 rounded-full bg-(--note-indicator)'
                  aria-hidden='true'
                />
              )}
              <span className='min-w-0'>
                <span className={`block truncate text-[14px] ${titleTone}`}>
                  {node.kind === "root" ? classLabel : node.title}
                </span>
                {node.kind !== "root" ? (
                  <span className={`block text-xs ${metaTone}`}>
                    {formatUpdatedAt(node.updatedAt)}
                  </span>
                ) : null}
              </span>
            </button>
            <RowActions
              node={node}
              isAddMenuOpen={openAddMenuForId === node.id}
              isRowMenuOpen={openRowMenuForId === node.id}
              buttonToneClass={rowActionTone}
              onToggleAddMenu={toggleAddMenu}
              onToggleRowMenu={toggleRowMenu}
              onCloseMenus={closeAllMenus}
              onAddAction={onAddAction}
              onMenuAction={onMenuAction}
              onPrepareRowMenu={onPrepareRowMenu}
              canGenerateNotes={canGenerateNotes}
            />
          </div>
        </div>

        {hasChildren && isExpanded
          ? children.map((child) => renderNode(child, depth + 1))
          : null}
      </div>
    );
  };

  const handleTreeBackgroundClick = (
    event: MouseEvent<HTMLDivElement>,
  ) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    closeAllMenus();
    onClearSelectionToActive();
  };

  if (collapsed) {
    return (
      <aside ref={asideRef} className={asideClass}>
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
    <aside ref={asideRef} className={asideClass}>
      <div ref={splitContainerRef} className='flex min-h-0 flex-1 flex-col'>
        <section
          className={
            isLgViewport
              ? "min-h-0 flex flex-col"
              : "flex min-h-0 flex-1 flex-col"
          }
          style={
            isLgViewport
              ? {
                  height: `${treeAreaRatio * 100}%`,
                  minHeight: `${MIN_TREE_AREA_PX}px`,
                }
              : undefined
          }
        >
          <div className='flex items-center gap-3 border-b border-(--border-soft) p-3'>
            <Link
              aria-label='Go to app dashboard'
              className='grid h-9 w-9 place-items-center rounded-full bg-(--main) text-[10px] font-extrabold text-(--text-contrast) transition-opacity duration-150 hover:opacity-90'
              href='/app'
            >
              10M
            </Link>
            <div className='flex-1'>
              <h2 className='m-0'>Notes</h2>
            </div>
            <button
              aria-label='Collapse notes pane'
              className='grid h-9 w-9 place-items-center rounded-lg border border-(--border-soft) bg-(--surface-panel-strong) text-(--text-muted) transition-colors duration-150 hover:bg-(--surface-main-faint) hover:text-(--text-main)'
              onClick={onCollapse}
              type='button'
            >
              <ChevronDoubleLeftIcon className='h-5 w-5' aria-hidden='true' />
            </button>
          </div>

          <div
            className='min-h-0 flex-1 overflow-auto py-3'
            onClick={handleTreeBackgroundClick}
          >
            <div className='min-h-full' onClick={handleTreeBackgroundClick}>
              {rootNode ? renderNode(rootNode, 0) : null}
            </div>
          </div>
        </section>

        {isLgViewport ? (
          <button
            aria-label='Resize notes and sessions panels'
            className='relative h-2 w-full cursor-row-resize border-y border-(--border-soft) bg-(--surface-panel-soft) transition-colors duration-150 hover:bg-(--surface-main-faint)'
            onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
              event.preventDefault();
              splitPointerIdRef.current = event.pointerId;
              setIsDraggingSplit(true);
              updateTreeRatioFromPointer(event.clientY);
            }}
            type='button'
          >
            <span
              className='pointer-events-none absolute top-1/2 left-1/2 h-0.5 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--border-strong)'
              aria-hidden='true'
            />
          </button>
        ) : null}

        <section
          className={`min-h-0 border-t border-(--border-soft) bg-(--surface-panel-soft) ${
            isLgViewport ? "flex flex-col" : ""
          }`}
          style={
            isLgViewport
              ? {
                  height: `${(1 - treeAreaRatio) * 100}%`,
                  minHeight: `${MIN_SESSIONS_AREA_PX}px`,
                }
              : undefined
          }
        >
          <div className='mono-label px-4 pt-3 pb-2 text-[11px] font-medium uppercase tracking-[0.15em] text-(--text-muted)'>
            Sessions
          </div>
          <div
            className={`${isLgViewport ? "min-h-0 flex-1 overflow-auto" : "overflow-visible"} px-2 pb-3`}
          >
            {sessions.map((session) => (
              <div key={session.id} className='group relative'>
                <div className='flex items-center gap-1'>
                  <button
                    draggable
                    className='w-full truncate rounded-lg px-2.5 py-1.5 text-left text-[13px] text-(--text-muted) transition-colors duration-150 hover:bg-(--surface-main-faint) hover:text-(--text-main)'
                    onDragEnd={() => {
                      setDragSource(null);
                      setDropIndicator(null);
                    }}
                    onDragStart={() => {
                      setDragSource({
                        type: "session",
                        noteNodeId: session.noteNodeId,
                        sessionId: session.id,
                      });
                    }}
                    onClick={() => {
                      closeAllMenus();
                      onSelectSession(session.id);
                    }}
                    type='button'
                  >
                    {session.title}
                  </button>
                  <div className='relative' data-tree-popover>
                    <button
                      className='inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-(--text-muted) transition-colors duration-150 hover:bg-(--surface-main-faint) hover:text-(--text-main)'
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        toggleSessionMenu(session.id);
                      }}
                      type='button'
                    >
                      <EllipsisVerticalIcon className='h-4 w-4' aria-hidden='true' />
                      <span className='sr-only'>Open session menu</span>
                    </button>
                    {openSessionMenuForId === session.id ? (
                      <div className='absolute top-[calc(100%+4px)] right-0 z-10 w-28 rounded-xl border border-(--border-soft) bg-(--surface-base) p-1 shadow-(--shadow-floating)'>
                        <button
                          className='w-full rounded-lg px-2 py-1.5 text-left text-xs text-(--destructive) transition-colors duration-150 hover:bg-(--surface-main-faint)'
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onRequestDeleteSession(session.id);
                            closeAllMenus();
                          }}
                          type='button'
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className='pointer-events-none invisible absolute top-1/2 left-full z-30 ml-2 w-72 -translate-y-1/2 rounded-xl border border-(--border-soft) bg-(--surface-base) p-2 opacity-0 shadow-(--shadow-floating) transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100'>
                  {session.unitTitles.length > 0 ? (
                    <div>
                      <p className='text-[11px] font-semibold text-(--text-main)'>Units</p>
                      <ul className='mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-(--text-muted)'>
                        {session.unitTitles.map((title, index) => (
                          <li key={`${title}-${index}`} className='break-words'>
                            {title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {session.noteTitles.length > 0 ? (
                    <div className='mt-2'>
                      <p className='text-[11px] font-semibold text-(--text-main)'>Notes</p>
                      <ul className='mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-(--text-muted)'>
                        {session.noteTitles.map((title, index) => (
                          <li key={`${title}-${index}`} className='break-words'>
                            {title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {session.pdfTitles.length > 0 ? (
                    <div className='mt-2'>
                      <p className='text-[11px] font-semibold text-(--text-main)'>PDFs</p>
                      <ul className='mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-(--text-muted)'>
                        {session.pdfTitles.map((title, index) => (
                          <li key={`${title}-${index}`} className='break-words'>
                            {title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      {isDraggingSplit ? (
        <div
          className='pointer-events-none fixed inset-0 z-50 cursor-row-resize'
          aria-hidden='true'
        />
      ) : null}
    </aside>
  );
}
