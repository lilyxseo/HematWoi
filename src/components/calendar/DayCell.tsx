import clsx from 'clsx';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

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
  dateISO: string;
  expenseTotal: number;
  incomeTotal: number;
  txCount: number;
  heatmapLevel: string;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  onSelect: (date: Date) => void;
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
  dateISO,
  expenseTotal,
  incomeTotal,
  txCount,
  heatmapLevel,
  isCurrentMonth,
  isSelected,
  isToday,
  onSelect,
}: DayCellProps) {
  const expenseLabel = formatExpense(expenseTotal);
  const incomeLabel = formatIncome(incomeTotal);
  const dateLabel = format(date, 'EEEE, dd MMMM yyyy', { locale: localeId });
  const countPhrase = txCount > 0 ? `${txCount} transaksi` : 'Tidak ada transaksi';
  const mobileCountLabel = txCount > 0 ? `${txCount} tx` : '—';
  const mobileAriaLabel = `${dateLabel} memiliki ${
    txCount > 0 ? `${txCount} transaksi` : 'tidak ada transaksi'
  }`;

  const ariaLabelParts = [dateLabel, countPhrase];
  if (expenseTotal > 0) {
    ariaLabelParts.push(`Pengeluaran ${expenseFormatter.format(expenseTotal)}`);
  }
  if (incomeTotal > 0) {
    ariaLabelParts.push(`Pemasukan ${incomeFormatter.format(incomeTotal)}`);
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      aria-pressed={isSelected}
      aria-label={ariaLabelParts.join(', ')}
      data-date={dateISO}
      className={clsx(
        'relative h-12 w-full min-w-0 rounded-xl px-1.5 py-1 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] md:h-16 md:px-2',
        'flex flex-col justify-between gap-1 ring-1 ring-slate-800',
        heatmapLevel,
        isSelected && 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-slate-950',
        !isCurrentMonth && 'opacity-70',
      )}
    >
      <span
        className="absolute top-1 right-1 inline-flex min-h-[1.125rem] min-w-[1.75rem] items-center justify-center rounded bg-slate-800/80 px-1 text-[10px] font-semibold text-slate-200"
      >
        {txCount}
      </span>
      <div className="flex items-start justify-between gap-1">
        <span
          className={clsx(
            'text-[10px] font-semibold text-slate-300 md:text-xs',
            isToday && 'text-[var(--accent)]',
          )}
        >
          {format(date, 'd', { locale: localeId })}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span
          className="block md:hidden text-[11px] font-semibold leading-tight text-slate-200 drop-shadow-[0_1px_0_rgba(0,0,0,0.3)]"
          aria-label={mobileAriaLabel}
        >
          {mobileCountLabel}
        </span>
        <div className="hidden md:flex md:items-center md:gap-2">
          <span className="font-mono text-sm leading-tight text-rose-400">{expenseLabel}</span>
          {incomeTotal > 0 ? (
            <span className="font-mono text-xs text-emerald-400 opacity-80">{incomeLabel}</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
