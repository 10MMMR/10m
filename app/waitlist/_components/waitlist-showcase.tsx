"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_WAITLIST_ENDPOINT = "https://formspree.io/f/xnjoyprk";
const WAITLIST_ENDPOINT_A =
  process.env.NEXT_PUBLIC_WAITLIST_ENDPOINT_A ?? DEFAULT_WAITLIST_ENDPOINT;
const WAITLIST_ENDPOINT_B = process.env.NEXT_PUBLIC_WAITLIST_ENDPOINT_B ?? WAITLIST_ENDPOINT_A;
const WAITLIST_ENDPOINT_C = process.env.NEXT_PUBLIC_WAITLIST_ENDPOINT_C ?? WAITLIST_ENDPOINT_A;
const WAITLIST_VARIANTS = [
  {
    id: "A",
    title: "Know what to study for your exam.",
    subtitle: "Without wasting time on stuff that doesn't matter.",
    endpoint: WAITLIST_ENDPOINT_A,
  },
  {
    id: "B",
    title: "What should I even study?",
    subtitle: "We will tell you what matters... and what you're still bad at.",
    endpoint: WAITLIST_ENDPOINT_B,
  },
  {
    id: "C",
    title: "Your exam study copilot.",
    subtitle: "Stop guessing what to study and focus on what actually shows up.",
    endpoint: WAITLIST_ENDPOINT_C,
  },
] as const;
const SUCCESS_MESSAGE =
  "You're on the list. We'll let you know as soon as early access opens.";
const MONITOR_SLIDES = ["/car1.png", "/car2.png", "/car3.png"];
const MONITOR_VIEWPORT = {
  left: "2.69%",
  top: "3.89%",
  width: "94.66%",
  height: "69.59%",
};

function InstagramIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="17.1" cy="6.9" r="1.3" fill="currentColor" />
    </svg>
  );
}

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

export function WaitlistShowcase() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const activeVariant = WAITLIST_VARIANTS[activeVariantIndex] ?? WAITLIST_VARIANTS[0];
  const waitlistEndpoint = activeVariant.endpoint ?? WAITLIST_ENDPOINT_A;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);

    return () => {
      mediaQuery.removeEventListener("change", updateMotionPreference);
    };
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % MONITOR_SLIDES.length);
    }, 6000);

    return () => {
      window.clearInterval(interval);
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * WAITLIST_VARIANTS.length);
    setActiveVariantIndex(randomIndex);
  }, []);

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

      const response = await fetch(waitlistEndpoint, {
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

      <section className="relative mx-auto w-full max-w-7xl">
        <div className="relative">
          <div className="grid items-center gap-10 px-2 py-8 sm:px-4 sm:py-10 lg:grid-cols-[0.65fr_1.35fr] lg:items-center lg:gap-24">
            <div className="text-left lg:flex lg:h-full lg:flex-col lg:justify-center lg:gap-10">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="grid h-20 w-20 place-items-center rounded-3xl border border-(--border-soft) bg-(--surface-panel-strong) shadow-(--shadow-soft)">
                    <Image
                      src="/ducki_app.png"
                      alt="Ducky app icon"
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded-2xl object-cover"
                    />
                  </div>
                  <p className="display-font text-3xl font-bold text-(--text-main) sm:text-4xl">Sprout</p>
                </div>

                <h1 className="display-font max-w-3xl text-4xl font-bold leading-tight text-(--text-main) sm:text-6xl">
                  {activeVariant.title}
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-(--text-body)">
                  {activeVariant.subtitle}
                </p>
              </div>

              {isSubmitted ? (
                <p className="max-w-2xl text-lg font-semibold text-(--text-main)">
                  {SUCCESS_MESSAGE}
                </p>
              ) : (
                <form
                  data-waitlist-form
                  className="w-full max-w-2xl"
                  noValidate
                  action={waitlistEndpoint}
                  method="post"
                  onSubmit={handleSubmit}
                >
                  <div className="flex flex-col gap-3 rounded-full border border-(--border-strong) bg-(--surface-input) p-2 sm:flex-row sm:items-center">
                    <input
                      aria-invalid={Boolean(error)}
                      aria-label="Email address"
                      className="h-12 w-full border-0 bg-transparent px-4 text-base text-(--text-main) outline-none placeholder:text-(--text-muted) focus-visible:outline-none"
                      name="email"
                      placeholder="Your email here"
                      required
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />

                    <button
                      disabled={isSubmitting}
                      className="organic-button organic-button-primary h-12 w-full px-6 text-sm focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60 sm:w-auto sm:min-w-44"
                      type="submit"
                    >
                      {isSubmitting ? "Submitting..." : "Join Waitlist ↗"}
                    </button>
                  </div>

                  {error ? <p className="mt-3 text-sm text-(--destructive)">{error}</p> : null}
                </form>
              )}

              <span
                aria-label="Instagram"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-(--border-strong) bg-(--surface-panel-strong) text-(--main)"
              >
                <InstagramIcon />
              </span>
            </div>

            <div className="relative flex items-center justify-center lg:h-full lg:justify-end">
              <div className="relative w-full max-w-4xl">
                <div
                  className="absolute z-0 overflow-hidden rounded-[1.35rem] border border-(--border-soft) bg-(--surface-panel-soft)"
                  style={{
                    left: MONITOR_VIEWPORT.left,
                    top: MONITOR_VIEWPORT.top,
                    width: MONITOR_VIEWPORT.width,
                    height: MONITOR_VIEWPORT.height,
                  }}
                >
                  <div
                    className="flex h-full"
                    style={{
                      transform: `translateX(-${activeSlide * 100}%)`,
                      transition: prefersReducedMotion
                        ? "none"
                        : "transform 500ms ease-out",
                    }}
                  >
                    {MONITOR_SLIDES.map((slide, index) => (
                      <div key={`${slide}-${index}`} className="relative h-full w-full shrink-0">
                        <Image src={slide} alt={`App preview slide ${index + 1}`} fill className="object-contain" />
                      </div>
                    ))}
                  </div>

                  <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center">
                    <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface-panel-strong) px-2 py-1.5">
                      {MONITOR_SLIDES.map((_, index) => (
                        <button
                          key={`dot-${index}`}
                          type="button"
                          aria-label={`Go to slide ${index + 1}`}
                          aria-current={activeSlide === index}
                          onClick={() => setActiveSlide(index)}
                          className={`h-2.5 w-2.5 rounded-full transition ${
                            activeSlide === index ? "bg-(--main)" : "bg-(--border-strong)"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <Image
                  src="/monitor-transp.png"
                  alt="Monitor preview"
                  width={2829}
                  height={2134}
                  priority
                  className="relative z-10 h-auto w-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        [data-waitlist-form] input:focus-visible,
        [data-waitlist-form] button:focus-visible {
          outline: none !important;
          outline-offset: 0 !important;
        }
      `}</style>
    </>
  );
}
