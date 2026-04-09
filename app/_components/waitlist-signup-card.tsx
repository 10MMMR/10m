"use client";

import { FormEvent, useState } from "react";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUCCESS_MESSAGE =
  "You're on the list. 🎉\nWe'll let you know as soon as early access opens.";
const WAITLIST_ENDPOINT = "https://formspree.io/f/xnjoyprk";

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay-scrim)">
      <div className="organic-card flex items-center gap-3 rounded-full px-6 py-4">
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-(--border-soft) border-t-(--main)"
          aria-hidden="true"
        />
        <p className="font-semibold text-(--text-main)">Submitting...</p>
      </div>
    </div>
  );
}

type WaitlistSignupCardProps = {
  topLeftLabel?: string;
};

export function WaitlistSignupCard({ topLeftLabel }: WaitlistSignupCardProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting || isSubmitted) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("email", normalizedEmail);

      const response = await fetch(WAITLIST_ENDPOINT, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Unable to join waitlist.");
      }

      setIsSubmitted(true);
      setEmail("");
    } catch {
      setError("Unable to join the waitlist right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {isSubmitting ? <LoadingOverlay /> : null}

      <section className="organic-card w-full max-w-2xl rounded-4xl p-8 text-left sm:p-12">
        {topLeftLabel ? (
          <p className="mono-label text-[11px] font-semibold uppercase tracking-[0.16em] text-(--main)">
            {topLeftLabel}
          </p>
        ) : null}
        <h1 className="display-font text-5xl font-bold leading-tight text-(--text-main) sm:text-6xl">
          From lecture slides to exam-ready in minutes.
        </h1>
        <p className="mt-4 text-lg text-(--text-body)">
          Stop studying for hours. Start studying smarter. Become exam ready
          without the burnout. We turn your class materials into an AI study
          system in minutes.
        </p>
        <p className="mt-8 text-lg font-medium text-(--text-muted)">
          Join the waitlist and get free early access
        </p>

        {isSubmitted ? (
          <p className="mt-6 whitespace-pre-line text-lg font-semibold text-(--text-main)">
            {SUCCESS_MESSAGE}
          </p>
        ) : (
          <form
            className="mt-6 space-y-4"
            noValidate
            action={WAITLIST_ENDPOINT}
            method="post"
            onSubmit={handleSubmit}
          >
            <input
              aria-invalid={Boolean(error)}
              aria-label="Email address"
              className="organic-input"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            {error ? <p className="text-sm text-(--destructive)">{error}</p> : null}

            <button
              disabled={isSubmitting}
              className="organic-button organic-button-primary min-h-12 w-full disabled:pointer-events-none disabled:opacity-60"
              type="submit"
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
          </form>
        )}
      </section>
    </>
  );
}
