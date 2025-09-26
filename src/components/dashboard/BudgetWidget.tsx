import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { supabase } from "../../lib/supabase.js";
import { getCurrentUserId } from "../../lib/session.js";
import { formatCurrency } from "../../lib/format.js";

interface RawBudgetRow {
  id: string;
  name: string | null;
  label: string | null;
  category_key: string | null;
  amount_planned: number | null;
  planned: number | null;
  rollover_in: number | null;
  current_spent: number | null;
}

interface BudgetItem {
  id: string;
  label: string;
  planned: number;
  rolloverIn: number;
  spent: number;
}

interface BudgetTotals {
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  usage: number;
}

function toNumber(value: unknown): number {
  if (value == null || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthStartISO(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}-01`;
}

function resolveLabel(row: RawBudgetRow): string {
  const resolved = (row.label || row.name || row.category_key || "").trim();
  return resolved.length > 0 ? resolved : "Tanpa kategori";
}

function computeTotals(rows: BudgetItem[]): BudgetTotals {
  const totalBudget = rows.reduce(
    (acc, row) => acc + row.planned + row.rolloverIn,
    0
  );
  const totalSpent = rows.reduce((acc, row) => acc + row.spent, 0);
  const remaining = totalBudget - totalSpent;
  const usage = totalBudget > 0 ? totalSpent / totalBudget : 0;

  return {
    totalBudget,
    totalSpent,
    remaining,
    usage,
  };
}

function getProgressTone(percentage: number): string {
  if (percentage >= 0.9) return "bg-rose-500";
  if (percentage >= 0.7) return "bg-amber-500";
  return "bg-emerald-500";
}

function BudgetWidgetSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-5 w-40 animate-pulse rounded-full bg-muted/40" />
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`summary-skeleton-${index}`}
              className="space-y-2 rounded-xl border border-border-subtle/60 bg-card/70 p-4 shadow-sm"
            >
              <div className="h-4 w-16 animate-pulse rounded-full bg-muted/40" />
              <div className="h-7 w-24 animate-pulse rounded-lg bg-muted/30" />
              <div className="h-3 w-full animate-pulse rounded-full bg-muted/20" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3 rounded-2xl border border-border-subtle/60 bg-card/60 p-4 shadow-sm">
        <div className="h-4 w-32 animate-pulse rounded-full bg-muted/40" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`category-skeleton-${index}`} className="space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-muted/30" />
              <div className="h-2 w-full animate-pulse rounded-full bg-muted/20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border-subtle bg-card/50 p-8 text-center">
      <div className="space-y-2">
        <p className="text-lg font-semibold text-text">Belum ada anggaran bulan ini</p>
        <p className="text-sm text-muted">
          Mulai atur kategori dan batas pengeluaran agar keuanganmu tetap terkontrol.
        </p>
      </div>
      <Link
        to="/budgets"
        className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2"
      >
        Buat Anggaran
      </Link>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-200/60 bg-rose-50/60 p-5 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
      <p className="text-sm font-medium">Gagal memuat anggaran: {message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex h-9 items-center justify-center rounded-lg border border-rose-300/60 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
      >
        Coba lagi
      </button>
    </div>
  );
}

function BudgetSummary({ totals }: { totals: BudgetTotals }) {
  const { totalBudget, totalSpent, remaining, usage } = totals;
  const remainingPositive = remaining >= 0;
  const remainingTone = remainingPositive
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-rose-600 dark:text-rose-400";

  const usageSafe = Math.max(usage, 0);
  const usageRatio = Math.min(usageSafe, 1);
  const usageTone = getProgressTone(usageRatio);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border-subtle/60 bg-card/80 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Total Anggaran</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-text tabular-nums">
            {formatCurrency(Math.trunc(totalBudget), "IDR")}
          </p>
        </div>
        <div className="rounded-xl border border-border-subtle/60 bg-card/80 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Pengeluaran</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-text tabular-nums">
            {formatCurrency(Math.trunc(totalSpent), "IDR")}
          </p>
        </div>
        <div className="rounded-xl border border-border-subtle/60 bg-card/80 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Sisa</p>
          <p className={clsx("mt-2 text-2xl font-bold tracking-tight tabular-nums", remainingTone)}>
            {formatCurrency(Math.trunc(remaining), "IDR")}
          </p>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between text-xs font-medium text-muted">
          <span>Progress penggunaan</span>
          <span className="tabular-nums text-muted-foreground">
            {(usageSafe * 100).toFixed(0)}%
          </span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-border-subtle/60">
          <div
            className={clsx("h-full rounded-full", usageTone)}
            style={{ width: `${Math.min(usageRatio * 100, 100)}%` }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}

function TopCategories({ items }: { items: BudgetItem[] }) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-border-subtle/60 bg-card/70 p-4 text-sm text-muted">
        Tidak ada kategori populer.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const plannedTotal = item.planned + item.rolloverIn;
        const percentageRaw = plannedTotal > 0 ? item.spent / plannedTotal : 0;
        const percentageSafe = Math.max(percentageRaw, 0);
        const tone = getProgressTone(Math.min(percentageSafe, 1));
        const progressWidth = `${Math.min(percentageSafe, 1) * 100}%`;

        return (
          <div key={item.id} className="rounded-xl border border-border-subtle/60 bg-card/80 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-text">{item.label}</p>
                <p className="mt-1 text-xs text-muted">
                  {formatCurrency(Math.trunc(item.spent), "IDR")} / {formatCurrency(Math.trunc(plannedTotal), "IDR")}
                </p>
              </div>
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {(percentageSafe * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border-subtle/60">
              <div
                className={clsx("h-full rounded-full", tone)}
                style={{ width: progressWidth }}
                aria-hidden="true"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function BudgetWidget() {
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const periodMonth = useMemo(() => monthStartISO(), []);

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const userId = await getCurrentUserId().catch(() => null);
      if (!userId) {
        setItems([]);
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from("budgets")
        .select(
          "id,name,label,category_key,amount_planned,planned,rollover_in,current_spent"
        )
        .eq("user_id", userId)
        .eq("period_month", periodMonth);

      if (queryError) {
        throw queryError;
      }

      const mapped: BudgetItem[] = (data ?? []).map((row) => {
        const normalized = row as RawBudgetRow;
        const plannedBase = toNumber(
          normalized.planned != null ? normalized.planned : normalized.amount_planned
        );
        const rolloverIn = toNumber(normalized.rollover_in);
        const spent = toNumber(normalized.current_spent);

        return {
          id: normalized.id,
          label: resolveLabel(normalized),
          planned: plannedBase,
          rolloverIn,
          spent,
        };
      });

      setItems(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan";
      setItems([]);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [periodMonth]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const totals = useMemo(() => computeTotals(items), [items]);
  const topCategories = useMemo(() => {
    if (!items.length) return [];
    const ranked = [...items].sort((a, b) => {
      const aValue = Math.max(a.planned + a.rolloverIn, a.spent);
      const bValue = Math.max(b.planned + b.rolloverIn, b.spent);
      return bValue - aValue;
    });
    return ranked.slice(0, 3);
  }, [items]);

  if (loading) {
    return (
      <section className="rounded-2xl border border-border-subtle/60 bg-card/80 p-6 shadow-sm">
        <BudgetWidgetSkeleton />
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-border-subtle/60 bg-card/80 p-6 shadow-sm">
        <ErrorState message={error} onRetry={fetchBudgets} />
      </section>
    );
  }

  if (!items.length) {
    return (
      <section className="rounded-2xl border border-border-subtle/60 bg-card/80 p-6 shadow-sm">
        <EmptyState />
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border-subtle/60 bg-card/80 p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text">Anggaran Bulan Ini</h2>
          <p className="text-sm text-muted-foreground">
            Ringkasan penggunaan anggaran periode {new Date(periodMonth).toLocaleString("id-ID", { month: "long", year: "numeric" })}
          </p>
        </div>
        <Link
          to="/budgets"
          className="inline-flex h-9 items-center justify-center rounded-lg border border-border-subtle bg-surface px-3 text-xs font-semibold text-muted-foreground transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          Kelola Anggaran
        </Link>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <BudgetSummary totals={totals} />
        </div>
        <div className="lg:w-80">
          <h3 className="text-sm font-semibold text-text">Top Kategori</h3>
          <p className="text-xs text-muted-foreground">
            Berdasarkan rencana atau pengeluaran terbesar bulan ini.
          </p>
          <div className="mt-3">
            <TopCategories items={topCategories} />
          </div>
        </div>
      </div>
    </section>
  );
}
