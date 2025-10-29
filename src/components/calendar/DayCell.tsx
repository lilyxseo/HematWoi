import clsx from 'clsx';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import type { DaySummary } from '../../lib/calendarApi';
import { formatShortCurrency } from '../../lib/formatShortCurrency';

const spokenCurrencyFormatter = new Intl.NumberFormat('id-ID', {
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
    return 'bg-slate-900/60 md:bg-slate-900';
  }

  if (p95 > 0 && expense > p95) {
    return 'bg-rose-900/65 md:bg-rose-900/80';
  }

  const base = p80 > 0 ? p80 : maxExpense > 0 ? maxExpense : expense;
  if (base <= 0) {
    return 'bg-slate-900/60 md:bg-slate-900';
  }

  const ratio = expense / base;

  if (ratio >= 1) {
    return 'bg-rose-900/50 md:bg-rose-900/70';
  }
  if (ratio >= 0.75) {
    return 'bg-rose-900/35 md:bg-rose-900/55';
  }
  if (ratio >= 0.5) {
    return 'bg-rose-900/30 md:bg-rose-900/45';
  }
  if (ratio >= 0.25) {
    return 'bg-rose-900/20 md:bg-rose-900/35';
  }
  return 'bg-slate-900/60 md:bg-slate-900';
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
    ariaLabelParts.push(`Pengeluaran ${spokenCurrencyFormatter.format(expense)}`);
  }
  if (income > 0) {
    ariaLabelParts.push(`Pemasukan ${spokenCurrencyFormatter.format(income)}`);
  }

  const heatmapClass = getHeatmapClass(expense, p80, p95, maxExpense);

  const expenseText =
    expense > 0 ? formatShortCurrency(-expense, { signDisplay: 'always' }) : 'Rp 0';
  const incomeText =
    income > 0 ? formatShortCurrency(income, { signDisplay: 'always' }) : '';

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      aria-pressed={isSelected}
      aria-label={ariaLabelParts.join(', ')}
      className={clsx(
        'relative flex h-12 w-full min-w-0 flex-col justify-between rounded-xl px-1.5 py-1 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 md:h-16 md:px-2',
        'ring-1 ring-slate-800',
        heatmapClass,
        isSelected && 'ring-[var(--accent)]',
        !isCurrentMonth && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={clsx(
            'text-[10px] font-semibold text-slate-200 leading-tight sm:text-xs',
            isToday && 'text-[var(--accent)]',
          )}
        >
          {format(date, 'd', { locale: localeId })}
        </span>
        {count > 0 ? (
          <span className="absolute top-1 right-1 inline-flex items-center rounded bg-slate-800/80 px-1 text-[10px] font-semibold text-slate-200">
            {count}
          </span>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-1 leading-tight">
        <span className="min-w-0 truncate font-mono text-[11px] text-rose-400 sm:text-xs">
          {expenseText}
        </span>
        {incomeText ? (
          <span className="shrink-0 font-mono text-[9px] text-emerald-400 sm:text-[11px]">
            {incomeText}
          </span>
        ) : null}
      </div>
    </button>
  );
}
