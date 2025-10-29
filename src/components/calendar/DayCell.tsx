import clsx from 'clsx';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { DaySummary } from '../../hooks/useMonthAggregates';
import { PercentileSummary } from '../../lib/calendarApi';

const CURRENCY_FORMATTER = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function getHeatmapClass(expense: number, scale: PercentileSummary): string {
  if (!expense || expense <= 0) {
    return 'bg-slate-900';
  }
  const denominator = Math.max(scale.p95 || 0, scale.max || 0, 1);
  const ratio = Math.min(expense / denominator, 1);
  if (expense > scale.p95) {
    return 'bg-rose-900/70';
  }
  if (ratio >= 0.75) {
    return 'bg-rose-900/50';
  }
  if (ratio >= 0.5) {
    return 'bg-rose-900/30';
  }
  if (ratio >= 0.25) {
    return 'bg-slate-900/80';
  }
  return 'bg-slate-900';
}

interface DayCellProps {
  day: Date;
  summary: DaySummary | undefined;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  onSelect: () => void;
  heatmap: PercentileSummary;
}

export default function DayCell({
  day,
  summary,
  isCurrentMonth,
  isToday,
  isSelected,
  onSelect,
  heatmap,
}: DayCellProps) {
  const dateLabel = format(day, 'EEEE, dd MMMM yyyy', { locale: localeId });
  const expenseText = summary?.totalExpense
    ? CURRENCY_FORMATTER.format(summary.totalExpense)
    : 'Rp 0';
  const incomeText = summary?.totalIncome
    ? CURRENCY_FORMATTER.format(summary.totalIncome)
    : null;
  const badge = summary?.count ?? 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        'flex h-full min-h-[96px] w-full flex-col rounded-xl p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        getHeatmapClass(summary?.totalExpense ?? 0, heatmap),
        !isCurrentMonth && 'opacity-40',
        isSelected && 'ring-2 ring-brand',
      )}
      aria-label={`${dateLabel}. Pengeluaran ${expenseText}${
        incomeText ? `. Pemasukan ${incomeText}` : ''
      }. ${badge} transaksi`}
    >
      <div className="flex items-center justify-between text-xs font-medium text-slate-300">
        <span
          className={clsx(
            'inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold',
            isToday
              ? 'bg-brand/90 text-white'
              : 'bg-slate-800/80 text-slate-100',
          )}
        >
          {format(day, 'd')}
        </span>
        {badge > 0 ? (
          <span className="inline-flex min-h-[1.75rem] min-w-[1.75rem] items-center justify-center rounded-full bg-slate-950/80 px-1 text-[11px] font-semibold text-slate-200 ring-1 ring-slate-700">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-col gap-1 text-xs">
        <span className="font-mono text-sm text-rose-300">
          -{summary?.totalExpense ? CURRENCY_FORMATTER.format(summary.totalExpense) : 'Rp 0'}
        </span>
        {summary?.totalIncome ? (
          <span className="font-mono text-xs text-emerald-300">
            +{CURRENCY_FORMATTER.format(summary.totalIncome)}
          </span>
        ) : null}
      </div>
    </button>
  );
}
