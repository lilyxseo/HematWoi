import clsx from 'clsx';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import type { DaySummary } from '../../lib/calendarApi';

const compactFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
  notation: 'compact',
});

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

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
    return 'bg-slate-900';
  }

  if (p95 > 0 && expense > p95) {
    return 'bg-rose-900/70';
  }

  const base = p80 > 0 ? p80 : maxExpense > 0 ? maxExpense : expense;
  if (base <= 0) {
    return 'bg-slate-900';
  }

  const ratio = expense / base;

  if (ratio >= 1) {
    return 'bg-rose-900/50';
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

function formatCompactValue(value: number): string {
  return compactFormatter.format(Math.abs(value)).replace(/\s+/g, '');
}

function formatExpense(value: number): string {
  if (!value) return '—';
  return `-${formatCompactValue(value)}`;
}

function formatIncome(value: number): string {
  if (!value) return '';
  return `+${formatCompactValue(value)}`;
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

  const dateLabel = format(date, 'EEEE, dd MMMM yyyy', { locale: localeId });
  const countLabel = count > 0 ? `${count} transaksi` : 'Tidak ada transaksi';

  const ariaLabelParts = [dateLabel, countLabel];
  if (expense > 0) {
    ariaLabelParts.push(`Pengeluaran ${currencyFormatter.format(expense)}`);
  }
  if (income > 0) {
    ariaLabelParts.push(`Pemasukan ${currencyFormatter.format(income)}`);
  }

  const heatmapClass = getHeatmapClass(expense, p80, p95, maxExpense);
  const mobileCountDisplay = count > 0 ? `${count} tx` : '—';
  const mobileAriaLabel = `${dateLabel} memiliki ${count > 0 ? `${count} transaksi` : 'tidak ada transaksi'}`;

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      aria-pressed={isSelected}
      aria-label={ariaLabelParts.join(', ')}
      className={clsx(
        'relative h-12 w-full min-w-0 rounded-xl ring-1 ring-slate-800 px-1.5 py-1 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] md:h-16 md:px-2',
        'flex flex-col justify-between',
        heatmapClass,
        isSelected && 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-slate-950',
        !isCurrentMonth && 'opacity-70',
      )}
    >
      <div className="flex items-start pr-5">
        <span
          className={clsx(
            'text-[10px] font-semibold text-slate-200 md:text-xs',
            isToday && 'text-[var(--accent)]',
          )}
        >
          {format(date, 'd', { locale: localeId })}
        </span>
        <span className="absolute right-1 top-1 rounded bg-slate-800/80 px-1 text-[10px] font-semibold text-slate-200">
          {count > 0 ? count : '—'}
        </span>
      </div>
      <div className="flex flex-col justify-end gap-1">
        <span
          className="block truncate text-[11px] font-semibold leading-tight text-slate-200 drop-shadow-[0_1px_0_rgba(0,0,0,0.3)] md:hidden"
          aria-label={mobileAriaLabel}
        >
          {mobileCountDisplay}
        </span>
        <div className="hidden md:flex md:items-center md:gap-2">
          <span className="font-mono text-rose-400 text-sm leading-tight">
            {formatExpense(expense)}
          </span>
          {income > 0 ? (
            <span className="font-mono text-emerald-400 text-xs opacity-80">
              {formatIncome(income)}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
