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

  const ariaLabelParts = [
    format(date, 'EEEE, dd MMMM yyyy', { locale: localeId }),
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
        'relative flex h-full min-h-[112px] w-full flex-col justify-between rounded-xl p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        heatmapClass,
        isSelected && 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-slate-950',
        !isCurrentMonth && 'opacity-70',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={clsx(
            'text-sm font-semibold text-slate-200 md:text-base',
            isToday && 'text-[var(--accent)]',
          )}
        >
          {format(date, 'd', { locale: localeId })}
        </span>
        {count > 0 ? (
          <span className="inline-flex min-h-5 min-w-[1.75rem] items-center justify-center rounded-full bg-slate-800 px-1 text-xs font-semibold text-slate-100">
            {count}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-col gap-1">
        <span className="block font-mono text-sm text-slate-200 md:hidden">
          Jumlah transaksi: {count}
        </span>
        <span className="hidden truncate font-mono text-sm text-rose-400 md:block md:text-base">
          {formatExpense(expense)}
        </span>
        {income > 0 ? (
          <span className="hidden truncate font-mono text-xs text-emerald-400 md:block md:text-sm">
            {formatIncome(income)}
          </span>
        ) : (
          <span className="hidden truncate font-mono text-xs text-slate-400 md:block md:text-sm">&nbsp;</span>
        )}
      </div>
    </button>
  );
}
