import { useMemo } from 'react';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  addDays,
} from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import clsx from 'clsx';
import DayCell from './DayCell';
import { DaySummary } from '../../hooks/useMonthAggregates';
import { PercentileSummary } from '../../lib/calendarApi';

const WEEK_DAYS = (() => {
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, index) =>
    format(addDays(start, index), 'EEE', { locale: localeId }),
  );
})();

interface CalendarGridProps {
  month: Date;
  days: DaySummary[];
  onSelectDay: (date: string) => void;
  selectedDate: string | null;
  heatmap: PercentileSummary;
  isLoading?: boolean;
}

export default function CalendarGrid({
  month,
  days,
  onSelectDay,
  selectedDate,
  heatmap,
  isLoading = false,
}: CalendarGridProps) {
  const map = useMemo(() => {
    const result = new Map<string, DaySummary>();
    for (const day of days) {
      result.set(day.date, day);
    }
    return result;
  }, [days]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400 md:gap-3">
        {WEEK_DAYS.map((label) => (
          <span key={label} className="truncate">
            {label}
          </span>
        ))}
      </div>
      <div
        className={clsx('grid grid-cols-7 gap-2 md:gap-3', isLoading && 'opacity-70')}
        aria-busy={isLoading}
      >
        {calendarDays.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const summary = map.get(key);
          return (
            <div key={key} className="min-h-[110px]">
              <DayCell
                day={day}
                summary={summary}
                isCurrentMonth={isSameMonth(day, month)}
                isToday={isToday(day)}
                isSelected={Boolean(selectedDate && isSameDay(day, new Date(selectedDate)))}
                onSelect={() => onSelectDay(key)}
                heatmap={heatmap}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
