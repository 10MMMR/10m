"use client";

import { useState } from "react";

type BillingCycle = "monthly" | "annual";

export function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  const premiumMonthlyEquivalent = billingCycle === "monthly" ? 20 : 10;
  const premiumBillingNote =
    billingCycle === "monthly" ? "Billed monthly" : "Billed annually ($120/year)";

  return (
    <section id="pricing" className="section-shell max-w-7xl py-14 sm:py-20">
      <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="mono-label text-[11px] font-semibold uppercase tracking-[0.15em] text-(--main)">
            Pricing
          </p>
          <h2 className="display-font mt-4 text-4xl font-bold md:text-5xl">
            Start free, then upgrade when you need unlimited prep.
          </h2>
        </div>

        <div
          className="inline-flex w-fit items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface-panel-strong) p-1 shadow-(--shadow-soft)"
          role="group"
          aria-label="Select billing cycle"
        >
          <button
            aria-pressed={billingCycle === "monthly"}
            className={`h-10 rounded-full px-5 text-sm font-semibold transition-all duration-200 ${
              billingCycle === "monthly"
                ? "bg-(--main) text-(--text-contrast)"
                : "bg-transparent text-(--text-muted) hover:bg-(--surface-main-soft) hover:text-(--text-main)"
            }`}
            onClick={() => setBillingCycle("monthly")}
            type="button"
          >
            Monthly
          </button>
          <button
            aria-pressed={billingCycle === "annual"}
            className={`h-10 rounded-full px-5 text-sm font-semibold transition-all duration-200 ${
              billingCycle === "annual"
                ? "bg-(--main) text-(--text-contrast)"
                : "bg-transparent text-(--text-muted) hover:bg-(--surface-main-soft) hover:text-(--text-main)"
            }`}
            onClick={() => setBillingCycle("annual")}
            type="button"
          >
            Annual
          </button>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <article className="organic-card flex h-full flex-col rounded-[2.2rem] p-7 sm:p-9">
          <p className="mono-label text-[11px] uppercase tracking-[0.15em] text-(--main)">
            Free Tier
          </p>
          <h3 className="display-font mt-3 text-3xl font-bold">Free</h3>
          <p className="mt-1 text-sm text-(--text-muted)">Perfect for getting started.</p>
          <ul className="mt-6 space-y-3 text-(--text-body)">
            <li>1 Class</li>
            <li>Up to 5 file uploads per class</li>
            <li>Up to 1 mock exam per class</li>
            <li>Up to 5 AI Chatbot messages</li>
            <li>Up to 3 flashcard generations per class</li>
          </ul>
          <div className="mt-auto pt-12">
            <button className="organic-button organic-button-outline h-12 w-full">
              Continue Free
            </button>
          </div>
        </article>

        <article className="organic-card flex h-full flex-col rounded-[2.2rem] rounded-tr-[4.5rem] border-(--border-accent) p-7 shadow-(--shadow-float) sm:p-9">
          <div className="inline-flex items-center rounded-full border border-(--border-accent) bg-(--surface-accent-soft) px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-(--text-secondary)">
            Premium Tier
          </div>
          <div className="mt-4 flex items-end gap-2">
            <p className="display-font text-4xl font-bold">${premiumMonthlyEquivalent}</p>
            <p className="pb-1 text-sm text-(--text-muted)">/ month</p>
          </div>
          <p className="mt-1 text-sm text-(--text-muted)">{premiumBillingNote}</p>
          <ul className="mt-6 space-y-3 text-(--text-body)">
            <li>Unlimited Class creation</li>
            <li>Unlimited file uploads per class</li>
            <li>Unlimited mock exams per class</li>
            <li>Unlimited AI Chatbot messages</li>
            <li>Mock Exam Weakness Identification</li>
            <li>Class Notes Generation and Summarization</li>
          </ul>
          <div className="mt-auto pt-12">
            <button className="organic-button organic-button-primary h-12 w-full">
              Start Premium
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
