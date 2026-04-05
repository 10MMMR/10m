"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";

type SignedInAuthPanelProps = {
  onSignOut: () => void;
  user: User;
};

function getUserDisplayName(user: User) {
  const metadata = user.user_metadata as Record<string, unknown> | null;
  const candidates = [
    metadata?.name,
    metadata?.full_name,
    metadata?.display_name,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

export function SignedInAuthPanel({ onSignOut, user }: SignedInAuthPanelProps) {
  const displayName = getUserDisplayName(user);
  const email = user.email ?? "No email available";

  return (
    <main className="flex h-[100dvh] items-center justify-center px-4 py-14 sm:px-6">
      <section className="organic-card w-full max-w-xl rounded-4xl p-6 sm:p-9">
        <p className="mono-label text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)">
          Signed In
        </p>
        <h1 className="display-font mt-3 text-4xl font-bold text-(--text-main)">
          You are already logged in
        </h1>

        <div className="mt-6 rounded-3xl border border-(--border-soft) bg-(--surface-panel) p-4">
          {displayName ? (
            <p className="text-(--text-main)">
              <span className="font-semibold">Name:</span> {displayName}
            </p>
          ) : null}
          <p className={`text-(--text-main) ${displayName ? "mt-2" : ""}`}>
            <span className="font-semibold">Email:</span> {email}
          </p>
        </div>

        <Link
          className="organic-button organic-button-primary mt-6 inline-flex min-h-12 w-full items-center justify-center"
          href="/app"
        >
          Go to Dashboard
        </Link>

        <p className="mt-5 text-center text-sm text-(--text-muted)">
          Not you?{" "}
          <button
            className="cursor-pointer font-semibold text-(--main) transition-colors hover:text-(--text-secondary)"
            onClick={onSignOut}
            type="button"
          >
            Sign out
          </button>
        </p>
      </section>
    </main>
  );
}

