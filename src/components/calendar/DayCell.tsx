import type { DayButtonProps } from 'react-day-picker';
import clsx from 'clsx';
import { format } from 'date-fns';
import type { DayAggregate, HeatmapStats } from '../../hooks/useMonthAggregates';

export type CalendarDayCellProps = DayButtonProps & {
  aggregate?: DayAggregate;
  heatmap: HeatmapStats;
};

function formatExpense(value: number): string {
  if (!value) return '0';
  const formatter = new Intl.NumberFormat('id-ID', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  return formatter.format(Math.abs(value));
}

function formatIncome(value: number): string {
  if (!value) return '';
  const formatter = new Intl.NumberFormat('id-ID', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  return formatter.format(Math.abs(value));
}

function getHeatmapClass(expense: number, stats: HeatmapStats): string {
  if (!expense || expense <= 0) {
    return 'bg-slate-900/20';
  }
  const reference = stats.p95 || stats.maxExpense || expense;
  if (reference <= 0) {
    return 'bg-slate-900/20';
  }
  const ratio = expense / reference;
  if (ratio > 1) return 'bg-rose-900/70';
  if (ratio >= 0.75) return 'bg-rose-900/50';
  if (ratio >= 0.5) return 'bg-rose-900/30';
  if (ratio >= 0.25) return 'bg-slate-900/80';
  return 'bg-slate-900';
}

export default function DayCell({
  day,
  modifiers,
  aggregate,
  heatmap,
  ...buttonProps
}: CalendarDayCellProps) {
  const date = day.date;
  const dateKey = format(date, 'yyyy-MM-dd');
  const expense = aggregate?.expense ?? 0;
  const income = aggregate?.income ?? 0;
  const count = aggregate?.count ?? 0;
  const isSelected = Boolean(modifiers.selected);
  const isToday = Boolean(modifiers.today);
  const isOutside = Boolean(modifiers.outside);
  const badgeVisible = count > 0;

  const baseClass = clsx(
    'relative flex h-[92px] w-full flex-col rounded-2xl border border-slate-800/60 p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    getHeatmapClass(expense, heatmap),
    isOutside && 'opacity-45',
    isSelected && 'ring-2 ring-brand/60 ring-offset-2 ring-offset-background border-brand/60',
    buttonProps.disabled && 'cursor-not-allowed opacity-40',
  );

  const { className, ...rest } = buttonProps;
  const combinedClassName = clsx(className, baseClass);

  return (
    <button
      {...rest}
      type="button"
      data-date={dateKey}
      className={combinedClassName}
    >
      <div className="flex items-start justify-between text-xs font-semibold text-muted">
        <span className={clsx('inline-flex h-6 w-6 items-center justify-center rounded-full', isToday && 'bg-brand/20 text-brand')}>
          {format(date, 'd')}
        </span>
        {badgeVisible ? (
          <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-black/40 px-1 text-[11px] font-semibold text-slate-200">
            {count}
          </span>
        ) : null}
      </div>
      <div className="mt-auto flex flex-col gap-1">
        <span className={clsx('text-lg font-mono font-semibold tracking-tight', expense > 0 ? 'text-rose-300' : 'text-slate-300/70')}>
          {expense > 0 ? `-Rp${formatExpense(expense)}` : '0'}
        </span>
        {income > 0 ? (
          <span className="text-[11px] font-medium text-emerald-300/90">+Rp{formatIncome(income)}</span>
        ) : null}
      </div>
    </button>
  );
}
