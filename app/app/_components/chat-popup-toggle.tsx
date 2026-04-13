"use client";

import {
  AcademicCapIcon,
  ChatBubbleLeftEllipsisIcon,
  ChevronDownIcon,
  HomeIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useSyncExternalStore, type ComponentType, type SVGProps } from "react";

type PopupSection = "home" | "classes" | "chats";

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
    id: "classes",
    label: "Classes",
    icon: AcademicCapIcon,
  },
  {
    id: "chats",
    label: "Chats",
    icon: ChatBubbleLeftEllipsisIcon,
  },
];

function HomeContent() {
  return (
    <div className="rounded-2xl border border-(--border-soft) bg-(--surface-main-xfaint) px-4 py-3 text-sm text-(--text-main)">
      Home
    </div>
  );
}

function ClassesContent() {
  return <p className="text-sm font-medium text-(--text-main)">Class</p>;
}

function ChatsContent() {
  return <p className="text-sm font-medium text-(--text-main)">Chats</p>;
}

function PopupContent({ section }: { section: PopupSection }) {
  if (section === "classes") {
    return <ClassesContent />;
  }

  if (section === "chats") {
    return <ChatsContent />;
  }

  return <HomeContent />;
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
    if (value === "home" || value === "classes" || value === "chats") {
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

  const setOpenState = (nextIsOpen: boolean) => {
    writePopupOpenState(nextIsOpen);
    notifyPopupStateChange();
  };

  const setSectionState = (nextSection: PopupSection) => {
    writePopupSectionState(nextSection);
    notifyPopupStateChange();
  };

  return (
    <>
      {isOpen ? (
        <section className="chat-popup-panel chat-popup-panel-enter fixed inset-0 z-50 flex flex-col bg-(--surface-base) md:inset-auto md:right-6 md:bottom-24 md:rounded-3xl md:border md:border-(--border-soft) md:bg-(--surface-panel-strong) md:shadow-(--shadow-floating)">
          <header className="border-b border-(--border-soft) p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-(--text-muted)">Hi Tan</p>
                <p className="mt-1 text-xl font-bold leading-tight text-(--text-main)">
                  What&apos;s on your mind today?
                </p>
              </div>
              <button
                aria-label="Close chat popup"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-(--text-muted) transition-colors duration-200 hover:bg-(--surface-main-faint) hover:text-(--text-main)"
                onClick={() => setOpenState(false)}
                type="button"
              >
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4">
            <PopupContent section={activeSection} />
          </div>

          <nav className="border-t border-(--border-soft) p-2">
            <ul className="grid grid-cols-3 gap-2">
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
