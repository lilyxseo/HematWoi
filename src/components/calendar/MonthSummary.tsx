import clsx from "clsx";
import { formatCurrency } from "../../lib/format";

export interface MonthSummaryProps {
  expense: number;
  income: number;
  net: number;
  previousExpense: number;
  previousIncome: number;
  momExpenseChange: number | null;
  momIncomeChange: number | null;
  loading?: boolean;
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  const rounded = Math.round(value * 10) / 10;
  const prefix = rounded > 0 ? "+" : "";
  return `${prefix}${rounded.toFixed(1)}%`;
}

function SummaryRow({
  label,
  value,
  previous,
  change,
  changePositive,
}: {
  label: string;
  value: string;
  previous: string;
  change: string;
  changePositive: boolean | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-900/70 bg-slate-900/50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-50">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
        <span>Bulan lalu: {previous}</span>
        <span
          className={clsx(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
            change === "—"
              ? "bg-slate-800/70 text-slate-300"
              : changePositive
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-rose-500/15 text-rose-300",
          )}
        >
          {change}
        </span>
      </div>
    </div>
  );
}

export default function MonthSummary({
  expense,
  income,
  net,
  previousExpense,
  previousIncome,
  momExpenseChange,
  momIncomeChange,
  loading = false,
}: MonthSummaryProps) {
  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-900/60 bg-slate-950/60 p-5 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-800/50" />
        <div className="mt-4 space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`month-summary-skel-${index}`}
              className="h-20 animate-pulse rounded-2xl bg-slate-900/50"
            />
          ))}
        </div>
      </div>
    );
  }

  const expenseChangeText = formatPercent(momExpenseChange);
  const incomeChangeText = formatPercent(momIncomeChange);
  const netClass = net >= 0 ? "text-emerald-300" : "text-rose-300";

  return (
    <div className="rounded-3xl border border-slate-900/60 bg-slate-950/60 p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-100">Ringkasan Bulan Ini</h2>
      <p className="mt-1 text-xs text-slate-400">Perbandingan performa bulan ini terhadap bulan sebelumnya.</p>
      <div className="mt-5 space-y-4">
        <SummaryRow
          label="Total Pengeluaran"
          value={formatCurrency(expense, "IDR")}
          previous={formatCurrency(previousExpense, "IDR")}
          change={expenseChangeText}
          changePositive={momExpenseChange === null ? null : momExpenseChange <= 0}
        />
        <SummaryRow
          label="Total Pemasukan"
          value={formatCurrency(income, "IDR")}
          previous={formatCurrency(previousIncome, "IDR")}
          change={incomeChangeText}
          changePositive={momIncomeChange === null ? null : momIncomeChange >= 0}
        />
        <div className="rounded-2xl border border-slate-900/70 bg-slate-900/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Saldo Bersih</p>
          <p className={clsx("mt-2 text-lg font-semibold", netClass)}>{formatCurrency(net, "IDR")}</p>
          <p className="mt-1 text-xs text-slate-400">
            Pendapatan bersih setelah dikurangi pengeluaran bulan ini.
          </p>
        </div>
      </div>
    </div>
  );
}
