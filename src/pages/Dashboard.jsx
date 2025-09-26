import { useEffect, useMemo, useState } from "react";
import QuoteBoard from "../components/QuoteBoard";
import SavingsProgress from "../components/SavingsProgress";
import AchievementBadges from "../components/AchievementBadges";
import QuickActions from "../components/QuickActions";
import BudgetStatusHighlights from "../components/BudgetStatusHighlights";
import SectionHeader from "../components/SectionHeader";
import MonthlyTrendChart from "../components/MonthlyTrendChart";
import CategoryDonut from "../components/CategoryDonut";
import TopSpendsTable from "../components/TopSpendsTable";
import RecentTransactions from "../components/RecentTransactions";
import useInsights from "../hooks/useInsights";
import EventBus from "../lib/eventBus";
import DashboardSummary from "../components/dashboard/DashboardSummary";
import PeriodPicker, {
  getPresetRange,
} from "../components/dashboard/PeriodPicker";
import useDashboardBalances from "../hooks/useDashboardBalances";
import DailyDigestModal from "../components/DailyDigestModal";
import useShowDigestOnLogin from "../hooks/useShowDigestOnLogin";
import { loadSubscriptions, findUpcoming, nextDue } from "../lib/subscriptions";

const DATE_LABEL = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const CURRENCY = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
});

function formatCurrency(value) {
  const numeric = Number.isFinite(Number(value)) ? Number(value) : 0;
  return CURRENCY.format(Math.round(numeric));
}

function normalizeBudgetStatus(items = []) {
  return items
    .map((item) => {
      const pct = Number.isFinite(Number(item?.pct)) ? Number(item.pct) : 0;
      const actual = Number.isFinite(Number(item?.actual)) ? Number(item.actual) : null;
      const planned = Number.isFinite(Number(item?.planned)) ? Number(item.planned) : null;
      const label = item?.category || "Tanpa kategori";
      let status = "ok";
      if (pct >= 100) status = "danger";
      else if (pct >= 80) status = "warning";
      return { pct, actual, planned, label, status };
    })
    .filter((entry) => entry.pct > 0)
    .sort((a, b) => b.pct - a.pct);
}

function collectTopCategories(transactions = [], referenceDate = new Date()) {
  const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const totals = new Map();
  for (const tx of transactions) {
    if (!tx) continue;
    if (tx.type !== "expense") continue;
    const txDate = new Date(tx.date);
    if (Number.isNaN(txDate.getTime())) continue;
    if (txDate < monthStart) continue;
    const category = tx.category || tx.category_name || "Tanpa kategori";
    const amount = Number(tx.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    totals.set(category, (totals.get(category) || 0) + amount);
  }
  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, amount]) => ({ name, amount }));
}

function gatherUpcomingSubscriptions() {
  try {
    const subs = loadSubscriptions();
    const upcoming = findUpcoming(subs, 7)
      .sort((a, b) => a.days - b.days)
      .slice(0, 4)
      .map(({ sub, days }) => {
        if (!sub) {
          return {
            name: "Langganan",
            amount: null,
            dueInDays: days,
            dueDateLabel: "Tanggal belum tersedia",
          };
        }
        const dueDate = nextDue(sub);
        return {
          name: sub?.name || "Langganan",
          amount: Number.isFinite(Number(sub?.amount)) ? Number(sub.amount) : null,
          dueInDays: days,
          dueDateLabel: dueDate ? DATE_LABEL.format(dueDate) : "Tanggal belum tersedia",
        };
      });
    return upcoming;
  } catch {
    return [];
  }
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const DEFAULT_PRESET = "month";

// Each content block uses <Section> to maintain a single vertical rhythm.
export default function Dashboard({ stats, txs, budgetStatus = [] }) {
  const digestControl = useShowDigestOnLogin();
  const [periodPreset, setPeriodPreset] = useState(DEFAULT_PRESET);
  const [periodRange, setPeriodRange] = useState(() => getPresetRange(DEFAULT_PRESET));
  const balances = useDashboardBalances(periodRange);
  const {
    income: periodIncome,
    expense: periodExpense,
    cashBalance,
    nonCashBalance,
    totalBalance,
    loading,
    error,
    refresh,
  } = balances;
  const { start: periodStart, end: periodEnd } = periodRange;

  useEffect(() => {
    refresh({ start: periodStart, end: periodEnd });
  }, [periodStart, periodEnd, refresh]);

  const handlePeriodChange = (range, preset) => {
    setPeriodRange(range);
    setPeriodPreset(preset);
  };

  const streak = useMemo(() => {
    const dates = new Set(txs.map((t) => new Date(t.date).toDateString()));
    let count = 0;
    const today = new Date();
    while (
      dates.has(
        new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() - count
        ).toDateString()
      )
    ) {
      count++;
    }
    return count;
  }, [txs]);

  const insights = useInsights(txs);
  const savingsTarget = stats?.savingsTarget || 1_000_000;

  const digestData = useMemo(() => {
    const now = new Date();
    const todayLabel = DATE_LABEL.format(now);
    let todayExpense = 0;
    let todayIncome = 0;
    let todayCount = 0;
    const monthExpenseTotals = { expense: 0 };

    for (const tx of txs) {
      if (!tx) continue;
      const txDate = new Date(tx.date);
      if (Number.isNaN(txDate.getTime())) continue;
      if (isSameDay(txDate, now)) {
        todayCount += 1;
        const amount = Number(tx.amount || 0);
        if (tx.type === "expense") {
          todayExpense += amount;
        } else if (tx.type === "income") {
          todayIncome += amount;
        }
      }
      if (tx.type === "expense" && txDate <= now) {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        if (txDate >= monthStart) {
          monthExpenseTotals.expense += Number(tx.amount || 0);
        }
      }
    }

    const categories = collectTopCategories(txs, now);
    const normalizedBudget = normalizeBudgetStatus(budgetStatus);
    const primaryBudget = normalizedBudget[0] || null;
    const upcoming = gatherUpcomingSubscriptions();

    const summaryParts = [];
    if (todayExpense > 0) {
      summaryParts.push(
        `Hari ini kamu membelanjakan ${formatCurrency(todayExpense)} dari ${todayCount} transaksi.`,
      );
    }
    if (primaryBudget) {
      summaryParts.push(
        `Kategori ${primaryBudget.label} telah terpakai ${Math.round(primaryBudget.pct)}% dari anggaran.`,
      );
    }
    if (!summaryParts.length) {
      summaryParts.push("Belum ada aktivitas berarti hari ini.");
    }

    return {
      summary: summaryParts.join(" "),
      balance: {
        total: stats?.balance ?? 0,
      },
      today: {
        dateLabel: todayLabel,
        expense: todayExpense,
        income: todayIncome,
        net: todayIncome - todayExpense,
        transactionCount: todayCount,
      },
      month: {
        expense: monthExpenseTotals.expense,
        status: primaryBudget
          ? {
              label: primaryBudget.label,
              pct: primaryBudget.pct,
              status: primaryBudget.status,
              actual: primaryBudget.actual,
              planned: primaryBudget.planned,
            }
          : null,
      },
      topCategories: categories,
      upcoming,
    };
  }, [budgetStatus, stats?.balance, txs]);

  return (
    <div className="space-y-6 sm:space-y-8 lg:space-y-10">
      <DailyDigestModal
        open={digestControl.open}
        onClose={digestControl.close}
        data={digestData}
        loading={digestControl.loading}
      />
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Dashboard
        </h1>
        <p className="text-sm text-muted sm:text-base">
          Ringkasan keuanganmu
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={digestControl.openManually}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text shadow-sm transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          >
            Lihat Ringkasan Hari Ini
          </button>
        </div>
        {digestControl.error ? (
          <div className="mt-2 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-xs text-danger">
            <div className="flex items-center justify-between gap-3">
              <span>{digestControl.error}</span>
              <button
                type="button"
                onClick={digestControl.clearError}
                className="text-[11px] font-semibold uppercase tracking-wide text-danger/80 hover:text-danger"
              >
                Tutup
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <section className="space-y-4">
        <PeriodPicker
          value={periodRange}
          preset={periodPreset}
          onChange={handlePeriodChange}
        />
        <DashboardSummary
          income={periodIncome}
          expense={periodExpense}
          cashBalance={cashBalance}
          nonCashBalance={nonCashBalance}
          totalBalance={totalBalance}
          loading={loading}
          error={error}
          period={periodRange}
        />
      </section>

      <QuoteBoard />

      <div className="grid gap-6 sm:gap-7 lg:gap-8 lg:grid-cols-2">
        <SavingsProgress current={stats?.balance || 0} target={savingsTarget} />
        <AchievementBadges
          stats={stats}
          streak={streak}
          target={savingsTarget}
        />
      </div>

      <QuickActions />

      <BudgetStatusHighlights items={budgetStatus} />

      <section className="space-y-6 sm:space-y-8 lg:space-y-10">
        <SectionHeader title="Analisis Bulanan" />
        <div className="grid gap-6 sm:gap-7 lg:gap-8 lg:grid-cols-2">
          <MonthlyTrendChart data={insights.trend} />
          <CategoryDonut data={insights.categories} />
        </div>
        <div className="grid gap-6 sm:gap-7 lg:gap-8 lg:grid-cols-2">
          <TopSpendsTable
            data={insights.topSpends}
            onSelect={(t) => EventBus.emit("tx:open", t)}
          />
          <RecentTransactions txs={txs} />
        </div>
      </section>
    </div>
  );
}
