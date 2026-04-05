import Link from "next/link";

export default function SignedOutPage() {
  return (
    <main className="flex h-[100dvh] items-center justify-center px-4 py-14 sm:px-6">
      <section className="organic-card w-full max-w-xl rounded-4xl p-6 text-center sm:p-9">
        <p className="mono-label text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)">
          Signed Out
        </p>
        <h1 className="display-font mt-3 text-4xl font-bold text-(--text-main)">
          Succesfully signed out
        </h1>
        <p className="mt-3 text-(--text-muted)">
          Your session has ended. Log in again whenever you are ready.
        </p>

        <Link
          className="organic-button organic-button-primary mt-6 inline-flex min-h-12 w-full items-center justify-center"
          href="/login"
        >
          Log in
        </Link>
      </section>
    </main>
  );
}
