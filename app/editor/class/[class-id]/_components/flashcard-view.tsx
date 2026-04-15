"use client";

import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  CheckBadgeIcon,
  ExclamationCircleIcon as ExclamationCircleSolidIcon,
} from "@heroicons/react/24/solid";
import { useMemo, useState } from "react";
import type { FlashcardSession } from "../_lib/workspace-sessions";
import styles from "./flashcard-view.module.css";

type FlashcardViewProps = {
  session: FlashcardSession;
};

type AnalysisSkill = {
  id: string;
  name: string;
  readiness: number;
};

type AnalysisSection = {
  id: string;
  kind: "strengths" | "needs-improvement";
  title: string;
  skills: AnalysisSkill[];
};

type TopicBreakdownItem = {
  id: string;
  readiness: number;
  statusLabel: "Strong" | "Developing" | "Needs Work";
  title: string;
};

type TrendPoint = {
  id: string;
  label: string;
  value: number;
};

type QuickActionItem = {
  id: string;
  label: string;
};

type FlashcardAnalysisPayload = {
  accuracy: number;
  cardsReviewed: number;
  mastery: number;
  priorityFocus: string;
  quickActions: QuickActionItem[];
  sections: AnalysisSection[];
  strongestArea: string;
  suggestion: string;
  timeSpent: string;
  topics: TopicBreakdownItem[];
  trend: TrendPoint[];
};

const DEFAULT_FLASHCARD_ANALYSIS: FlashcardAnalysisPayload = {
  accuracy: 76,
  cardsReviewed: 20,
  mastery: 76,
  priorityFocus: "Multi-step Problem Solving",
  quickActions: [
    { id: "review-flagged", label: "Review flagged cards" },
    { id: "practice-weak-topics", label: "Practice weak topics" },
    { id: "download-report", label: "Download PDF report" },
  ],
  sections: [
    {
      id: "strengths",
      kind: "strengths",
      title: "Strengths",
      skills: [
        { id: "memory-management", name: "Memory Management", readiness: 94 },
        { id: "sorting-algorithms", name: "Sorting Algorithms", readiness: 91 },
      ],
    },
    {
      id: "needs-improvement",
      kind: "needs-improvement",
      title: "Needs Improvement",
      skills: [
        { id: "space-complexity", name: "Space Complexity", readiness: 58 },
        { id: "recursion", name: "Recursion", readiness: 42 },
        { id: "branching-control", name: "Branching Control", readiness: 47 },
      ],
    },
  ],
  strongestArea: "Core Definitions",
  suggestion:
    "You struggle with recursion after long sessions. Consider reviewing this topic during your morning peak focus hours.",
  timeSpent: "12:45",
  topics: [
    { id: "data-structures", readiness: 82, statusLabel: "Strong", title: "Data Structures" },
    { id: "algorithms", readiness: 46, statusLabel: "Needs Work", title: "Algorithms" },
    { id: "problem-solving", readiness: 61, statusLabel: "Developing", title: "Problem Solving" },
  ],
  trend: [
    { id: "mon", label: "Mon", value: 36 },
    { id: "tue", label: "Tue", value: 44 },
    { id: "wed", label: "Wed", value: 40 },
    { id: "thu", label: "Thu", value: 58 },
    { id: "fri", label: "Fri", value: 52 },
    { id: "sat", label: "Sat", value: 74 },
    { id: "sun", label: "Sun", value: 78 },
  ],
};

const BIOL_101_FLASHCARD_ANALYSIS: FlashcardAnalysisPayload = {
  accuracy: 84,
  cardsReviewed: 24,
  mastery: 84,
  priorityFocus: "Cellular Respiration Sequence",
  quickActions: [
    { id: "review-mitosis-meiosis", label: "Review mitosis vs meiosis" },
    { id: "practice-enzyme-graphs", label: "Practice enzyme activity graphs" },
    { id: "drill-cell-organelles", label: "Drill organelle functions" },
  ],
  sections: [
    {
      id: "strengths",
      kind: "strengths",
      title: "Strengths",
      skills: [
        { id: "cell-structure", name: "Cell Structure", readiness: 92 },
        { id: "membrane-transport", name: "Membrane Transport", readiness: 88 },
      ],
    },
    {
      id: "needs-improvement",
      kind: "needs-improvement",
      title: "Needs Improvement",
      skills: [
        { id: "photosynthesis-vs-respiration", name: "Photosynthesis vs Respiration", readiness: 61 },
        { id: "meiosis-phases", name: "Meiosis Phases", readiness: 55 },
        { id: "enzyme-regulation", name: "Enzyme Regulation", readiness: 58 },
      ],
    },
  ],
  strongestArea: "Membrane Transport",
  suggestion:
    "Your recall is strong on structures but weaker on process order. Add one timed sequence drill for glycolysis and the Krebs cycle each day.",
  timeSpent: "14:12",
  topics: [
    { id: "cell-biology", readiness: 89, statusLabel: "Strong", title: "Cell Biology" },
    { id: "energy-transformations", readiness: 59, statusLabel: "Needs Work", title: "Energy Transformations" },
    { id: "cell-division", readiness: 66, statusLabel: "Developing", title: "Cell Division" },
  ],
  trend: [
    { id: "mon", label: "Mon", value: 48 },
    { id: "tue", label: "Tue", value: 54 },
    { id: "wed", label: "Wed", value: 57 },
    { id: "thu", label: "Thu", value: 63 },
    { id: "fri", label: "Fri", value: 68 },
    { id: "sat", label: "Sat", value: 76 },
    { id: "sun", label: "Sun", value: 84 },
  ],
};

const MOCK_FLASHCARD_ANALYSIS_BY_SESSION_ID: Record<string, FlashcardAnalysisPayload> = {
  "mock-session-biol-101-flashcards": BIOL_101_FLASHCARD_ANALYSIS,
};

export function FlashcardView({ session }: FlashcardViewProps) {
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [viewMode, setViewMode] = useState<"flashcards" | "analysis">(() => {
    if (typeof window === "undefined") {
      return "flashcards";
    }

    return new URLSearchParams(window.location.search).get("analysis") === "1"
      ? "analysis"
      : "flashcards";
  });
  const [notesToastMessage, setNotesToastMessage] = useState("");
  const [cardResults, setCardResults] = useState<
    Record<string, "correct" | "incorrect">
  >({});

  const activeCard = useMemo(
    () => session.cards[activeCardIndex] ?? null,
    [activeCardIndex, session.cards],
  );
  const isAtFirstCard = activeCardIndex <= 0;
  const isAtLastCard = activeCardIndex >= session.cards.length - 1;
  const activeCardResult = activeCard ? cardResults[activeCard.id] ?? null : null;
  const analysisData =
    MOCK_FLASHCARD_ANALYSIS_BY_SESSION_ID[session.id] ?? DEFAULT_FLASHCARD_ANALYSIS;
  const masteryAngle = Math.max(
    0,
    Math.min(360, (analysisData.mastery / 100) * 360),
  );

  const moveCard = (direction: "previous" | "next") => {
    if (direction === "previous") {
      setActiveCardIndex((current) => Math.max(current - 1, 0));
      setIsAnswerVisible(false);
      setViewMode("flashcards");
      return;
    }

    setActiveCardIndex((current) => Math.min(current + 1, session.cards.length - 1));
    setIsAnswerVisible(false);
    setViewMode("flashcards");
  };

  const markCard = (result: "correct" | "incorrect") => {
    if (!activeCard) {
      return;
    }

    setCardResults((current) => ({
      ...current,
      [activeCard.id]: result,
    }));
  };

  const handleOpenAnalysis = () => {
    setViewMode("analysis");
    setIsAnswerVisible(false);
    setNotesToastMessage("");
  };

  const handleBackToFlashcards = () => {
    setViewMode("flashcards");
    setNotesToastMessage("");
  };

  const handleGenerateTailoredNotes = () => {
    setNotesToastMessage(
      "Tailored study notes are ready to generate. AI drafting is mocked for now.",
    );
  };

  return (
    <section className='flex min-h-0 min-w-0 flex-col bg-(--surface-editor-card) lg:rounded-2xl lg:border lg:border-(--border-soft) lg:bg-(--surface-base)'>
      <div className='mx-auto flex h-full w-full max-w-6xl flex-col px-4 py-6 sm:px-8 sm:py-8'>
        {viewMode === "analysis" ? (
          <div className='-mr-4 flex min-h-0 flex-1 flex-col overflow-y-auto pr-4 sm:-mr-8 sm:pr-8'>
            <div className='grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-stretch lg:gap-0'>
              <div className='min-h-0 lg:pr-5'>
                <header className='mb-5'>
                  <p className='mono-label text-[11px] font-semibold uppercase tracking-[0.12em] text-(--text-muted)'>
                    Flashcard Analysis
                  </p>
                  <h2 className='mt-1 text-4xl font-semibold leading-tight text-(--text-main)'>
                    Your Performance Summary
                  </h2>
                  <p className='mt-2 text-base text-(--text-muted)'>
                    Here&apos;s what you&apos;ve mastered and where to focus next.
                  </p>
                </header>

                {notesToastMessage ? (
                  <div className='mb-4 rounded-xl border border-(--border-strong) bg-(--surface-main-soft) px-4 py-3 text-sm text-(--text-main)'>
                    {notesToastMessage}
                  </div>
                ) : null}

                <section className='mb-5 flex w-full flex-wrap overflow-hidden rounded-xl border border-(--border-soft) bg-(--surface-base) shadow-(--shadow-soft) lg:max-w-xl'>
                  <article className='min-w-36 flex-1 border-r border-(--border-faint) px-4 py-3'>
                    <p className='mono-label text-[10px] uppercase tracking-[0.12em] text-(--text-muted)'>
                      Accuracy
                    </p>
                    <p className='mt-1 text-2xl font-semibold text-(--text-main)'>
                      {analysisData.accuracy}%
                    </p>
                  </article>
                  <article className='min-w-36 flex-1 border-r border-(--border-faint) px-4 py-3'>
                    <p className='mono-label text-[10px] uppercase tracking-[0.12em] text-(--text-muted)'>
                      Time
                    </p>
                    <p className='mt-1 text-2xl font-semibold text-(--text-main)'>
                      {analysisData.timeSpent}
                    </p>
                  </article>
                  <article className='min-w-36 flex-1 px-4 py-3'>
                    <p className='mono-label text-[10px] uppercase tracking-[0.12em] text-(--text-muted)'>
                      Cards
                    </p>
                    <p className='mt-1 text-2xl font-semibold text-(--text-main)'>
                      {analysisData.cardsReviewed}
                    </p>
                  </article>
                </section>

                <div className='min-h-0 space-y-5'>
                  <section className='grid grid-cols-1 gap-4 2xl:grid-cols-2'>
                    {analysisData.sections.map((section) => {
                      const isStrengths = section.kind === "strengths";

                      return (
                        <article
                          key={section.id}
                          className='rounded-2xl border border-(--border-soft) bg-(--surface-base) p-5 shadow-(--shadow-soft)'
                        >
                          <div className='mb-4 flex items-center gap-2'>
                            {isStrengths ? (
                              <CheckBadgeIcon className='h-5 w-5 text-(--main)' aria-hidden='true' />
                            ) : (
                              <ExclamationCircleSolidIcon className='h-5 w-5 text-(--secondary-strong)' aria-hidden='true' />
                            )}
                            <h3 className='min-w-0 break-words text-2xl font-semibold leading-tight text-(--text-main) xl:text-3xl'>
                              {section.title}
                            </h3>
                          </div>
                          <div className='space-y-4'>
                            {section.skills.map((skill) => (
                              <div key={skill.id}>
                                <div className='flex items-center justify-between gap-3 text-sm'>
                                  <p className='min-w-0 break-words text-(--text-body)'>{skill.name}</p>
                                  <p className='font-semibold text-(--text-main)'>
                                    {skill.readiness}%
                                  </p>
                                </div>
                                <div className='mt-2 h-2.5 w-full overflow-hidden rounded-full bg-(--surface-main-xfaint)'>
                                  <div
                                    className={`h-full rounded-full ${
                                      isStrengths ? "bg-(--main)" : "bg-(--secondary-strong)"
                                    }`}
                                    style={{
                                      width: `${Math.max(0, Math.min(100, skill.readiness))}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </article>
                      );
                    })}
                  </section>

                  <section>
                    <h3 className='text-4xl font-semibold text-(--text-main)'>Topic Breakdown</h3>
                    <div className='mt-3 space-y-3'>
                      {analysisData.topics.map((topic) => (
                        <article
                          key={topic.id}
                          className='rounded-2xl border border-(--border-soft) bg-(--surface-base) p-4 shadow-(--shadow-soft)'
                        >
                          <div className='flex items-start justify-between gap-3'>
                            <div className='min-w-0'>
                              <p className='text-lg font-semibold text-(--text-main)'>
                                {topic.title}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                                topic.statusLabel === "Strong"
                                  ? "bg-(--surface-main-soft) text-(--main)"
                                  : topic.statusLabel === "Developing"
                                    ? "bg-(--surface-accent-soft) text-(--secondary-strong)"
                                    : "bg-(--surface-user-soft) text-(--secondary-strong)"
                              }`}
                            >
                              {topic.statusLabel}
                            </span>
                          </div>
                          <div className='mt-3 flex items-center gap-3'>
                            <div className='h-2.5 flex-1 overflow-hidden rounded-full bg-(--surface-main-xfaint)'>
                              <div
                                className={`h-full rounded-full ${
                                  topic.statusLabel === "Strong"
                                    ? "bg-(--main)"
                                    : topic.statusLabel === "Developing"
                                      ? "bg-(--secondary)"
                                      : "bg-(--secondary-strong)"
                                }`}
                                style={{
                                  width: `${Math.max(0, Math.min(100, topic.readiness))}%`,
                                }}
                              />
                            </div>
                            <p className='w-24 shrink-0 text-right text-sm font-semibold text-(--text-main)'>
                              {topic.readiness}% ready
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              </div>

              <aside className='min-h-0 lg:self-stretch'>
                <section className='rounded-2xl border border-(--border-soft) bg-(--surface-panel) p-5 shadow-(--shadow-soft) lg:h-full lg:rounded-none lg:border-y-0 lg:border-r-0 lg:border-l lg:shadow-none'>
                  <div className='space-y-2'>
                    <button
                      className='w-full rounded-xl border border-(--border-soft) bg-(--surface-base) px-4 py-2 text-left text-sm font-semibold text-(--text-main) transition-colors duration-200 hover:bg-(--surface-main-faint)'
                      onClick={handleBackToFlashcards}
                      type='button'
                    >
                      Back to flashcards
                    </button>
                    <button
                      className='w-full rounded-xl border border-(--main) bg-(--main) px-4 py-2 text-left text-sm font-semibold text-(--text-contrast) transition-colors duration-200 hover:bg-(--main-deep)'
                      onClick={handleGenerateTailoredNotes}
                      type='button'
                    >
                      Generate tailored study notes
                    </button>
                  </div>

                  <div className='mt-5 border-t border-(--border-faint) pt-5'>
                    <p className='mono-label text-[10px] uppercase tracking-[0.12em] text-(--text-muted)'>
                      Mastery Overview
                    </p>
                    <div className='mt-4 grid place-items-center'>
                      <div
                        className='grid h-36 w-36 place-items-center rounded-full'
                        style={{
                          background: `conic-gradient(var(--main) ${masteryAngle}deg, var(--surface-main-xfaint) ${masteryAngle}deg 360deg)`,
                        }}
                      >
                        <div className='flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-full bg-(--surface-base) text-center'>
                          <p className='leading-none text-[42px] font-semibold text-(--text-main)'>
                            {analysisData.mastery}%
                          </p>
                          <p className='mono-label w-[76px] text-center text-[8.5px] leading-[1.05] uppercase tracking-[0.06em] text-(--text-muted)'>
                            Overall Mastery
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className='mt-5 border-t border-(--border-faint) pt-5'>
                    <p className='mono-label text-[10px] uppercase tracking-[0.12em] text-(--text-muted)'>
                      Learning Trend
                    </p>
                    <div className='mt-4 flex items-end gap-1.5'>
                      {analysisData.trend.map((point, index) => (
                        <div key={point.id} className='flex flex-1 flex-col items-center gap-1'>
                          <div
                            className={`w-full rounded-t-sm ${
                              index >= analysisData.trend.length - 2
                                ? "bg-(--main)"
                                : "bg-(--surface-main-soft)"
                            }`}
                            style={{ height: `${Math.max(18, point.value)}px` }}
                          />
                          <p className='mono-label text-[9px] uppercase tracking-[0.08em] text-(--text-muted)'>
                            {point.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className='mt-5 border-t border-(--border-faint) pt-5'>
                    <p className='text-sm font-semibold text-(--text-main)'>Smart Suggestions</p>
                    <div className='mt-3 rounded-xl border border-(--border-faint) bg-(--surface-panel-soft) px-3 py-3'>
                      <p className='text-sm leading-6 text-(--text-muted)'>
                        {analysisData.suggestion}
                      </p>
                    </div>
                  </div>

                  <div className='mt-5 border-t border-(--border-faint) pt-5'>
                    <p className='mono-label text-[10px] uppercase tracking-[0.12em] text-(--text-muted)'>
                      Quick Actions
                    </p>
                    <div className='mt-3 space-y-2'>
                      {analysisData.quickActions.map((action) => (
                        <button
                          key={action.id}
                          className='flex w-full items-center justify-between rounded-xl border border-(--border-soft) bg-(--surface-base) px-3 py-2.5 text-left text-sm font-semibold text-(--text-main) transition-colors duration-200 hover:bg-(--surface-main-faint)'
                          type='button'
                        >
                          <span className='min-w-0 break-words pr-3'>{action.label}</span>
                          <ChevronRightIcon className='h-4 w-4 text-(--text-muted)' aria-hidden='true' />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className='mt-5 border-t border-(--border-faint) pt-5'>
                    <p className='mono-label text-[10px] uppercase tracking-[0.12em] text-(--text-muted)'>
                      Priority Focus
                    </p>
                    <p className='mt-1 break-words text-base font-semibold text-(--text-main)'>
                      {analysisData.priorityFocus}
                    </p>
                    <p className='mt-3 mono-label text-[10px] uppercase tracking-[0.12em] text-(--text-muted)'>
                      Strongest Area
                    </p>
                    <p className='mt-1 break-words text-base font-semibold text-(--text-main)'>
                      {analysisData.strongestArea}
                    </p>
                  </div>
                </section>
              </aside>
            </div>
          </div>
        ) : (
          <div className='flex h-full w-full flex-col items-center justify-center'>
            <header className='mb-6 w-full max-w-3xl text-left'>
              <p className='mono-label text-[11px] font-semibold uppercase tracking-[0.12em] text-(--text-muted)'>
                Flashcard Session
              </p>
              <h2 className='mt-2 text-2xl font-semibold text-(--text-main)'>{session.title}</h2>
            </header>

            <button
              className={`h-96 w-full max-w-3xl cursor-pointer rounded-3xl text-center shadow-(--shadow-soft) ${styles.flipCard}`}
              onClick={() => setIsAnswerVisible((current) => !current)}
              type='button'
            >
              <div className={`${styles.flipInner} ${isAnswerVisible ? styles.flipped : ""}`}>
                <div
                  className={`${styles.face} flex items-center justify-center rounded-3xl border border-(--main) bg-(--main) px-8 py-6`}
                >
                  <span className='mono-label absolute top-5 left-5 text-sm font-semibold text-(--background)'>
                    {session.cards.length > 0 ? `${activeCardIndex + 1}/${session.cards.length}` : "0/0"}
                  </span>
                  <p className='text-balance text-2xl font-semibold leading-relaxed text-(--background)'>
                    {activeCard?.question ?? "No flashcards yet."}
                  </p>
                  <span className='absolute right-0 bottom-5 left-0 text-center text-sm text-(--background)'>
                    Click to see answer.
                  </span>
                </div>
                <div
                  className={`${styles.face} ${styles.back} flex items-center justify-center rounded-3xl border border-(--border-soft) bg-(--surface-panel-strong) px-8 py-6`}
                >
                  <span className='mono-label absolute top-5 left-5 text-sm font-semibold text-(--text-muted)'>
                    {session.cards.length > 0 ? `${activeCardIndex + 1}/${session.cards.length}` : "0/0"}
                  </span>
                  <p className='text-balance text-2xl font-semibold leading-relaxed text-(--text-main)'>
                    {activeCard?.answer ?? "No flashcards yet."}
                  </p>
                </div>
              </div>
            </button>

            <div className='mt-6 flex w-full max-w-3xl flex-wrap items-center justify-center gap-3'>
              <button
                className='grid h-10 w-10 place-items-center rounded-full border border-(--border-soft) bg-(--surface-panel) text-(--text-main) transition-colors duration-200 hover:bg-(--surface-main-faint) disabled:cursor-not-allowed disabled:opacity-50'
                disabled={isAtFirstCard || session.cards.length === 0}
                onClick={() => moveCard("previous")}
                type='button'
                aria-label='Previous flashcard'
              >
                <ChevronLeftIcon className='h-5 w-5' aria-hidden='true' />
                <span className='sr-only'>Previous flashcard</span>
              </button>
              <button
                className='rounded-full border border-(--border-soft) bg-(--background) px-4 py-2 text-(--destructive) transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
                disabled={session.cards.length === 0}
                onClick={() => markCard("incorrect")}
                type='button'
                aria-label='Mark incorrect'
                aria-pressed={activeCardResult === "incorrect"}
              >
                <XMarkIcon className='h-5 w-5' aria-hidden='true' />
                <span className='sr-only'>Mark incorrect</span>
              </button>
              <button
                className='rounded-full border border-(--border-soft) bg-(--background) px-4 py-2 text-(--success) transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
                disabled={session.cards.length === 0}
                onClick={() => markCard("correct")}
                type='button'
                aria-label='Mark correct'
                aria-pressed={activeCardResult === "correct"}
              >
                <CheckIcon className='h-5 w-5' aria-hidden='true' />
                <span className='sr-only'>Mark correct</span>
              </button>
              <button
                className={`border border-(--border-soft) bg-(--surface-panel) text-(--text-main) transition-colors duration-200 hover:bg-(--surface-main-faint) disabled:cursor-not-allowed disabled:opacity-50 ${
                  isAtLastCard
                    ? "rounded-full px-4 py-2 text-sm font-semibold"
                    : "grid h-10 w-10 place-items-center rounded-full"
                }`}
                disabled={session.cards.length === 0}
                onClick={() => {
                  if (isAtLastCard) {
                    handleOpenAnalysis();
                    return;
                  }

                  moveCard("next");
                }}
                type='button'
                aria-label={isAtLastCard ? "Show results" : "Next flashcard"}
              >
                {isAtLastCard ? (
                  "Show results"
                ) : (
                  <>
                    <ChevronRightIcon className='h-5 w-5' aria-hidden='true' />
                    <span className='sr-only'>Next flashcard</span>
                  </>
                )}
              </button>
            </div>

            <p className='mt-3 min-h-5 text-sm text-(--text-muted)'>
              {activeCardResult === "correct"
                ? "Marked: Correct"
                : activeCardResult === "incorrect"
                  ? "Marked: Incorrect"
                  : ""}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
