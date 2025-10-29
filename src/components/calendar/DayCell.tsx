import clsx from 'clsx';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import type { DaySummary } from '../../lib/calendarApi';
import { formatCurrency, formatCurrencyShort } from '../../lib/format';

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
    return 'bg-slate-900/30 md:bg-slate-900/50';
  }

  if (p95 > 0 && expense > p95) {
    return 'bg-rose-900/65 md:bg-rose-900/80';
  }

  const base = p80 > 0 ? p80 : maxExpense > 0 ? maxExpense : expense;
  if (base <= 0) {
    return 'bg-slate-900/30 md:bg-slate-900/50';
  }

  const ratio = expense / base;

  if (ratio >= 1) {
    return 'bg-rose-900/50 md:bg-rose-900/65';
  }
  if (ratio >= 0.75) {
    return 'bg-rose-900/50 md:bg-rose-900/60';
  }
  if (ratio >= 0.5) {
    return 'bg-rose-900/35 md:bg-rose-900/50';
  }
  if (ratio >= 0.25) {
    return 'bg-rose-900/20 md:bg-rose-900/35';
  }
  return 'bg-slate-900/30 md:bg-slate-900/50';
}

function formatExpense(value: number): string {
  if (!value) return '—';
  return `-Rp ${formatCurrencyShort(Math.abs(value), { withSymbol: false })}`;
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
    ariaLabelParts.push(`Pengeluaran ${formatCurrency(expense)}`);
  }
  if (income > 0) {
    ariaLabelParts.push(`Pemasukan ${formatCurrency(income)}`);
  }

  const heatmapClass = getHeatmapClass(expense, p80, p95, maxExpense);

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      aria-pressed={isSelected}
      aria-label={ariaLabelParts.join(', ')}
      className={clsx(
        'relative flex h-12 w-full min-w-0 flex-col justify-between rounded-xl px-1.5 py-1 text-left text-[10px] leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:text-[11px] md:h-16 md:px-2',
        heatmapClass,
        isSelected ? 'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-slate-950' : 'ring-1 ring-slate-800',
        !isCurrentMonth && 'opacity-60',
      )}
    >
      <span
        className={clsx(
          'font-semibold text-slate-200',
          isToday && 'text-[var(--accent)]',
        )}
      >
        {format(date, 'd', { locale: localeId })}
      </span>
      {count > 0 ? (
        <span className="absolute top-1 right-1 inline-flex items-center justify-center rounded bg-slate-800/80 px-1 text-[10px] font-semibold text-slate-200">
          {count}
        </span>
      ) : null}
      <span
        className={clsx(
          'mt-auto min-w-0 truncate font-mono text-[10px] text-rose-400 sm:text-[11px] md:text-xs',
          expense <= 0 && 'text-slate-400',
        )}
      >
        {formatExpense(expense)}
      </span>
    </button>
  );
}
