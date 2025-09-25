import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { CalendarDays, RefreshCcw } from 'lucide-react';
import {
  formatDateInputValue,
  formatDateIso,
  getPresetRange,
  normalizeRange,
  parseDateInJakarta,
  type DateRange,
  type PeriodPreset,
} from '../../lib/date-range';

const PRESETS: Array<{ value: PeriodPreset; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
];

interface PeriodPickerProps {
  range: DateRange;
  preset: PeriodPreset;
  onChange: (preset: PeriodPreset, range: DateRange) => void;
  onRefresh?: () => void;
  loading?: boolean;
}

function sanitizeRange(range: DateRange): DateRange {
  const normalized = normalizeRange(range);
  const startIso = formatDateIso(normalized.start);
  const endIso = formatDateIso(normalized.end);
  const startDate = parseDateInJakarta(startIso);
  const endDate = parseDateInJakarta(endIso);
  if (endDate.getTime() < startDate.getTime()) {
    return { start: startDate, end: startDate };
  }
  return { start: startDate, end: endDate };
}

export default function PeriodPicker({ range, preset, onChange, onRefresh, loading = false }: PeriodPickerProps) {
  const [customStart, setCustomStart] = useState(() => formatDateInputValue(range.start));
  const [customEnd, setCustomEnd] = useState(() => formatDateInputValue(range.end));

  useEffect(() => {
    const nextStart = formatDateInputValue(range.start);
    const nextEnd = formatDateInputValue(range.end);
    setCustomStart(nextStart);
    setCustomEnd(nextEnd);
  }, [range.start, range.end]);

  const handlePresetChange = useCallback(
    (value: PeriodPreset) => {
      if (value === 'custom') {
        onChange('custom', sanitizeRange(range));
        return;
      }
      const nextRange = sanitizeRange(getPresetRange(value));
      onChange(value, nextRange);
    },
    [onChange, range],
  );

  const handleCustomChange = useCallback(
    (nextStartValue: string, nextEndValue: string) => {
      if (!nextStartValue || !nextEndValue) return;
      const startDate = parseDateInJakarta(nextStartValue);
      const endDate = parseDateInJakarta(nextEndValue);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return;
      const safeRange = sanitizeRange({ start: startDate, end: endDate });
      onChange('custom', safeRange);
    },
    [onChange],
  );

  const refreshDisabled = loading;

  const refreshButton = useMemo(() => {
    if (!onRefresh) return null;
    return (
      <button
        type="button"
        onClick={() => {
          if (refreshDisabled) return;
          onRefresh();
        }}
        className="inline-flex h-10 items-center justify-center rounded-xl border border-transparent bg-primary/10 px-3 text-sm font-medium text-primary transition hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={refreshDisabled}
        title="Muat ulang ringkasan"
      >
        <RefreshCcw className={clsx('h-4 w-4', refreshDisabled && 'animate-spin')} aria-hidden="true" />
        <span className="sr-only">Muat ulang</span>
      </button>
    );
  }, [onRefresh, refreshDisabled]);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-gradient-to-b from-white/80 to-white/40 p-4 shadow-sm backdrop-blur dark:from-zinc-900/60 dark:to-zinc-900/30 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary" title="Pilih periode">
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Periode</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handlePresetChange(option.value)}
                className={clsx(
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  option.value === preset
                    ? 'border-primary/50 bg-primary/10 text-primary shadow-sm'
                    : 'border-border/60 bg-white/60 text-muted-foreground hover:border-primary/20 hover:text-foreground dark:bg-zinc-900/40',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex flex-col text-xs font-medium text-muted-foreground">
              Mulai
              <input
                type="date"
                value={customStart}
                onChange={(event) => {
                  const value = event.target.value;
                  setCustomStart(value);
                  handleCustomChange(value, customEnd);
                }}
                className="mt-1 h-11 rounded-2xl border border-border/60 bg-white/80 px-3 text-sm shadow-sm transition focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-zinc-900/60"
              />
            </label>
            <label className="flex flex-col text-xs font-medium text-muted-foreground">
              Selesai
              <input
                type="date"
                value={customEnd}
                onChange={(event) => {
                  const value = event.target.value;
                  setCustomEnd(value);
                  handleCustomChange(customStart, value);
                }}
                className="mt-1 h-11 rounded-2xl border border-border/60 bg-white/80 px-3 text-sm shadow-sm transition focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-zinc-900/60"
              />
            </label>
          </div>
        )}
        {refreshButton}
      </div>
    </section>
  );
}
