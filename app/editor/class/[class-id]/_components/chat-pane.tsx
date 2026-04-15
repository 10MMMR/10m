"use client";

import { useEffect, useRef, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  MicrophoneIcon,
  PaperClipIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "../_lib/workspace-data";

type ChatPaneProps = {
  disabled: boolean;
  disabledMessage: string;
  locked: boolean;
  isStreaming: boolean;
  onHide: () => void;
  messages: Message[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
};

export function ChatPane({
  disabled,
  disabledMessage,
  locked,
  isStreaming,
  onHide,
  messages,
  inputValue,
  onInputChange,
  onSubmit,
}: ChatPaneProps) {
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!messageListRef.current) {
      return;
    }

    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages.length]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (disabled || isStreaming) {
      return;
    }

    onSubmit();
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    onInputChange(event.target.value);
  };

  return (
    <aside
      className={`relative flex min-h-96 min-w-0 flex-col overflow-hidden border-t border-(--border-soft) bg-(--surface-panel) backdrop-blur-xl lg:h-full lg:min-h-0 lg:rounded-2xl lg:border lg:border-(--border-soft) lg:bg-(--surface-base) ${
        locked
          ? "pointer-events-none select-none opacity-[0.55] grayscale-[0.85] saturate-[0.7]"
          : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-(--border-soft) p-3">
        <div>
          <h2 className="m-0">Study Assistant</h2>
        </div>
        <button
          className="grid h-9 w-9 place-items-center rounded-lg border border-(--border-soft) bg-(--surface-panel-strong) text-(--text-muted) transition-colors duration-150 hover:bg-(--surface-main-faint) hover:text-(--text-main)"
          onClick={onHide}
          type="button"
          aria-label="Hide chat"
        >
          <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div
        ref={messageListRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-5 pb-40"
      >
        {messages.length === 0 ? (
          <div className="flex min-h-full items-center justify-center">
            <div className="flex max-w-[600px] flex-col items-center text-center">
              <Image
                src="/ducki-bubble.png"
                alt="Duck mascot waiting for your first chat message"
                width={600}
                height={600}
                className="h-auto w-[600px]"
                priority
              />
              <p className="mt-4 text-base leading-7 font-bold text-(--text-muted)">
                Open a note or PDF, then ask Study Assistant to explain, summarize,
                or quiz you.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => {
            const isUser = message.side === "user";

            return (
              isUser ? (
                <div key={`${message.author}-${index}`} className="mb-4 flex justify-end">
                  <div className="max-w-[85%] rounded-2xl bg-(--main) px-4 py-3.5 text-(--text-contrast) shadow-md sm:max-w-[78%]">
                    {message.text}
                  </div>
                </div>
              ) : (
                <div
                  key={`${message.author}-${index}`}
                  className="mb-6 w-full text-(--text-main)"
                >
                  <div className="chat-markdown w-full leading-8">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.text}
                    </ReactMarkdown>
                  </div>
                </div>
              )
            );
          })
        )}
      </div>

      <div
        className="pointer-events-none absolute right-0 bottom-0 left-0 z-10"
        style={{ backgroundColor: "var(--surface-base)", height: "84px" }}
        aria-hidden="true"
      />

      <div className="absolute right-4 bottom-4 left-4 z-20">
        <form
          className="flex items-center gap-2.5 rounded-3xl border border-(--border-strong) bg-(--surface-input) p-2.5 shadow-lg backdrop-blur-lg"
          onSubmit={handleSubmit}
        >
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-(--border-soft) bg-(--surface-panel-strong) text-(--text-muted) transition-all duration-200 hover:-translate-y-0.5"
            type="button"
            aria-label="Attach file"
          >
            <PaperClipIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <input
            className="h-11 min-w-0 flex-1 border-0 bg-transparent text-(--text-main) outline-none"
            placeholder={disabled ? disabledMessage : "Ask a question..."}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            disabled={disabled || isStreaming}
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
            type="submit"
            aria-label="Send message"
            disabled={disabled || isStreaming}
          >
            <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </form>
        {disabled ? (
          <p className="px-2 pt-2 text-center text-[11px] text-(--text-muted)">
            {disabledMessage}
          </p>
        ) : null}
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
