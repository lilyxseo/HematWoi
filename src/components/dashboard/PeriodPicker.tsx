import { useMemo } from 'react';
import { CalendarRange, RotateCcw } from 'lucide-react';

const PRESETS = ['today', 'thisWeek', 'thisMonth', 'custom'] as const;

export type PeriodPreset = (typeof PRESETS)[number];

export type PeriodSelection = {
  preset: PeriodPreset;
  start: Date;
  end: Date;
};

type PeriodPickerProps = {
  value: PeriodSelection;
  onChange: (value: PeriodSelection) => void;
  onRefresh?: () => void;
  loading?: boolean;
};

function formatInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clampRange(start: Date, end: Date): { start: Date; end: Date } {
  if (start > end) {
    return { start: end, end: start };
  }
  return { start, end };
}

function withStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = withStartOfDay(now);
  const end = withStartOfDay(now);
  return { start, end };
}

function getThisWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const end = withStartOfDay(now);
  const currentDay = end.getDay();
  const mondayIndex = (currentDay + 6) % 7; // Monday as first day
  const start = new Date(end);
  start.setDate(end.getDate() - mondayIndex);
  return { start, end };
}

function getThisMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = withStartOfDay(now);
  return { start, end };
}

function parseDateInput(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function labelForPreset(preset: PeriodPreset): string {
  switch (preset) {
    case 'today':
      return 'Today';
    case 'thisWeek':
      return 'This Week';
    case 'thisMonth':
      return 'This Month';
    case 'custom':
    default:
      return 'Custom';
  }
}

export function getInitialSelection(): PeriodSelection {
  const { start, end } = getThisMonthRange();
  return { preset: 'thisMonth', start, end };
}

export function labelRange(start: Date, end: Date): string {
  const intl = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });

  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    const startDay = start.getDate();
    const endDay = end.getDate();
    const month = intl.formatToParts(start).find((part) => part.type === 'month')?.value ?? '';
    const year = start.getFullYear();
    return `${startDay}\u2013${endDay} ${month} ${year}`;
  }

  return `${intl.format(start)} – ${intl.format(end)}`;
}

export default function PeriodPicker({ value, onChange, onRefresh, loading }: PeriodPickerProps) {
  const { preset, start, end } = value;

  const presets = useMemo(
    () => ({
      today: getTodayRange,
      thisWeek: getThisWeekRange,
      thisMonth: getThisMonthRange,
      custom: () => ({ start, end }),
    }),
    [start, end]
  );

  const handlePresetClick = (nextPreset: PeriodPreset) => {
    const rangeFactory = presets[nextPreset];
    const range = rangeFactory();
    const selection: PeriodSelection = {
      preset: nextPreset,
      start: range.start,
      end: range.end,
    };
    onChange(selection);
  };

  const handleDateChange = (key: 'start' | 'end', dateString: string) => {
    if (!dateString) return;
    const parsed = parseDateInput(dateString);
    const { start: nextStart, end: nextEnd } = clampRange(
      key === 'start' ? parsed : start,
      key === 'end' ? parsed : end
    );

    const selection: PeriodSelection = {
      preset: 'custom',
      start: withStartOfDay(nextStart),
      end: withStartOfDay(nextEnd),
    };
    onChange(selection);
  };

  const isLoading = Boolean(loading);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card/60 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((option) => {
          const active = preset === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => handlePresetClick(option)}
              className={`flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                active
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-transparent bg-muted/40 text-muted-foreground hover:border-primary/20 hover:bg-muted/60'
              }`}
            >
              <CalendarRange className="h-4 w-4" aria-hidden="true" />
              {labelForPreset(option)}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-2xl border border-transparent bg-muted/40 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary/20 hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
          title="Muat ulang"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-muted-foreground/40 bg-muted/20 p-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Dari</span>
            <input
              type="date"
              value={formatInputDate(start)}
              onChange={(event) => handleDateChange('start', event.target.value)}
              className="h-11 rounded-2xl border border-transparent bg-background px-3 text-base shadow-sm ring-2 ring-muted-foreground/10 focus:outline-none focus:ring-primary/40"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Sampai</span>
            <input
              type="date"
              value={formatInputDate(end)}
              onChange={(event) => handleDateChange('end', event.target.value)}
              className="h-11 rounded-2xl border border-transparent bg-background px-3 text-base shadow-sm ring-2 ring-muted-foreground/10 focus:outline-none focus:ring-primary/40"
            />
          </label>
        </div>
      )}
    </section>
  );
}
