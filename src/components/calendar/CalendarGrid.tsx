import { useMemo } from 'react';
import { DayPicker, type DayButtonProps, type ClassNames } from 'react-day-picker';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import clsx from 'clsx';
import DayCell from './DayCell';
import type { DayAggregate, HeatmapStats } from '../../hooks/useMonthAggregates';

export type CalendarGridProps = {
  month: Date;
  selectedDate: Date | undefined;
  onSelectDate: (date: Date | undefined) => void;
  onMonthChange: (month: Date) => void;
  aggregates: Record<string, DayAggregate>;
  heatmap: HeatmapStats;
  isLoading?: boolean;
};

const classNames: Partial<ClassNames> = {
  root: 'w-full',
  months: 'w-full',
  month: 'w-full',
  caption: 'sr-only',
  nav: 'hidden',
  head_row: 'text-[11px] uppercase tracking-[0.24em] text-muted',
  head_cell: 'text-center font-semibold',
  row: 'w-full',
  cell: 'p-0 align-top',
  day: 'p-0',
  day_button: 'w-full',
};

const styles = {
  head_row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: '0.5rem',
    paddingBottom: '0.5rem',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: '0.5rem',
  },
  head_cell: {
    padding: 0,
  },
  cell: {
    padding: 0,
  },
};

export default function CalendarGrid({
  month,
  selectedDate,
  onSelectDate,
  onMonthChange,
  aggregates,
  heatmap,
  isLoading = false,
}: CalendarGridProps) {
  const aggregatesMap = useMemo(() => new Map(Object.entries(aggregates ?? {})), [aggregates]);

  const renderDayButton = (props: DayButtonProps) => {
    const key = format(props.day.date, 'yyyy-MM-dd');
    const aggregate = aggregatesMap.get(key);
    return <DayCell {...props} aggregate={aggregate} heatmap={heatmap} />;
  };

  return (
    <div className="relative">
      <DayPicker
        mode="single"
        month={month}
        onMonthChange={onMonthChange}
        selected={selectedDate}
        onSelect={onSelectDate}
        showOutsideDays
        locale={localeId}
        weekStartsOn={1}
        classNames={classNames}
        styles={styles}
        components={{ DayButton: renderDayButton }}
        modifiers={{}}
        className={clsx('rounded-3xl border border-slate-800/70 bg-surface-1/80 p-4 shadow-sm backdrop-blur')}
        aria-busy={isLoading}
      />
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-surface-1/60 backdrop-blur-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-transparent" aria-hidden="true" />
          <span className="sr-only">Memuat kalender...</span>
        </div>
      ) : null}
    </div>
  );
}
