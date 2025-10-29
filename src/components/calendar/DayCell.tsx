import clsx from 'clsx';
import { format, isSameDay } from 'date-fns';
import type { DayAggregate } from '../../lib/calendarApi';

export interface DayCellProps {
  date: Date;
  aggregate?: DayAggregate;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  showIncome: boolean;
  heatLevel?: number;
  onSelect: (date: Date) => void;
  onOpenDetail?: (date: Date) => void;
}

const HEATMAP_CLASSES: Record<number, string> = {
  0: 'bg-slate-900/40',
  1: 'bg-slate-900',
  2: 'bg-slate-900/80',
  3: 'bg-rose-900/30',
  4: 'bg-rose-900/50',
  5: 'bg-rose-900/70',
};

export function DayCell({
  date,
  aggregate,
  isCurrentMonth,
  isSelected,
  isToday,
  showIncome,
  heatLevel = 0,
  onSelect,
  onOpenDetail,
}: DayCellProps) {
  const handleClick = () => {
    onSelect(date);
    onOpenDetail?.(date);
  };

  const displayDate = format(date, 'd');
  const expense = aggregate?.expenseTotal ?? 0;
  const income = aggregate?.incomeTotal ?? 0;
  const transactionCount = aggregate?.transactionCount ?? 0;
  const hasTransactions = transactionCount > 0;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={clsx(
        'group relative flex h-full w-full flex-col rounded-xl p-2 text-left ring-1 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,theme(colors.rose.500))]',
        HEATMAP_CLASSES[Math.min(Math.max(heatLevel, 0), 5)],
        !isCurrentMonth && 'opacity-40',
        isSelected && 'ring-2 ring-[color:var(--accent,theme(colors.rose.400))]',
      )}
      aria-pressed={isSelected}
      aria-label={`${format(date, 'PPP')}${hasTransactions ? `, ${transactionCount} transaksi` : ''}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={clsx('text-sm font-semibold', isToday ? 'text-[color:var(--accent,theme(colors.rose.400))]' : 'text-white')}
        >
          {displayDate}
        </span>
        {hasTransactions ? (
          <span className="rounded bg-slate-800 px-1 text-[10px] font-medium text-slate-300">
            {transactionCount}
          </span>
        ) : null}
      </div>
      <div className="mt-auto space-y-1 pt-4">
        <p className="text-xs font-mono text-rose-400 sm:text-sm">
          {expense > 0 ? `-Rp${expense.toLocaleString('id-ID')}` : '—'}
        </p>
        {showIncome ? (
          <p className="text-[11px] font-mono text-emerald-400 sm:text-xs">
            {income > 0 ? `+Rp${income.toLocaleString('id-ID')}` : '—'}
          </p>
        ) : null}
      </div>
    </button>
  );
}

export function isSameCalendarDay(dateA: Date, dateB: Date): boolean {
  return isSameDay(dateA, dateB);
}
