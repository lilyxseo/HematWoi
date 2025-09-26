import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useRepo } from "../../providers/DataProvider";
import { formatCurrency } from "../../lib/format";

function startOfCurrentMonthKey() {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  return utc.toISOString().slice(0, 10);
}

function normalizePeriod(value) {
  if (!value) return null;
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch (error) {
    console.warn("[BudgetWidget] Failed to parse period_month", value, error);
    return null;
  }
}

function getProgressColor(percentage) {
  if (percentage >= 90) return "bg-danger";
  if (percentage >= 70) return "bg-warning";
  return "bg-success";
}

function BudgetWidgetSkeleton() {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface shadow-sm">
      <div className="space-y-6 p-5 sm:p-6">
        <div className="h-4 w-32 animate-pulse rounded-full bg-border" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((key) => (
            <div key={key} className="space-y-2">
              <div className="h-3 w-24 animate-pulse rounded-full bg-border-subtle" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-border" />
            </div>
          ))}
        </div>
        <div className="h-2 w-full animate-pulse rounded-full bg-border-subtle" />
        <div className="space-y-3">
          {[1, 2, 3].map((key) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-3 w-28 animate-pulse rounded-full bg-border-subtle" />
                <div className="h-3 w-20 animate-pulse rounded-full bg-border-subtle" />
              </div>
              <div className="h-2 w-full animate-pulse rounded-full bg-border-subtle" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BudgetWidget() {
  const repo = useRepo();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [budgets, setBudgets] = useState([]);

  const periodKey = useMemo(() => startOfCurrentMonthKey(), []);

  useEffect(() => {
    let ignore = false;

    async function loadBudgets() {
      try {
        setLoading(true);
        setError(null);
        const list = await repo.budgets.list();
        if (!ignore) {
          setBudgets(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        console.error("[BudgetWidget] Failed to load budgets", err);
        if (!ignore) {
          setError("Gagal memuat anggaran. Coba lagi nanti.");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadBudgets();

    return () => {
      ignore = true;
    };
  }, [repo]);

  const currentBudgets = useMemo(() => {
    return budgets.filter((item) => normalizePeriod(item?.period_month) === periodKey);
  }, [budgets, periodKey]);

  const summary = useMemo(() => {
    const totalBudget = currentBudgets.reduce(
      (acc, item) => acc + Number(item?.planned ?? 0) + Number(item?.rollover_in ?? 0),
      0
    );
    const totalSpent = currentBudgets.reduce(
      (acc, item) => acc + Number(item?.current_spent ?? 0),
      0
    );
    const remaining = totalBudget - totalSpent;
    const usagePercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return {
      totalBudget,
      totalSpent,
      remaining,
      usagePercentage,
    };
  }, [currentBudgets]);

  const topCategories = useMemo(() => {
    return [...currentBudgets]
      .sort((a, b) => {
        const aValue = Math.max(
          Number(a?.amount_planned ?? a?.planned ?? 0),
          Number(a?.current_spent ?? 0)
        );
        const bValue = Math.max(
          Number(b?.amount_planned ?? b?.planned ?? 0),
          Number(b?.current_spent ?? 0)
        );
        return bValue - aValue;
      })
      .slice(0, 3);
  }, [currentBudgets]);

  if (loading) {
    return <BudgetWidgetSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-danger/40 bg-danger/10 p-6 text-danger shadow-sm">
        <p className="text-sm font-medium">{error}</p>
      </div>
    );
  }

  if (!currentBudgets.length) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-surface p-6 text-center shadow-sm">
        <h3 className="text-lg font-semibold text-text">Belum ada anggaran bulan ini</h3>
        <p className="mt-2 text-sm text-muted">
          Buat rencana anggaran untuk melacak pengeluaranmu dengan lebih baik.
        </p>
        <Link
          to="/budgets"
          className="mt-4 inline-flex items-center justify-center rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2"
        >
          Buat Anggaran
        </Link>
      </div>
    );
  }

  const overallProgressColor = getProgressColor(summary.usagePercentage);
  const overallProgressWidth = `${Math.max(0, Math.min(summary.usagePercentage, 100)).toFixed(0)}%`;

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface shadow-sm">
      <div className="space-y-6 p-5 sm:p-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-text">Anggaran Bulan Ini</h3>
            <p className="text-sm text-muted">Ringkasan anggaran periode berjalan</p>
          </div>
          <Link
            to="/budgets"
            className="inline-flex items-center justify-center rounded-2xl border border-border-subtle px-3 py-2 text-xs font-semibold text-text transition hover:border-border hover:bg-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2"
          >
            Kelola Anggaran
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Total Anggaran</p>
            <p className="text-xl font-semibold text-text sm:text-2xl">
              {formatCurrency(summary.totalBudget, "IDR")}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Realisasi</p>
            <p className="text-xl font-semibold text-text sm:text-2xl">
              {formatCurrency(summary.totalSpent, "IDR")}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Sisa</p>
            <p className={`text-xl font-semibold sm:text-2xl ${summary.remaining < 0 ? "text-danger" : "text-text"}`}>
              {formatCurrency(summary.remaining, "IDR")}
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs font-medium text-muted">
            <span>Penggunaan {Math.round(summary.usagePercentage)}%</span>
            <span>{summary.remaining >= 0 ? "Sisa" : "Melampaui"}</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-border-subtle">
            <div
              className={`h-2 rounded-full ${overallProgressColor}`}
              style={{ width: overallProgressWidth }}
            />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-text">Top Kategori</p>
          <div className="space-y-4">
            {topCategories.map((item) => {
              const planned = Number(item?.planned ?? 0) + Number(item?.rollover_in ?? 0);
              const spent = Number(item?.current_spent ?? 0);
              const percentage = planned > 0 ? (spent / planned) * 100 : spent > 0 ? 100 : 0;
              const barColor = getProgressColor(percentage);
              const name = item?.label || item?.name || item?.category_key || "Tanpa kategori";

              return (
                <div key={item?.id ?? name} className="space-y-2">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <div className="truncate font-medium text-text">{name}</div>
                    <div className="shrink-0 text-xs text-muted">
                      {formatCurrency(spent, "IDR")} / {formatCurrency(planned, "IDR")}
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-border-subtle">
                    <div
                      className={`h-2 rounded-full ${barColor}`}
                      style={{ width: `${Math.max(0, Math.min(percentage, 100)).toFixed(0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
