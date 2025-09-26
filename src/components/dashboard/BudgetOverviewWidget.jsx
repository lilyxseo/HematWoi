import { useMemo } from "react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../../lib/format";

function normalizeMonthKey(month) {
  if (!month) return null;
  if (month instanceof Date) {
    if (Number.isNaN(month.getTime())) return null;
    return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  }
  const text = String(month);
  if (!text) return null;
  return text.slice(0, 7);
}

function formatMonthLabel(monthKey) {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-").map((part) => Number.parseInt(part, 10));
  if (!year || !month) return monthKey;
  try {
    return new Intl.DateTimeFormat("id-ID", {
      month: "long",
      year: "numeric",
    }).format(new Date(year, month - 1, 1));
  } catch {
    return monthKey;
  }
}

const numberOrZero = (value) => {
  const parsed = Number.parseFloat(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

function getStatusDescriptor(ratio) {
  if (ratio >= 1) {
    return { label: "Lebih", className: "text-rose-500 dark:text-rose-300" };
  }
  if (ratio >= 0.8) {
    return { label: "Waspada", className: "text-amber-500 dark:text-amber-300" };
  }
  return { label: "Aman", className: "text-emerald-500 dark:text-emerald-300" };
}

function getProgressClass(ratio) {
  if (ratio >= 1) return "bg-rose-500";
  if (ratio >= 0.8) return "bg-amber-500";
  return "bg-brand";
}

function BudgetProgressRow({ item }) {
  const status = getStatusDescriptor(item.ratio);
  const progressWidth = Math.max(0, Math.min(100, item.ratio * 100));

  return (
    <div className="space-y-2 rounded-2xl border border-border/40 bg-surface/60 p-3 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 text-sm font-medium text-text">
        <span className="truncate" title={item.label}>
          {item.label}
        </span>
        <span className={`text-xs font-semibold ${status.className}`}>{status.label}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{formatCurrency(item.spent, "IDR")}</span>
        <span>{formatCurrency(item.planned, "IDR")}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40">
        <div
          className={`h-full rounded-full ${getProgressClass(item.ratio)}`}
          style={{ width: `${progressWidth}%` }}
        />
      </div>
    </div>
  );
}

function StatItem({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-surface/70 p-4 shadow-sm backdrop-blur-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted/80">{label}</p>
      <p className="mt-2 text-lg font-semibold text-text">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export default function BudgetOverviewWidget({ budgets = [], transactions = [], month }) {
  const desiredMonth = normalizeMonthKey(month) ?? normalizeMonthKey(new Date());

  const { activeMonth, monthBudgets } = useMemo(() => {
    if (!Array.isArray(budgets) || budgets.length === 0) {
      return { activeMonth: desiredMonth, monthBudgets: [] };
    }

    const bucket = new Map();
    budgets.forEach((budget) => {
      const key = normalizeMonthKey(
        budget?.month ?? budget?.period_month ?? budget?.periodMonth ?? null
      );
      if (!key) return;
      if (!bucket.has(key)) bucket.set(key, []);
      bucket.get(key).push(budget);
    });

    const months = Array.from(bucket.keys()).sort((a, b) => (a > b ? -1 : 1));
    const selected = desiredMonth && bucket.has(desiredMonth) ? desiredMonth : months[0] ?? desiredMonth;

    return {
      activeMonth: selected ?? null,
      monthBudgets: selected ? bucket.get(selected) ?? [] : [],
    };
  }, [budgets, desiredMonth]);

  const spentByCategory = useMemo(() => {
    if (!activeMonth || !Array.isArray(transactions)) return {};

    return transactions.reduce((acc, tx) => {
      if (!tx) return acc;
      const type = tx.type ?? tx.transaction_type;
      if (type !== "expense") return acc;
      const dateValue = tx.date ?? tx.transaction_date;
      if (!dateValue) return acc;
      const txMonth = normalizeMonthKey(dateValue);
      if (txMonth !== activeMonth) return acc;
      const categoryLabel =
        tx.category ?? tx.category_name ?? tx.categoryLabel ?? "Tanpa kategori";
      const amount = numberOrZero(tx.amount ?? tx.total ?? tx.value ?? 0);
      acc[categoryLabel] = (acc[categoryLabel] ?? 0) + Math.abs(amount);
      return acc;
    }, {});
  }, [transactions, activeMonth]);

  const summary = useMemo(() => {
    if (!activeMonth || monthBudgets.length === 0) {
      return {
        items: [],
        totalPlanned: 0,
        totalSpent: 0,
        remaining: 0,
      };
    }

    const items = monthBudgets
      .map((budget) => {
        const label =
          budget?.label ??
          budget?.category ??
          budget?.category_name ??
          budget?.name ??
          "Tanpa kategori";
        const planned = numberOrZero(
          budget?.amount_planned ?? budget?.planned ?? budget?.limit ?? budget?.cap
        );
        const recordedActual =
          budget?.actual ?? budget?.spent ?? budget?.current_spent ?? budget?.actual_amount;
        const spent =
          numberOrZero(recordedActual) > 0
            ? numberOrZero(recordedActual)
            : spentByCategory[label] ?? 0;
        const ratio = planned > 0 ? spent / planned : 0;
        return {
          id: budget?.id ?? label,
          label,
          planned,
          spent,
          remaining: planned - spent,
          ratio,
        };
      })
      .filter((item) => item.planned > 0 || item.spent > 0);

    const sorted = items.sort((a, b) => b.ratio - a.ratio);
    const topItems = sorted.slice(0, 4);

    const totalPlanned = items.reduce((acc, item) => acc + item.planned, 0);
    const totalSpent = items.reduce((acc, item) => acc + item.spent, 0);

    return {
      items: topItems,
      totalPlanned,
      totalSpent,
      remaining: totalPlanned - totalSpent,
    };
  }, [monthBudgets, spentByCategory, activeMonth]);

  const monthLabel = formatMonthLabel(activeMonth);

  const hasBudgets = monthBudgets.length > 0;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 p-6 shadow-sm backdrop-blur">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand/15 blur-3xl"
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted/80">
            Anggaran
          </p>
          <h2 className="text-xl font-semibold text-text">
            {hasBudgets ? `Ringkasan ${monthLabel}` : "Belum ada anggaran"}
          </h2>
          <p className="text-sm text-muted">
            {hasBudgets
              ? "Pantau progres kategori utama dan sisa ruang belanja bulan ini."
              : "Buat anggaran pertamamu untuk mulai mengontrol pengeluaran."}
          </p>
        </div>
        <Link
          to="/budgets"
          className="inline-flex h-10 items-center justify-center rounded-2xl border border-border bg-surface px-4 text-sm font-semibold text-text shadow-sm transition hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          Kelola Anggaran
        </Link>
      </div>

      {hasBudgets ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <StatItem
              label="Total Dialokasikan"
              value={formatCurrency(summary.totalPlanned, "IDR")}
              hint={monthLabel}
            />
            <StatItem
              label="Sudah Terpakai"
              value={formatCurrency(summary.totalSpent, "IDR")}
              hint={`${summary.totalPlanned > 0 ? Math.round((summary.totalSpent / summary.totalPlanned) * 100) : 0}% dari anggaran`}
            />
            <StatItem
              label="Sisa Ruang"
              value={formatCurrency(summary.remaining, "IDR")}
              hint={summary.remaining >= 0 ? "Masih aman" : "Sudah melewati batas"}
            />
          </div>
          <div className="mt-6 space-y-3">
            {summary.items.length ? (
              summary.items.map((item) => <BudgetProgressRow key={item.id} item={item} />)
            ) : (
              <p className="text-sm text-muted">
                Belum ada kategori anggaran dengan aktivitas bulan ini.
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-border/70 bg-surface/40 p-6 text-sm text-muted">
          Tambahkan kategori anggaran untuk melihat ringkasan cerdas di sini.
        </div>
      )}
    </section>
  );
}
