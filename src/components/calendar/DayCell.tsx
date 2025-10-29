import clsx from 'clsx';
import type { DayAggregate } from '../../hooks/useMonthAggregates';
import type { HeatmapScale } from './CalendarGrid';

const EXPENSE_FORMATTER = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
});

type DayCellProps = {
  date: Date;
  dateKey: string;
  aggregate?: DayAggregate;
  selected: boolean;
  isCurrentMonth: boolean;
  isToday: boolean;
  loading?: boolean;
  percentiles: HeatmapScale;
  onSelect: (date: string) => void;
};

function formatAmount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0';
  }
  return EXPENSE_FORMATTER.format(Math.round(value));
}

function getHeatmapClass(value: number, scale: HeatmapScale): string {
  if (!Number.isFinite(value) || value <= 0) {
    return 'bg-surface-1/30';
  }
  const baseline = Math.max(scale.maxExpense, scale.p95, 1);
  const ratio = value / baseline;
  if (value >= scale.p95 && scale.p95 > 0) {
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

export default function DayCell({
  date,
  dateKey,
  aggregate,
  selected,
  isCurrentMonth,
  isToday,
  loading = false,
  percentiles,
  onSelect,
}: DayCellProps) {
  const dayNumber = date.getUTCDate();
  const expense = aggregate?.expenseTotal ?? 0;
  const income = aggregate?.incomeTotal ?? 0;
  const count = aggregate?.transactionCount ?? 0;
  const backgroundClass = getHeatmapClass(expense, percentiles);

  return (
    <button
      type="button"
      onClick={() => onSelect(dateKey)}
      disabled={loading}
      className={clsx(
        'group relative flex min-h-[96px] w-full flex-col justify-between overflow-hidden rounded-xl border border-border/60 p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 md:p-4',
        backgroundClass,
        !isCurrentMonth && 'opacity-45',
        selected && 'ring-2 ring-brand',
        loading && 'animate-pulse'
      )}
      aria-pressed={selected}
      aria-label={`Lihat transaksi tanggal ${dateKey}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={clsx(
            'rounded-full px-2 py-1 text-xs font-semibold',
            isToday ? 'bg-brand/20 text-brand' : 'text-muted'
          )}
        >
          {dayNumber}
        </span>
        {count > 0 ? (
          <span className="inline-flex min-h-[1.5rem] min-w-[1.5rem] items-center justify-center rounded-full bg-black/40 px-2 text-[11px] font-semibold text-slate-100">
            {count}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-mono text-sm font-semibold text-rose-400 md:text-base">
          -Rp {formatAmount(expense)}
        </span>
        {income > 0 ? (
          <span className="font-mono text-xs text-emerald-400 md:text-sm">
            +Rp {formatAmount(income)}
          </span>
        ) : (
          <span className="text-xs text-muted md:text-sm">&nbsp;</span>
        )}
      </div>
    </button>
  );
}
