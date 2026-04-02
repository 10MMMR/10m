type TopbarProps = {
  lockIn: boolean;
  classId: string;
  requestedClassId: string;
  usedFallback: boolean;
  workspaceName: string;
  classLabel: string;
  isAuthReady: boolean;
  isSignedIn: boolean;
  authLabel: string;
  onSignIn: () => void;
  onSignOut: () => void;
};

export function Topbar({
  lockIn,
  classId,
  requestedClassId,
  usedFallback,
  workspaceName,
  classLabel,
  isAuthReady,
  isSignedIn,
  authLabel,
  onSignIn,
  onSignOut,
}: TopbarProps) {
  return (
    <header className="z-10 flex items-center justify-between border-b border-(--border-soft) bg-(--surface-topbar) px-4 py-2 backdrop-blur-lg">
      <div className="flex items-center gap-2.5">
        <div
          className="grid h-7 w-7 place-items-center rounded-lg bg-(--main) font-extrabold text-(--text-contrast) shadow-(--shadow-brand)"
          aria-hidden="true"
        >
          <span>L</span>
        </div>
        <div>
          <p className="mono-label mb-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-(--text-muted)">
            AI Study Workspace
          </p>
          <h1 className="m-0 text-[1.1rem] leading-[1.15]">{workspaceName}</h1>
          <p className="mono-label mt-1 text-[11px] text-(--text-muted)">{classLabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 text-(--text-muted)">
        <span className="mono-label inline-flex items-center gap-1 rounded-full border border-(--border-soft) bg-(--surface-panel) px-3 py-2 text-[11px] font-medium uppercase tracking-[0.1em]">
          class: {classId}
        </span>
        {usedFallback ? (
          <span className="mono-label hidden rounded-full border border-(--border-accent) bg-(--surface-accent-soft) px-3 py-2 text-[11px] font-medium uppercase tracking-[0.1em] text-(--text-secondary) lg:inline-flex">
            fallback for {requestedClassId}
          </span>
        ) : null}
        {lockIn ? (
          <span
            className="mono-label inline-flex items-center gap-2 rounded-full border border-(--border-accent) bg-(--surface-accent-soft) px-3 py-2 text-[12px] font-bold uppercase tracking-[0.15em] text-(--text-secondary)"
            aria-live="polite"
          >
            <span
              className="inline-block h-2 w-2 animate-[lock-pulse_1.6s_ease-in-out_infinite] rounded-full bg-(--secondary)"
              aria-hidden="true"
            />
            Lock-in ON
          </span>
        ) : null}
        {isSignedIn ? (
          <div className="flex items-center gap-2">
            <span className="mono-label hidden rounded-full border border-(--border-soft) bg-(--surface-panel) px-3 py-2 text-[11px] font-medium text-(--text-main) md:inline-flex">
              {authLabel}
            </span>
            <button
              className="mono-label inline-flex items-center rounded-full border border-(--border-soft) bg-(--surface-panel) px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-(--text-main) transition-colors duration-150 hover:bg-(--surface-main-faint)"
              onClick={onSignOut}
              type="button"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            className="mono-label inline-flex items-center rounded-full border border-(--border-accent) bg-(--surface-accent-soft) px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-(--text-secondary) transition-colors duration-150 hover:bg-(--surface-main-faint) disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!isAuthReady}
            onClick={onSignIn}
            type="button"
          >
            {authLabel}
          </button>
        )}
      </div>
    </header>
  );
}
