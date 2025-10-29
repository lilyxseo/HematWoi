import { useMemo } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../../lib/format';

interface MonthSummaryProps {
  month: Date;
  expense: number;
  income: number;
  net: number;
  previousExpense: number;
  momExpenseChange: number | null;
  isLoading?: boolean;
}

const percentFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 1,
});

export default function MonthSummary({
  month,
  expense,
  income,
  net,
  previousExpense,
  momExpenseChange,
  isLoading = false,
}: MonthSummaryProps) {
  const monthLabel = format(month, 'MMMM yyyy', { locale: localeId });

  const momInfo = useMemo(() => {
    if (momExpenseChange == null) {
      return { label: 'Tidak ada data pembanding', tone: 'neutral' as const };
    }
    const value = percentFormatter.format(Math.abs(momExpenseChange));
    if (momExpenseChange === 0) {
      return { label: 'Stabil dibanding bulan lalu', tone: 'neutral' as const };
    }
    if (momExpenseChange > 0) {
      return { label: `Naik ${value}% dari bulan lalu`, tone: 'up' as const };
    }
    return { label: `Turun ${value}% dari bulan lalu`, tone: 'down' as const };
  }, [momExpenseChange]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4 shadow-sm sm:p-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ringkasan Bulan</p>
        <h2 className="text-lg font-semibold text-slate-100">{monthLabel}</h2>
      </header>
      <div className="mt-6 space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>Total Expense MTD</span>
            <span className="font-mono text-rose-400">-{formatCurrency(expense)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>Total Income MTD</span>
            <span className="font-mono text-emerald-400">+{formatCurrency(income)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>Net</span>
            <span className={`font-mono ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {net >= 0 ? '+' : ''}
              {formatCurrency(net)}
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Expense vs bulan lalu
          </p>
          <div className="mt-3 flex items-center gap-3">
            {momInfo.tone === 'up' ? (
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 text-rose-300">
                <TrendingUp className="h-5 w-5" />
              </div>
            ) : momInfo.tone === 'down' ? (
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300">
                <TrendingDown className="h-5 w-5" />
              </div>
            ) : (
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-300">
                <TrendingUp className="h-5 w-5 rotate-90" />
              </div>
            )}
            <div className="flex flex-col">
              <p className="text-sm font-semibold text-slate-100">{momInfo.label}</p>
              <p className="text-xs text-slate-400">
                Bulan lalu: {formatCurrency(previousExpense)} pengeluaran
              </p>
            </div>
          </div>
        </div>
      </div>
      {isLoading ? (
        <div className="mt-4 text-xs text-slate-500">Memuat ringkasan...</div>
      ) : null}
    </section>
  );
}
