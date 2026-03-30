export default function AppHomePage() {
  return (
    <section className="space-y-6">
      <header>
        <p className="mono-label text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)">
          Dashboard
        </p>
        <h1 className="display-font mt-2 text-4xl font-bold text-(--text-main)">
          Welcome back, Tan Yu
        </h1>
      </header>

      <article className="organic-card rounded-[1.8rem] p-6 sm:p-8">
        <h2 className="display-font text-2xl font-bold text-(--text-main)">Overview</h2>
        <p className="mt-3 max-w-2xl text-(--text-muted)">
          This is the starter dashboard route for authenticated users. Authentication can be
          connected later while keeping this layout and sidebar intact.
        </p>
      </article>
    </section>
  );
}
