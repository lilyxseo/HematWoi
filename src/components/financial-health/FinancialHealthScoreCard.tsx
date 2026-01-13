import clsx from "clsx";
import {
  Circle,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../../lib/format";

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(Math.max(value, min), max);

function getScoreTone(score: number) {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-lime-500";
  if (score >= 40) return "text-amber-500";
  return "text-rose-500";
}

export type ScoreComparison = {
  direction: "up" | "down" | "flat";
  value: number;
  label: string;
};

interface FinancialHealthScoreCardProps {
  score: number;
  label: string;
  subtitle: string;
  comparison?: ScoreComparison | null;
  isEmpty: boolean;
  net: number;
  savingsRate: number;
  debtRatio: number;
  budgetOverCount: number;
  budgetTotal: number;
  cashflowScore: number;
  savingsScore: number;
  debtScore: number;
  budgetScore: number;
  expenseStabilityScore: number | null;
  expenseStabilityRatio: number | null;
  expenseCoverageScore: number | null;
  expenseCoverageDays: number | null;
};

export default function FinancialHealthScoreCard({
  score,
  label,
  subtitle,
  comparison,
  isEmpty,
  net,
  savingsRate,
  debtRatio,
  budgetOverCount,
  budgetTotal,
  cashflowScore,
  savingsScore,
  debtScore,
  budgetScore,
  expenseStabilityScore,
  expenseStabilityRatio,
  expenseCoverageScore,
  expenseCoverageDays,
}: FinancialHealthScoreCardProps) {
  const safeScore = clamp(score);
  const radius = 56;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset =
    circumference - (safeScore / 100) * circumference;
  const toneClass = getScoreTone(safeScore);

  const TrendIcon =
    comparison?.direction === "up"
      ? TrendingUp
      : comparison?.direction === "down"
        ? TrendingDown
        : Minus;

  const trendTone =
    comparison?.direction === "up"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
      : comparison?.direction === "down"
        ? "border-rose-500/30 bg-rose-500/10 text-rose-500"
        : "border-border bg-surface-2 text-muted";

  const formatPercent = (value?: number | null) => {
    if (!Number.isFinite(value)) return "0%";
    return `${((value ?? 0) * 100).toFixed(1)}%`;
  };

  const formatRatio = (value?: number | null) => {
    if (!Number.isFinite(value)) return "—";
    return value!.toFixed(2);
  };

  const indicators = [
    {
      key: "cashflow",
      score: cashflowScore,
      message: net < 0
        ? `Cashflow defisit: ${formatCurrency(net)}`
        : `Cashflow surplus: ${formatCurrency(net)}`,
      target: "target surplus ≥20%",
      tone:
        net < 0
          ? "border-rose-500/20 bg-rose-500/10 text-rose-600"
          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
    },
    {
      key: "savings",
      score: savingsScore,
      message: `Savings rate rendah: ${formatPercent(savingsRate)}`,
      target: "target >20%",
      tone:
        savingsRate < 0.1
          ? "border-rose-500/20 bg-rose-500/10 text-rose-600"
          : "border-amber-500/20 bg-amber-500/10 text-amber-700",
    },
    {
      key: "debt",
      score: debtScore,
      message: `Debt ratio tinggi: ${formatPercent(debtRatio)}`,
      target: "target <30%",
      tone:
        debtRatio > 0.5
          ? "border-rose-500/20 bg-rose-500/10 text-rose-600"
          : "border-amber-500/20 bg-amber-500/10 text-amber-700",
    },
    {
      key: "budget",
      score: budgetScore,
      message: `Over-budget: ${budgetOverCount}/${budgetTotal}`,
      target: "target 0 kategori",
      tone:
        budgetOverCount > 0
          ? "border-amber-500/20 bg-amber-500/10 text-amber-700"
          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
    },
    {
      key: "stability",
      score: expenseStabilityScore,
      message: `Variasi pengeluaran: ${formatRatio(expenseStabilityRatio)}`,
      target: "target <0.30",
      tone:
        expenseStabilityRatio != null && expenseStabilityRatio >= 0.6
          ? "border-rose-500/20 bg-rose-500/10 text-rose-600"
          : "border-amber-500/20 bg-amber-500/10 text-amber-700",
    },
    {
      key: "coverage",
      score: expenseCoverageScore,
      message: `Expense coverage: ${expenseCoverageDays != null ? `±${Math.max(0, Math.round(expenseCoverageDays))} hari` : "Belum cukup data"}`,
      target: "target ≥30 hari",
      tone:
        expenseCoverageDays != null && expenseCoverageDays < 7
          ? "border-rose-500/20 bg-rose-500/10 text-rose-600"
          : "border-amber-500/20 bg-amber-500/10 text-amber-700",
    },
  ];

  const topDrivers = indicators
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 2);
  const worstIndicator = topDrivers[0]?.key;

  const actionKey = net < 0 ? "cashflow" : worstIndicator;
  const actions = {
    cashflow: { primary: "/transactions?type=expense", secondary: "/reports" },
    debt: { primary: "/debts", secondary: "/reports" },
    budget: { primary: "/budgets", secondary: "/reports" },
    coverage: { primary: "/accounts", secondary: "/reports" },
    default: { primary: "/reports", secondary: "/reports" },
  };
  const actionSet = actions[actionKey as keyof typeof actions] ?? actions.default;

  return (
    <div className="rounded-3xl border border-border-subtle bg-surface-1 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text">
            Financial Health Score
          </h2>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        {comparison ? (
          <div
            className={clsx(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
              trendTone
            )}
          >
            {TrendIcon ? (
              <span className="flex h-4 w-4 items-center justify-center">
                <TrendIcon className="h-4 w-4" />
              </span>
            ) : null}
            <span>
              {comparison.direction === "down"
                ? "-"
                : comparison.direction === "flat"
                  ? ""
                  : "+"}
              {comparison.value.toFixed(1)}% vs bulan lalu
            </span>
          </div>
        ) : null}
      </div>

      {isEmpty ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-subtle bg-surface-2/40 p-6 text-center">
          <Circle className="h-8 w-8 text-muted" />
          <div>
            <p className="text-sm font-semibold text-text">
              Belum ada data untuk periode ini
            </p>
            <p className="mt-1 text-sm text-muted">
              Tambahkan transaksi agar skor finansial dan insight bisa dihitung.
            </p>
          </div>
          <Link
            to="/transaction/add"
            className="inline-flex items-center justify-center rounded-full border border-primary/30 bg-primary/15 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/25"
          >
            Tambah transaksi
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-[auto,1fr] md:items-start lg:grid-cols-[auto,1fr,0.9fr]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative flex h-32 w-32 items-center justify-center">
              <svg height={radius * 2} width={radius * 2}>
                <circle
                  stroke="hsl(var(--color-border))"
                  fill="transparent"
                  strokeWidth={stroke}
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                />
                <circle
                  stroke="currentColor"
                  fill="transparent"
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  className={toneClass}
                  strokeDasharray={`${circumference} ${circumference}`}
                  style={{ strokeDashoffset }}
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                />
              </svg>
              <div className="absolute text-center">
                <div className="text-3xl font-bold text-text">{safeScore}</div>
                <div className="text-xs text-muted">/ 100</div>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs uppercase text-muted">Kondisi</p>
              <p className="text-xl font-semibold text-text">{label}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted">Ringkasan kondisi</p>
              <p className="mt-1 text-sm text-muted">
                {safeScore >= 80 &&
                  "Pertahankan kebiasaan finansialmu. Kamu sudah di jalur yang tepat."}
                {safeScore >= 60 &&
                  safeScore < 80 &&
                  "Kondisi keuangan cukup stabil, tetap jaga disiplin pengeluaran."}
                {safeScore >= 40 &&
                  safeScore < 60 &&
                  "Mulai cek pos pengeluaran utama agar cashflow tetap aman."}
                {safeScore < 40 &&
                  "Perlu segera perbaiki cashflow dan kendalikan cicilan."}
              </p>
            </div>

            <div className="grid gap-3 border-t border-border-subtle pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <MiniStat
                label="Cashflow"
                value={formatCurrency(net)}
                subLabel={net >= 0 ? "Surplus" : "Defisit"}
              />
              <MiniStat
                label="Savings Rate"
                value={formatPercent(savingsRate)}
                subLabel="target >20%"
              />
              <MiniStat
                label="Debt Ratio"
                value={formatPercent(debtRatio)}
                subLabel="target <30%"
              />
              <MiniStat
                label="Over-budget"
                value={`${budgetOverCount}/${budgetTotal}`}
                subLabel="kategori"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border-subtle bg-surface-2/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Top Drivers
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {topDrivers.map((driver) => (
                  <span
                    key={driver.key}
                    className={clsx(
                      "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold",
                      driver.tone
                    )}
                  >
                    <span>{driver.message}</span>
                    <span className="text-[11px] text-muted">
                      {driver.target}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
              <Link
                to={actionSet.primary}
                className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/90"
              >
                Perbaiki sekarang
              </Link>
              <Link
                to={actionSet.secondary}
                className="inline-flex items-center justify-center rounded-full border border-border-subtle px-4 py-2 text-xs font-semibold text-muted transition hover:border-border"
              >
                Lihat detail
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type MiniStatProps = {
  label: string;
  value: string;
  subLabel: string;
};

function MiniStat({ label, value, subLabel }: MiniStatProps) {
  return (
    <div className="space-y-1 rounded-2xl border border-border-subtle bg-surface-2/30 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="text-base font-semibold text-text">{value}</p>
      <p className="text-xs text-muted">{subLabel}</p>
    </div>
  );
}
