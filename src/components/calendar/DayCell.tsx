import { useMemo } from 'react';
import clsx from 'clsx';
import { format, isToday } from 'date-fns';
import type { DaySummary } from '../../hooks/useMonthAggregates';

const COMPACT_CURRENCY =
  typeof Intl !== 'undefined'
    ? new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
        notation: 'compact',
      })
    : null;

function formatAmount(amount: number) {
  if (!amount) return 'Rp0';
  if (!COMPACT_CURRENCY) return `Rp${Math.round(amount).toLocaleString('id-ID')}`;
  return COMPACT_CURRENCY.format(Math.round(amount));
}

export interface DayCellProps {
  date: Date;
  dateKey: string;
  summary?: DaySummary;
  isCurrentMonth: boolean;
  isSelected: boolean;
  onSelect: (dateKey: string) => void;
  heatmapClass: string;
  showIncome: boolean;
}

export default function DayCell({
  date,
  dateKey,
  summary,
  isCurrentMonth,
  isSelected,
  onSelect,
  heatmapClass,
  showIncome,
}: DayCellProps) {
  const dayNumber = useMemo(() => format(date, 'd'), [date]);
  const displayExpense = summary?.expenseTotal ?? 0;
  const displayIncome = summary?.incomeTotal ?? 0;
  const isTodayFlag = isToday(date);

  return (
    <button
      type="button"
      onClick={() => onSelect(dateKey)}
      className={clsx(
        'group relative flex min-h-[108px] flex-col rounded-xl p-2 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'ring-1 ring-slate-800 hover:-translate-y-0.5 hover:ring-slate-700',
        heatmapClass,
        !isCurrentMonth && 'opacity-50',
        isSelected && 'ring-2 ring-brand/70 shadow-lg shadow-brand/10',
      )}
      aria-pressed={isSelected}
    >
      <div className="flex items-start justify-between text-xs font-medium text-muted-foreground">
        <span
          className={clsx(
            'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold transition',
            isTodayFlag
              ? 'bg-brand/20 text-brand'
              : 'bg-surface-2/70 text-muted-foreground group-hover:bg-surface-2/90',
          )}
        >
          {dayNumber}
        </span>
        {summary?.transactionCount ? (
          <span className="inline-flex items-center rounded-full bg-surface-2/80 px-1.5 py-0.5 text-[11px] font-semibold text-muted">
            {summary.transactionCount}
          </span>
        ) : null}
      </div>
      <div className="mt-auto flex flex-col">
        <span className="font-mono text-sm font-semibold text-rose-400">
          {displayExpense ? `- ${formatAmount(displayExpense)}` : '- Rp0'}
        </span>
        {showIncome && displayIncome > 0 ? (
          <span className="mt-1 text-xs font-medium text-emerald-400">
            + {formatAmount(displayIncome)}
          </span>
        ) : null}
      </div>
    </button>
  );
}
