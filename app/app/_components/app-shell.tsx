"use client";

import {
  AcademicCapIcon,
  Bars3Icon,
  CalendarDaysIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ClipboardDocumentCheckIcon,
  Squares2X2Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import { useAuth } from "@/app/_global/authentication/auth-context";
import { supabase } from "@/app/_global/authentication/supabaseClient";
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

type ClassSidebarItem = {
  id: string;
  name: string | null;
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [classes, setClasses] = useState<ClassSidebarItem[]>([]);
  const { signOut, user } = useAuth();
  const pathname = usePathname();
  const mobileMenuId = "app-mobile-menu";
  const sidebarWidth = collapsed
    ? `${SIDEBAR_VISIBLE_REM}rem`
    : `${SIDEBAR_EXPANDED_REM}rem`;
  const sidebarShift = collapsed
    ? `translateX(-${SIDEBAR_HIDDEN_SHIFT_REM}rem)`
    : "translateX(0rem)";
  const isItemActive = (item: SidebarItem) =>
    item.match === "exact"
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const sortedClasses = useMemo(
    () =>
      [...classes].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", undefined, {
          sensitivity: "base",
        }),
      ),
    [classes],
  );
  const visibleClasses = user ? sortedClasses : [];

  useEffect(() => {
    if (!supabase || !user) {
      return;
    }

    let ignore = false;

    const loadClasses = async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (ignore || error) {
        if (!ignore && error) {
          setClasses([]);
        }
        return;
      }

      setClasses(data ?? []);
    };

    void loadClasses();

    return () => {
      ignore = true;
    };
  }, [user]);

  return (
    <div className='workspace-shell flex h-[100dvh] flex-1 overflow-hidden'>
      <aside
        className='relative hidden overflow-hidden border-r border-(--border-soft) bg-(--surface-panel-strong) transition-[width] duration-300 ease-in-out h-[100dvh] md:block'
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

          <div className='mt-8 min-h-0 flex-1 overflow-y-auto pb-6 pr-1'>
            <nav className='space-y-2'>
              {sidebarItems.map((item) => {
                const isActive = isItemActive(item);
                const Icon = item.icon;
                const isClassesItem = item.href === "/app/classes";

                return (
                  <div key={item.label}>
                    <Link
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

                    {isClassesItem && visibleClasses.length > 0 ? (
                      <div className='mt-2 space-y-1 pl-4'>
                        {visibleClasses.map((classItem) => {
                          const className = classItem.name?.trim() || "Untitled class";
                          const classHref = `/app/classes/${classItem.id}`;
                          const isClassActive =
                            pathname === classHref ||
                            pathname.startsWith(`${classHref}/`);

                          return (
                            <Link
                              key={classItem.id}
                              href={classHref}
                              className={`flex min-h-9 items-center rounded-xl px-3 text-sm transition-colors duration-200 ${
                                isClassActive
                                  ? "bg-(--surface-main-soft) text-(--text-main)"
                                  : "text-(--text-muted) hover:bg-(--surface-main-faint) hover:text-(--text-main)"
                              }`}
                            >
                              <span className='truncate'>{className}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </nav>
          </div>

          <div className='mt-3 space-y-3 pb-1'>
            <ThemeTogglePill placement='inline' />
            <SidebarProfile name='Tan Yu' onSignOut={signOut} />
          </div>
        </div>
      </aside>

      <div className='flex min-h-0 flex-1 flex-col'>
        <div className='border-b border-(--border-soft) bg-(--surface-panel-strong) md:hidden'>
          <div className='flex items-center justify-between px-4 py-3'>
            <SiteLogo />
            <button
              aria-controls={mobileMenuId}
              aria-expanded={mobileMenuOpen}
              aria-label='Open navigation menu'
              className='inline-flex h-9 w-9 items-center justify-center rounded-lg border border-(--border-soft) bg-(--surface-base) text-(--text-muted) transition-colors duration-200 hover:bg-(--surface-main-faint) hover:text-(--text-main)'
              onClick={() => setMobileMenuOpen(true)}
              type='button'
            >
              <Bars3Icon className='h-5 w-5' aria-hidden='true' />
            </button>
          </div>
        </div>

        <div
          id={mobileMenuId}
          className={`fixed inset-0 z-50 bg-(--surface-base) transition-all duration-300 ease-in-out md:hidden ${
            mobileMenuOpen
              ? "translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-full opacity-0"
          }`}
        >
          <div className='flex h-full flex-col p-4'>
            <div className='flex items-center justify-between border-b border-(--border-soft) pb-4'>
              <SiteLogo />
              <button
                aria-label='Close navigation menu'
                className='inline-flex h-9 w-9 items-center justify-center rounded-lg border border-(--border-soft) bg-(--surface-base) text-(--text-muted) transition-colors duration-200 hover:bg-(--surface-main-faint) hover:text-(--text-main)'
                onClick={() => setMobileMenuOpen(false)}
                type='button'
              >
                <XMarkIcon className='h-5 w-5' aria-hidden='true' />
              </button>
            </div>

            <div className='flex min-h-0 flex-1 flex-col pt-4'>
              <div className='min-h-0 flex-1 overflow-y-auto pb-4 pr-1'>
                <nav className='space-y-2'>
                  {sidebarItems.map((item) => {
                    const isActive = isItemActive(item);
                    const Icon = item.icon;
                    const isClassesItem = item.href === "/app/classes";

                    return (
                      <div key={item.label}>
                        <Link
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
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

                        {isClassesItem && sortedClasses.length > 0 ? (
                          <div className='mt-2 space-y-1 pl-4'>
                            {sortedClasses.map((classItem) => {
                              const className =
                                classItem.name?.trim() || "Untitled class";
                              const classHref = `/app/classes/${classItem.id}`;
                              const isClassActive =
                                pathname === classHref ||
                                pathname.startsWith(`${classHref}/`);

                              return (
                                <Link
                                  key={classItem.id}
                                  href={classHref}
                                  onClick={() => setMobileMenuOpen(false)}
                                  className={`flex min-h-9 items-center rounded-xl px-3 text-sm transition-colors duration-200 ${
                                    isClassActive
                                      ? "bg-(--surface-main-soft) text-(--text-main)"
                                      : "text-(--text-muted) hover:bg-(--surface-main-faint) hover:text-(--text-main)"
                                  }`}
                                >
                                  <span className='truncate'>{className}</span>
                                </Link>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </nav>
              </div>

              <div className='space-y-3 pt-3'>
                <ThemeTogglePill placement='inline' />
                <SidebarProfile name='Tan Yu' onSignOut={signOut} />
              </div>
            </div>
          </div>
        </div>

        <main className='min-h-0 flex-1 overflow-y-auto'>
          <div className='h-full p-5 sm:p-8 lg:p-10'>{children}</div>
        </main>
      </div>
      <ChatPopupToggle />
    </div>
  );
}
