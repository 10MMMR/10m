"use client";

export function AuthCheckLoadingScreen() {
  return (
    <main className="flex h-[100dvh] items-center justify-center px-4 py-14 sm:px-6">
      <section className="organic-card w-full max-w-xl rounded-4xl p-6 text-center sm:p-9">
        <p className="mono-label text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)">
          Authentication
        </p>
        <div
          className="mx-auto mt-6 h-14 w-14 animate-spin rounded-full border-4 border-(--border-soft) border-t-(--main)"
          aria-hidden="true"
        />
        <p className="mt-4 text-sm font-semibold text-(--text-muted)">
          Checking your account...
        </p>
        <span className="sr-only" role="status" aria-live="polite">
          Checking your account
        </span>
      </section>
    </main>
  );
}
