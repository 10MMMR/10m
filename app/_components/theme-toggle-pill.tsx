"use client";

import { MoonIcon, SunIcon } from "@heroicons/react/24/solid";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

type ThemeMode = "light" | "dark";
type ThemeTogglePlacement = "floating" | "inline";

type ThemeTogglePillProps = {
  placement?: ThemeTogglePlacement;
};

const STORAGE_KEY = "theme";
const THEME_CHANGE_EVENT = "theme-change";
const dashboardPrefixes = ["/app", "/editor", "/waitlist"];

function readThemePreference(): ThemeMode | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribeToThemePreference(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === STORAGE_KEY) {
      callback();
    }
  };

  const handleThemeChange = () => {
    callback();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  };
}

export function ThemeTogglePill({ placement = "floating" }: ThemeTogglePillProps) {
  const pathname = usePathname();
  const theme = useSyncExternalStore(
    subscribeToThemePreference,
    readThemePreference,
    () => null,
  );

  const shouldHideFloatingPill = dashboardPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  const setActiveTheme = (nextTheme: ThemeMode) => {
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem(STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  if (placement === "floating" && shouldHideFloatingPill) {
    return null;
  }

  if (!theme) {
    return null;
  }

  return (
    <div className={placement === "floating" ? "theme-toggle-shell" : "theme-toggle-shell-inline"}>
      <div className="theme-toggle-pill" role="group" aria-label="Toggle color mode">
        <button
          aria-label="Use light mode"
          aria-pressed={theme === "light"}
          className="theme-toggle-button"
          onClick={() => setActiveTheme("light")}
          type="button"
        >
          <SunIcon className="h-4 w-4" aria-hidden="true" />
          Light
        </button>
        <button
          aria-label="Use dark mode"
          aria-pressed={theme === "dark"}
          className="theme-toggle-button"
          onClick={() => setActiveTheme("dark")}
          type="button"
        >
          <MoonIcon className="h-4 w-4" aria-hidden="true" />
          Dark
        </button>
      </div>
    </div>
  );
}
