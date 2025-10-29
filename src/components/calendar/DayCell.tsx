import clsx from 'clsx';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { formatCurrency } from '../../lib/format';

export type DayHeatLevel = 'none' | 'quarter' | 'half' | 'three-quarter' | 'full' | 'overflow';

export interface DayTotals {
  expenseTotal: number;
  incomeTotal: number;
  transactionCount: number;
}

interface DayCellProps {
  date: Date;
  totals?: DayTotals | null;
  heatLevel: DayHeatLevel;
  showIncome: boolean;
  isOutsideMonth?: boolean;
  isSelected?: boolean;
  isToday?: boolean;
}

const HEAT_CLASSES: Record<DayHeatLevel, string> = {
  none: 'bg-slate-950/60',
  quarter: 'bg-slate-900',
  half: 'bg-slate-900/80',
  three-quarter: 'bg-rose-900/30',
  full: 'bg-rose-900/50',
  overflow: 'bg-rose-900/70',
};

function formatDayNumber(date: Date): string {
  try {
    return format(date, 'd', { locale: localeId });
  } catch {
    return String(date.getDate());
  }
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value) || value === 0) {
    return 'Rp0';
  }
  return formatCurrency(Math.abs(value), 'IDR');
}

export default function DayCell({
  date,
  totals,
  heatLevel,
  showIncome,
  isOutsideMonth = false,
  isSelected = false,
  isToday = false,
}: DayCellProps) {
  const hasTransactions = (totals?.transactionCount ?? 0) > 0;
  const expense = totals?.expenseTotal ?? 0;
  const income = totals?.incomeTotal ?? 0;

  return (
    <div
      className={clsx(
        'flex h-full min-h-[92px] w-full flex-col justify-between rounded-xl p-2 text-left transition-colors',
        'ring-1 ring-inset ring-slate-800 focus:outline-none',
        HEAT_CLASSES[heatLevel],
        isSelected && 'ring-2 ring-accent/80 shadow-lg',
        isToday && !isSelected && 'ring-1 ring-accent/60',
        isOutsideMonth && 'opacity-50',
        !hasTransactions && 'bg-slate-950/40',
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-slate-200 md:text-base">
            {formatDayNumber(date)}
          </span>
          {isToday && (
            <span className="rounded-full bg-accent/80 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-900">
              Hari ini
            </span>
          )}
        </div>
        {hasTransactions && (
          <span className="rounded bg-slate-800/80 px-1 text-[10px] font-medium text-slate-300">
            {totals?.transactionCount ?? 0}
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-1">
        <span className="text-xs font-medium text-rose-400/90 md:text-sm">
          {expense > 0 ? `- ${formatMoney(expense)}` : '-'}
        </span>
        {showIncome && (
          <span className="text-xs font-medium text-emerald-400/90 md:text-sm">
            {income > 0 ? `+ ${formatMoney(income)}` : '+'}
          </span>
        )}
      </div>
    </div>
  );
}
