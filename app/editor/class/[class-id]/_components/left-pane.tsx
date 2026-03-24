"use client";

import {
  ChevronDownIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import type { Note } from "@/lib/note-repository";

type LeftPaneProps = {
  locked: boolean;
  collapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
  notes: Note[];
  selectedNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
  onDeleteNote: (noteId: string) => void;
  classLabel: string;
  unitTitle: string;
  sessions: string[];
};

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

export function LeftPane({
  locked,
  collapsed,
  onCollapse,
  onExpand,
  notes = [],
  selectedNoteId,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  classLabel,
  unitTitle,
  sessions,
}: LeftPaneProps) {
  const [isCourseOpen, setIsCourseOpen] = useState(true);
  const [isUnitOpen, setIsUnitOpen] = useState(true);

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
            aria-label="Open notes pane"
            className="grid h-9 w-9 place-items-center rounded-xl border border-transparent bg-(--surface-main-soft) text-[13px] font-bold text-(--main) transition-colors duration-150 hover:bg-(--surface-main-faint)"
            onClick={onExpand}
            type="button"
          >
            <ChevronDoubleRightIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            aria-label="New note"
            className="grid h-9 w-9 place-items-center rounded-xl border border-(--border-soft) bg-(--surface-panel-strong) text-(--text-muted) transition-colors duration-150 hover:bg-(--surface-main-faint) hover:text-(--text-main)"
            onClick={onCreateNote}
            type="button"
          >
            <PlusIcon className="h-5 w-5" aria-hidden="true" />
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
            N
          </div>
          <div className="flex-1">
            <h2 className="m-0">Notes</h2>
          </div>
          <button
            aria-label="Create note"
            className="grid h-9 w-9 place-items-center rounded-lg border border-(--border-soft) bg-(--surface-panel-strong) text-(--text-muted) transition-colors duration-150 hover:bg-(--surface-main-faint) hover:text-(--text-main)"
            onClick={onCreateNote}
            type="button"
          >
            <PlusIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            aria-label="Collapse notes pane"
            className="grid h-9 w-9 place-items-center rounded-lg border border-(--border-soft) bg-(--surface-panel-strong) text-(--text-muted) transition-colors duration-150 hover:bg-(--surface-main-faint) hover:text-(--text-main)"
            onClick={onCollapse}
            type="button"
          >
            <ChevronDoubleLeftIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          <div className="rounded-2xl border border-(--border-faint) bg-(--surface-base)">
            <button
              className="flex w-full items-center gap-2 px-3 py-3 text-left"
              onClick={() => setIsCourseOpen((current) => !current)}
              type="button"
            >
              {isCourseOpen ? (
                <ChevronDownIcon className="h-4 w-4 text-(--text-muted)" aria-hidden="true" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 text-(--text-muted)" aria-hidden="true" />
              )}
              <span className="inline-block h-3.5 w-3.5 rounded-full bg-(--main)" aria-hidden="true" />
              <span className="truncate text-[15px] font-medium text-(--text-main)">
                {classLabel}
              </span>
            </button>

            {isCourseOpen ? (
              <div className="pb-3 pl-5">
                <div className="border-l-2 border-(--border-soft) pl-3">
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                    onClick={() => setIsUnitOpen((current) => !current)}
                    type="button"
                  >
                    {isUnitOpen ? (
                      <ChevronDownIcon className="h-4 w-4 text-(--text-muted)" aria-hidden="true" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4 text-(--text-muted)" aria-hidden="true" />
                    )}
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full bg-(--secondary)"
                      aria-hidden="true"
                    />
                    <span className="truncate text-[15px] text-(--text-main)">
                      {unitTitle}
                    </span>
                  </button>

                  {isUnitOpen ? (
                    <div className="space-y-1 py-1 pl-8 pr-2">
                      {notes.length === 0 ? (
                        <p className="m-0 py-1 text-sm text-(--text-muted)">
                          No saved notes
                        </p>
                      ) : null}

                      {notes.map((note) => {
                        const isActive = selectedNoteId === note.id;

                        return (
                          <div key={note.id} className="group flex items-start gap-1">
                            <button
                              className={`flex min-w-0 flex-1 items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 ${
                                isActive
                                  ? "bg-(--surface-main-faint)"
                                  : "hover:bg-(--surface-main-faint)"
                              }`}
                              onClick={() => onSelectNote(note.id)}
                              type="button"
                            >
                              <span
                                className="mt-1.5 h-2.5 w-2.5 rounded-full bg-(--text-muted)"
                                aria-hidden="true"
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-[15px] text-(--text-main)">
                                  {note.title || "Untitled note"}
                                </span>
                                <span className="block text-xs text-(--text-muted)">
                                  {formatUpdatedAt(note.updatedAt)}
                                </span>
                              </span>
                            </button>
                            <button
                              aria-label="Delete note"
                              className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-(--text-muted) transition-colors duration-150 hover:bg-(--surface-main-faint) hover:text-(--text-main)"
                              onClick={() => onDeleteNote(note.id)}
                              type="button"
                            >
                              <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="border-t border-(--border-soft) bg-(--surface-panel-soft)">
        <div className="mono-label px-4 pt-3 pb-2 text-[11px] font-medium uppercase tracking-[0.15em] text-(--text-muted)">
          Sessions
        </div>
        <div className="max-h-40 overflow-auto px-2 pb-3">
          {sessions.map((session) => (
            <div
              key={session}
              className="truncate rounded-lg px-2.5 py-1.5 text-[13px] text-(--text-muted)"
            >
              {session}
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
