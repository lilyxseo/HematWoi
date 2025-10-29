import { addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import DayCell from './DayCell';
import type { DayAggregate } from '../../hooks/useMonthAggregates';

const WEEK_DAYS = Array.from({ length: 7 }).map((_, index) => {
  const reference = startOfWeek(new Date(2024, 0, 1), { weekStartsOn: 1 });
  const date = new Date(reference);
  date.setDate(reference.getDate() + index);
  return format(date, 'EEE', { locale: localeId });
});

interface CalendarGridProps {
  month: Date;
  aggregates: Record<string, DayAggregate>;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onMonthChange: (next: Date) => void;
  onToday: () => void;
  showIncome: boolean;
  loading?: boolean;
  maxExpense: number;
  p80Expense: number;
  p95Expense: number;
}

function getHeatmapClassForValue(
  value: number,
  maxExpense: number,
  p80: number,
  p95: number,
): string {
  if (!Number.isFinite(value) || value <= 0) {
    return 'bg-slate-900/40';
  }
  const baseline = p95 > 0 ? p95 : maxExpense > 0 ? maxExpense : value;
  const ratio = baseline > 0 ? value / baseline : 0;
  if (value >= p95 && p95 > 0) {
    return 'bg-rose-900/70';
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

export default function CalendarGrid({
  month,
  aggregates,
  selectedDate,
  onSelectDate,
  onMonthChange,
  onToday,
  showIncome,
  loading = false,
  maxExpense,
  p80Expense,
  p95Expense,
}: CalendarGridProps) {
  const monthLabel = format(month, 'LLLL yyyy', { locale: localeId });
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  const handlePrev = () => {
    onMonthChange(addMonths(month, -1));
  };

  const handleNext = () => {
    onMonthChange(addMonths(month, 1));
  };

  const getHeatmapClass = (value: number) =>
    getHeatmapClassForValue(value, maxExpense, p80Expense, p95Expense);

  return (
    <section className="rounded-3xl bg-slate-950/70 p-4 shadow-lg ring-1 ring-slate-900/60">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 text-slate-200 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            aria-label="Bulan sebelumnya"
          >
            ‹
          </button>
          <h2 className="text-lg font-semibold text-slate-100">{monthLabel}</h2>
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 text-slate-200 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            aria-label="Bulan berikutnya"
          >
            ›
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToday}
            className="inline-flex items-center rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            Today
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {WEEK_DAYS.map((label) => (
          <div key={label} className="text-center">
            {label}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2 md:gap-3">
        {loading
          ? Array.from({ length: 35 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="h-28 rounded-2xl border border-slate-800 bg-slate-900/40 animate-pulse"
              />
            ))
          : days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const aggregate = aggregates[key];
              const isCurrent = isSameMonth(day, month);
              const selected = selectedDate ? isSameDay(day, selectedDate) : false;
              return (
                <DayCell
                  key={key}
                  date={day}
                  aggregate={aggregate}
                  isCurrentMonth={isCurrent}
                  isSelected={selected}
                  isToday={isToday(day)}
                  onSelect={(value) => {
                    if (!isCurrent) return;
                    onSelectDate(value);
                  }}
                  getHeatmapClass={getHeatmapClass}
                  showIncome={showIncome}
                />
              );
            })}
      </div>
    </section>
  );
}
