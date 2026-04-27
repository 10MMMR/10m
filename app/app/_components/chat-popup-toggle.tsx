"use client";

import {
  ChatBubbleLeftEllipsisIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  HomeIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type SVGProps,
} from "react";
import { useAuth } from "@/app/_global/authentication/auth-context";
import { NewChatSessionPanel } from "@/app/_components/chat/new-chat-session-panel";
import { supabase } from "@/app/_global/authentication/supabaseClient";

type PopupSection = "home" | "chats";
type PopupChatDetail =
  | {
      mode: "existing";
      chatId: string;
    }
  | {
      mode: "new";
    };

type PopupTab = {
  id: PopupSection;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};
const POPUP_OPEN_KEY = "dashboard-chat-popup-open";
const POPUP_SECTION_KEY = "dashboard-chat-popup-section";
const POPUP_STATE_EVENT = "dashboard-chat-popup-state";

const popupTabs: PopupTab[] = [
  {
    id: "home",
    label: "Home",
    icon: HomeIcon,
  },
  {
    id: "chats",
    label: "Chats",
    icon: ChatBubbleLeftEllipsisIcon,
  },
];

type ChatRow = {
  created_at?: string | null;
  id: string;
  last_updated_at?: string | null;
  title: string | null;
  updated_at?: string | null;
};

type RecentChatItem = {
  id: string;
  lastActivity: string;
  title: string;
};
type RecentChatsCachePayload = {
  chats: RecentChatItem[];
  userId: string;
};

const recentChatDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const RECENT_CHATS_CACHE_KEY = "dashboard-recent-chats-cache";

const toRecentChatItem = (row: ChatRow): RecentChatItem => {
  const title = row.title?.trim() || "Untitled chat";
  const lastActivityIso =
    row.last_updated_at ?? row.updated_at ?? row.created_at ?? new Date().toISOString();
  const parsedDate = lastActivityIso ? new Date(lastActivityIso) : null;
  const lastActivity =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? recentChatDateFormatter.format(parsedDate)
      : recentChatDateFormatter.format(new Date());

  return {
    id: row.id,
    lastActivity,
    title,
  };
};

type HomeContentProps = {
  onOpenChat: (detail: PopupChatDetail) => void;
};

function HomeContent({
  onOpenChat,
  refreshNonce = 0,
}: HomeContentProps & { refreshNonce?: number }) {
  const { user } = useAuth();
  const [recentChats, setRecentChats] = useState<RecentChatItem[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);

  const readRecentChatsCache = useCallback(() => {
    if (typeof window === "undefined" || !user) {
      return null;
    }

    try {
      const raw = window.sessionStorage.getItem(RECENT_CHATS_CACHE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as RecentChatsCachePayload;
      if (parsed.userId !== user.id || !Array.isArray(parsed.chats)) {
        return null;
      }

      return parsed.chats;
    } catch {
      return null;
    }
  }, [user]);

  const writeRecentChatsCache = useCallback(
    (chats: RecentChatItem[]) => {
      if (typeof window === "undefined" || !user) {
        return;
      }

      const payload: RecentChatsCachePayload = {
        chats,
        userId: user.id,
      };

      try {
        window.sessionStorage.setItem(RECENT_CHATS_CACHE_KEY, JSON.stringify(payload));
      } catch {
        return;
      }
    },
    [user],
  );

  const loadRecentChats = useCallback(async (forceRefresh = false) => {
    if (!supabase || !user) {
      setRecentChats([]);
      setIsLoadingChats(false);
      return;
    }

    let hasCachedChats = false;
    if (!forceRefresh) {
      const cachedChats = readRecentChatsCache();
      if (cachedChats) {
        setRecentChats(cachedChats);
        setIsLoadingChats(false);
        hasCachedChats = true;
      }
    }

    if (!hasCachedChats) {
      setIsLoadingChats(true);
    }

    const fullQuery = supabase
      .from("chats")
      .select("id, title, last_updated_at, updated_at, created_at")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("last_updated_at", { ascending: false })
      .limit(3);

    const { data, error } = await fullQuery;

    if (error) {
      const fallbackQuery = supabase
        .from("chats")
        .select("id, title")
        .eq("user_id", user.id)
        .eq("is_archived", false)
        .limit(3);
      const { data: fallbackData, error: fallbackError } = await fallbackQuery;

      if (fallbackError) {
        setRecentChats([]);
        setIsLoadingChats(false);
        return;
      }

      const nextChats = (fallbackData ?? []).map((row) => toRecentChatItem(row as ChatRow));
      setRecentChats(nextChats);
      writeRecentChatsCache(nextChats);
      setIsLoadingChats(false);
      return;
    }

    const nextChats = (data ?? []).map((row) => toRecentChatItem(row as ChatRow));
    setRecentChats(nextChats);
    writeRecentChatsCache(nextChats);
    setIsLoadingChats(false);
  }, [readRecentChatsCache, user, writeRecentChatsCache]);

  useEffect(() => {
    void loadRecentChats();
  }, [loadRecentChats, refreshNonce]);

  return (
    <div className="flex flex-col gap-5 text-(--text-main)">
      <div className="border-b border-(--border-soft) pb-4">
        <p className="text-sm font-semibold text-(--text-muted)">Hi Tan</p>
        <p className="mt-1 text-xl font-bold leading-tight text-(--text-main)">
          What&apos;s on your mind today?
        </p>
      </div>

      <section className="rounded-2xl border border-(--border-soft) bg-(--surface-main-xfaint) p-4">
        <h3 className="text-sm font-semibold">Recent chats</h3>
        {isLoadingChats ? (
          <p className="mt-3 text-xs text-(--text-muted)">Loading recent chats...</p>
        ) : recentChats.length === 0 ? (
          <p className="mt-3 text-sm text-(--text-muted)">You have no recent chats</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {recentChats.map((chat) => (
              <li key={chat.id}>
                <button
                  className="group flex w-full cursor-pointer items-center justify-between rounded-xl border border-(--border-soft) bg-(--surface-base) px-3 py-2.5 text-left transition-colors duration-200 hover:bg-(--surface-main-faint)"
                  onClick={() => onOpenChat({ mode: "existing", chatId: chat.id })}
                  type="button"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight text-(--text-main)">
                      {chat.title}
                    </p>
                    <p className="mt-1 text-xs text-(--text-muted)">
                      Last activity: {chat.lastActivity}
                    </p>
                  </div>
                  <ChevronRightIcon
                    aria-hidden="true"
                    className="ml-3 h-4 w-4 shrink-0 text-(--text-muted) transition-colors duration-200 group-hover:text-(--text-main)"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-(--border-soft) bg-(--surface-base) px-3 py-2.5 text-sm font-semibold text-(--text-main) transition-colors duration-200 hover:bg-(--surface-main-faint)"
          onClick={() => onOpenChat({ mode: "new" })}
          type="button"
        >
          <PlusIcon aria-hidden="true" className="h-4 w-4" />
          Start a new chat
        </button>
      </section>
    </div>
  );
}

function ChatsContent() {
  return <p className="text-sm font-medium text-(--text-main)">Chats</p>;
}

function PopupContent({
  refreshNonce,
  onOpenChat,
  section,
}: {
  refreshNonce?: number;
  onOpenChat: (detail: PopupChatDetail) => void;
  section: PopupSection;
}) {
  if (section === "chats") {
    return <ChatsContent />;
  }

  return <HomeContent onOpenChat={onOpenChat} refreshNonce={refreshNonce} />;
}

function readPopupOpenState() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.sessionStorage.getItem(POPUP_OPEN_KEY) === "true";
  } catch {
    return false;
  }
}

function readPopupSectionState(): PopupSection {
  if (typeof window === "undefined") {
    return "home";
  }

  try {
    const value = window.sessionStorage.getItem(POPUP_SECTION_KEY);
    if (value === "home" || value === "chats") {
      return value;
    }
  } catch {
    return "home";
  }

  return "home";
}

function writePopupOpenState(nextState: boolean) {
  try {
    window.sessionStorage.setItem(POPUP_OPEN_KEY, String(nextState));
  } catch {
    return;
  }
}

function writePopupSectionState(nextSection: PopupSection) {
  try {
    window.sessionStorage.setItem(POPUP_SECTION_KEY, nextSection);
  } catch {
    return;
  }
}

function notifyPopupStateChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(POPUP_STATE_EVENT));
}

function subscribeToPopupState(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handlePopupStateChange = () => callback();
  window.addEventListener(POPUP_STATE_EVENT, handlePopupStateChange);

  return () => {
    window.removeEventListener(POPUP_STATE_EVENT, handlePopupStateChange);
  };
}

export function ChatPopupToggle() {
  const isOpen = useSyncExternalStore(
    subscribeToPopupState,
    readPopupOpenState,
    () => false,
  );
  const activeSection = useSyncExternalStore<PopupSection>(
    subscribeToPopupState,
    readPopupSectionState,
    () => "home",
  );
  const [chatDetail, setChatDetail] = useState<PopupChatDetail | null>(null);
  const [recentChatsRefreshNonce, setRecentChatsRefreshNonce] = useState(0);

  const setOpenState = (nextIsOpen: boolean) => {
    writePopupOpenState(nextIsOpen);
    notifyPopupStateChange();
  };

  const setSectionState = (nextSection: PopupSection) => {
    writePopupSectionState(nextSection);
    notifyPopupStateChange();
  };
  const handleOpenChatDetail = (detail: PopupChatDetail) => {
    setChatDetail(detail);
  };
  const handleBackFromChatDetail = () => {
    setChatDetail(null);
    setRecentChatsRefreshNonce((value) => value + 1);
  };
  const isChatDetailOpen = chatDetail !== null;

  return (
    <>
      {isOpen ? (
        <section className="chat-popup-panel chat-popup-panel-enter fixed inset-0 z-50 flex flex-col bg-(--surface-base) md:inset-auto md:right-6 md:bottom-24 md:rounded-3xl md:border md:border-(--border-soft) md:bg-(--surface-base) md:shadow-(--shadow-floating)">
          <div className="pointer-events-none absolute top-5 right-5 z-20">
            <button
              aria-label="Close chat popup"
              className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-(--text-muted) transition-colors duration-200 hover:bg-(--surface-main-faint) hover:text-(--text-main)"
              onClick={() => setOpenState(false)}
              type="button"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className={`min-h-0 flex-1 ${isChatDetailOpen ? "" : "overflow-y-auto p-5"}`}>
            {isChatDetailOpen ? (
              <NewChatSessionPanel
                existingChatId={chatDetail.mode === "existing" ? chatDetail.chatId : null}
                onBack={handleBackFromChatDetail}
              />
            ) : (
              <PopupContent
                onOpenChat={handleOpenChatDetail}
                refreshNonce={recentChatsRefreshNonce}
                section={activeSection}
              />
            )}
          </div>

          {isChatDetailOpen ? null : (
            <nav className="border-t border-(--border-soft) p-3">
              <ul className="grid grid-cols-2 gap-2">
                {popupTabs.map((tab) => {
                  const isActive = activeSection === tab.id;
                  const Icon = tab.icon;

                  return (
                    <li key={tab.id}>
                      <button
                        className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition-colors duration-200 ${
                          isActive
                            ? "bg-(--surface-main-soft) text-(--text-main)"
                            : "text-(--text-muted) hover:bg-(--surface-main-faint)"
                        }`}
                        onClick={() => setSectionState(tab.id)}
                        type="button"
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        <span>{tab.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
        </section>
      ) : null}

      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close chat popup" : "Open chat popup"}
        className={`fixed right-6 bottom-6 z-50 h-14 w-14 items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-panel-strong) text-(--text-main) shadow-(--shadow-floating) transition-colors duration-200 hover:bg-(--surface-main-faint) ${
          isOpen ? "hidden md:inline-flex" : "inline-flex"
        }`}
        onClick={() => setOpenState(!isOpen)}
        type="button"
      >
        {isOpen ? (
          <ChevronDownIcon className="h-6 w-6" aria-hidden="true" />
        ) : (
          <ChatBubbleLeftEllipsisIcon className="h-6 w-6" aria-hidden="true" />
        )}
      </button>
    </>
  );
}
