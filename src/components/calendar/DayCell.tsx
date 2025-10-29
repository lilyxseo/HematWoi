import clsx from 'clsx';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { DaySummary, HeatmapLevel } from '../../hooks/useMonthAggregates';

const formatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const heatmapClass: Record<HeatmapLevel, string> = {
  none: 'bg-slate-900/40',
  quarter: 'bg-slate-900',
  half: 'bg-slate-900/80',
  'three-quarter': 'bg-rose-900/30',
  full: 'bg-rose-900/50',
  beyond: 'bg-rose-900/70',
};

interface DayCellProps {
  date: Date;
  summary?: DaySummary;
  isOutside?: boolean;
  isSelected?: boolean;
  onSelect?: (day: string) => void;
}

export default function DayCell({
  date,
  summary,
  isOutside = false,
  isSelected = false,
  onSelect,
}: DayCellProps) {
  const dayKey = format(date, 'yyyy-MM-dd');
  const dayNumber = date.getDate();
  const isToday = dayKey === format(new Date(), 'yyyy-MM-dd');
  const expense = summary?.expenseTotal ?? 0;
  const income = summary?.incomeTotal ?? 0;
  const count = summary?.transactionCount ?? 0;
  const displayExpense = expense > 0 ? formatter.format(expense) : '-';
  const displayIncome = income > 0 ? formatter.format(income) : null;

  const ariaLabelParts = [
    format(date, 'EEEE, d MMMM yyyy', { locale: localeId }),
    expense > 0 ? `Pengeluaran ${displayExpense}` : 'Tidak ada pengeluaran',
  ];
  if (income > 0) {
    ariaLabelParts.push(`Pemasukan ${displayIncome}`);
  }
  if (count > 0) {
    ariaLabelParts.push(`${count} transaksi`);
  }

  return (
    <button
      type="button"
      onClick={() => onSelect?.(dayKey)}
      className={clsx(
        'group flex h-full min-h-28 w-full flex-col rounded-xl border border-slate-800 p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        heatmapClass[summary?.heatmapLevel ?? 'none'],
        isSelected && 'ring-2 ring-[color:var(--accent)] ring-offset-2 ring-offset-background',
        isOutside && 'opacity-60',
      )}
      aria-label={ariaLabelParts.join('. ')}
    >
      <div className="flex items-start justify-between">
        <span
          className={clsx(
            'inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-sm font-semibold',
            isToday
              ? 'bg-[color:var(--accent)]/80 text-black'
              : 'bg-black/30 text-slate-100',
          )}
        >
          {dayNumber}
        </span>
        {count > 0 ? (
          <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-slate-100">
            {count}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-col gap-1 text-xs text-slate-200">
        <div className="font-mono text-sm text-rose-400 md:text-base" aria-label={`Total pengeluaran ${displayExpense}`}>
          {displayExpense}
        </div>
        {displayIncome ? (
          <div className="text-[13px] font-medium text-emerald-400" aria-label={`Total pemasukan ${displayIncome}`}>
            {displayIncome}
          </div>
        ) : null}
      </div>
    </button>
  );
}
