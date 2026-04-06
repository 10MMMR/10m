"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect } from "react";

type FloatingPopupVariant = "error" | "info" | "success";

type FloatingPopupBannerProps = {
  autoDismissMs?: number | null;
  message: string;
  onClose: () => void;
  open: boolean;
  testId?: string;
  variant?: FloatingPopupVariant;
};

const VARIANT_STYLES: Record<FloatingPopupVariant, string> = {
  error: "border-(--destructive) bg-(--surface-panel-strong) text-(--destructive)",
  info: "border-(--border-strong) bg-(--surface-panel-strong) text-(--text-main)",
  success: "border-(--main) bg-(--surface-panel-strong) text-(--main)",
};

export function FloatingPopupBanner({
  autoDismissMs = 8_000,
  message,
  onClose,
  open,
  testId,
  variant = "info",
}: FloatingPopupBannerProps) {
  useEffect(() => {
    if (!open || !message || !autoDismissMs || autoDismissMs <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onClose();
    }, autoDismissMs);

    return () => window.clearTimeout(timeoutId);
  }, [autoDismissMs, message, onClose, open]);

  if (!open || !message) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed top-4 left-1/2 z-[120] w-full max-w-xl -translate-x-1/2 px-4">
      <div
        className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-(--shadow-floating) ${VARIANT_STYLES[variant]}`}
        data-testid={testId}
        role="status"
      >
        <p className="min-w-0 flex-1 text-sm leading-6">{message}</p>
        <button
          aria-label="Dismiss popup"
          className="grid h-7 w-7 place-items-center rounded-full border border-(--border-soft) bg-(--surface-panel) text-(--text-muted) transition-colors hover:bg-(--surface-main-faint)"
          onClick={onClose}
          type="button"
        >
          <XMarkIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
