import { useMemo } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import Card from "../Card";
import { useBudgets } from "../../hooks/useBudgets";
import { formatCurrency } from "../../lib/format";

const MONTH_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
});

function getCurrentPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function getProgressPalette(percentage) {
  if (percentage >= 105) {
    return {
      gradient: "linear-gradient(90deg, #fb7185 0%, #ef4444 60%, #b91c1c 100%)",
      glow: "rgba(239, 68, 68, 0.55)",
      glowBase: "rgba(254, 226, 226, 0.95)",
    };
  }
  if (percentage >= 95) {
    return {
      gradient: "linear-gradient(90deg, #fbbf24 0%, #f97316 55%, #f43f5e 100%)",
      glow: "rgba(249, 115, 22, 0.55)",
      glowBase: "rgba(255, 247, 237, 0.95)",
    };
  }
  return {
    gradient: "linear-gradient(90deg, #34d399 0%, #22d3ee 60%, #38bdf8 100%)",
    glow: "rgba(56, 189, 248, 0.55)",
    glowBase: "rgba(224, 242, 254, 0.95)",
  };
}

function BudgetProgress({ percentage }) {
  const palette = getProgressPalette(percentage);
  const clamped = Math.max(0, Math.min(percentage, 110));

  return (
    <div className="relative h-3 overflow-hidden rounded-full bg-border/50">
      <div
        className="relative h-full rounded-full transition-[width] duration-500 ease-out"
        style={{
          width: `${clamped}%`,
          background: palette.gradient,
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
        }}
      >
        {percentage > 2 && (
          <span
            className="absolute -right-1 top-1/2 inline-block h-4 w-4 -translate-y-1/2 rounded-full"
            style={{
              background: palette.glowBase,
              boxShadow: `0 0 0 2px rgba(255,255,255,0.55), 0 0 12px ${palette.glow}`,
            }}
          />
        )}
      </div>
    </div>
  );
}

function BudgetHighlightItem({ item, index }) {
  const remainingLabel = item.remaining >= 0
    ? `Sisa ${formatCurrency(item.remaining, "IDR")}`
    : `Melebihi ${formatCurrency(Math.abs(item.remaining), "IDR")}`;
  const remainingPct = Math.max(0, Math.round(100 - Math.min(item.percentage, 100)));
  const usageClass = clsx(
    "text-sm font-semibold",
    item.percentage >= 100
      ? "text-danger"
      : item.percentage >= 90
        ? "text-warning"
        : "text-success"
  );

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border-subtle/60 bg-surface/90 p-4 shadow-sm transition hover:border-primary/40 hover:shadow-lg dark:bg-white/5">
      <div className="absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-emerald-100/5 dark:from-primary/20 dark:to-emerald-200/10" />
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted/80">#{index + 1}</span>
          <h4 className="mt-1 text-base font-semibold text-text sm:text-lg">
            {item.name}
          </h4>
        </div>
        <div className="text-right">
          <p className={usageClass}>{Math.round(item.percentage)}% terpakai</p>
          <p className="text-xs text-muted">
            {formatCurrency(item.spent, "IDR")} / {formatCurrency(item.planned, "IDR")}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <BudgetProgress percentage={item.percentage} />
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{remainingLabel}</span>
          <span>{remainingPct}% tersisa</span>
        </div>
      </div>
    </div>
  );
}

function BudgetHighlightsSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-border-subtle/60 bg-surface/70 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 rounded-full bg-border/60" />
            <div className="h-4 w-16 rounded-full bg-border/60" />
          </div>
          <div className="mt-4 h-3 rounded-full bg-border/60" />
          <div className="mt-3 flex justify-between">
            <div className="h-3 w-28 rounded-full bg-border/60" />
            <div className="h-3 w-16 rounded-full bg-border/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyBudgetHighlights() {
  return (
    <div className="rounded-2xl border border-dashed border-border-subtle/70 bg-surface/60 p-6 text-center text-sm text-muted">
      Belum ada budget yang mendekati batas bulan ini. Tetap pertahankan ritme bagusmu!
    </div>
  );
}

function ErrorBudgetHighlights({ message }) {
  return (
    <div className="rounded-2xl border border-danger/30 bg-danger/10 p-6 text-center text-sm text-danger">
      {message ?? "Gagal memuat data budget."}
    </div>
  );
}

export default function BudgetHighlightsCard() {
  const period = useMemo(() => getCurrentPeriod(), []);
  const periodLabel = useMemo(() => {
    const [year, month] = period.split("-").map((part) => Number.parseInt(part, 10));
    if (!year || !month) return MONTH_FORMATTER.format(new Date());
    return MONTH_FORMATTER.format(new Date(year, month - 1, 1));
  }, [period]);

  const { rows, loading, error } = useBudgets(period);

  const highlights = useMemo(() => {
    return rows
      .map((row) => {
        const planned = Number(row.amount_planned ?? 0);
        const spent = Number(row.spent ?? 0);
        if (!planned || planned <= 0) return null;
        const percentage = (spent / planned) * 100;
        const name = row.category?.name ?? row.category_name ?? row.name ?? "Budget tanpa nama";
        return {
          id: row.id,
          name,
          planned,
          spent,
          remaining: Number(row.remaining ?? planned - spent),
          percentage,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3);
  }, [rows]);

  const showEmpty = !loading && !error && highlights.length === 0;

  return (
    <Card className="relative overflow-hidden border border-border-subtle/70 bg-surface-alt/70 p-6">
      <div className="pointer-events-none absolute -top-32 right-0 h-64 w-64 rounded-full bg-primary/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 left-10 h-48 w-48 rounded-full bg-warning/20 blur-3xl opacity-60 dark:bg-warning/10" aria-hidden />
      <div className="relative space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-4 w-4" /> Budget Watch
            </span>
            <h3 className="mt-3 text-xl font-semibold text-text sm:text-2xl">
              Budget Hampir Tembus
            </h3>
            <p className="text-sm text-muted">Periode {periodLabel}</p>
          </div>
          <Link to="/budgets" className="btn btn-primary btn-sm whitespace-nowrap">
            Info Lengkap
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <BudgetHighlightsSkeleton />
        ) : error ? (
          <ErrorBudgetHighlights message={error} />
        ) : showEmpty ? (
          <EmptyBudgetHighlights />
        ) : (
          <div className="space-y-4">
            {highlights.map((item, index) => (
              <BudgetHighlightItem key={item.id ?? index} item={item} index={index} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
