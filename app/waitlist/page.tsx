import { WaitlistShowcase } from "./_components/waitlist-showcase";

export default function WaitlistPage() {
  return (
    <main
      className="relative flex min-h-dvh items-center overflow-hidden bg-(--background) px-4 py-6 sm:px-6 sm:py-10"
      style={{
        backgroundImage:
          "url('/sprout_waitlist_background.svg'), radial-gradient(circle at 18% 10%, var(--surface-main-xfaint), transparent 46%), radial-gradient(circle at 84% 92%, var(--surface-accent-soft), transparent 48%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-(--surface-panel-soft) via-transparent to-(--surface-panel-soft) opacity-45" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--border-strong) 0.95px, transparent 0.95px)",
          backgroundPosition: "0 0",
          backgroundSize: "34px 34px",
          opacity: 0.24,
          maskImage:
            "radial-gradient(ellipse at center, transparent 28%, black 76%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, transparent 28%, black 76%, transparent 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--border-strong) 1.9px, transparent 1.9px)",
          backgroundPosition: "0 0",
          backgroundSize: "36px 36px",
          opacity: 0.32,
          maskImage: "radial-gradient(ellipse at center, black 0%, transparent 62%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 0%, transparent 62%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-(--surface-base) opacity-12" />
      <div className="relative w-full">
        <WaitlistShowcase />
      </div>
    </main>
  );
}
