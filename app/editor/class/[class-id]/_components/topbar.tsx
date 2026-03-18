type TopbarProps = {
  lockIn: boolean;
  classId: string;
  requestedClassId: string;
  usedFallback: boolean;
  workspaceName: string;
  classLabel: string;
};

export function Topbar({
  lockIn,
  classId,
  requestedClassId,
  usedFallback,
  workspaceName,
  classLabel,
}: TopbarProps) {
  return (
    <header className="z-10 flex items-center justify-between border-b border-[var(--border-soft)] bg-[var(--surface-topbar)] px-4 py-2 backdrop-blur-[18px]">
      <div className="flex items-center gap-2.5">
        <div
          className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--main)] font-extrabold text-[var(--text-contrast)] shadow-[var(--shadow-brand)]"
          aria-hidden="true"
        >
          <span>L</span>
        </div>
        <div>
          <p className="mono-label mb-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
            AI Study Workspace
          </p>
          <h1 className="m-0 text-[1.1rem] leading-[1.15]">{workspaceName}</h1>
          <p className="mono-label mt-1 text-[11px] text-[var(--text-muted)]">{classLabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 text-[var(--text-muted)]">
        <span className="mono-label inline-flex items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[var(--surface-panel)] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.1em]">
          class: {classId}
        </span>
        {usedFallback ? (
          <span className="mono-label hidden rounded-full border border-[var(--border-accent)] bg-[var(--surface-accent-soft)] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-secondary)] lg:inline-flex">
            fallback for {requestedClassId}
          </span>
        ) : null}
        {lockIn ? (
          <span
            className="mono-label inline-flex items-center gap-2 rounded-full border border-[var(--border-accent)] bg-[var(--surface-accent-soft)] px-3 py-2 text-[12px] font-bold uppercase tracking-[0.15em] text-[var(--text-secondary)]"
            aria-live="polite"
          >
            <span
              className="inline-block h-2 w-2 animate-[lock-pulse_1.6s_ease-in-out_infinite] rounded-full bg-[var(--secondary)]"
              aria-hidden="true"
            />
            Lock-in ON
          </span>
        ) : null}
      </div>
    </header>
  );
}
