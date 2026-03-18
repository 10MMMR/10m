"use client";

import {
  ArrowsUpDownIcon,
  Bars3Icon,
  BoldIcon,
  ChevronDownIcon,
  EyeIcon,
  ItalicIcon,
  ListBulletIcon,
  LockClosedIcon,
  MinusIcon,
  PaintBrushIcon,
  PhotoIcon,
  PlusIcon,
  SwatchIcon,
  TableCellsIcon,
  UnderlineIcon,
} from "@heroicons/react/24/outline";
import type { ApproachRow } from "../_lib/workspace-data";

type EditorPaneProps = {
  lockIn: boolean;
  onToggleLockIn: () => void;
  unitTitle: string;
  unitDescription: string;
  sectionTitle: string;
  sectionBody: string;
  tableHeaders: [string, string, string];
  approaches: ApproachRow[];
};

export function EditorPane({
  lockIn,
  onToggleLockIn,
  unitTitle,
  unitDescription,
  sectionTitle,
  sectionBody,
  tableHeaders,
  approaches,
}: EditorPaneProps) {
  return (
    <section className="relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--surface-editor)]">
      <div className="absolute top-4 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-3 md:flex">
        <div className="flex items-center rounded-[20px] bg-[var(--surface-toolbar-float)] px-3 py-2 shadow-[var(--shadow-floating)] backdrop-blur-[18px]">
          <button
            className="flex h-11 items-center gap-1.5 rounded-xl border border-transparent px-3 text-[15px] text-[var(--text-main)] transition-colors duration-150 hover:bg-[var(--surface-main-soft)]"
            type="button"
            aria-label="Select font family"
          >
            <span>Clarika</span>
            <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="mx-2 h-8 w-px bg-[var(--border-soft)]" aria-hidden="true" />
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-transparent text-[var(--text-main)] transition-colors duration-150 hover:bg-[var(--surface-main-soft)]"
            type="button"
            aria-label="Decrease font size"
          >
            <MinusIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="grid h-11 min-w-[58px] place-items-center rounded-xl border border-[var(--border-floating)] bg-[var(--surface-base)] px-3 text-[1.125rem] font-semibold text-[var(--text-main)]">
            17
          </div>
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-transparent text-[var(--text-main)] transition-colors duration-150 hover:bg-[var(--surface-main-soft)]"
            type="button"
            aria-label="Increase font size"
          >
            <PlusIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="mx-2 h-8 w-px bg-[var(--border-soft)]" aria-hidden="true" />
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-transparent bg-[var(--main)] text-[var(--text-contrast)] transition-colors duration-150 hover:bg-[var(--main-deep)]"
            type="button"
            aria-label="Bold"
          >
            <BoldIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-transparent text-[var(--text-main)] transition-colors duration-150 hover:bg-[var(--surface-main-soft)]"
            type="button"
            aria-label="Italic"
          >
            <ItalicIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-transparent text-[var(--text-main)] transition-colors duration-150 hover:bg-[var(--surface-main-soft)]"
            type="button"
            aria-label="Underline"
          >
            <UnderlineIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-transparent text-[var(--text-main)] transition-colors duration-150 hover:bg-[var(--surface-main-soft)]"
            type="button"
            aria-label="Text color"
          >
            <SwatchIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-transparent text-[var(--text-main)] transition-colors duration-150 hover:bg-[var(--surface-main-soft)]"
            type="button"
            aria-label="Highlight style"
          >
            <PaintBrushIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="mx-2 h-8 w-px bg-[var(--border-soft)]" aria-hidden="true" />
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-transparent text-[var(--text-main)] transition-colors duration-150 hover:bg-[var(--surface-main-soft)]"
            type="button"
            aria-label="Insert image"
          >
            <PhotoIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-transparent text-[var(--text-main)] transition-colors duration-150 hover:bg-[var(--surface-main-soft)]"
            type="button"
            aria-label="Insert table"
          >
            <TableCellsIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-transparent text-[var(--text-main)] transition-colors duration-150 hover:bg-[var(--surface-main-soft)]"
            type="button"
            aria-label="Align text"
          >
            <Bars3Icon className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-transparent text-[var(--text-main)] transition-colors duration-150 hover:bg-[var(--surface-main-soft)]"
            type="button"
            aria-label="Bullet list"
          >
            <ListBulletIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-transparent text-[var(--text-main)] transition-colors duration-150 hover:bg-[var(--surface-main-soft)]"
            type="button"
            aria-label="Line spacing"
          >
            <ArrowsUpDownIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="mx-2 h-8 w-px bg-[var(--border-soft)]" aria-hidden="true" />
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-transparent text-[var(--text-main)] transition-colors duration-150 hover:bg-[var(--surface-main-soft)]"
            type="button"
            aria-label="Preview"
          >
            <EyeIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <button
          aria-pressed={lockIn}
          className={`inline-flex h-14 items-center gap-2 rounded-2xl px-4 text-[15px] font-medium transition-all duration-200 ${
            lockIn
              ? "bg-[var(--main)] text-[var(--text-contrast)] shadow-[var(--shadow-accent)]"
              : "bg-[var(--surface-toolbar-float)] text-[var(--text-main)] shadow-[var(--shadow-floating)]"
          }`}
          onClick={onToggleLockIn}
          type="button"
        >
          <LockClosedIcon className="h-5 w-5" aria-hidden="true" />
          Lock in
        </button>
      </div>

      <div className="relative z-10 flex-1 overflow-auto">
        <div className="min-h-full pt-7 pb-10 md:pt-[112px]">
          <div className="min-h-full w-full bg-[var(--surface-editor-card)] backdrop-blur-[20px]">
            <div
              className={`px-8 pt-11 pb-14 max-[860px]:px-[18px] ${
                lockIn
                  ? "[font-family:'Sans_Forgetica','Trebuchet_MS','Segoe_UI',sans-serif]"
                  : ""
              }`}
            >
              <div className="mono-label mb-4 text-[12px] font-medium uppercase tracking-[0.15em] text-[var(--main)]">
                AI generated notes
              </div>
              <h2 className="m-0 font-[Georgia,'Times_New_Roman',serif] text-[clamp(2.4rem,5vw,4rem)] leading-[0.98]">
                {unitTitle}
              </h2>
              <p className="mt-[18px] mb-0 max-w-[62ch] text-[18px] leading-[1.7] text-[var(--text-muted)]">
                {unitDescription}
              </p>

              <article className="leading-[1.75] text-[var(--text-body)]">
                <h3 className="mt-0 mb-3 font-[Georgia,'Times_New_Roman',serif] text-[1.75rem]">
                  {sectionTitle}
                </h3>
                <p>{sectionBody}</p>

                <div className="my-7 mb-9 overflow-hidden rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-base)]">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {tableHeaders.map((heading) => (
                          <th
                            key={heading}
                            className="border-b border-[var(--border-subtle)] bg-[var(--surface-table-head)] px-4 py-[14px] text-left text-[var(--text-main)]"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {approaches.map(([approach, focus, model]) => (
                        <tr key={approach}>
                          <td className="border-b border-[var(--border-subtle)] px-4 py-[14px] text-left">
                            {approach}
                          </td>
                          <td className="border-b border-[var(--border-subtle)] px-4 py-[14px] text-left">
                            {focus}
                          </td>
                          <td className="border-b border-[var(--border-subtle)] px-4 py-[14px] text-left">
                            {model}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h3 className="mt-0 mb-3 font-[Georgia,'Times_New_Roman',serif] text-[1.75rem]">
                  2. Key Exam Reminders
                </h3>
                <p>
                  Focus on definitions first, then walk through one representative
                  example. If a prompt asks for comparison, mention both assumptions
                  and tradeoffs before giving your conclusion.
                </p>
                <ul className="pl-5">
                  <li>
                    <strong>Signal words:</strong> identify what method or framework
                    the question is implicitly requesting.
                  </li>
                  <li>
                    <strong>Decision rule:</strong> explain why your selected approach
                    fits the structure of the prompt.
                  </li>
                  <li>
                    <strong>Check step:</strong> verify edge cases and units before
                    finalizing your answer.
                  </li>
                </ul>
              </article>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
