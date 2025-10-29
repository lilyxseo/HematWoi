import clsx from 'clsx';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import type { DaySummary } from '../../lib/calendarApi';
import { formatShortCurrency } from '../../lib/numberFormat';

interface DayCellProps {
  date: Date;
  summary?: DaySummary;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  p80: number;
  p95: number;
  maxExpense: number;
  onSelect: (date: Date) => void;
}

function getHeatmapClass(
  expense: number,
  p80: number,
  p95: number,
  maxExpense: number,
): string {
  if (expense <= 0) {
    return 'bg-slate-900/40 md:bg-slate-900/60';
  }

  if (p95 > 0 && expense > p95) {
    return 'bg-rose-900/65 md:bg-rose-900/80';
  }

  const base = p80 > 0 ? p80 : maxExpense > 0 ? maxExpense : expense;
  if (base <= 0) {
    return 'bg-slate-900/40 md:bg-slate-900/60';
  }

  const ratio = expense / base;

  if (ratio >= 1) {
    return 'bg-rose-900/65 md:bg-rose-900/80';
  }
  if (ratio >= 0.75) {
    return 'bg-rose-900/50 md:bg-rose-900/60';
  }
  if (ratio >= 0.5) {
    return 'bg-rose-900/35 md:bg-rose-900/45';
  }
  if (ratio >= 0.25) {
    return 'bg-rose-900/20 md:bg-rose-900/30';
  }
  return 'bg-slate-900/40 md:bg-slate-900/60';
}

function formatExpense(value: number): string {
  if (!value) return '—';
  return `-${formatShortCurrency(Math.abs(value))}`;
}

function formatIncome(value: number): string {
  if (!value) return '';
  return `+${formatShortCurrency(Math.abs(value))}`;
}

export default function DayCell({
  date,
  summary,
  isCurrentMonth,
  isSelected,
  isToday,
  p80,
  p95,
  maxExpense,
  onSelect,
}: DayCellProps) {
  const expense = summary?.expenseTotal ?? 0;
  const income = summary?.incomeTotal ?? 0;
  const count = summary?.count ?? 0;

  const ariaLabelParts = [
    format(date, 'EEEE, dd MMMM yyyy', { locale: localeId }),
    count > 0 ? `${count} transaksi` : 'Tidak ada transaksi',
  ];
  if (expense > 0) {
    ariaLabelParts.push(`Pengeluaran ${formatShortCurrency(expense)}`);
  }
  if (income > 0) {
    ariaLabelParts.push(`Pemasukan ${formatShortCurrency(income)}`);
  }

  const heatmapClass = getHeatmapClass(expense, p80, p95, maxExpense);

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      aria-pressed={isSelected}
      aria-label={ariaLabelParts.join(', ')}
      className={clsx(
        'relative flex h-12 min-w-0 flex-col justify-between rounded-xl px-1.5 py-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] md:h-16 md:px-2 md:py-2',
        'ring-1 ring-slate-800',
        heatmapClass,
        isSelected &&
          'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-slate-950 md:ring-offset-2',
        !isCurrentMonth && 'opacity-70',
      )}
    >
      <span
        className={clsx(
          'text-[10px] font-semibold text-slate-200 leading-tight sm:text-xs md:text-sm',
          isToday && 'text-[var(--accent)]',
        )}
      >
        {format(date, 'd', { locale: localeId })}
      </span>
      <div className="flex min-w-0 items-end justify-between gap-1">
        <span className="min-w-0 truncate font-mono text-[11px] text-rose-400 leading-tight sm:text-xs md:text-sm">
          {formatExpense(expense)}
        </span>
        {income > 0 ? (
          <span className="shrink-0 font-mono text-[10px] text-emerald-400 leading-tight sm:text-xs">
            {formatIncome(income)}
          </span>
        ) : null}
      </div>
      {count > 0 ? (
        <span className="absolute top-1 right-1 inline-flex min-w-[1.25rem] justify-center rounded bg-slate-800/80 px-1 text-[10px] font-semibold text-slate-200">
          {count}
        </span>
      ) : null}
    </button>
  );
}
