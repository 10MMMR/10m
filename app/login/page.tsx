"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const canSubmit = Boolean(email && password);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <main className="flex h-[100dvh] items-center justify-center px-4 py-14 sm:px-6">
      <section className="organic-card w-full max-w-xl rounded-4xl p-6 sm:p-9">
        <p className="mono-label text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)">
          Welcome Back
        </p>
        <h1 className="display-font mt-3 text-4xl font-bold text-(--text-main)">Log in</h1>
        <p className="mt-3 text-(--text-muted)">
          Enter your details to access your account. Submit is intentionally inactive for now.
        </p>

        <button
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-(--border-soft) bg-(--surface-panel) px-5 py-3 font-semibold text-(--text-main) transition-colors duration-200 hover:bg-(--surface-main-soft)"
          type="button"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-base) text-sm font-bold text-(--main)">
            G
          </span>
          Sign in with Google
        </button>

        <div className="mt-5 flex items-center gap-3 text-xs uppercase tracking-[0.12em] text-(--text-muted)">
          <span className="h-px flex-1 bg-(--border-soft)" />
          <span>Or continue with email</span>
          <span className="h-px flex-1 bg-(--border-soft)" />
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-(--text-main)" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              className="organic-input"
              name="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-(--text-main)" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              className="organic-input"
              name="password"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-(--text-muted)" htmlFor="login-remember-me">
            <input
              id="login-remember-me"
              checked={rememberMe}
              className="h-4 w-4 accent-(--main)"
              name="rememberMe"
              type="checkbox"
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            Save my login info
          </label>

          <button
            disabled={!canSubmit}
            className="organic-button organic-button-primary mt-1 min-h-12 w-full disabled:pointer-events-none disabled:opacity-60"
            type="submit"
          >
            Submit
          </button>
        </form>

        <p className="mt-6 text-sm text-(--text-muted)">
          Need an account?{" "}
          <Link className="font-semibold text-(--main) transition-colors hover:text-(--text-secondary)" href="/signup">
            Sign up
          </Link>
        </p>
      </section>
    </main>
  );
}
