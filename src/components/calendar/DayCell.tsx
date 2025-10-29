import clsx from 'clsx';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import type { DaySummary } from '../../lib/calendarApi';

const expenseFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
  notation: 'compact',
});

const incomeFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
  notation: 'compact',
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

function formatExpense(value: number): string {
  if (!value) return '—';
  return `-${expenseFormatter.format(Math.abs(value))}`;
}

function formatIncome(value: number): string {
  if (!value) return '';
  return `+${incomeFormatter.format(Math.abs(value))}`;
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

  const ariaLabelParts = [
    dateLabel,
    count > 0 ? `${count} transaksi` : 'Tidak ada transaksi',
  ];
  if (expense > 0) {
    ariaLabelParts.push(`Pengeluaran ${expenseFormatter.format(expense)}`);
  }
  if (income > 0) {
    ariaLabelParts.push(`Pemasukan ${incomeFormatter.format(income)}`);
  }

  const heatmapClass = getHeatmapClass(expense, p80, p95, maxExpense);

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      aria-pressed={isSelected}
      aria-label={ariaLabelParts.join(', ')}
      className={clsx(
        'relative flex h-12 min-w-0 flex-col justify-between gap-1 rounded-xl px-1.5 py-1 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 md:h-16 md:gap-1.5 md:px-2',
        heatmapClass,
        isSelected
          ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-slate-950'
          : 'ring-1 ring-slate-800',
        !isCurrentMonth && 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between pr-4">
        <span
          className={clsx(
            'text-[10px] font-semibold text-slate-300 md:text-xs',
            isToday && 'text-[var(--accent)]',
          )}
        >
          {format(date, 'd', { locale: localeId })}
        </span>
      </div>

      <span
        className="absolute top-1 right-1 inline-flex min-h-4 min-w-[1.25rem] items-center justify-center rounded bg-slate-800/80 px-1 text-[10px] font-semibold text-slate-200"
        aria-hidden="true"
      >
        {count > 0 ? count : 0}
      </span>

      <span
        className="block truncate text-[11px] font-semibold leading-tight text-slate-200 drop-shadow-[0_1px_0_rgba(0,0,0,0.3)] md:hidden"
        aria-label={`${dateLabel} memiliki ${count > 0 ? `${count} transaksi` : 'tidak ada transaksi'}`}
      >
        {count > 0 ? `${count} tx` : '—'}
      </span>

      <div className="hidden md:flex md:items-center md:gap-2">
        <span className="truncate font-mono text-sm leading-tight text-rose-400">
          {formatExpense(expense)}
        </span>
        {income > 0 ? (
          <span className="truncate font-mono text-xs leading-tight text-emerald-400 opacity-80">
            {formatIncome(income)}
          </span>
        ) : null}
      </div>
    </button>
  );
}
