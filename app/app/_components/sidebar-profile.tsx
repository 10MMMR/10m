"use client";

import {
  ArrowLeftOnRectangleIcon,
  ChevronUpIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  UserCircleIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";

type SidebarProfileProps = {
  name: string;
  onSignOut: () => void;
};

type ProfileAction = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  id: string;
  label: string;
};

const profileActions: ProfileAction[] = [
  {
    id: "profile",
    label: "Profile",
    icon: UserIcon,
  },
  {
    id: "settings",
    label: "Settings",
    icon: Cog6ToothIcon,
  },
  {
    id: "subscription",
    label: "Manage Subscription",
    icon: CreditCardIcon,
  },
  {
    id: "logout",
    label: "Log Out",
    icon: ArrowLeftOnRectangleIcon,
  },
];

export function SidebarProfile({ name, onSignOut }: SidebarProfileProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {menuOpen ? (
        <div className="absolute right-0 bottom-[calc(100%+0.55rem)] left-0 z-30 rounded-2xl border border-(--border-soft) bg-(--surface-panel-strong) p-1.5 shadow-(--shadow-floating) backdrop-blur-sm">
          {profileActions.map((action) => {
            const Icon = action.icon;

            return (
              <button
                key={action.id}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-semibold text-(--text-main) transition-colors duration-150 hover:bg-(--surface-main-faint)"
                onClick={() => {
                  if (action.id === "logout") {
                    onSignOut();
                  }

                  setMenuOpen(false);
                }}
                type="button"
              >
                <Icon className="h-4 w-4 text-(--text-muted)" aria-hidden="true" />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <button
        aria-expanded={menuOpen}
        className="flex h-14 w-full items-center justify-between rounded-2xl border border-(--border-soft) bg-(--surface-panel-soft) px-3 text-left transition-colors duration-200 hover:bg-(--surface-main-faint)"
        onClick={() => setMenuOpen((value) => !value)}
        type="button"
      >
        <span className="flex items-center gap-2.5">
          <UserCircleIcon className="h-6 w-6 text-(--text-muted)" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-(--text-main)">{name}</span>
            <span className="block text-xs font-medium text-(--text-muted)">Free</span>
          </span>
        </span>
        <ChevronUpIcon
          className={`h-4 w-4 text-(--text-muted) transition-transform duration-200 ${
            menuOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
