import { useMemo } from 'react';
import DayCell from './DayCell';
import type { DayAggregate } from '../../hooks/useMonthAggregates';

const WEEK_START = 1; // Monday

export type HeatmapScale = {
  p80: number;
  p95: number;
  maxExpense: number;
};

export interface CalendarGridProps {
  month: Date;
  aggregates: Record<string, DayAggregate>;
  percentiles: HeatmapScale;
  loading?: boolean;
  selectedDate?: string | null;
  onSelectDate: (date: string) => void;
}

function toDateKey(value: Date): string {
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${value.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(value: Date): Date {
  const day = value.getUTCDay();
  const diff = (day < WEEK_START ? 7 : 0) + day - WEEK_START;
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() - diff);
  return new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth(), result.getUTCDate()));
}

function endOfWeek(value: Date): Date {
  const start = startOfWeek(value);
  start.setUTCDate(start.getUTCDate() + 6);
  return start;
}

function startOfMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function endOfMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));
}

function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

const WEEKDAY_LABELS = Array.from({ length: 7 }).map((_, index) => {
  const base = new Date(Date.UTC(2023, 0, 2 + index));
  const formatter = new Intl.DateTimeFormat('id-ID', { weekday: 'short' });
  return formatter.format(base);
});

export default function CalendarGrid({
  month,
  aggregates,
  percentiles,
  loading = false,
  selectedDate,
  onSelectDate,
}: CalendarGridProps) {
  const todayKey = useMemo(() => toDateKey(new Date()), []);

  const { dayItems, monthKey } = useMemo(() => {
    const normalizedMonth = startOfMonth(new Date(month));
    const monthKeyValue = toDateKey(normalizedMonth);
    const monthEnd = endOfMonth(normalizedMonth);
    const rangeStart = startOfWeek(normalizedMonth);
    const rangeEnd = endOfWeek(monthEnd);
    const days = eachDay(rangeStart, rangeEnd).map((date) => {
      const key = toDateKey(date);
      return {
        date,
        key,
        isCurrentMonth:
          date.getUTCMonth() === normalizedMonth.getUTCMonth() &&
          date.getUTCFullYear() === normalizedMonth.getUTCFullYear(),
        isToday: key === todayKey,
      };
    });
    return { dayItems: days, monthKey: monthKeyValue };
  }, [month, todayKey]);

  return (
    <section aria-label="Kalender transaksi bulanan" className="w-full min-w-0">
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-muted md:gap-3">
        {WEEKDAY_LABELS.map((label, index) => (
          <div key={`${label}-${index}`} className="px-1">
            {label}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2 md:mt-3 md:gap-3">
        {dayItems.map(({ date, key, isCurrentMonth, isToday }) => (
          <DayCell
            key={`${monthKey}-${key}`}
            date={date}
            dateKey={key}
            isCurrentMonth={isCurrentMonth}
            isToday={isToday}
            selected={selectedDate === key}
            aggregate={aggregates[key]}
            loading={loading}
            percentiles={percentiles}
            onSelect={onSelectDate}
          />
        ))}
      </div>
    </section>
  );
}
