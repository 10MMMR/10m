import { ChevronUpIcon, UserCircleIcon } from "@heroicons/react/24/outline";

type SidebarProfileProps = {
  name: string;
};

export function SidebarProfile({ name }: SidebarProfileProps) {
  return (
    <button
      className="flex h-12 w-full items-center justify-between rounded-2xl border border-(--border-soft) bg-(--surface-panel-soft) px-3 text-left transition-colors duration-200 hover:bg-(--surface-main-faint)"
      type="button"
    >
      <span className="flex items-center gap-2.5">
        <UserCircleIcon className="h-6 w-6 text-(--text-muted)" aria-hidden="true" />
        <span className="truncate text-sm font-semibold text-(--text-main)">{name}</span>
      </span>
      <ChevronUpIcon className="h-4 w-4 text-(--text-muted)" aria-hidden="true" />
    </button>
  );
}
