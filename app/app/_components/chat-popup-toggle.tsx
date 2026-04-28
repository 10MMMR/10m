"use client";

import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
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
  useLayoutEffect,
  useRef,
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
const POPUP_FULLSCREEN_KEY = "dashboard-chat-popup-fullscreen";
const POPUP_STATE_EVENT = "dashboard-chat-popup-state";
const FULLSCREEN_ANIMATION_MS = 320;
const FULLSCREEN_ANIMATION_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

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
  class_id?: string | null;
  created_at?: string | null;
  id: string;
  last_updated_at?: string | null;
  title: string | null;
  updated_at?: string | null;
};

type RecentChatItem = {
  className: string;
  id: string;
  lastActivity: string;
  title: string;
};
type RecentChatsCachePayload = {
  chats: RecentChatItem[];
  userId: string;
  version?: number;
};

const recentChatDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const RECENT_CHATS_CACHE_KEY = "dashboard-recent-chats-cache";
const RECENT_CHATS_CACHE_VERSION = 2;

const toRecentChatItem = (
  row: ChatRow,
  classNamesById = new Map<string, string>(),
): RecentChatItem => {
  const title = row.title?.trim() || "Untitled chat";
  const classId = row.class_id?.trim() ?? "";
  const className = classId
    ? classNamesById.get(classId) ?? "Untitled class"
    : "No Linked Class";
  const lastActivityIso =
    row.last_updated_at ?? row.updated_at ?? row.created_at ?? new Date().toISOString();
  const parsedDate = lastActivityIso ? new Date(lastActivityIso) : null;
  const lastActivity =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? recentChatDateFormatter.format(parsedDate)
      : recentChatDateFormatter.format(new Date());

  return {
    className,
    id: row.id,
    lastActivity,
    title,
  };
};

async function loadClassNamesById(classIds: string[], userId: string) {
  if (!supabase || classIds.length === 0) {
    return new Map<string, string>();
  }

  const uniqueClassIds = Array.from(new Set(classIds.filter(Boolean)));

  if (uniqueClassIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("classes")
    .select("id, name")
    .eq("user_id", userId)
    .in("id", uniqueClassIds);

  if (error || !Array.isArray(data)) {
    return new Map<string, string>();
  }

  return new Map(
    data
      .map((row) => {
        const id = (row as { id?: unknown }).id;
        const name = (row as { name?: unknown }).name;

        if (typeof id !== "string" || typeof name !== "string") {
          return null;
        }

        return [id, name.trim() || "Untitled class"] as const;
      })
      .filter((entry): entry is readonly [string, string] => entry !== null),
  );
}

async function toRecentChatItems(rows: ChatRow[], userId: string) {
  const classIds = rows
    .map((row) => row.class_id?.trim() ?? "")
    .filter(Boolean);
  const classNamesById = await loadClassNamesById(classIds, userId);

  return rows.map((row) => toRecentChatItem(row, classNamesById));
}

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
      if (
        parsed.userId !== user.id ||
        parsed.version !== RECENT_CHATS_CACHE_VERSION ||
        !Array.isArray(parsed.chats)
      ) {
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
        version: RECENT_CHATS_CACHE_VERSION,
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
      .select("id, title, class_id, last_updated_at, updated_at, created_at")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("last_updated_at", { ascending: false })
      .limit(3);

    const { data, error } = await fullQuery;

    if (error) {
      const fallbackQuery = supabase
        .from("chats")
        .select("id, title, class_id")
        .eq("user_id", user.id)
        .eq("is_archived", false)
        .limit(3);
      const { data: fallbackData, error: fallbackError } = await fallbackQuery;

      if (fallbackError) {
        setRecentChats([]);
        setIsLoadingChats(false);
        return;
      }

      const nextChats = await toRecentChatItems((fallbackData ?? []) as ChatRow[], user.id);
      setRecentChats(nextChats);
      writeRecentChatsCache(nextChats);
      setIsLoadingChats(false);
      return;
    }

    const nextChats = await toRecentChatItems((data ?? []) as ChatRow[], user.id);
    setRecentChats(nextChats);
    writeRecentChatsCache(nextChats);
    setIsLoadingChats(false);
  }, [readRecentChatsCache, user, writeRecentChatsCache]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadRecentChats();
    });
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
                    <p className="mt-1 truncate text-xs font-semibold text-(--text-muted)">
                      {chat.className}
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

type ChatHistorySidebarProps = {
  activeChatId: string | null;
  onOpenChat: (detail: PopupChatDetail) => void;
  refreshNonce?: number;
};

function ChatHistorySidebar({
  activeChatId,
  onOpenChat,
  refreshNonce = 0,
}: ChatHistorySidebarProps) {
  const { user } = useAuth();
  const [chats, setChats] = useState<RecentChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadChats = useCallback(async () => {
    if (!supabase || !user) {
      setChats([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase
      .from("chats")
      .select("id, title, class_id, last_updated_at, updated_at, created_at")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("last_updated_at", { ascending: false });

    if (error) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("chats")
        .select("id, title, class_id, created_at")
        .eq("user_id", user.id)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (fallbackError) {
        setChats([]);
        setIsLoading(false);
        return;
      }

      setChats(await toRecentChatItems((fallbackData ?? []) as ChatRow[], user.id));
      setIsLoading(false);
      return;
    }

    setChats(await toRecentChatItems((data ?? []) as ChatRow[], user.id));
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadChats();
    });
  }, [loadChats, refreshNonce]);

  return (
    <aside className="hidden w-80 shrink-0 flex-col border-r border-(--border-soft) bg-(--surface-main-xfaint) md:flex">
      <div className="border-b border-(--border-soft) px-4 py-4">
        <p className="text-xs font-bold uppercase text-(--text-muted)">Chats</p>
        <button
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-(--border-soft) bg-(--surface-base) px-3 py-2.5 text-sm font-semibold text-(--text-main) transition-colors duration-200 hover:bg-(--surface-main-faint)"
          onClick={() => onOpenChat({ mode: "new" })}
          type="button"
        >
          <PlusIcon aria-hidden="true" className="h-4 w-4" />
          New chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <p className="px-2 py-3 text-xs font-semibold text-(--text-muted)">
            Loading chats...
          </p>
        ) : chats.length === 0 ? (
          <p className="px-2 py-3 text-sm text-(--text-muted)">No chats yet.</p>
        ) : (
          <ul className="space-y-2">
            {chats.map((chat) => {
              const isActive = activeChatId === chat.id;

              return (
                <li key={chat.id}>
                  <button
                    className={`group w-full rounded-xl border px-3 py-3 text-left transition-colors duration-200 ${
                      isActive
                        ? "border-(--border-strong) bg-(--surface-main-soft)"
                        : "border-(--border-soft) bg-(--surface-base) hover:bg-(--surface-main-faint)"
                    }`}
                    onClick={() => onOpenChat({ mode: "existing", chatId: chat.id })}
                    type="button"
                  >
                    <p className="truncate text-sm font-semibold text-(--text-main)">
                      {chat.title}
                    </p>
                    <p className="mt-1 truncate text-xs font-semibold text-(--text-muted)">
                      {chat.className}
                    </p>
                    <p className="mt-1 text-xs text-(--text-muted)">
                      {chat.lastActivity}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
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

function readPopupFullscreenPreference() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(POPUP_FULLSCREEN_KEY) === "true";
  } catch {
    return false;
  }
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

function writePopupFullscreenPreference(nextState: boolean) {
  try {
    window.localStorage.setItem(POPUP_FULLSCREEN_KEY, String(nextState));
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
  const [isFullscreen, setIsFullscreen] = useState(readPopupFullscreenPreference);
  const [recentChatsRefreshNonce, setRecentChatsRefreshNonce] = useState(0);
  const panelRef = useRef<HTMLElement | null>(null);
  const panelRectBeforeToggleRef = useRef<DOMRect | null>(null);

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
  const handleChatActivity = () => {
    setRecentChatsRefreshNonce((value) => value + 1);
  };
  const handleFullscreenToggle = () => {
    const panel = panelRef.current;
    panelRectBeforeToggleRef.current = panel?.getBoundingClientRect() ?? null;

    setIsFullscreen((value) => {
      const nextValue = !value;
      writePopupFullscreenPreference(nextValue);

      return nextValue;
    });
  };
  const handleClosePopup = () => {
    setOpenState(false);
  };
  const isChatDetailOpen = chatDetail !== null;
  const activeChatId = chatDetail?.mode === "existing" ? chatDetail.chatId : null;
  const FullscreenIcon = isFullscreen ? ArrowsPointingInIcon : ArrowsPointingOutIcon;

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const previousRect = panelRectBeforeToggleRef.current;
    panelRectBeforeToggleRef.current = null;

    if (!panel || !previousRect) {
      return;
    }

    const nextRect = panel.getBoundingClientRect();

    if (
      previousRect.width === 0 ||
      previousRect.height === 0 ||
      nextRect.width === 0 ||
      nextRect.height === 0
    ) {
      return;
    }

    const animation = panel.animate(
      [
        {
          height: `${previousRect.height}px`,
          left: `${previousRect.left}px`,
          top: `${previousRect.top}px`,
          width: `${previousRect.width}px`,
        },
        {
          height: `${nextRect.height}px`,
          left: `${nextRect.left}px`,
          top: `${nextRect.top}px`,
          width: `${nextRect.width}px`,
        },
      ],
      {
        duration: FULLSCREEN_ANIMATION_MS,
        easing: FULLSCREEN_ANIMATION_EASING,
      },
    );

    return () => {
      animation.cancel();
    };
  }, [isFullscreen]);

  return (
    <>
      {isOpen ? (
        <section
          ref={panelRef}
          className={`chat-popup-panel chat-popup-panel-enter fixed z-50 flex flex-col bg-(--surface-base) ${
            isFullscreen
              ? "chat-popup-panel-fullscreen inset-0"
              : "inset-0 md:inset-auto md:right-6 md:bottom-24 md:rounded-3xl md:border md:border-(--border-soft) md:bg-(--surface-base) md:shadow-(--shadow-floating)"
          }`}
        >
          <div className="pointer-events-none absolute top-5 right-5 z-20 flex items-center gap-2">
            <button
              aria-label={isFullscreen ? "Minimize chat popup" : "Open chat popup full screen"}
              className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-(--text-muted) transition-colors duration-200 hover:bg-(--surface-main-faint) hover:text-(--text-main)"
              onClick={handleFullscreenToggle}
              type="button"
            >
              <FullscreenIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              aria-label="Close chat popup"
              className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-(--text-muted) transition-colors duration-200 hover:bg-(--surface-main-faint) hover:text-(--text-main)"
              onClick={handleClosePopup}
              type="button"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1">
            {isFullscreen && isChatDetailOpen ? (
              <ChatHistorySidebar
                activeChatId={activeChatId}
                onOpenChat={handleOpenChatDetail}
                refreshNonce={recentChatsRefreshNonce}
              />
            ) : null}

            <div
              className={`min-h-0 flex-1 ${
                isChatDetailOpen ? "flex flex-col overflow-hidden" : "overflow-y-auto p-5"
              }`}
            >
              {isChatDetailOpen ? (
                <NewChatSessionPanel
                  existingChatId={chatDetail.mode === "existing" ? chatDetail.chatId : null}
                  onChatActivity={handleChatActivity}
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
          </div>

          {isChatDetailOpen || isFullscreen ? null : (
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
        className={`fixed right-6 z-50 h-14 w-14 items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-panel-strong) text-(--text-main) shadow-(--shadow-floating) transition-all duration-200 hover:bg-(--surface-main-faint) ${
          isOpen && isFullscreen ? "bottom-24" : "bottom-6"
        } ${
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
