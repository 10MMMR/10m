"use client";

import {
  ArrowRightIcon,
  MicrophoneIcon,
  PaperClipIcon,
} from "@heroicons/react/24/outline";
import type { Message } from "../_lib/workspace-data";

type ChatPaneProps = {
  locked: boolean;
  scopeLabel: string;
  messages: Message[];
};

export function ChatPane({ locked, scopeLabel, messages }: ChatPaneProps) {
  return (
    <aside
      className={`relative flex min-h-[480px] flex-col overflow-hidden border-t border-(--border-soft) bg-(--surface-panel) backdrop-blur-xl lg:col-span-2 xl:col-span-1 xl:min-h-0 xl:border-t-0 xl:border-l xl:border-(--border-soft) ${
        locked
          ? "pointer-events-none select-none opacity-[0.55] grayscale-[0.85] saturate-[0.7]"
          : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-(--border-soft) px-5 pt-[22px] pb-[18px]">
        <div>
          <h2 className="m-0">Study Assistant</h2>
          <p className="mono-label mt-2.5 mb-0 inline-flex items-center rounded-full border border-(--border-soft) bg-(--surface-panel) px-3 py-2 text-[12px] font-medium uppercase tracking-[0.15em] text-(--text-muted)">
            {scopeLabel}
          </p>
        </div>
        <button
          className="grid h-11 place-items-center rounded-xl border border-(--border-soft) bg-(--surface-panel-strong) px-3 py-[9px] text-(--text-muted) transition-all duration-200 hover:-translate-y-0.5"
          type="button"
        >
          ...
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 pt-5 pb-32">
        {messages.map((message, index) => {
          const isUser = message.side === "user";

          return (
            <div
              key={`${message.author}-${index}`}
              className={`mb-[18px] flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`grid h-9 w-9 flex-none place-items-center rounded-full text-[11px] font-extrabold ${
                  isUser
                    ? "bg-(--surface-user-soft) text-(--text-secondary)"
                    : "bg-(--surface-main-soft) text-(--main)"
                }`}
                aria-hidden="true"
              >
                {isUser ? "Y" : "AI"}
              </div>
              <div className={`max-w-[84%] ${isUser ? "text-right" : ""}`}>
                <span className="mb-1.5 block text-[12px] text-(--text-muted)">
                  {message.author} · {message.time}
                </span>
                <div
                  className={`rounded-[20px] border px-4 py-3.5 leading-[1.6] shadow-(--shadow-main) ${
                    isUser
                      ? "rounded-br-[20px] rounded-bl-[6px] border-transparent bg-(--main) text-(--text-contrast)"
                      : "rounded-br-[6px] rounded-bl-[20px] border-(--border-soft) bg-(--surface-base) text-(--text-main)"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute right-4 bottom-[18px] left-4">
        <div className="flex items-center gap-2.5 rounded-[22px] border border-(--border-strong) bg-(--surface-input) p-2.5 shadow-[0_10px_14px_rgba(44,44,36,0.08)] backdrop-blur-lg">
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-(--border-soft) bg-(--surface-panel-strong) text-(--text-muted) transition-all duration-200 hover:-translate-y-0.5"
            type="button"
            aria-label="Attach file"
          >
            <PaperClipIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <input
            className="h-11 min-w-0 flex-1 border-0 bg-transparent text-(--text-main) outline-none"
            placeholder="Ask a question..."
            type="text"
          />
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-(--border-soft) bg-(--surface-panel-strong) text-(--text-muted) transition-all duration-200 hover:-translate-y-0.5"
            type="button"
            aria-label="Use microphone"
          >
            <MicrophoneIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            className="grid h-11 w-11 place-items-center rounded-full border border-(--border-strong) bg-(--main) text-(--text-contrast) shadow-(--shadow-accent) transition-all duration-200 hover:-translate-y-0.5 hover:shadow-(--shadow-accent-strong)"
            type="button"
            aria-label="Send message"
          >
            <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex items-center justify-center gap-4 pt-2.5 text-[11px] text-(--text-muted)">
          <button className="border-0 bg-transparent text-inherit" type="button">
            Plugins
          </button>
          <span>AI can make mistakes.</span>
        </div>
      </div>
    </aside>
  );
}
