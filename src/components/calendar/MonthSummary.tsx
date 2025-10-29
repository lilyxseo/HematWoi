import { TrendingDown, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import clsx from 'clsx';
import { MonthChange, MonthTotals } from '../../hooks/useMonthAggregates';

const formatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

interface MonthSummaryProps {
  month: Date;
  totals: MonthTotals;
  change: MonthChange;
  isLoading?: boolean;
}

function formatChange(value: number | null) {
  if (value == null) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export default function MonthSummary({ month, totals, change, isLoading = false }: MonthSummaryProps) {
  const label = format(month, 'MMMM yyyy', { locale: localeId });
  const cards = [
    {
      title: 'Total Expense',
      value: formatter.format(totals.expense),
      change: change.expensePct,
      accent: 'text-rose-400',
    },
    {
      title: 'Total Income',
      value: formatter.format(totals.income),
      change: change.incomePct,
      accent: 'text-emerald-400',
    },
    {
      title: 'Net',
      value: formatter.format(totals.net),
      change: change.netPct,
      accent: totals.net >= 0 ? 'text-emerald-400' : 'text-rose-400',
    },
  ];

  return (
    <aside className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border/60 bg-surface-2/60 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-100">Ringkasan bulan ini</h2>
        <p className="mt-1 text-sm text-slate-400">{label}</p>
        <div className="mt-4 grid grid-cols-1 gap-4">
          {cards.map((card) => (
            <div key={card.title} className="rounded-xl border border-border/50 bg-surface-1/80 p-4">
              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-surface-3" />
                  <div className="h-6 w-32 animate-pulse rounded bg-surface-3" />
                  <div className="h-3 w-20 animate-pulse rounded bg-surface-3" />
                </div>
              ) : (
                <>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    {card.title}
                  </p>
                  <p className={clsx('mt-2 text-2xl font-semibold', card.accent)}>{card.value}</p>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-black/30 px-2.5 py-1 text-xs font-medium text-slate-300">
                    {card.change != null && card.change < 0 ? (
                      <TrendingDown className="h-4 w-4 text-rose-400" aria-hidden="true" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    )}
                    <span>{formatChange(card.change)}</span>
                    <span className="text-slate-500">vs bulan lalu</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
