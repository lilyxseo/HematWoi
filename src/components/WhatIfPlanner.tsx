import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type Nullable<T> = T | null | undefined;

type Transaction = {
  date?: Nullable<string>;
  type?: Nullable<string>;
  amount?: Nullable<number>;
  category?: Nullable<string>;
  category_id?: Nullable<string>;
  merchant?: Nullable<string>;
  merchant_id?: Nullable<string>;
};

type Budget = {
  month?: Nullable<string>;
  amount_planned?: Nullable<number>;
  planned?: Nullable<number>;
  category?: Nullable<string>;
  category_id?: Nullable<string>;
  categoryId?: Nullable<string>;
  name?: Nullable<string>;
  label?: Nullable<string>;
};

interface WhatIfPlannerProps {
  transactions?: Transaction[];
  budgets?: Budget[];
  userId?: string | null;
}

interface CategorySummary {
  key: string;
  categoryId: string | null;
  label: string;
  total: number;
}

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const quantityFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 1,
});

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(80, Math.max(0, Math.round(value)));
};

const monthKeyNow = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const toNumber = (value: Nullable<number>) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeMonth = (value: Nullable<string>) =>
  value ? String(value).slice(0, 7) : null;

const matchCategory = (summary: CategorySummary, tx: Transaction) => {
  const txCategoryId = tx.category_id ?? null;
  if (summary.categoryId && txCategoryId) {
    return summary.categoryId === txCategoryId;
  }
  const label = tx.category ?? "Tanpa kategori";
  return !summary.categoryId && summary.label === label;
};

const resolveBudgetLabel = (budget: Budget) =>
  budget.label ?? budget.name ?? budget.category ?? "Tanpa kategori";

export default function WhatIfPlanner({
  transactions = [],
  budgets = [],
  userId = null,
}: WhatIfPlannerProps) {
  const monthKey = useMemo(monthKeyNow, []);
  const storageKey = useMemo(
    () => `hw:whatif:last:${userId ?? "local"}`,
    [userId]
  );
  const restoredRef = useRef(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [percent, setPercent] = useState<number>(0);

  useEffect(() => {
    restoredRef.current = false;
  }, [storageKey]);

  const monthlyTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (!tx || tx.type !== "expense") return false;
      const month = normalizeMonth(tx.date ?? null);
      if (!month) return false;
      return month === monthKey;
    });
  }, [transactions, monthKey]);

  const monthlyIncomeExpense = useMemo(() => {
    return transactions.reduce(
      (acc, tx) => {
        if (!tx?.date) return acc;
        const month = normalizeMonth(tx.date);
        if (month !== monthKey) return acc;
        const amount = toNumber(tx.amount);
        if (tx.type === "income") {
          acc.income += amount;
        } else if (tx.type === "expense") {
          acc.expense += amount;
        }
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [transactions, monthKey]);

  const categories = useMemo<CategorySummary[]>(() => {
    const map = new Map<string, CategorySummary>();
    monthlyTransactions.forEach((tx) => {
      const categoryId = tx.category_id ?? null;
      const label = tx.category ?? "Tanpa kategori";
      const key = categoryId ?? `name::${label}`;
      const amount = toNumber(tx.amount);
      if (amount <= 0) return;
      const current = map.get(key);
      if (current) {
        current.total += amount;
      } else {
        map.set(key, {
          key,
          categoryId,
          label,
          total: amount,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [monthlyTransactions]);

  useEffect(() => {
    if (!categories.length) {
      setSelectedKey(null);
      return;
    }
    if (!restoredRef.current) {
      restoredRef.current = true;
      let savedPercent: number | null = null;
      let savedCategoryId: string | null = null;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.percent === "number") {
            savedPercent = clampPercent(parsed.percent);
          }
          if (typeof parsed?.categoryId === "string") {
            savedCategoryId = parsed.categoryId;
          }
        }
      } catch {
        /* ignore corrupted storage */
      }
      if (savedPercent !== null) {
        setPercent(savedPercent);
      } else {
        setPercent(0);
      }
      if (savedCategoryId) {
        const match = categories.find(
          (item) => item.categoryId === savedCategoryId
        );
        if (match) {
          setSelectedKey(match.key);
          return;
        }
      }
      setSelectedKey(categories[0].key);
      return;
    }
    setSelectedKey((prev) => {
      if (prev && categories.some((item) => item.key === prev)) {
        return prev;
      }
      return categories[0].key;
    });
  }, [categories, storageKey]);

  const selectedCategory = useMemo(() => {
    if (!categories.length) return null;
    if (selectedKey) {
      const found = categories.find((item) => item.key === selectedKey);
      if (found) return found;
    }
    return categories[0];
  }, [categories, selectedKey]);

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedKey(event.target.value);
  };

  const handlePercentChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPercent(clampPercent(Number(event.target.value)));
  };

  const handleReset = () => {
    setPercent(0);
    if (categories.length) {
      setSelectedKey(categories[0].key);
    }
  };

  const selectedTransactions = useMemo(() => {
    if (!selectedCategory) return [];
    return monthlyTransactions.filter((tx) => matchCategory(selectedCategory, tx));
  }, [monthlyTransactions, selectedCategory]);

  const totalSpend = selectedCategory ? selectedCategory.total : 0;
  const saving = (totalSpend * percent) / 100;

  const budgetForCategory = useMemo(() => {
    if (!selectedCategory) return null;
    const monthBudgets = budgets.filter((budget) => {
      const budgetMonth = normalizeMonth(budget.month ?? null);
      return budgetMonth === monthKey;
    });
    const match = monthBudgets.find((budget) => {
      const budgetCategoryId =
        (budget.category_id ?? budget.categoryId) ?? null;
      if (selectedCategory.categoryId && budgetCategoryId) {
        return selectedCategory.categoryId === budgetCategoryId;
      }
      if (!selectedCategory.categoryId) {
        const label = resolveBudgetLabel(budget);
        return label === selectedCategory.label;
      }
      return false;
    });
    return match ?? null;
  }, [budgets, monthKey, selectedCategory]);

  const plannedBudget = useMemo(() => {
    if (!budgetForCategory) return 0;
    if (typeof budgetForCategory.amount_planned === "number") {
      return toNumber(budgetForCategory.amount_planned);
    }
    if (typeof budgetForCategory.planned === "number") {
      return toNumber(budgetForCategory.planned);
    }
    return 0;
  }, [budgetForCategory]);

  const projectedBudgetRemaining = plannedBudget - (totalSpend - saving);
  const cashflowNow = monthlyIncomeExpense.income - monthlyIncomeExpense.expense;
  const projectedCashflow = cashflowNow + saving;

  const dominantMerchant = useMemo(() => {
    if (!selectedTransactions.length || saving <= 0) return null;
    const merchantMap = new Map<string, { name: string; amount: number; count: number }>();
    selectedTransactions.forEach((tx) => {
      const merchantId = tx.merchant_id ?? null;
      const merchantLabel = tx.merchant ?? null;
      if (!merchantId && !merchantLabel) return;
      const key = merchantId ?? `name::${merchantLabel}`;
      const name = merchantLabel ?? "merchant favoritmu";
      const amount = toNumber(tx.amount);
      if (amount <= 0) return;
      const current = merchantMap.get(key);
      if (current) {
        current.amount += amount;
        current.count += 1;
      } else {
        merchantMap.set(key, { name, amount, count: 1 });
      }
    });
    const candidates = Array.from(merchantMap.values());
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.amount - a.amount);
    const top = candidates[0];
    if (!top || top.count === 0) return null;
    const average = top.amount / top.count;
    if (average <= 0) return null;
    const equivalent = saving / average;
    if (!Number.isFinite(equivalent) || equivalent <= 0.05) return null;
    return {
      name: top.name,
      equivalent,
    };
  }, [selectedTransactions, saving]);

  useEffect(() => {
    if (!selectedCategory) return;
    try {
      const payload = {
        categoryId: selectedCategory.categoryId,
        percent,
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      /* ignore storage errors */
    }
  }, [selectedCategory, percent, storageKey]);

  if (!categories.length) {
    return (
      <section className="rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-text">What-if Planner</h2>
          <p className="text-sm text-muted">
            Butuh transaksi pengeluaran bulan ini untuk mulai simulasi.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-text">What-if Planner</h2>
          <p className="text-sm text-muted">
            Simulasikan penghematan cepat untuk kategori pilihanmu bulan ini.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex h-9 items-center justify-center rounded-full border border-border/60 px-4 text-sm font-medium text-text transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          Reset
        </button>
      </div>

      <div className="mt-4 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-text">Kategori</span>
            <select
              value={selectedCategory?.key ?? ""}
              onChange={handleSelectChange}
              className="h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand/60"
            >
              {categories.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-text">Pengurangan pengeluaran</span>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={80}
                step={5}
                value={percent}
                onChange={handlePercentChange}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-border"
              />
              <span className="w-12 text-right text-sm font-semibold text-brand">
                {percent}%
              </span>
            </div>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/50 bg-surface-2/80 p-4">
            <p className="text-xs uppercase tracking-wide text-muted">
              Estimated Saving
            </p>
            <p className="mt-2 text-lg font-semibold text-success tabular-nums">
              {rupiahFormatter.format(Math.round(saving))}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-surface-2/80 p-4">
            <p className="text-xs uppercase tracking-wide text-muted">
              Sisa Budget Kategori
            </p>
            <p
              className={`mt-2 text-lg font-semibold tabular-nums ${
                projectedBudgetRemaining < 0 ? "text-danger" : "text-text"
              }`}
            >
              {rupiahFormatter.format(Math.round(projectedBudgetRemaining))}
            </p>
            {plannedBudget === 0 && (
              <p className="mt-1 text-[11px] text-muted">
                Belum ada anggaran tercatat bulan ini.
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border/50 bg-surface-2/80 p-4">
            <p className="text-xs uppercase tracking-wide text-muted">
              Cashflow Bulan Ini
            </p>
            <p
              className={`mt-2 text-lg font-semibold tabular-nums ${
                projectedCashflow < 0 ? "text-danger" : "text-text"
              }`}
            >
              {rupiahFormatter.format(Math.round(projectedCashflow))}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              Dari {rupiahFormatter.format(Math.round(cashflowNow))} sekarang.
            </p>
          </div>
        </div>

        {dominantMerchant && (
          <p className="text-sm text-muted">
            ≈ {quantityFormatter.format(dominantMerchant.equivalent)} gelas boba
            {dominantMerchant.name
              ? ` di ${dominantMerchant.name}`
              : ""}
          </p>
        )}
      </div>
    </section>
  );
}
