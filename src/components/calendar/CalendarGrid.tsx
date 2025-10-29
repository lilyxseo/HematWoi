import { addDays, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import DayCell from './DayCell';
import type { DaySummary } from '../../lib/calendarApi';

interface CalendarGridProps {
  month: Date;
  selectedDate: string | null;
  summaries: Record<string, DaySummary>;
  p80: number;
  p95: number;
  maxExpense: number;
  onSelectDate: (date: string) => void;
  isLoading?: boolean;
}

const DATE_KEY_FORMAT = 'yyyy-MM-dd';

export default function CalendarGrid({
  month,
  selectedDate,
  summaries,
  p80,
  p95,
  maxExpense,
  onSelectDate,
  isLoading = false,
}: CalendarGridProps) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });

  const allDays = eachDayOfInterval({ start, end });
  const weeks: Date[][] = [];
  for (let index = 0; index < allDays.length; index += 7) {
    weeks.push(allDays.slice(index, index + 7));
  }

  const weekdayLabels = weeks[0]?.map((day, index) => {
    const reference = addDays(start, index);
    return format(reference, 'EEE', { locale: localeId });
  });

  const selectedDateObj = selectedDate
    ? new Date(`${selectedDate}T00:00:00`)
    : null;

  return (
    <div className="relative">
      <div className="grid grid-cols-7 gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 md:gap-2">
        {(weekdayLabels ?? ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']).map((label) => (
          <div key={label} className="px-1 py-1 text-center">
            {label}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5 md:gap-2" role="grid">
        {weeks.map((week, rowIndex) => (
          <div key={`week-${rowIndex}`} className="contents">
            {week.map((day) => {
              const key = format(day, DATE_KEY_FORMAT);
              const summary = summaries[key];
              const isCurrentMonth = isSameMonth(day, month);
              const selected = selectedDateObj ? isSameDay(day, selectedDateObj) : false;
              const today = isToday(day);
              return (
                <div key={key} role="gridcell" className="min-w-0">
                  <DayCell
                    date={day}
                    summary={summary}
                    isCurrentMonth={isCurrentMonth}
                    isSelected={selected}
                    isToday={today}
                    p80={p80}
                    p95={p95}
                    maxExpense={maxExpense}
                    onSelect={(next) => onSelectDate(format(next, DATE_KEY_FORMAT))}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {isLoading ? (
        <div className="pointer-events-none absolute inset-0 rounded-2xl border border-slate-800/80 bg-slate-950/70 backdrop-blur-sm">
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-[var(--accent)]" aria-label="Memuat kalender" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
