export const JAKARTA_TIMEZONE = 'Asia/Jakarta';

const ISO_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: JAKARTA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const HUMAN_FULL_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  timeZone: JAKARTA_TIMEZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const HUMAN_MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  timeZone: JAKARTA_TIMEZONE,
  month: 'short',
  year: 'numeric',
});

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: JAKARTA_TIMEZONE,
  weekday: 'short',
});

const WEEKDAY_TO_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export type PeriodPreset = 'today' | 'week' | 'month' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export function formatDateIso(date: Date): string {
  return ISO_DATE_FORMATTER.format(date);
}

export function parseDateInJakarta(isoDate: string): Date {
  if (!isoDate) return new Date(NaN);
  return new Date(`${isoDate}T00:00:00+07:00`);
}

export function startOfTodayJakarta(reference: Date = new Date()): Date {
  return parseDateInJakarta(formatDateIso(reference));
}

export function startOfWeekJakarta(reference: Date = new Date()): Date {
  const today = startOfTodayJakarta(reference);
  const weekdayKey = WEEKDAY_FORMATTER.format(reference).slice(0, 3).toLowerCase();
  const weekdayIndex = WEEKDAY_TO_INDEX[weekdayKey] ?? 0;
  const offset = (weekdayIndex + 6) % 7;
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - offset);
  return start;
}

export function startOfMonthJakarta(reference: Date = new Date()): Date {
  const iso = formatDateIso(reference);
  const [year, month] = iso.split('-');
  const firstDayIso = `${year}-${month}-01`;
  return parseDateInJakarta(firstDayIso);
}

export function normalizeRange(range: DateRange): DateRange {
  if (!range.start || !range.end) return range;
  if (range.start.getTime() <= range.end.getTime()) {
    return range;
  }
  return { start: range.end, end: range.start };
}

export function getPresetRange(preset: PeriodPreset, reference: Date = new Date()): DateRange {
  const today = startOfTodayJakarta(reference);
  if (preset === 'today') {
    return { start: today, end: today };
  }

  if (preset === 'week') {
    const start = startOfWeekJakarta(reference);
    return normalizeRange({ start, end: today });
  }

  if (preset === 'month') {
    const start = startOfMonthJakarta(reference);
    return normalizeRange({ start, end: today });
  }

  return { start: today, end: today };
}

export function formatDateInputValue(date: Date): string {
  return formatDateIso(date);
}

export function formatRangeLabel(start: Date, end: Date): string {
  const startIso = formatDateIso(start);
  const endIso = formatDateIso(end);

  if (startIso === endIso) {
    return HUMAN_FULL_FORMATTER.format(end);
  }

  const sameMonth = startIso.slice(0, 7) === endIso.slice(0, 7);

  if (sameMonth) {
    const startDay = Number.parseInt(startIso.slice(8, 10), 10);
    const endDay = Number.parseInt(endIso.slice(8, 10), 10);
    const monthYear = HUMAN_MONTH_YEAR_FORMATTER.format(end);
    return `${startDay}–${endDay} ${monthYear}`;
  }

  return `${HUMAN_FULL_FORMATTER.format(start)} – ${HUMAN_FULL_FORMATTER.format(end)}`;
}
