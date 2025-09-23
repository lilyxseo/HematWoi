import SectionHeader from "./SectionHeader";

function normalizeItems(items = []) {
  return items
    .map((item) => {
      const pct = Number.isFinite(Number(item?.pct))
        ? Number(item.pct)
        : 0;
      return {
        category: item?.category || "Tanpa kategori",
        planned: Number.isFinite(Number(item?.planned)) ? Number(item.planned) : 0,
        actual: Number.isFinite(Number(item?.actual)) ? Number(item.actual) : 0,
        pct,
      };
    })
    .filter((item) => item.pct > 0);
}

const MAX_ITEMS = 5;

function BudgetStatusGroup({ title, colorClass, items }) {
  if (!items.length) return null;
  return (
    <div className="space-y-2">
      <h3
        className={
          "text-xs font-semibold uppercase tracking-wide text-muted/80"
        }
      >
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={`${title}-${item.category}`}
            className={`inline-flex max-w-full items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium shadow-sm ${colorClass}`}
          >
            <span className="min-w-0 max-w-[10rem] overflow-hidden text-ellipsis whitespace-nowrap">
              {item.category}
            </span>
            <span>{Math.round(item.pct)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function BudgetStatusHighlights({ items = [] }) {
  const normalized = normalizeItems(items);
  if (!normalized.length) {
    return (
      <section className="rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur">
        <SectionHeader
          title="Status Anggaran"
          description="Pantau kategori yang mendekati atau melebihi batas."
        />
        <p className="mt-3 text-sm text-muted">
          Belum ada data anggaran untuk ditampilkan.
        </p>
      </section>
    );
  }

  const over = normalized
    .filter((item) => item.pct >= 100)
    .sort((a, b) => b.pct - a.pct);
  const near = normalized
    .filter((item) => item.pct >= 80 && item.pct < 100)
    .sort((a, b) => b.pct - a.pct);

  const overDisplay = over.slice(0, MAX_ITEMS);
  const nearDisplay = near.slice(0, Math.max(0, MAX_ITEMS - overDisplay.length));

  if (!overDisplay.length && !nearDisplay.length) {
    return (
      <section className="rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur">
        <SectionHeader
          title="Status Anggaran"
          description="Pantau kategori yang mendekati atau melebihi batas."
        />
        <p className="mt-3 text-sm text-muted">
          Semua kategori masih aman di bawah 80% dari anggaran.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur">
      <SectionHeader
        title="Status Anggaran"
        description="Pantau kategori yang mendekati atau melebihi batas."
      />
      <div className="mt-4 space-y-4">
        <BudgetStatusGroup
          title="Over Budget"
          colorClass="border-rose-500/30 bg-rose-500/10 text-rose-600 dark:border-rose-400/30 dark:text-rose-300"
          items={overDisplay}
        />
        <BudgetStatusGroup
          title="Near Budget"
          colorClass="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:border-amber-400/30 dark:text-amber-300"
          items={nearDisplay}
        />
      </div>
    </section>
  );
}
