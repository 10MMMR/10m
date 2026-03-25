"use client";

import { useState } from "react";
import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import type { ExplorerItem, ExplorerItemType } from "../_lib/workspace-data";

function itemDotColor(type: ExplorerItemType) {
  if (type === "semester") return "bg-(--secondary)";
  if (type === "course") return "bg-(--main)";
  if (type === "unit") return "bg-(--secondary-strong)";
  return "bg-(--text-muted)";
}

function depthValue(type: ExplorerItemType) {
  if (type === "semester") return 0;
  if (type === "course") return 1;
  if (type === "unit") return 2;
  return 3;
}

function depthPadding(type: ExplorerItemType) {
  if (type === "course") return "pl-4";
  if (type === "unit") return "pl-8";
  if (type === "material") return "pl-10";
  return "";
}

function isFolder(type: ExplorerItemType) {
  return type !== "material";
}

type LeftPaneProps = {
  locked: boolean;
  collapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
  explorerItems: ExplorerItem[];
  sessions: string[];
};

export function LeftPane({
  locked,
  collapsed,
  onCollapse,
  onExpand,
  explorerItems,
  sessions,
}: LeftPaneProps) {
  const [checkedState, setCheckedState] = useState(() =>
    explorerItems.map((item) => item.checked),
  );
  const [openState, setOpenState] = useState(() =>
    explorerItems.map((item) => isFolder(item.type)),
  );

  function childIndexes(index: number) {
    const indexes: number[] = [];
    const currentDepth = depthValue(explorerItems[index].type);

    for (let i = index + 1; i < explorerItems.length; i += 1) {
      const nextDepth = depthValue(explorerItems[i].type);
      if (nextDepth <= currentDepth) break;
      indexes.push(i);
    }

    return indexes;
  }

  function toggleChecked(index: number, checked: boolean) {
    setCheckedState((current) => {
      const next = [...current];
      next[index] = checked;

      if (isFolder(explorerItems[index].type)) {
        for (const childIndex of childIndexes(index)) {
          next[childIndex] = checked;
        }
      }

      return next;
    });
  }

  function visibleItem(index: number) {
    let parentDepth = depthValue(explorerItems[index].type);

    for (let i = index - 1; i >= 0; i -= 1) {
      const depth = depthValue(explorerItems[i].type);
      if (depth < parentDepth) {
        if (!openState[i]) return false;
        parentDepth = depth;
      }
    }

    return true;
  }

  const asideClass = `flex min-h-0 flex-col overflow-hidden border-b border-(--border-soft) bg-(--surface-panel) backdrop-blur-xl lg:border-r lg:border-b-0 ${
    locked
      ? "pointer-events-none select-none opacity-[0.55] grayscale-[0.85] saturate-[0.7]"
      : ""
  }`;

  if (collapsed) {
    return (
      <aside className={asideClass}>
        <div className="flex min-h-0 flex-1 flex-col items-center gap-3 p-3">
          <button
            aria-label="Open workspace pane"
            className="grid h-9 w-9 place-items-center rounded-xl border border-transparent bg-(--surface-main-soft) text-[13px] font-bold text-(--main) transition-colors duration-150 hover:bg-(--surface-main-faint)"
            onClick={onExpand}
            type="button"
          >
            <ChevronDoubleRightIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            aria-label="Settings"
            className="grid h-9 w-9 place-items-center rounded-xl border border-(--border-soft) bg-(--surface-panel-strong) text-(--text-muted) transition-colors duration-150 hover:bg-(--surface-main-faint) hover:text-(--text-main)"
            type="button"
          >
            <Cog6ToothIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className={asideClass}>
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-(--border-soft) p-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-(--surface-main-soft) text-[13px] font-bold text-(--main)">
            T
          </div>
          <div className="flex-1">
            <h2 className="m-0">Workspace</h2>
          </div>
          <button
            aria-label="Collapse workspace pane"
            className="grid h-9 w-9 place-items-center rounded-lg border border-(--border-soft) bg-(--surface-panel-strong) text-(--text-muted) transition-colors duration-150 hover:bg-(--surface-main-faint) hover:text-(--text-main)"
            onClick={onCollapse}
            type="button"
          >
            <ChevronDoubleLeftIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-auto px-2.5 pt-3 pb-4">
          {explorerItems.map((item, index) => {
            if (!visibleItem(index)) return null;

            const folder = isFolder(item.type);
            const checked = checkedState[index];

            return (
              <div
                key={`${item.type}-${item.title}-${index}`}
                className={`relative flex items-center gap-2.5 rounded-none px-3 py-2.5 text-(--text-muted) transition-colors duration-150 ${
                  checked ? "bg-(--surface-main-faint) text-(--text-main)" : ""
                } ${depthPadding(item.type)}`}
              >
                {checked ? (
                  <span
                    className="pointer-events-none absolute top-0 bottom-0 left-0 w-1 bg-(--main)"
                    aria-hidden="true"
                  />
                ) : null}
                <div className="flex min-w-0 items-center gap-2.5 text-sm">
                  {folder ? (
                    <button
                      aria-label={openState[index] ? "Collapse folder" : "Expand folder"}
                      className="w-3.5 flex-none border-0 bg-transparent p-0 text-(--text-muted)"
                      onClick={() =>
                        setOpenState((current) => {
                          const next = [...current];
                          next[index] = !next[index];
                          return next;
                        })
                      }
                      type="button"
                    >
                      <ChevronRightIcon
                        className={`inline-block h-4 w-4 transition-transform duration-150 ${
                          openState[index] ? "rotate-90" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  ) : (
                    <span className="w-3.5 flex-none" aria-hidden="true" />
                  )}

                  <button
                    className="flex min-w-0 items-center gap-2.5 border-0 bg-transparent p-0 text-left text-inherit"
                    onClick={() => {
                      const nextChecked = !checked;

                      if (folder) {
                        if (nextChecked) {
                          setOpenState((current) => {
                            const next = [...current];
                            next[index] = true;
                            return next;
                          });
                        }

                        toggleChecked(index, nextChecked);
                        return;
                      }

                      toggleChecked(index, nextChecked);
                    }}
                    type="button"
                  >
                    <span
                      className={`h-2.5 w-2.5 flex-none rounded-full ${itemDotColor(item.type)}`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.title}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex min-h-44 grow-0 shrink-0 basis-1/3 flex-col border-t border-(--border-soft) bg-(--surface-panel-soft)">
        <div className="mono-label flex items-center justify-between border-b border-(--border-faint) px-5 py-4 text-[11px] font-medium uppercase tracking-[0.15em] text-(--text-muted)">
          <span>Active sessions</span>
          <span className="inline-grid h-7 w-7 place-items-center rounded-full bg-(--surface-main-soft) text-[12px] text-(--main)">
            {sessions.length}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-2.5">
          {sessions.map((session) => (
            <button
              key={session}
              className="mb-1.5 flex h-11 w-full items-center gap-2.5 rounded-xl border-0 bg-transparent px-3 py-2.5 text-left text-[13px] text-(--text-muted) transition-all duration-200 hover:bg-(--surface-panel-strong) hover:text-(--text-main)"
              type="button"
            >
              <span
                className="grid h-2 w-2 place-items-center rounded-full bg-(--main)"
                aria-hidden="true"
              />
              {session}
            </button>
          ))}
        </div>
        <div className="border-t border-(--border-faint) p-2.5">
          <button
            aria-label="Settings"
            className="flex h-11 w-full items-center gap-2.5 rounded-xl border-0 bg-transparent px-3 py-2.5 text-left text-[13px] text-(--text-muted) transition-all duration-200 hover:bg-(--surface-panel-strong) hover:text-(--text-main)"
            type="button"
          >
            <Cog6ToothIcon className="h-5 w-5" aria-hidden="true" />
            Settings
          </button>
        </div>
      </section>
    </aside>
  );
}
