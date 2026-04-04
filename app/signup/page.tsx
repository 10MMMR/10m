"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  const passwordsMatch = repeatPassword.length === 0 || password === repeatPassword;

  const canSubmit = Boolean(name && email && password && repeatPassword && password === repeatPassword);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <main className="flex h-[100dvh] items-center justify-center px-4 py-14 sm:px-6">
      <section className="organic-card w-full max-w-xl rounded-4xl p-6 sm:p-9">
        <p className="mono-label text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)">
          Account Setup
        </p>
        <h1 className="display-font mt-3 text-4xl font-bold text-(--text-main)">Create account</h1>
        <p className="mt-3 text-(--text-muted)">
          Sign up now and we will connect this form to real auth logic in the next step.
        </p>

        <button
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-(--border-soft) bg-(--surface-panel) px-5 py-3 font-semibold text-(--text-main) transition-colors duration-200 hover:bg-(--surface-main-soft)"
          type="button"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-base) text-sm font-bold text-(--main)">
            G
          </span>
          Sign up with Google
        </button>

        <div className="mt-5 flex items-center gap-3 text-xs uppercase tracking-[0.12em] text-(--text-muted)">
          <span className="h-px flex-1 bg-(--border-soft)" />
          <span>Or continue with email</span>
          <span className="h-px flex-1 bg-(--border-soft)" />
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-(--text-main)" htmlFor="signup-name">
              Name
            </label>
            <input
              id="signup-name"
              className="organic-input"
              name="name"
              required
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-(--text-main)" htmlFor="signup-email">
              Email
            </label>
            <input
              id="signup-email"
              className="organic-input"
              name="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-(--text-main)" htmlFor="signup-password">
              Password
            </label>
            <input
              id="signup-password"
              className="organic-input"
              name="password"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-(--text-main)" htmlFor="signup-repeat-password">
              Repeat password
            </label>
            <input
              id="signup-repeat-password"
              aria-invalid={!passwordsMatch}
              className="organic-input"
              name="repeatPassword"
              required
              type="password"
              value={repeatPassword}
              onChange={(event) => setRepeatPassword(event.target.value)}
            />
            {!passwordsMatch ? (
              <p className="text-sm text-(--destructive)">Passwords must match.</p>
            ) : null}
          </div>

          <button
            disabled={!canSubmit}
            className="organic-button organic-button-primary mt-1 min-h-12 w-full disabled:pointer-events-none disabled:opacity-60"
            type="submit"
          >
            Submit
          </button>
        </form>

        <p className="mt-6 text-sm text-(--text-muted)">
          Already have an account?{" "}
          <Link className="font-semibold text-(--main) transition-colors hover:text-(--text-secondary)" href="/login">
            Log in
          </Link>
        </p>
      </section>
    </main>
  );
}
