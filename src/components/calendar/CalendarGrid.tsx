import { useMemo } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, parseISO } from 'date-fns';
import DayCell from './DayCell';
import { DaySummary } from '../../hooks/useMonthAggregates';

import 'react-day-picker/style.css';

interface CalendarGridProps {
  month: Date;
  summaries: DaySummary[];
  selectedDay?: string | null;
  onSelectDay?: (day: string) => void;
  onMonthChange?: (month: Date) => void;
}

export default function CalendarGrid({
  month,
  summaries,
  selectedDay,
  onSelectDay,
  onMonthChange,
}: CalendarGridProps) {
  const summaryMap = useMemo(() => {
    return new Map(summaries.map((item) => [item.date, item]));
  }, [summaries]);

  const selectedDate = selectedDay ? parseISO(selectedDay) : undefined;

  return (
    <DayPicker
      mode="single"
      month={month}
      onMonthChange={onMonthChange}
      selected={selectedDate}
      showOutsideDays
      weekStartsOn={1}
      onSelect={(date) => {
        if (!date) return;
        const key = format(date, 'yyyy-MM-dd');
        onSelectDay?.(key);
      }}
      disableNavigation
      className="w-full"
      classNames={{
        months: 'w-full',
        month: 'w-full space-y-4',
        caption: 'hidden',
        table: 'w-full border-collapse',
        tbody: 'grid grid-cols-7 gap-2 md:gap-3',
        tr: 'contents',
        head: 'mb-2 grid grid-cols-7 gap-2 text-xs uppercase tracking-wide text-slate-400 md:text-sm',
        head_row: 'contents',
        head_cell: 'text-center',
        day: 'h-full w-full',
        day_button: 'h-full w-full',
        row: 'contents',
      }}
      components={{
        DayContent: (props) => (
          <DayCell
            date={props.date}
            summary={summaryMap.get(format(props.date, 'yyyy-MM-dd'))}
            isOutside={props.outside}
            isSelected={
              selectedDay === format(props.date, 'yyyy-MM-dd') && !props.outside
            }
            onSelect={onSelectDay}
          />
        ),
      }}
    />
  );
}
