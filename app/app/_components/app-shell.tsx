"use client";

import {
  AcademicCapIcon,
  CalendarDaysIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ClipboardDocumentCheckIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType, type SVGProps } from "react";
import { useAuth } from "@/app/_global/authentication/auth-context";
import { SiteLogo } from "@/app/_components/site-logo";
import { ThemeTogglePill } from "@/app/_components/theme-toggle-pill";
import { ChatPopupToggle } from "./chat-popup-toggle";
import { SidebarProfile } from "./sidebar-profile";

const SIDEBAR_EXPANDED_REM = 20;
const SIDEBAR_VISIBLE_REM = 3.5;
const SIDEBAR_HIDDEN_SHIFT_REM = SIDEBAR_EXPANDED_REM - SIDEBAR_VISIBLE_REM;

type AppShellProps = {
  children: React.ReactNode;
};

type SidebarItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  match?: "exact" | "prefix";
};

const sidebarItems: SidebarItem[] = [
  {
    href: "/app",
    label: "Overview",
    icon: Squares2X2Icon,
    match: "exact",
  },
  {
    href: "/app/classes",
    label: "Classes",
    icon: AcademicCapIcon,
  },
  {
    href: "/app/exams",
    label: "Mock Exams",
    icon: ClipboardDocumentCheckIcon,
  },
  {
    href: "/app/calendar",
    label: "Calendar",
    icon: CalendarDaysIcon,
  },
];

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { signOut } = useAuth();
  const pathname = usePathname();
  const sidebarWidth = collapsed
    ? `${SIDEBAR_VISIBLE_REM}rem`
    : `${SIDEBAR_EXPANDED_REM}rem`;
  const sidebarShift = collapsed
    ? `translateX(-${SIDEBAR_HIDDEN_SHIFT_REM}rem)`
    : "translateX(0rem)";

  return (
    <div className='workspace-shell flex h-[100dvh] flex-1 overflow-hidden'>
      <aside
        className='relative overflow-hidden border-r border-(--border-soft) bg-(--surface-panel-strong) transition-[width] duration-300 ease-in-out h-[100dvh]'
        style={{ width: sidebarWidth }}
      >
        <button
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className='absolute top-3 right-3 z-30 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--border-soft) bg-(--surface-base) text-(--text-muted) transition-colors duration-200 hover:bg-(--surface-main-faint) hover:text-(--text-main)'
          onClick={() => setCollapsed((value) => !value)}
          type='button'
        >
          {collapsed ? (
            <ChevronDoubleRightIcon className='h-4 w-4' aria-hidden='true' />
          ) : (
            <ChevronDoubleLeftIcon className='h-4 w-4' aria-hidden='true' />
          )}
        </button>

        <div
          className='relative flex h-full flex-col p-3 pt-4 transition-transform duration-300 ease-in-out'
          style={{
            width: `${SIDEBAR_EXPANDED_REM}rem`,
            transform: sidebarShift,
          }}
        >
          <div className='pr-14'>
            <SiteLogo />
          </div>

          <nav className='mt-8 space-y-2 pb-32'>
            {sidebarItems.map((item) => {
              const isActive =
                item.match === "exact"
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`group flex h-11 w-full items-center gap-3 rounded-2xl px-3 transition-colors duration-200 ${
                    isActive
                      ? "bg-(--surface-main-soft) text-(--text-main)"
                      : "text-(--text-muted) hover:bg-(--surface-main-faint) hover:text-(--text-main)"
                  }`}
                >
                  <Icon className='h-5 w-5 shrink-0' aria-hidden='true' />
                  <span className='whitespace-nowrap text-sm font-semibold'>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div
            className='absolute right-3 left-3 space-y-3'
            style={{ bottom: "1.2rem" }}
          >
            <ThemeTogglePill placement='inline' />
            <SidebarProfile name='Tan Yu' onSignOut={signOut} />
          </div>
        </div>
      </aside>

      <main className='flex-1 overflow-y-auto'>
        <div className='h-full p-5 sm:p-8 lg:p-10'>{children}</div>
      </main>
      <ChatPopupToggle />
    </div>
  );
}
