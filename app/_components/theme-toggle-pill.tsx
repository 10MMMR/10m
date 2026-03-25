"use client";

import { MoonIcon, SunIcon } from "@heroicons/react/24/solid";
import { useState } from "react";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "theme";

function readThemeFromDom(): ThemeMode {
  if (typeof document === "undefined") {
    return "light";
  }

  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeTogglePill() {
  const [theme, setTheme] = useState<ThemeMode>(() => readThemeFromDom());

  const setActiveTheme = (nextTheme: ThemeMode) => {
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem(STORAGE_KEY, nextTheme);
    setTheme(nextTheme);
  };

  return (
    <div className="theme-toggle-shell">
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
