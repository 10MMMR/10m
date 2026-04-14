type SiteLogoProps = {
  compact?: boolean;
  className?: string;
};

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function SiteLogo({ compact = false, className }: SiteLogoProps) {
  return (
    <div
      className={joinClasses(
        "flex items-center",
        compact ? "justify-center" : "gap-3",
        className,
      )}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-(--surface-panel-strong) text-sm font-extrabold text-(--text-main)">
        10M
      </span>
      {compact ? null : (
        <p className="display-font text-lg font-bold text-(--text-main)">
          10M Study
        </p>
      )}
    </div>
  );
}
