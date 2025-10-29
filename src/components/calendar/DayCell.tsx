import clsx from 'clsx';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import type { DayAggregate } from '../../hooks/useMonthAggregates';

const EXPENSE_FORMATTER = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
});

const INCOME_FORMATTER = new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

interface DayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  aggregate?: DayAggregate;
  onSelect?: (date: Date) => void;
  getHeatmapClass: (expense: number) => string;
  showIncome: boolean;
}

function formatExpense(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '-';
  return EXPENSE_FORMATTER.format(value);
}

function formatIncome(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  return INCOME_FORMATTER.format(value);
}

export default function DayCell({
  date,
  isCurrentMonth,
  isSelected,
  isToday,
  aggregate,
  onSelect,
  getHeatmapClass,
  showIncome,
}: DayCellProps) {
  const expense = aggregate?.expense ?? 0;
  const income = aggregate?.income ?? 0;
  const count = aggregate?.count ?? 0;
  const labelParts = [
    format(date, 'EEEE, d MMMM yyyy', { locale: localeId }),
    expense > 0 ? `Pengeluaran Rp ${EXPENSE_FORMATTER.format(expense)}` : 'Tidak ada pengeluaran',
  ];
  if (showIncome && income > 0) {
    labelParts.push(`Pemasukan Rp ${EXPENSE_FORMATTER.format(income)}`);
  }
  if (count > 0) {
    labelParts.push(`${count} transaksi`);
  }

  return (
    <button
      type="button"
      onClick={() => onSelect?.(date)}
      className={clsx(
        'relative flex h-28 w-full flex-col rounded-2xl border border-slate-800 p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60',
        isCurrentMonth ? 'text-slate-200' : 'text-slate-500',
        getHeatmapClass(expense),
        isSelected && 'ring-2 ring-offset-2 ring-brand/70 ring-offset-slate-950',
      )}
      aria-pressed={isSelected}
      aria-label={labelParts.join('. ')}
    >
      <div className="flex items-start justify-between">
        <div
          className={clsx(
            'inline-flex min-h-[2rem] min-w-[2rem] items-center justify-center rounded-lg px-2 text-sm font-semibold',
            isToday
              ? 'bg-brand/90 text-white shadow'
              : 'bg-slate-900/70 text-slate-300',
          )}
        >
          {format(date, 'd', { locale: localeId })}
        </div>
        {count > 0 ? (
          <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-brand/80 px-1.5 text-xs font-semibold text-white">
            {count}
          </span>
        ) : null}
      </div>
      <div className="mt-auto flex flex-col gap-1">
        <div className="font-mono text-lg font-semibold text-rose-300">
          {formatExpense(expense)}
        </div>
        {showIncome && income > 0 ? (
          <div className="text-xs font-medium text-emerald-300">
            +{formatIncome(income)}
          </div>
        ) : null}
      </div>
    </button>
  );
}
