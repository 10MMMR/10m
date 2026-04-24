"use client";

import {
  ArrowLeftIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import type { User } from "@supabase/supabase-js";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/app/_global/authentication/auth-context";
import { supabase } from "@/app/_global/authentication/supabaseClient";

type ChatMessageRole = "assistant" | "system" | "user";

type ChatMessage = {
  content: string;
  messageIndex: number;
  role: ChatMessageRole;
};
type UserClassItem = {
  id: string;
  name: string | null;
};

type NewChatSessionPanelProps = {
  classId?: string | null;
  existingChatId?: string | null;
  onBack: () => void;
};

function getUserFirstName(user: User | null) {
  if (!user) {
    return "there";
  }

  const metadata = user.user_metadata as Record<string, unknown> | null;
  const candidates = [metadata?.name, metadata?.full_name, metadata?.display_name];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim().split(/\s+/)[0] ?? "there";
    }
  }

  if (typeof user.email === "string" && user.email.trim()) {
    return user.email.trim().split("@")[0] ?? "there";
  }

  return "there";
}

function summarizeChatTitle(message: string) {
  const normalized = message.trim().replace(/\s+/g, " ");
  if (normalized.length <= 56) {
    return normalized;
  }

  return `${normalized.slice(0, 56).trimEnd()}...`;
}

function buildAssistantGreeting(firstName: string) {
  return `Hello ${firstName}. How may I help you today?`;
}

type GenerateTitleResponse = {
  title?: string;
};

type PopupAssistantResponse = {
  assistant?: ChatMessage;
  userMessage?: ChatMessage;
};

export function NewChatSessionPanel({
  classId = null,
  existingChatId = null,
  onBack,
}: NewChatSessionPanelProps) {
  const { user } = useAuth();
  const [chatId, setChatId] = useState<string | null>(null);
  const [composerValue, setComposerValue] = useState("");
  const [initError, setInitError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatTitle, setChatTitle] = useState("New chat");
  const [displayTitle, setDisplayTitle] = useState("New chat");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(classId);
  const [userClasses, setUserClasses] = useState<UserClassItem[]>([]);
  const [isClassPickerOpen, setIsClassPickerOpen] = useState(false);
  const [isTitleEditorOpen, setIsTitleEditorOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("New chat");
  const [wasTitleEditedBeforeFirstSend, setWasTitleEditedBeforeFirstSend] = useState(false);
  const [isAwaitingAssistant, setIsAwaitingAssistant] = useState(false);
  const hasUserMessage = useMemo(
    () => messages.some((message) => message.role === "user"),
    [messages],
  );
  const cleanupStateRef = useRef({
    chatId: null as string | null,
    hasUserMessage: false,
    isDeleting: false,
    shouldCleanupDraft: false,
  });
  const titleAnimationRef = useRef<number | null>(null);

  const firstName = useMemo(() => getUserFirstName(user), [user]);
  const isDraftChat = !existingChatId;
  const chatBootstrapKey = `${user?.id ?? ""}|${existingChatId ?? ""}|${classId ?? ""}|${firstName}`;
  const selectedClassName = useMemo(() => {
    if (!selectedClassId) {
      return null;
    }

    const linkedClass = userClasses.find((item) => item.id === selectedClassId);
    return linkedClass?.name?.trim() || "Untitled class";
  }, [selectedClassId, userClasses]);

  const setTitleImmediate = useCallback((nextTitle: string) => {
    setChatTitle(nextTitle);
    setDisplayTitle(nextTitle);
    setTitleDraft(nextTitle);
  }, []);

  const animateTitleTyping = useCallback((nextTitle: string) => {
    if (titleAnimationRef.current !== null) {
      window.clearInterval(titleAnimationRef.current);
      titleAnimationRef.current = null;
    }

    setDisplayTitle("");
    setTitleDraft(nextTitle);
    let index = 0;
    titleAnimationRef.current = window.setInterval(() => {
      index += 1;
      setDisplayTitle(nextTitle.slice(0, index));

      if (index >= nextTitle.length && titleAnimationRef.current !== null) {
        window.clearInterval(titleAnimationRef.current);
        titleAnimationRef.current = null;
      }
    }, 42);
  }, []);

  const deleteChatById = useCallback(
    async (targetChatId: string) => {
      if (!supabase || !user) {
        return;
      }

      await supabase
        .from("chat_messages")
        .delete()
        .eq("chat_id", targetChatId)
        .eq("user_id", user.id);
      await supabase
        .from("chats")
        .delete()
        .eq("id", targetChatId)
        .eq("user_id", user.id);
    },
    [user],
  );

  const cleanupDraftChat = useCallback(async () => {}, []);

  useEffect(() => {
    cleanupStateRef.current.hasUserMessage = hasUserMessage;
  }, [hasUserMessage]);

  useEffect(() => {
    if (!supabase || !user) {
      setUserClasses([]);
      return;
    }

    const db = supabase;
    let ignore = false;
    const loadClasses = async () => {
      const { data, error } = await db
        .from("classes")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (ignore || error) {
        if (!ignore) {
          setUserClasses([]);
        }
        return;
      }

      setUserClasses(data ?? []);
    };

    void loadClasses();
    return () => {
      ignore = true;
    };
  }, [user]);

  useEffect(() => {
    if (!supabase || !user) {
      setInitError("Unable to start chat right now.");
      setIsInitializing(false);
      return;
    }

    const db = supabase;
    let ignore = false;

    const createOrLoadChat = async () => {
      setIsInitializing(true);
      setInitError(null);

      if (existingChatId) {
        const { data: existingChat, error: existingChatError } = await db
          .from("chats")
          .select("id, title, class_id")
          .eq("id", existingChatId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (ignore) {
          return;
        }

        if (existingChatError || !existingChat) {
          setInitError("Unable to load chat right now.");
          setIsInitializing(false);
          return;
        }

        const { data: existingMessages, error: existingMessagesError } = await db
          .from("chat_messages")
          .select("content, message_index, role")
          .eq("chat_id", existingChatId)
          .eq("user_id", user.id)
          .order("message_index", { ascending: true });

        if (ignore) {
          return;
        }

        if (existingMessagesError) {
          setInitError("Unable to load chat right now.");
          setIsInitializing(false);
          return;
        }

        const mappedMessages: ChatMessage[] = (existingMessages ?? [])
          .filter(
            (row) =>
              typeof row.content === "string" &&
              typeof row.message_index === "number" &&
              (row.role === "assistant" || row.role === "user" || row.role === "system"),
          )
          .map((row) => ({
            content: row.content,
            messageIndex: row.message_index,
            role: row.role,
          }));

        cleanupStateRef.current.chatId = existingChatId;
        cleanupStateRef.current.shouldCleanupDraft = false;
        cleanupStateRef.current.hasUserMessage = mappedMessages.some(
          (message) => message.role === "user",
        );
        setChatId(existingChatId);
        setSelectedClassId(existingChat.class_id ?? null);
        setTitleImmediate(existingChat.title?.trim() || "Untitled chat");
        setMessages(mappedMessages);
        setIsAwaitingAssistant(false);
        setIsInitializing(false);
        return;
      }

      const greetingMessage = buildAssistantGreeting(firstName);
      cleanupStateRef.current.chatId = null;
      cleanupStateRef.current.shouldCleanupDraft = false;
      setChatId(null);
      setSelectedClassId(classId);
      setWasTitleEditedBeforeFirstSend(false);
      setTitleImmediate("New chat");
      setMessages([
        {
          content: greetingMessage,
          messageIndex: 0,
          role: "assistant",
        },
      ]);
      setIsInitializing(false);
    };

    void createOrLoadChat();

    return () => {
      ignore = true;
      void cleanupDraftChat();
    };
  }, [chatBootstrapKey, cleanupDraftChat, setTitleImmediate]);

  useEffect(() => {
    const handleExit = () => {
      void cleanupDraftChat();
    };

    window.addEventListener("beforeunload", handleExit);
    window.addEventListener("pagehide", handleExit);

    return () => {
      window.removeEventListener("beforeunload", handleExit);
      window.removeEventListener("pagehide", handleExit);
    };
  }, [cleanupDraftChat]);

  const handleSend = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const content = composerValue.trim();
      if (!supabase || !user || !content || isSending || isAwaitingAssistant) {
        return;
      }

      const optimisticMessageIndex =
        messages.reduce((maxValue, message) => Math.max(maxValue, message.messageIndex), -1) + 1;
      const isFirstUserMessage = !messages.some((message) => message.role === "user");
      const summaryTitle = summarizeChatTitle(content);
      const timestamp = new Date().toISOString();

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          content,
          messageIndex: optimisticMessageIndex,
          role: "user",
        },
      ]);
      setComposerValue("");
      setIsSending(true);
      setIsAwaitingAssistant(true);

      let activeChatId = chatId;
      if (!activeChatId) {
        const greetingMessage = buildAssistantGreeting(firstName);
        const requestedInitialTitle = titleDraft.trim() || "New chat";
        const { data: createdChat, error: createChatError } = await supabase
          .from("chats")
          .insert({
            class_id: selectedClassId,
            is_archived: false,
            last_updated_at: timestamp,
            title: requestedInitialTitle,
            user_id: user.id,
          })
          .select("id")
          .single();

        if (createChatError || !createdChat?.id) {
          setIsSending(false);
          setIsAwaitingAssistant(false);
          return;
        }

        activeChatId = createdChat.id;
        const { error: seedInsertError } = await supabase.from("chat_messages").insert({
          chat_id: activeChatId,
          content: greetingMessage,
          message_index: 0,
          role: "assistant",
          user_id: user.id,
        });

        if (seedInsertError) {
          await deleteChatById(createdChat.id);
          setIsSending(false);
          setIsAwaitingAssistant(false);
          return;
        }

        setChatId(activeChatId);
        setTitleImmediate(requestedInitialTitle);
      }

      if (!activeChatId) {
        setIsSending(false);
        setIsAwaitingAssistant(false);
        return;
      }

      if (isFirstUserMessage && chatId) {
        void supabase
          .from("chats")
          .update({ title: summaryTitle })
          .eq("id", activeChatId)
          .eq("user_id", user.id);
        setTitleImmediate(summaryTitle);
      }

      if (
        isDraftChat &&
        isFirstUserMessage &&
        !wasTitleEditedBeforeFirstSend &&
        activeChatId
      ) {
        try {
          const response = await fetch("/api/chat", {
            body: JSON.stringify({
              firstMessage: content,
              mode: "generate_title",
            }),
            headers: {
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ""}`,
              "Content-Type": "application/json",
            },
            method: "POST",
          });

          if (response.ok) {
            const generated = (await response.json()) as GenerateTitleResponse;
            const generatedTitle = typeof generated.title === "string"
              ? generated.title.trim()
              : "";

            if (generatedTitle) {
              setChatTitle(generatedTitle);
              animateTitleTyping(generatedTitle);
              void supabase
                .from("chats")
                .update({ last_updated_at: timestamp, title: generatedTitle })
                .eq("id", activeChatId)
                .eq("user_id", user.id);
            }
          }
        } catch {
          // no-op fallback to existing title
        }
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) {
          setIsSending(false);
          setIsAwaitingAssistant(false);
          return;
        }

        const response = await fetch("/api/chat", {
          body: JSON.stringify({
            chatId: activeChatId,
            message: content,
            mode: "popup_assistant",
          }),
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        if (!response.ok) {
          setIsSending(false);
          setIsAwaitingAssistant(false);
          return;
        }

        const payload = (await response.json()) as PopupAssistantResponse;
        const returnedAssistant =
          payload.assistant &&
          typeof payload.assistant.content === "string" &&
          typeof payload.assistant.messageIndex === "number" &&
          payload.assistant.role === "assistant"
            ? payload.assistant
            : null;

        if (!returnedAssistant) {
          setIsSending(false);
          setIsAwaitingAssistant(false);
          return;
        }

        setMessages((currentMessages) => [
          ...currentMessages,
          returnedAssistant,
        ]);
        cleanupStateRef.current.hasUserMessage = true;
        setIsSending(false);
        setIsAwaitingAssistant(false);
      } catch {
        setIsSending(false);
        setIsAwaitingAssistant(false);
      }
    },
    [
      animateTitleTyping,
      chatId,
      composerValue,
      deleteChatById,
      firstName,
      isAwaitingAssistant,
      isDraftChat,
      isSending,
      messages,
      selectedClassId,
      setTitleImmediate,
      titleDraft,
      user,
      wasTitleEditedBeforeFirstSend,
    ],
  );

  useEffect(() => {
    return () => {
      if (titleAnimationRef.current !== null) {
        window.clearInterval(titleAnimationRef.current);
      }
    };
  }, []);

  const applyManualTitleEdit = useCallback(async () => {
    const normalized = titleDraft.trim();
    if (!normalized) {
      return;
    }

    setTitleImmediate(normalized);
    setIsTitleEditorOpen(false);

    const hasNoUserMessagesYet = !messages.some((message) => message.role === "user");
    if (isDraftChat && hasNoUserMessagesYet) {
      setWasTitleEditedBeforeFirstSend(true);
    }

    if (chatId && supabase && user) {
      await supabase.from("chats").update({ title: normalized }).eq("id", chatId).eq("user_id", user.id);
    }
  }, [chatId, isDraftChat, messages, setTitleImmediate, titleDraft, user]);

  const handleClassSelect = useCallback(
    async (nextClassId: string) => {
      setSelectedClassId(nextClassId);
      setIsClassPickerOpen(false);

      if (!chatId || !supabase || !user) {
        return;
      }

      await supabase
        .from("chats")
        .update({ class_id: nextClassId })
        .eq("id", chatId)
        .eq("user_id", user.id);
    },
    [chatId, user],
  );

  if (isInitializing) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <button
          className="inline-flex w-fit items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-(--text-muted) transition-colors duration-200 hover:bg-(--surface-main-faint) hover:text-(--text-main)"
          onClick={onBack}
          type="button"
        >
          <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
          Back
        </button>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div
            aria-label="Loading chat"
            className="h-6 w-6 animate-spin rounded-full border-2 border-(--border-soft) border-t-(--main)"
            role="status"
          />
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <button
          className="inline-flex w-fit items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-(--text-muted) transition-colors duration-200 hover:bg-(--surface-main-faint) hover:text-(--text-main)"
          onClick={onBack}
          type="button"
        >
          <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
          Back
        </button>
        <p className="mt-4 text-sm text-(--destructive)">{initError}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col px-5 py-5">
      <div>
        <button
          className="inline-flex w-fit items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-(--text-muted) transition-colors duration-200 hover:bg-(--surface-main-faint) hover:text-(--text-main)"
          onClick={onBack}
          type="button"
        >
          <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
          Back
        </button>
      </div>

      <div className="relative mt-2">
        <button
          className="inline-flex cursor-pointer items-center gap-1.5 text-left text-lg font-bold text-(--text-main)"
          onClick={() => setIsTitleEditorOpen((value) => !value)}
          type="button"
        >
          <span>{displayTitle || chatTitle}</span>
          <PencilSquareIcon aria-hidden="true" className="h-4 w-4 text-(--text-muted)" />
        </button>

        {isTitleEditorOpen ? (
          <div className="absolute top-full left-0 z-20 mt-2 w-64 rounded-xl border border-(--border-soft) bg-(--surface-base) p-2 shadow-(--shadow-floating)">
            <input
              className="h-9 w-full rounded-lg border border-(--border-soft) bg-transparent px-2 text-sm text-(--text-main) outline-none"
              onChange={(event) => setTitleDraft(event.target.value)}
              placeholder="Edit title"
              value={titleDraft}
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                className="rounded-lg px-2 py-1 text-xs font-semibold text-(--text-muted) transition-colors duration-200 hover:bg-(--surface-main-faint) hover:text-(--text-main)"
                onClick={() => {
                  setTitleDraft(chatTitle);
                  setIsTitleEditorOpen(false);
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-lg border border-(--border-soft) bg-(--surface-main-soft) px-2 py-1 text-xs font-semibold text-(--text-main) transition-colors duration-200 hover:bg-(--surface-main-faint)"
                onClick={() => {
                  void applyManualTitleEdit();
                }}
                type="button"
              >
                Save
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative mt-2">
        {selectedClassName ? (
          <p className="text-xs font-semibold text-(--text-muted)">
            Linked class: {selectedClassName}
          </p>
        ) : (
          <>
            <button
              className="cursor-pointer text-xs font-semibold text-(--main) transition-colors duration-200 hover:text-(--text-secondary)"
              onClick={() => setIsClassPickerOpen((value) => !value)}
              type="button"
            >
              Link this chat to a class
            </button>
            {isClassPickerOpen ? (
              <div className="absolute top-full left-0 z-20 mt-2 w-64 rounded-xl border border-(--border-soft) bg-(--surface-base) p-2 shadow-(--shadow-floating)">
                {userClasses.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-(--text-muted)">No classes available yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {userClasses.map((classItem) => (
                      <li key={classItem.id}>
                        <button
                          className="w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-(--text-main) transition-colors duration-200 hover:bg-(--surface-main-faint)"
                          onClick={() => {
                            void handleClassSelect(classItem.id);
                          }}
                          type="button"
                        >
                          {classItem.name?.trim() || "Untitled class"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {messages.map((message, index) => {
          const isUserMessage = message.role === "user";
          const actorName = isUserMessage ? firstName : "Assistant";
          const actorIconText = isUserMessage ? firstName.charAt(0).toUpperCase() : "A";

          return (
            <article
              key={`${message.role}-${message.messageIndex}-${index}`}
              className={`flex ${isUserMessage ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] ${isUserMessage ? "items-end" : "items-start"} flex flex-col`}>
                <p className="flex items-center gap-2 text-xs font-semibold text-(--text-muted)">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-base) text-[11px] font-bold text-(--text-main)">
                    {actorIconText}
                  </span>
                  <span>{actorName}</span>
                </p>
                <div
                  className={`mt-1 rounded-2xl border px-3 py-2.5 text-sm leading-6 ${
                    isUserMessage
                      ? "border-(--border-strong) bg-(--surface-main-soft) text-(--text-main)"
                      : "border-(--border-soft) bg-(--surface-base) text-(--text-main)"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            </article>
          );
        })}
        {isAwaitingAssistant ? (
          <p className="text-xs font-medium text-(--text-muted)">Assistant is thinking...</p>
        ) : null}
      </div>

      <form className="mt-4 border-t border-(--border-soft) pt-3" onSubmit={handleSend}>
        <div className="flex items-center gap-2 rounded-xl border border-(--border-soft) bg-(--surface-base) px-2 py-2">
          <input
            className="h-10 min-w-0 flex-1 border-0 bg-transparent px-2 text-sm text-(--text-main) outline-none"
            onChange={(event) => setComposerValue(event.target.value)}
            placeholder="Type your message..."
            value={composerValue}
          />
          <button
            aria-label="Send message"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-(--border-soft) bg-(--surface-main-soft) text-(--text-main) transition-colors duration-200 hover:bg-(--surface-main-faint) disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!composerValue.trim() || isSending || isAwaitingAssistant}
            type="submit"
          >
            <PaperAirplaneIcon aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
