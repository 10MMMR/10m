import { PricingSection } from "./_components/pricing-section";
import { SiteLogo } from "./_components/site-logo";

export default function Home() {
  return (
    <div id="home-top" className="relative flex-1 bg-(--background) text-(--text-main)">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="organic-blob-a absolute top-[-8rem] left-[-4rem] h-[22rem] w-[28rem] bg-(--hero-blob-a) blur-3xl" />
        <div className="organic-blob-b absolute top-[32rem] right-[-7rem] h-[24rem] w-[24rem] bg-(--hero-blob-b) blur-3xl" />
        <div className="organic-blob-c absolute bottom-[-9rem] left-[22%] h-[24rem] w-[25rem] bg-(--hero-blob-c) blur-3xl" />
      </div>

      <header className="sticky top-4 z-30 px-4 sm:px-6 lg:px-8">
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between rounded-full border border-(--border-soft) bg-(--surface-panel-strong) px-5 py-3 shadow-(--shadow-soft) backdrop-blur-md">
          <a
            href="#home-top"
            className="flex cursor-pointer items-center gap-3"
            aria-label="Scroll to top"
          >
            <SiteLogo />
          </a>
          <div className="hidden items-center gap-7 text-base text-(--text-muted) md:flex">
            <a
              href="#features"
              className="relative cursor-pointer pb-1 transition-colors duration-300 hover:text-(--main) after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-(--main) after:transition-transform after:duration-300 after:content-[''] hover:after:scale-x-100"
            >
              Features
            </a>
            <a
              href="#flashcards"
              className="relative cursor-pointer pb-1 transition-colors duration-300 hover:text-(--main) after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-(--main) after:transition-transform after:duration-300 after:content-[''] hover:after:scale-x-100"
            >
              Flashcards
            </a>
            <a
              href="#mock-exams"
              className="relative cursor-pointer pb-1 transition-colors duration-300 hover:text-(--main) after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-(--main) after:transition-transform after:duration-300 after:content-[''] hover:after:scale-x-100"
            >
              Mock Exams
            </a>
          </div>
          <button className="organic-button organic-button-primary h-11 cursor-pointer px-6 py-0 text-sm">
            Start Now
          </button>
        </nav>
      </header>

      <main className="relative z-10 pb-20">
        <section className="section-shell max-w-7xl pt-14 pb-16 sm:pt-20 lg:pt-24">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="organic-pill inline-flex items-center gap-2 bg-(--surface-main-soft) px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-(--main)">
                Mock-Exam First Study App
              </p>
              <h1 className="display-font mt-6 text-5xl font-bold leading-[0.96] tracking-[-0.02em] text-(--foreground) md:text-7xl">
                Train for test day with AI-built exams and targeted feedback.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-[1.75] text-(--text-muted)">
                10M converts your slides, lectures, and notes into realistic mock
                exams. It explains every wrong answer, identifies weak zones, and
                reprioritizes your study plan so the hardest topics are handled
                before exam day.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button className="organic-button organic-button-primary min-h-12">
                  Start Demo Class
                </button>
                <button className="organic-button organic-button-outline min-h-12">
                  View Sample Mock Exam
                </button>
              </div>
            </div>

            <article className="organic-card rounded-[2.2rem] rounded-tr-[4rem] p-6 sm:p-8">
              <p className="mono-label text-[11px] font-semibold uppercase tracking-[0.16em] text-(--text-muted)">
                Adaptive Readiness Board
              </p>
              <h2 className="display-font mt-3 text-3xl font-bold">
                Exam Sprint: Economics 101
              </h2>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-(--surface-main-soft) p-3 text-center">
                  <p className="display-font text-3xl font-bold text-(--main)">18</p>
                  <p className="text-xs text-(--text-muted)">Mocks Completed</p>
                </div>
                <div className="rounded-2xl bg-(--surface-accent-soft) p-3 text-center">
                  <p className="display-font text-3xl font-bold text-(--text-secondary)">
                    74%
                  </p>
                  <p className="text-xs text-(--text-muted)">Readiness</p>
                </div>
                <div className="rounded-2xl bg-(--surface-main-xfaint) p-3 text-center">
                  <p className="display-font text-3xl font-bold text-(--main)">6</p>
                  <p className="text-xs text-(--text-muted)">Weak Areas</p>
                </div>
              </div>
              <div className="mt-6 rounded-[1.6rem] border border-(--border-soft) bg-(--surface-panel) p-4">
                <p className="text-sm font-semibold text-(--text-main)">
                  Next priority topics
                </p>
                <ul className="mt-3 space-y-2 text-sm text-(--text-muted)">
                  <li>Supply shift vs movement on curve</li>
                  <li>Cross-price elasticity calculations</li>
                  <li>Graph interpretation under time pressure</li>
                </ul>
              </div>
            </article>
          </div>
        </section>

        <section id="features" className="section-shell max-w-7xl py-14 sm:py-20">
          <div className="mb-10 max-w-3xl">
            <p className="mono-label text-[11px] font-semibold uppercase tracking-[0.15em] text-(--main)">
              Core Platform
            </p>
            <h2 className="display-font mt-4 text-4xl font-bold md:text-5xl">
              Built around real exam outcomes, not generic studying.
            </h2>
          </div>
          <div className="grid gap-7 md:grid-cols-3">
            <article className="organic-card rounded-[2rem] rounded-tl-[4rem] p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-(--shadow-card-hover)">
              <h3 className="display-font text-2xl font-bold">Mock Exam Engine</h3>
              <p className="mt-3 text-(--text-muted)">
                Generates exam-style sets from your own uploaded materials so
                practice feels like the real thing.
              </p>
            </article>
            <article className="organic-card rounded-[2rem] rounded-tr-[4.4rem] p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-(--shadow-card-hover)">
              <h3 className="display-font text-2xl font-bold">Mistake Explainer</h3>
              <p className="mt-3 text-(--text-muted)">
                Breaks down why each wrong answer missed the mark and gives a
                concise correction path.
              </p>
            </article>
            <article className="organic-card rounded-[2rem] rounded-bl-[4.6rem] p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-(--shadow-card-hover)">
              <h3 className="display-font text-2xl font-bold">Weakness Priority</h3>
              <p className="mt-3 text-(--text-muted)">
                Tracks recurring misses, ranks weakest concepts, and updates your
                prep order automatically before test day.
              </p>
            </article>
          </div>
        </section>

        <section
          id="flashcards"
          className="section-shell max-w-7xl rounded-[2.4rem] bg-(--section-soft-bg) py-14 sm:py-20"
        >
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div>
              <p className="mono-label text-[11px] font-semibold uppercase tracking-[0.15em] text-(--main)">
                Smart Flashcards
              </p>
              <h2 className="display-font mt-4 text-4xl font-bold md:text-5xl">
                Turn on Nerd Mode for deeper questions beyond the textbook.
              </h2>
              <p className="mt-5 text-lg text-(--text-muted)">
                When enabled, flashcards expand into scenario reasoning and cloze
                drills so students connect definitions to exam-style thinking.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-(--border-accent) bg-(--surface-accent-soft) px-4 py-2 text-sm font-semibold text-(--text-secondary)">
                Nerd Mode: ON
              </div>
            </div>
            <div className="grid gap-4">
              <article className="organic-card rounded-[2rem] p-5">
                <p className="mono-label text-[11px] uppercase tracking-[0.15em] text-(--main)">
                  Basic
                </p>
                <p className="mt-2 text-base">
                  Topic: Supply and Demand. Question: What is supply?
                </p>
              </article>
              <article className="organic-card rounded-[2rem] rounded-tr-[4rem] p-5">
                <p className="mono-label text-[11px] uppercase tracking-[0.15em] text-(--main)">
                  Scenario
                </p>
                <p className="mt-2 text-base">
                  What happens to the demand curve if the price of a substitute
                  good rises?
                </p>
              </article>
              <article className="organic-card rounded-[2rem] rounded-bl-[3.5rem] p-5">
                <p className="mono-label text-[11px] uppercase tracking-[0.15em] text-(--main)">
                  Cloze Deletion
                </p>
                <p className="mt-2 text-base">
                  When price increases, quantity demanded usually{" "}
                  <span className="rounded-md bg-(--surface-main-soft) px-2 py-1 font-bold text-(--main)">
                    decreases
                  </span>
                  .
                </p>
              </article>
            </div>
          </div>
        </section>

        <section id="mock-exams" className="section-shell max-w-7xl py-14 sm:py-20">
          <div className="grid gap-8 lg:grid-cols-2">
            <article className="organic-card rounded-[2.3rem] p-7 sm:p-9">
              <p className="mono-label text-[11px] uppercase tracking-[0.15em] text-(--main)">
                AI Notes Summarization
              </p>
              <h3 className="display-font mt-3 text-3xl font-bold">
                Import slides, lectures, and textbook pages.
              </h3>
              <p className="mt-4 text-(--text-muted)">
                10M generates clean, exam-focused summaries with key definitions,
                likely test traps, and high-yield recall points.
              </p>
              <div className="mt-6 rounded-[1.5rem] border border-(--border-soft) bg-(--surface-panel) p-4">
                <p className="text-sm font-semibold">Summary Preview</p>
                <ul className="mt-3 space-y-2 text-sm text-(--text-muted)">
                  <li>Main idea and formula chain in plain language</li>
                  <li>Most testable concepts from this chapter</li>
                  <li>Quick-review bullets for 24h before exam</li>
                </ul>
              </div>
            </article>

            <article className="organic-card rounded-[2.3rem] rounded-tr-[4.6rem] p-7 sm:p-9">
              <p className="mono-label text-[11px] uppercase tracking-[0.15em] text-(--main)">
                Weakness-to-Plan Loop
              </p>
              <h3 className="display-font mt-3 text-3xl font-bold">
                Every miss updates what you should study next.
              </h3>
              <ol className="mt-5 space-y-3 text-(--text-muted)">
                <li>1. Mock exam reveals weak concepts and timing issues.</li>
                <li>2. AI explains errors and generates targeted drills.</li>
                <li>3. New mock focuses heavily on your top weak zones.</li>
                <li>4. Confidence score climbs as weak zones shrink.</li>
              </ol>
            </article>
          </div>
        </section>

        <PricingSection />

        <section className="section-shell max-w-5xl pb-8">
          <div className="organic-card rounded-[2.8rem] bg-(--surface-panel-strong) p-8 text-(--text-main) shadow-(--shadow-float) sm:p-12">
            <p className="mono-label text-[11px] uppercase tracking-[0.14em] text-(--text-secondary)">
              Next Step
            </p>
            <h2 className="display-font mt-4 text-4xl font-bold leading-[1.02] md:text-5xl">
              Your study app foundation is now styled and ready for feature buildout.
            </h2>
            <p className="mt-5 max-w-3xl text-base text-(--text-muted)">
              This homepage is set up as a demo surface for your mock exams,
              smart flashcards, AI summaries, and adaptive weakness coaching.
            </p>
            <form className="mt-7 flex flex-col gap-3 sm:flex-row">
              <input
                className="organic-input min-h-12 border-(--border-soft) bg-(--surface-input) text-(--text-main) placeholder:text-(--text-muted)"
                placeholder="Enter your email for launch access"
                type="email"
              />
              <button className="organic-button organic-button-primary h-12 w-full whitespace-nowrap px-6 py-0 sm:w-auto">
                Reserve Spot
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
