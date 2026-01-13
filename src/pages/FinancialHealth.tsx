import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CreditCard,
  LineChart,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Wallet,
  ListChecks,
} from "lucide-react";
import Page from "../layout/Page";
import PageHeader from "../layout/PageHeader";
import Card, { CardBody, CardHeader } from "../components/Card";
import Skeleton from "../components/Skeleton";
import FinancialHealthScoreCard from "../components/financial-health/FinancialHealthScoreCard";
import IndicatorCard from "../components/financial-health/IndicatorCard";
import InsightList, {
  type InsightItem,
} from "../components/financial-health/InsightList";
import PeriodToolbar from "../components/financial-health/PeriodToolbar";
import { formatCurrency } from "../lib/format";
import { listAccounts, listTransactions } from "../lib/api";
import { listDebts } from "../lib/api-debts";
import { dbCache } from "../lib/sync/localdb";
import useNetworkStatus from "../hooks/useNetworkStatus";
import { useRepo, useDataMode } from "../context/DataContext";

type RawRecord = Record<string, any>;

type NormalizedTransaction = {
  amount: number;
  type: "income" | "expense" | "transfer";
  date: string;
  month: string;
  categoryKey: string | number | null;
  categoryName: string;
};

type NormalizedBudget = {
  categoryKey: string | number | null;
  categoryName: string;
  cap: number;
  period: string | null;
};

type DebtLike = {
  amount?: number;
  tenor_months?: number;
  status?: string;
};

type HealthSnapshot = {
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
  debtRatio: number;
  budgetOverCount: number;
  budgetTotal: number;
  cashflowScore: number;
  savingsScore: number;
  debtScore: number;
  budgetScore: number;
  expenseStabilityRatio: number | null;
  expenseStabilityScore: number | null;
  expenseCoverageDays: number | null;
  expenseCoverageScore: number | null;
  totalScore: number;
  label: string;
};

const SCORE_LABELS = [
  { min: 80, label: "Sangat Sehat" },
  { min: 60, label: "Cukup Sehat" },
  { min: 40, label: "Perlu Perhatian" },
  { min: 0, label: "Tidak Sehat" },
];

const MONTH_LABEL =
  typeof Intl !== "undefined"
    ? new Intl.DateTimeFormat("id-ID", {
        month: "long",
        year: "numeric",
      })
    : null;

function getMonthKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthLabel(key: string) {
  if (!key) return "";
  const [year, month] = key.split("-").map((value) => Number.parseInt(value, 10));
  if (!year || !month) return key;
  const date = new Date(year, month - 1, 1);
  return MONTH_LABEL ? MONTH_LABEL.format(date) : key;
}

function parseMonthInput(value: string) {
  if (!value) return null;
  const [year, month] = value.split("-").map((entry) => Number.parseInt(entry, 10));
  if (!year || !month) return null;
  return new Date(year, month - 1, 1);
}

function buildMonthRange(start: Date, end: Date) {
  const values: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const limit = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= limit) {
    values.push(getMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return values;
}

function safeNumber(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getCategoryKey(value: any) {
  if (value == null) return null;
  if (typeof value === "object") return value.id ?? value.uuid ?? null;
  return value;
}

function normalizeTransactions(
  transactions: RawRecord[] = [],
  categoriesById: Map<string | number, string>
): NormalizedTransaction[] {
  return transactions
    .map((tx) => {
      const rawDate =
        tx.date || tx.transaction_date || tx.created_at || tx.posted_at || tx.createdAt;
      const iso = rawDate ? String(rawDate) : new Date().toISOString();
      const month = iso.slice(0, 7);
      const typeValue = (tx.type || tx.transaction_type || "").toString();
      let type: NormalizedTransaction["type"];
      if (typeValue === "income" || typeValue === "expense" || typeValue === "transfer") {
        type = typeValue;
      } else if (Number(tx.amount) < 0) {
        type = "expense";
      } else {
        type = "income";
      }
      const amount = Math.abs(safeNumber(tx.amount));
      const categoryKey = getCategoryKey(
        tx.category_id ?? tx.categoryId ?? tx.category_uuid ?? tx.category
      );
      const categoryName =
        tx.category?.name ||
        tx.category_name ||
        (categoryKey != null ? categoriesById.get(categoryKey) : null) ||
        "Lainnya";
      return {
        amount,
        type,
        date: iso,
        month,
        categoryKey,
        categoryName,
      };
    })
    .filter(Boolean);
}

function normalizeBudgets(
  budgets: RawRecord[] = [],
  categoriesById: Map<string | number, string>
): NormalizedBudget[] {
  return budgets
    .map((item) => {
      const rawCap =
        item.amount_planned ??
        item.limit ??
        item.cap ??
        item.amount ??
        item.budget ??
        0;
      const cap = safeNumber(rawCap);
      const periodSource =
        item.period ?? item.month ?? item.for_month ?? item.date ?? item.created_at;
      const period = typeof periodSource === "string" ? periodSource.slice(0, 7) : null;
      const categoryKey = getCategoryKey(
        item.category_id ?? item.categoryId ?? item.category_uuid ?? item.category
      );
      const categoryName =
        item.category?.name ||
        item.category_name ||
        (categoryKey != null ? categoriesById.get(categoryKey) : null) ||
        "Tanpa kategori";
      return {
        categoryKey,
        categoryName,
        cap,
        period,
      };
    })
    .filter(Boolean);
}

function computeCashflowScore(net: number, income: number, expense: number) {
  if (income <= 0 && expense <= 0) return 0;
  if (income <= 0) return 10;
  const ratio = net / income;
  if (ratio >= 0.2) return 100;
  if (ratio >= 0) return 60 + (ratio / 0.2) * 40;
  const deficitRatio = Math.min(Math.abs(ratio), 1);
  return Math.max(0, 60 - deficitRatio * 60);
}

function computeSavingsScore(savingsRate: number, income: number) {
  if (income <= 0) return 0;
  if (savingsRate <= 0) return 20;
  if (savingsRate < 0.1) return 40 + (savingsRate / 0.1) * 20;
  if (savingsRate < 0.2) return 60 + ((savingsRate - 0.1) / 0.1) * 20;
  if (savingsRate < 0.4) return 80 + ((savingsRate - 0.2) / 0.2) * 20;
  return 100;
}

function computeDebtScore(debtRatio: number, income: number) {
  if (income <= 0) return 0;
  if (debtRatio <= 0) return 100;
  if (debtRatio <= 0.3) return 100 - (debtRatio / 0.3) * 40;
  if (debtRatio <= 0.6) return 60 - ((debtRatio - 0.3) / 0.3) * 40;
  return 10;
}

function computeBudgetScore(overCount: number, total: number) {
  if (total <= 0) return 50;
  const ratio = Math.min(overCount / total, 1);
  return Math.max(0, 100 - ratio * 100);
}

function computeStandardDeviation(values: number[]) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
}

function buildDailyExpenseSeries(
  transactions: NormalizedTransaction[],
  start: Date,
  end: Date
) {
  const totals = new Map<string, number>();
  transactions
    .filter((tx) => tx.type === "expense")
    .forEach((tx) => {
      const key = tx.date.slice(0, 10);
      totals.set(key, (totals.get(key) ?? 0) + tx.amount);
    });

  const values: number[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= endDate) {
    const key = cursor.toISOString().slice(0, 10);
    values.push(totals.get(key) ?? 0);
    cursor.setDate(cursor.getDate() + 1);
  }
  return values;
}

function computeExpenseStabilityScore(stabilityRatio: number) {
  if (stabilityRatio < 0.3) {
    return 90 + ((0.3 - stabilityRatio) / 0.3) * 10;
  }
  if (stabilityRatio < 0.6) {
    return 60 + ((0.6 - stabilityRatio) / 0.3) * 29;
  }
  const normalized = Math.min((stabilityRatio - 0.6) / 0.6, 1);
  return Math.max(0, 59 - normalized * 59);
}

function computeExpenseCoverageScore(coverageDays: number) {
  if (coverageDays < 7) {
    return 10 + (coverageDays / 7) * 20;
  }
  if (coverageDays < 30) {
    return 31 + ((coverageDays - 7) / 23) * 29;
  }
  if (coverageDays < 90) {
    return 61 + ((coverageDays - 30) / 60) * 24;
  }
  return 86 + Math.min((coverageDays - 90) / 90, 1) * 14;
}

function getHealthLabel(score: number) {
  const match = SCORE_LABELS.find((entry) => score >= entry.min);
  return match ? match.label : "Tidak Sehat";
}

function buildHealthSnapshot(params: {
  transactions: NormalizedTransaction[];
  budgets: NormalizedBudget[];
  debts: DebtLike[];
  accounts: RawRecord[];
  months: string[];
  start: Date;
  end: Date;
}): HealthSnapshot {
  const { transactions, budgets, debts, accounts, months, start, end } = params;
  const startIso = start.toISOString().slice(0, 10);
  const endIso = end.toISOString().slice(0, 10);
  const inRange = transactions.filter(
    (tx) => tx.date.slice(0, 10) >= startIso && tx.date.slice(0, 10) <= endIso
  );
  const income = inRange
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const expense = inRange
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const net = income - expense;
  const savingsRate = income > 0 ? net / income : 0;

  const monthlyIncome = months.length ? income / months.length : income;
  const debtMonthly = debts
    .filter((debt) => debt?.status !== "paid")
    .reduce((sum, debt) => {
      const amount = safeNumber(debt?.amount);
      const tenor = Math.max(1, safeNumber(debt?.tenor_months ?? 1));
      return sum + amount / tenor;
    }, 0);
  const debtRatio = monthlyIncome > 0 ? debtMonthly / monthlyIncome : 0;
  const totalBalance = accounts.reduce(
    (sum, account) => sum + safeNumber(account?.balance),
    0
  );

  const dailyExpenses = buildDailyExpenseSeries(inRange, start, end);
  const avgDailyExpense =
    dailyExpenses.length > 0
      ? dailyExpenses.reduce((sum, value) => sum + value, 0) / dailyExpenses.length
      : 0;
  const expenseDeviation = computeStandardDeviation(dailyExpenses);
  const expenseStabilityRatio =
    avgDailyExpense > 0 ? expenseDeviation / avgDailyExpense : null;
  const expenseStabilityScore =
    expenseStabilityRatio == null
      ? null
      : computeExpenseStabilityScore(expenseStabilityRatio);

  const expenseCoverageDays =
    avgDailyExpense > 0 ? totalBalance / avgDailyExpense : null;
  const expenseCoverageScore =
    expenseCoverageDays == null
      ? null
      : computeExpenseCoverageScore(expenseCoverageDays);

  const monthsSet = new Set(months);
  const spendByMonthCategory = new Map<string, number>();
  inRange
    .filter((tx) => tx.type === "expense")
    .forEach((tx) => {
      const key = `${tx.month}:${tx.categoryKey ?? "uncat"}`;
      spendByMonthCategory.set(
        key,
        (spendByMonthCategory.get(key) ?? 0) + tx.amount
      );
    });

  const budgetEntries = budgets.map((budget) => ({
    ...budget,
    period: budget.period ?? months[months.length - 1] ?? getMonthKey(new Date()),
  }));
  const budgetsInRange = budgetEntries.filter((budget) =>
    monthsSet.has(String(budget.period))
  );
  const overBudget = budgetsInRange.filter((budget) => {
    if (!budget.cap || budget.cap <= 0) return false;
    const key = `${budget.period}:${budget.categoryKey ?? "uncat"}`;
    const spent = spendByMonthCategory.get(key) ?? 0;
    return spent > budget.cap;
  });

  const cashflowScore = computeCashflowScore(net, income, expense);
  const savingsScore = computeSavingsScore(savingsRate, income);
  const debtScore = computeDebtScore(debtRatio, income);
  const budgetScore = computeBudgetScore(overBudget.length, budgetsInRange.length);
  const weightedScores = [
    { score: cashflowScore, weight: 0.25 },
    { score: savingsScore, weight: 0.2 },
    { score: debtScore, weight: 0.2 },
    { score: budgetScore, weight: 0.15 },
    { score: expenseStabilityScore, weight: 0.1 },
    { score: expenseCoverageScore, weight: 0.1 },
  ].filter((entry) => entry.score != null);
  const totalWeight = weightedScores.reduce((sum, entry) => sum + entry.weight, 0);
  const totalScore = totalWeight
    ? Math.round(
        weightedScores.reduce((sum, entry) => sum + entry.score * entry.weight, 0) /
          totalWeight
      )
    : 0;

  return {
    income,
    expense,
    net,
    savingsRate,
    debtRatio,
    budgetOverCount: overBudget.length,
    budgetTotal: budgetsInRange.length,
    cashflowScore,
    savingsScore,
    debtScore,
    budgetScore,
    expenseStabilityRatio,
    expenseStabilityScore,
    expenseCoverageDays,
    expenseCoverageScore,
    totalScore,
    label: getHealthLabel(totalScore),
  };
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${(value * 100).toFixed(1)}%`;
}

export default function FinancialHealth() {
  const currentMonth = getMonthKey(new Date());
  const [periodMode, setPeriodMode] = useState<"single" | "range">("single");
  const [singleMonth, setSingleMonth] = useState(currentMonth);
  const [rangeStart, setRangeStart] = useState(currentMonth);
  const [rangeEnd, setRangeEnd] = useState(currentMonth);

  const { start, end, months } = useMemo(() => {
    if (periodMode === "single") {
      const monthDate = parseMonthInput(singleMonth) ?? new Date();
      const rangeStartDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const rangeEndDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);
      return {
        start: rangeStartDate,
        end: rangeEndDate,
        months: buildMonthRange(rangeStartDate, rangeEndDate),
      };
    }
    const parsedStart = parseMonthInput(rangeStart) ?? new Date();
    const parsedEnd = parseMonthInput(rangeEnd) ?? parsedStart;
    const rangeStartDate = parsedStart <= parsedEnd ? parsedStart : parsedEnd;
    const rangeEndDate = parsedStart <= parsedEnd ? parsedEnd : parsedStart;
    const endOfRange = new Date(
      rangeEndDate.getFullYear(),
      rangeEndDate.getMonth() + 1,
      0,
      23,
      59,
      59
    );
    return {
      start: rangeStartDate,
      end: endOfRange,
      months: buildMonthRange(rangeStartDate, rangeEndDate),
    };
  }, [periodMode, singleMonth, rangeStart, rangeEnd]);
  const online = useNetworkStatus();
  const { mode } = useDataMode();
  const repo = useRepo();

  const categoriesQuery = useQuery({
    queryKey: ["financial-health", "categories", mode],
    queryFn: () => repo.categories.list(),
    staleTime: 5 * 60 * 1000,
    placeholderData: (previous) => previous,
  });

  const transactionsQuery = useQuery({
    queryKey: ["financial-health", "transactions", mode, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      if (mode === "local") {
        return repo.transactions.list();
      }
      const startIso = start.toISOString().slice(0, 10);
      const endIso = end.toISOString().slice(0, 10);
      const { rows } = await listTransactions({
        period: { preset: "custom", start: startIso, end: endIso },
        pageSize: 5000,
        page: 1,
      });
      return rows || [];
    },
    staleTime: 60 * 1000,
    placeholderData: (previous) => previous,
  });

  const budgetsQuery = useQuery({
    queryKey: ["financial-health", "budgets", mode],
    queryFn: () => repo.budgets.list(),
    staleTime: 5 * 60 * 1000,
    placeholderData: (previous) => previous,
  });

  const goalsQuery = useQuery({
    queryKey: ["financial-health", "goals", mode],
    queryFn: () => repo.goals.list(),
    staleTime: 5 * 60 * 1000,
    placeholderData: (previous) => previous,
  });

  const accountsQuery = useQuery({
    queryKey: ["financial-health", "accounts", mode],
    queryFn: () => listAccounts(),
    staleTime: 5 * 60 * 1000,
    placeholderData: (previous) => previous,
  });

  const debtsQuery = useQuery({
    queryKey: ["financial-health", "debts", mode, online],
    queryFn: async () => {
      if (!online || mode === "local") {
        const cached = await dbCache.list("debts");
        return Array.isArray(cached) ? cached : [];
      }
      const response = await listDebts();
      return response.items || [];
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (previous) => previous,
  });

  const isLoading =
    transactionsQuery.isLoading ||
    budgetsQuery.isLoading ||
    categoriesQuery.isLoading ||
    goalsQuery.isLoading ||
    accountsQuery.isLoading ||
    debtsQuery.isLoading;

  const categoriesById = useMemo(() => {
    const map = new Map<string | number, string>();
    const categories = Array.isArray(categoriesQuery.data)
      ? categoriesQuery.data
      : [];
    categories.forEach((cat) => {
      if (!cat) return;
      const id = cat.id ?? cat.uuid;
      if (id != null) map.set(id, cat.name ?? "Lainnya");
    });
    return map;
  }, [categoriesQuery.data]);

  const normalizedTransactions = useMemo(() => {
    const rows = Array.isArray(transactionsQuery.data)
      ? transactionsQuery.data
      : [];
    return normalizeTransactions(rows, categoriesById);
  }, [transactionsQuery.data, categoriesById]);

  const normalizedBudgets = useMemo(() => {
    const rows = Array.isArray(budgetsQuery.data) ? budgetsQuery.data : [];
    return normalizeBudgets(rows, categoriesById);
  }, [budgetsQuery.data, categoriesById]);

  const debts = useMemo(
    () => (Array.isArray(debtsQuery.data) ? debtsQuery.data : []),
    [debtsQuery.data]
  );

  const snapshot = useMemo(() => {
    return buildHealthSnapshot({
      transactions: normalizedTransactions,
      budgets: normalizedBudgets,
      debts,
      accounts: Array.isArray(accountsQuery.data) ? accountsQuery.data : [],
      months,
      start,
      end,
    });
  }, [
    normalizedTransactions,
    normalizedBudgets,
    debts,
    accountsQuery.data,
    months,
    start,
    end,
  ]);

  const comparison = useMemo(() => {
    const monthsCount = Math.max(1, months.length);
    const previousStart = new Date(start.getFullYear(), start.getMonth() - monthsCount, 1);
    const previousEnd = new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59);
    const previousMonths = buildMonthRange(previousStart, previousEnd);
    const previousSnapshot = buildHealthSnapshot({
      transactions: normalizedTransactions,
      budgets: normalizedBudgets,
      debts,
      accounts: Array.isArray(accountsQuery.data) ? accountsQuery.data : [],
      months: previousMonths,
      start: previousStart,
      end: previousEnd,
    });
    const delta = snapshot.totalScore - previousSnapshot.totalScore;
    if (!Number.isFinite(delta) || previousSnapshot.totalScore === 0) {
      return null;
    }
    const change = (delta / previousSnapshot.totalScore) * 100;
    return {
      direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
      value: Math.abs(change),
      label: `vs ${getMonthLabel(previousMonths[previousMonths.length - 1])}`,
    };
  }, [
    snapshot.totalScore,
    normalizedTransactions,
    normalizedBudgets,
    debts,
    accountsQuery.data,
    start,
    months.length,
  ]);

  const insights = useMemo(() => {
    const items: InsightItem[] = [];
    const hasTransactions = normalizedTransactions.length > 0;
    if (!hasTransactions) {
      items.push({
        id: "no-transactions",
        title: "Belum ada transaksi",
        description: "Catat pemasukan dan pengeluaran agar skor finansial bisa dihitung dengan akurat.",
        severity: "low",
        ctaLabel: "Catat Transaksi",
        ctaHref: "/transaction/add",
      });
    }

    if (snapshot.net < 0) {
      items.push({
        id: "cashflow-deficit",
        title: "Cashflow defisit",
        description: "Pengeluaranmu lebih besar dari pemasukan pada periode ini.",
        severity: "high",
        ctaLabel: "Perbarui Budget",
        ctaHref: "/budgets",
      });
    }

    if (snapshot.savingsRate <= 0) {
      items.push({
        id: "no-savings",
        title: "Tabungan 0%",
        description: "Tidak ada sisa untuk ditabung. Coba alokasikan dana untuk goal tabungan.",
        severity: "high",
        ctaLabel: "Buat Goal Tabungan",
        ctaHref: "/goals",
      });
    } else if (snapshot.savingsRate < 0.1) {
      items.push({
        id: "low-savings",
        title: "Savings rate rendah",
        description: "Rasio tabungan masih di bawah 10%.", 
        severity: "medium",
        ctaLabel: "Buat Goal Tabungan",
        ctaHref: "/goals",
      });
    }

    if (snapshot.debtRatio > 0.3) {
      items.push({
        id: "debt-ratio",
        title: "Rasio hutang tinggi",
        description: "Total cicilan bulananmu melebihi 30% dari pemasukan.",
        severity: snapshot.debtRatio > 0.5 ? "high" : "medium",
        ctaLabel: "Lihat Hutang",
        ctaHref: "/debts",
      });
    }

    const budgetsInRange = normalizedBudgets.filter((budget) =>
      months.includes(String(budget.period ?? months[months.length - 1]))
    );
    if (budgetsInRange.length === 0) {
      items.push({
        id: "no-budgets",
        title: "Belum ada budget",
        description: "Buat budget untuk menjaga pengeluaran tetap terkendali.",
        severity: "low",
        ctaLabel: "Buat Budget",
        ctaHref: "/budgets",
      });
    }

    const spendByMonthCategory = new Map<string, number>();
    normalizedTransactions
      .filter((tx) => tx.type === "expense")
      .forEach((tx) => {
        const key = `${tx.month}:${tx.categoryKey ?? "uncat"}`;
        spendByMonthCategory.set(
          key,
          (spendByMonthCategory.get(key) ?? 0) + tx.amount
        );
      });
    const overBudgets = budgetsInRange.filter((budget) => {
      if (!budget.cap || budget.cap <= 0) return false;
      const key = `${budget.period ?? months[months.length - 1]}:${budget.categoryKey ?? "uncat"}`;
      return (spendByMonthCategory.get(key) ?? 0) > budget.cap;
    });
    if (overBudgets.length > 0) {
      const budgetNames = overBudgets
        .map((budget) => budget.categoryName)
        .filter(Boolean)
        .join(", ");
      items.push({
        id: "over-budget",
        title: "Ada kategori yang over-budget",
        description: budgetNames
          ? `Kategori: ${budgetNames}.`
          : "Beberapa kategori melebihi batas yang kamu tetapkan.",
        severity: "medium",
        ctaLabel: "Perbarui Budget",
        ctaHref: "/budgets",
      });
    }

    const goals = Array.isArray(goalsQuery.data) ? goalsQuery.data : [];
    if (snapshot.savingsRate > 0 && goals.length === 0) {
      items.push({
        id: "no-goals",
        title: "Belum punya goal tabungan",
        description: "Buat goal agar tabungan punya target jelas.",
        severity: "low",
        ctaLabel: "Buat Goal Tabungan",
        ctaHref: "/goals",
      });
    }

    return items;
  }, [
    normalizedTransactions,
    snapshot,
    normalizedBudgets,
    months,
    accountsQuery.data,
    goalsQuery.data,
  ]);

  const cashflowStatus = snapshot.net >= 0 ? "Surplus" : "Defisit";
  const savingsStatus =
    snapshot.savingsRate < 0.1
      ? "Perlu perhatian"
      : snapshot.savingsRate < 0.2
        ? "Bisa ditingkatkan"
        : "Baik";
  const debtStatus = snapshot.debtRatio > 0.3 ? "Perlu perhatian" : "Aman";
  const budgetStatus =
    snapshot.budgetTotal === 0
      ? "Belum ada budget"
      : snapshot.budgetOverCount === 0
        ? "Semua on-track"
        : `${snapshot.budgetOverCount} kategori over-budget`;
  const expenseStabilityStatus =
    snapshot.expenseStabilityScore == null
      ? "Belum cukup data"
      : snapshot.expenseStabilityRatio != null &&
          snapshot.expenseStabilityRatio < 0.3
        ? "Pengeluaran harian relatif konsisten"
        : snapshot.expenseStabilityRatio != null &&
            snapshot.expenseStabilityRatio < 0.6
          ? "Masih ada variasi, tapi cukup terkendali"
          : "Ada lonjakan pengeluaran di hari tertentu";
  const expenseStabilityValue =
    snapshot.expenseStabilityScore == null
      ? "Belum cukup data"
      : snapshot.expenseStabilityRatio != null &&
          snapshot.expenseStabilityRatio < 0.3
        ? "Stabil"
        : snapshot.expenseStabilityRatio != null &&
            snapshot.expenseStabilityRatio < 0.6
          ? "Cukup Stabil"
          : "Tidak Stabil";
  const coverageDays = snapshot.expenseCoverageDays;
  const expenseCoverageValue =
    coverageDays == null
      ? "Belum cukup data"
      : `Saldo cukup untuk ±${Math.max(0, Math.round(coverageDays))} hari`;
  const expenseCoverageStatus =
    coverageDays == null
      ? "Belum cukup data"
      : coverageDays < 7
        ? "Perlu perhatian"
        : coverageDays < 30
          ? "Bisa ditingkatkan"
          : coverageDays < 90
            ? "Aman"
            : "Sangat aman";
  const isEmpty = normalizedTransactions.length === 0;

  return (
    <Page>
      <PageHeader
        title="Financial Health"
        description="Ringkasan kesehatan keuanganmu bulan ini"
      >
        <PeriodToolbar
          mode={periodMode}
          singleMonth={singleMonth}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onModeChange={setPeriodMode}
          onSingleMonthChange={setSingleMonth}
          onRangeStartChange={setRangeStart}
          onRangeEndChange={setRangeEnd}
        />
        {!online || mode === "local" ? (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700">
            Offline Mode
          </span>
        ) : null}
      </PageHeader>

      <div className="space-y-6">
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <FinancialHealthScoreCard
            score={snapshot.totalScore}
            label={snapshot.label}
            subtitle={
              periodMode === "single"
                ? `Periode ${getMonthLabel(months[0])}`
                : `Periode ${getMonthLabel(months[0])} - ${getMonthLabel(
                    months[months.length - 1]
                  )}`
            }
            comparison={comparison}
            isEmpty={isEmpty}
          />
        )}

        <Card>
          <CardHeader
            title="Breakdown Indikator"
            subtext="Lihat faktor utama yang memengaruhi skor finansialmu."
          />
          <CardBody>
            <div className="grid gap-4 md:grid-cols-2">
              {isLoading ? (
                <>
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                </>
              ) : (
                <>
                  <IndicatorCard
                    title="Cashflow Health"
                    icon={<Wallet className="h-5 w-5" />}
                    value={formatCurrency(snapshot.net)}
                    status={`${cashflowStatus} · income ${formatCurrency(snapshot.income)}`}
                    score={snapshot.cashflowScore}
                    infoTitle="Cashflow Health"
                    infoPoints={[
                      "Apa artinya: selisih pemasukan & pengeluaran.",
                      "Cara hitung: (income - expense) dibanding income.",
                      "Target sehat: surplus ≥20%.",
                    ]}
                  />
                  <IndicatorCard
                    title="Savings Rate"
                    icon={<PiggyBank className="h-5 w-5" />}
                    value={formatPercent(snapshot.savingsRate)}
                    status={`${savingsStatus} · target >20%`}
                    score={snapshot.savingsScore}
                    infoTitle="Savings Rate"
                    infoPoints={[
                      "Apa artinya: porsi tabungan dari pemasukan.",
                      "Cara hitung: (income - expense) / income.",
                      "Target sehat: >20%.",
                    ]}
                  />
                  <IndicatorCard
                    title="Debt Ratio"
                    icon={<CreditCard className="h-5 w-5" />}
                    value={formatPercent(snapshot.debtRatio)}
                    status={`${debtStatus} · batas 30%`}
                    score={snapshot.debtScore}
                    infoTitle="Debt Ratio"
                    infoPoints={[
                      "Apa artinya: cicilan bulanan dibanding pemasukan.",
                      "Cara hitung: total cicilan / pemasukan bulanan.",
                      "Target sehat: <30%.",
                    ]}
                  />
                  <IndicatorCard
                    title="Budget Discipline"
                    icon={<ListChecks className="h-5 w-5" />}
                    value={`${snapshot.budgetOverCount}/${snapshot.budgetTotal} over-budget`}
                    status={budgetStatus}
                    score={snapshot.budgetScore}
                    infoTitle="Budget Discipline"
                    infoPoints={[
                      "Apa artinya: kategori yang melewati batas budget.",
                      "Cara hitung: jumlah over-budget / total kategori.",
                      "Target sehat: 0 kategori over-budget.",
                    ]}
                  />
                  <IndicatorCard
                    title="Expense Stability"
                    icon={<LineChart className="h-5 w-5" />}
                    value={expenseStabilityValue}
                    status={expenseStabilityStatus}
                    score={snapshot.expenseStabilityScore}
                    infoTitle="Expense Stability"
                    infoPoints={[
                      "Apa artinya: konsistensi pengeluaran harian.",
                      "Cara hitung: standar deviasi / rata-rata harian.",
                      "Target sehat: rasio variasi <0.3.",
                    ]}
                  />
                  <IndicatorCard
                    title="Expense Coverage"
                    icon={<CalendarDays className="h-5 w-5" />}
                    value={expenseCoverageValue}
                    status={expenseCoverageStatus}
                    score={snapshot.expenseCoverageScore}
                    infoTitle="Expense Coverage"
                    infoPoints={[
                      "Apa artinya: berapa lama saldo cukup menutup pengeluaran.",
                      "Cara hitung: total saldo / pengeluaran harian rata-rata.",
                      "Target sehat: ≥30 hari.",
                    ]}
                  />
                </>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Insight & Warning"
            subtext="Prioritas yang perlu ditindaklanjuti dari kondisi finansialmu."
          />
          <CardBody>
            {isLoading ? <Skeleton className="h-32 w-full" /> : <InsightList insights={insights} />}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Ringkasan Action"
            subtext="Rekomendasi praktis untuk meningkatkan skor finansialmu."
          />
          <CardBody>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="text-sm font-semibold text-text">Naikkan savings rate</p>
                    <p className="text-xs text-muted">
                      Sisihkan minimal 10% dari pemasukan setiap bulan.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
                <div className="flex items-center gap-3">
                  <TrendingDown className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-sm font-semibold text-text">Kontrol cicilan</p>
                    <p className="text-xs text-muted">
                      Pastikan rasio hutang di bawah 30% pemasukan.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
                <div className="flex items-center gap-3">
                  <ListChecks className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-semibold text-text">Disiplin budget</p>
                    <p className="text-xs text-muted">
                      Kurangi kategori yang over-budget agar cashflow stabil.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
                <div className="flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-violet-500" />
                  <div>
                    <p className="text-sm font-semibold text-text">Bangun dana darurat</p>
                    <p className="text-xs text-muted">
                      Siapkan minimal 1x pengeluaran bulanan di saldo akun.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </Page>
  );
}
