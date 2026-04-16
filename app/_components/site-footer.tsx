"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { SiteLogo } from "./site-logo";

const hiddenPrefixes = ["/app", "/editor", "/waitlist"];

export function SiteFooter() {
  const pathname = usePathname();

  const shouldHideFooter = hiddenPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (shouldHideFooter) {
    return null;
  }

  return (
    <footer className="border-t border-(--border-soft) bg-(--surface-panel-strong)">
      <div className="section-shell max-w-7xl py-14 sm:py-16">
        <div className="grid gap-10 md:grid-cols-[1.2fr_2fr]">
          <div className="flex flex-col gap-5">
            <SiteLogo />
            <button className="organic-button organic-button-primary h-12 w-fit cursor-pointer">
              Get Started - It&apos;s Free
            </button>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-(--text-main)">
                Product
              </h3>
              <ul className="mt-3 space-y-2.5 text-sm text-(--text-muted)">
                <li>
                  <Link className="cursor-pointer transition-colors hover:text-(--main)" href="/">
                    All In One Study App
                  </Link>
                </li>
                <li>
                  <a className="cursor-pointer transition-colors hover:text-(--main)" href="#">
                    App Store
                  </a>
                </li>
                <li>
                  <a className="cursor-pointer transition-colors hover:text-(--main)" href="#">
                    Google Play
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-(--text-main)">
                Company
              </h3>
              <ul className="mt-3 space-y-2.5 text-sm text-(--text-muted)">
                <li>
                  <Link className="cursor-pointer transition-colors hover:text-(--main)" href="/signup">
                    Sign Up
                  </Link>
                </li>
                <li>
                  <Link className="cursor-pointer transition-colors hover:text-(--main)" href="/signin">
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link className="cursor-pointer transition-colors hover:text-(--main)" href="/aboutus">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link className="cursor-pointer transition-colors hover:text-(--main)" href="/blog">
                    Blog
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-(--text-main)">
                Legal
              </h3>
              <ul className="mt-3 space-y-2.5 text-sm text-(--text-muted)">
                <li>
                  <Link className="cursor-pointer transition-colors hover:text-(--main)" href="/privacy">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link className="cursor-pointer transition-colors hover:text-(--main)" href="/terms">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
