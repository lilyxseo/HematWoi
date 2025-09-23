import { type ChangeEvent, useEffect, useId, useMemo, useState } from "react";
import { formatCurrency } from "../lib/format";

type TransactionLike = Record<string, any>;
type BudgetLike = Record<string, any>;

interface CategoryOption {
  key: string;
  id: string | null;
  name: string;
  spent: number;
  merchants: Record<string, { total: number; count: number }>;
}

interface BudgetInfo {
  key: string;
  categoryId: string | null;
  categoryName: string | null;
  month: string | null;
  planned: number;
}

interface WhatIfPlannerProps {
  txs: TransactionLike[];
  budgets?: BudgetLike[];
  userId?: string | null;
}

const DEFAULT_PERCENT = 0;
const MAX_PERCENT = 80;
const DOMINANT_SHARE_THRESHOLD = 0.35;
const NUMBER_FORMAT = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PERCENT;
  const rounded = Math.round(value);
  return Math.min(MAX_PERCENT, Math.max(0, rounded));
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value == null) return 0;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPositiveNumber(value: unknown): number {
  const num = toNumber(value);
  return Number.isFinite(num) ? Math.max(0, num) : 0;
}

function extractMonthKey(source: unknown): string | null {
  if (!source) return null;
  if (source instanceof Date) {
    if (Number.isNaN(source.getTime())) return null;
    return `${source.getFullYear()}-${String(source.getMonth() + 1).padStart(2, "0")}`;
  }
  const str = String(source);
  if (!str) return null;
  if (/^\d{4}-\d{2}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 7);
  if (/^\d{6}$/.test(str)) return `${str.slice(0, 4)}-${str.slice(4, 6)}`;
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const CURRENT_MONTH_KEY = (() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
})();

function normalizeBudgets(budgets: BudgetLike[] | undefined, monthKey: string): BudgetInfo[] {
  if (!Array.isArray(budgets)) return [];
  return budgets
    .map((budget) => {
      const rawMonth =
        budget?.month ??
        budget?.period_month ??
        budget?.periodMonth ??
        budget?.period ??
        budget?.date ??
        null;
      const month = extractMonthKey(rawMonth);
      if (month && month !== monthKey) return null;
      const categoryId = budget?.category_id ?? budget?.categoryId ?? budget?.categoryID ?? budget?.category_key ?? null;
      const categoryName =
        budget?.category ??
        budget?.category_name ??
        budget?.categoryName ??
        budget?.category_label ??
        budget?.categoryLabel ??
        null;
      const plannedSource =
        budget?.amount_planned ??
        budget?.planned ??
        budget?.amount ??
        budget?.limit ??
        budget?.cap ??
        0;
      const planned = toPositiveNumber(plannedSource);
      const key = categoryId != null ? String(categoryId) : categoryName ?? "";
      return {
        key,
        categoryId: categoryId != null ? String(categoryId) : null,
        categoryName,
        month,
        planned,
      } satisfies BudgetInfo;
    })
    .filter((item): item is BudgetInfo => Boolean(item));
}

function buildCategoryOptions(txs: TransactionLike[], monthKey: string) {
  const map = new Map<string, CategoryOption>();
  let totalIncome = 0;
  let totalExpense = 0;

  for (const tx of txs) {
    const month = extractMonthKey(tx?.date ?? tx?.transaction_date ?? tx?.created_at ?? null);
    if (month !== monthKey) continue;

    const rawAmount = tx?.amount ?? tx?.total ?? tx?.value ?? 0;
    const amount = toNumber(rawAmount);
    const type = String(tx?.type ?? "").toLowerCase();

    if (type === "income") {
      totalIncome += Math.abs(amount);
      continue;
    }
    if (type !== "expense") {
      if (amount < 0) {
        totalExpense += Math.abs(amount);
      }
      continue;
    }

    const absolute = Math.abs(amount);
    totalExpense += absolute;

    if (absolute <= 0) continue;

    const rawName =
      tx?.category ??
      tx?.category_name ??
      tx?.categoryName ??
      tx?.category_label ??
      tx?.categoryLabel ??
      "Tanpa kategori";
    const name = rawName || "Tanpa kategori";
    const categoryId = tx?.category_id ?? tx?.categoryId ?? tx?.categoryID ?? null;
    const key = categoryId != null ? String(categoryId) : name;
    const merchantRaw =
      tx?.merchant ?? tx?.merchant_name ?? tx?.merchantName ?? tx?.merchant_label ?? tx?.merchantLabel ?? null;

    const existing = map.get(key) ?? {
      key,
      id: categoryId != null ? String(categoryId) : null,
      name,
      spent: 0,
      merchants: {} as CategoryOption["merchants"],
    };

    existing.spent += absolute;
    if (merchantRaw) {
      const merchantKey = String(merchantRaw);
      const bucket = existing.merchants[merchantKey] ?? { total: 0, count: 0 };
      bucket.total += absolute;
      bucket.count += 1;
      existing.merchants[merchantKey] = bucket;
    }

    map.set(key, existing);
  }

  const categoryOptions = Array.from(map.values())
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 10);

  return { categoryOptions, totalIncome, totalExpense };
}

export default function WhatIfPlanner({ txs, budgets, userId }: WhatIfPlannerProps) {
  const selectId = useId();
  const sliderId = useId();

  const { categoryOptions, totalIncome, totalExpense } = useMemo(
    () => buildCategoryOptions(Array.isArray(txs) ? txs : [], CURRENT_MONTH_KEY),
    [txs]
  );

  const cashflowNow = Math.round(totalIncome - totalExpense);

  const normalizedBudgets = useMemo(
    () => normalizeBudgets(Array.isArray(budgets) ? budgets : [], CURRENT_MONTH_KEY),
    [budgets]
  );

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [percent, setPercent] = useState<number>(DEFAULT_PERCENT);

  const storageKey = typeof window !== "undefined" && userId ? `hw:whatif:last:${userId}` : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed.percent === "number") {
        setPercent(clampPercent(parsed.percent));
      }
      if (parsed.categoryId) {
        setSelectedKey(String(parsed.categoryId));
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    if (!categoryOptions.length) {
      setSelectedKey(null);
      return;
    }
    setSelectedKey((prev) => {
      if (prev && categoryOptions.some((option) => option.key === prev)) {
        return prev;
      }
      return categoryOptions[0]?.key ?? null;
    });
  }, [categoryOptions]);

  const selectedOption = useMemo(() => {
    if (!categoryOptions.length) return null;
    if (!selectedKey) return categoryOptions[0] ?? null;
    return categoryOptions.find((option) => option.key === selectedKey) ?? categoryOptions[0] ?? null;
  }, [categoryOptions, selectedKey]);

  useEffect(() => {
    if (!storageKey || !selectedOption) return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          categoryId: selectedOption.key,
          percent,
        })
      );
    } catch {
      /* ignore */
    }
  }, [percent, selectedOption, storageKey]);

  const spent = selectedOption?.spent ?? 0;
  const saving = selectedOption ? Math.round(spent * (percent / 100)) : 0;

  const matchingBudget = useMemo(() => {
    if (!selectedOption) return null;
    return (
      normalizedBudgets.find((item) => {
        if (item.categoryId && selectedOption.id && item.categoryId === selectedOption.id) {
          return true;
        }
        if (item.categoryId && item.categoryId === selectedOption.key) {
          return true;
        }
        if (item.categoryName && item.categoryName === selectedOption.name) {
          return true;
        }
        if (item.key === selectedOption.key) {
          return true;
        }
        return false;
      }) ?? null
    );
  }, [normalizedBudgets, selectedOption]);

  const plannedBudget = matchingBudget?.planned ?? 0;
  const projectedBudget = Math.round(plannedBudget - (spent - saving));
  const projectedCashflow = Math.round(cashflowNow + saving);

  const dominantMerchant = useMemo(() => {
    if (!selectedOption || !saving || selectedOption.spent <= 0) return null;
    const entries = Object.entries(selectedOption.merchants || {});
    if (!entries.length) return null;

    let bestName: string | null = null;
    let bestTotal = 0;
    let bestCount = 0;

    for (const [name, stats] of entries) {
      if (!stats || stats.total <= 0 || stats.count <= 0) continue;
      if (stats.total > bestTotal) {
        bestName = name;
        bestTotal = stats.total;
        bestCount = stats.count;
      }
    }

    if (!bestName || bestTotal <= 0 || bestCount <= 0) return null;
    const share = bestTotal / selectedOption.spent;
    if (share < DOMINANT_SHARE_THRESHOLD) return null;
    const avgTicket = bestTotal / bestCount;
    if (!(avgTicket > 0)) return null;
    const cups = Math.round(saving / avgTicket);
    if (cups < 1) return null;
    return {
      name: bestName,
      cups,
    };
  }, [saving, selectedOption]);

  const handlePercentChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPercent(clampPercent(Number(event.target.value)));
  };

  const handleCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedKey(event.target.value || null);
  };

  const handleReset = () => {
    if (categoryOptions.length) {
      setSelectedKey(categoryOptions[0].key);
    } else {
      setSelectedKey(null);
    }
    setPercent(DEFAULT_PERCENT);
  };

  if (!categoryOptions.length) {
    return (
      <section className="rounded-xl border border-border bg-surface-1 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">What-if Planner</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Belum ada pengeluaran bulan ini untuk dihitung. Tambahkan transaksi untuk melihat simulasi penghematan.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface-1 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">What-if Planner</h2>
          <p className="text-sm text-muted-foreground">
            Simulasikan penghematan dengan mengurangi pengeluaran kategori pilihanmu.
          </p>
        </div>
        <button type="button" className="btn btn-secondary self-start sm:self-auto" onClick={handleReset}>
          Reset
        </button>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,260px)_1fr] sm:items-start">
        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor={selectId} className="text-sm font-medium">
              Kategori terbesar bulan ini
            </label>
            <select
              id={selectId}
              className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={selectedOption?.key ?? ""}
              onChange={handleCategoryChange}
            >
              {categoryOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Total pengeluaran: {formatCurrency(spent, "IDR")} bulan ini.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Pengurangan pengeluaran</span>
              <span>{percent}%</span>
            </div>
            <input
              id={sliderId}
              type="range"
              min={0}
              max={MAX_PERCENT}
              step={1}
              value={percent}
              onChange={handlePercentChange}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>80%</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-surface-2 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Estimated Saving
              </div>
              <div className="mt-2 text-lg font-semibold">{formatCurrency(saving, "IDR")}</div>
            </div>
            <div className="rounded-lg bg-surface-2 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Proyeksi sisa budget kategori
              </div>
              <div className="mt-2 text-lg font-semibold">{formatCurrency(projectedBudget, "IDR")}</div>
            </div>
            <div className="rounded-lg bg-surface-2 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Dampak ke cashflow bulan ini
              </div>
              <div className="mt-2 text-lg font-semibold">{formatCurrency(projectedCashflow, "IDR")}</div>
            </div>
          </div>
          {dominantMerchant ? (
            <div className="rounded-lg border border-dashed border-border bg-surface-1 p-4 text-sm text-muted-foreground">
              Penghematanmu setara dengan ≈ {NUMBER_FORMAT.format(dominantMerchant.cups)} gelas boba di {" "}
              <span className="font-medium text-foreground">{dominantMerchant.name}</span>.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
