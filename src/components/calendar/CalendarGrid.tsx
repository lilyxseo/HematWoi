import { addDays, eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import clsx from 'clsx';
import DayCell from './DayCell';
import type { DaySummary } from '../../hooks/useMonthAggregates';

const WEEKDAY_LABELS = Array.from({ length: 7 }).map((_, index) =>
  format(addDays(startOfWeek(new Date(2020, 0, 6), { weekStartsOn: 1 }), index), 'EEE'),
);

export interface CalendarGridProps {
  month: Date;
  days: Record<string, DaySummary>;
  onSelectDate: (dateKey: string) => void;
  selectedDate?: string | null;
  getHeatmapClass: (value: number) => string;
  showIncome: boolean;
  loading?: boolean;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

export default function CalendarGrid({
  month,
  days,
  onSelectDate,
  selectedDate,
  getHeatmapClass,
  showIncome,
  loading = false,
}: CalendarGridProps) {
  const calendarStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weeks = chunk(allDays, 7);

  return (
    <div className="w-full">
      <div className="mb-3 grid grid-cols-7 gap-2 text-center text-xs font-medium uppercase tracking-wide text-muted">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="rounded-lg bg-surface-2/60 py-1">
            {label}
          </span>
        ))}
      </div>
      <div
        className={clsx(
          'grid grid-cols-7 gap-2 md:gap-3',
          loading && 'animate-pulse',
        )}
        aria-busy={loading}
      >
        {weeks.map((week, weekIndex) => (
          <div key={`week-${weekIndex}`} className="contents">
            {week.map((date) => {
              const dateKey = format(date, 'yyyy-MM-dd');
              const summary = days[dateKey];
              const heatmapClass = getHeatmapClass(summary?.expenseTotal ?? 0);
              const isCurrentMonth = date.getMonth() === month.getMonth();
              const isSelected = selectedDate === dateKey;
              return (
                <DayCell
                  key={dateKey}
                  date={date}
                  dateKey={dateKey}
                  summary={summary}
                  isCurrentMonth={isCurrentMonth}
                  isSelected={Boolean(isSelected)}
                  onSelect={onSelectDate}
                  heatmapClass={heatmapClass}
                  showIncome={showIncome}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
