"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteLogo } from "./site-logo";

const navbarVisibleRoutes = ["/", "/waitlist"];

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

export function SiteNavbar() {
  const pathname = usePathname();
  const normalizedPathname = normalizePath(pathname);
  const shouldShowNavbar = navbarVisibleRoutes.includes(normalizedPathname);

  if (!shouldShowNavbar) {
    return null;
  }

  return (
    <header className="fixed top-4 right-0 left-0 z-[200] px-4 sm:px-6 lg:px-8">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between rounded-full border border-(--border-soft) bg-(--surface-panel-strong) px-5 py-3 shadow-(--shadow-soft) backdrop-blur-md">
        <Link href="/" className="flex cursor-pointer items-center gap-3" aria-label="Go to homepage">
          <SiteLogo />
        </Link>

        <div className="hidden items-center gap-7 text-base text-(--text-muted) md:flex">
          <Link
            href="/#features"
            className="relative cursor-pointer pb-1 transition-colors duration-300 hover:text-(--main) after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-(--main) after:transition-transform after:duration-300 after:content-[''] hover:after:scale-x-100"
          >
            Features
          </Link>
          <Link
            href="/#flashcards"
            className="relative cursor-pointer pb-1 transition-colors duration-300 hover:text-(--main) after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-(--main) after:transition-transform after:duration-300 after:content-[''] hover:after:scale-x-100"
          >
            Flashcards
          </Link>
          <Link
            href="/#mock-exams"
            className="relative cursor-pointer pb-1 transition-colors duration-300 hover:text-(--main) after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-(--main) after:transition-transform after:duration-300 after:content-[''] hover:after:scale-x-100"
          >
            Mock Exams
          </Link>
        </div>

        <Link
          href="/waitlist"
          className="organic-button organic-button-primary h-11 cursor-pointer px-6 py-0 text-sm"
        >
          Start Now
        </Link>
      </nav>
    </header>
  );
}
