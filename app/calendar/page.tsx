import { AppShell } from "@/app/app/_components/app-shell";

export default function CalendarPage() {
  return (
    <AppShell>
      <section className="space-y-6">
        <header>
          <p className="mono-label text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)">
            Workspace
          </p>
          <h1 className="display-font mt-2 text-4xl font-bold text-(--text-main)">
            Calendar
          </h1>
        </header>
      </section>
    </AppShell>
  );
}
