const FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const existing = FORMATTER_CACHE.get(timeZone);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  FORMATTER_CACHE.set(timeZone, formatter);
  return formatter;
}

export function toZonedDate(value: Date | string | number, timeZone: string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = getFormatter(timeZone).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  const year = lookup.year;
  const month = (lookup.month || 1) - 1;
  const day = lookup.day || 1;
  const hour = lookup.hour || 0;
  const minute = lookup.minute || 0;
  const second = lookup.second || 0;
  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

export function startOfDayZoned(date: Date, timeZone: string): Date {
  const zoned = toZonedDate(date, timeZone) ?? new Date(date.getTime());
  return new Date(Date.UTC(zoned.getUTCFullYear(), zoned.getUTCMonth(), zoned.getUTCDate()));
}

export function startOfWeekZoned(date: Date, timeZone: string): Date {
  const zoned = toZonedDate(date, timeZone) ?? new Date(date.getTime());
  const day = zoned.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const result = new Date(zoned);
  result.setUTCDate(zoned.getUTCDate() - daysSinceMonday);
  return new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth(), result.getUTCDate()));
}

export function startOfMonthZoned(date: Date, timeZone: string): Date {
  const zoned = toZonedDate(date, timeZone) ?? new Date(date.getTime());
  return new Date(Date.UTC(zoned.getUTCFullYear(), zoned.getUTCMonth(), 1));
}

export function endOfDayZoned(date: Date, timeZone: string): Date {
  const start = startOfDayZoned(date, timeZone);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function differenceInDaysUtc(later: Date, earlier: Date): number {
  const diff = later.getTime() - earlier.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

export function daysInMonth(date: Date): number {
  return new Date(date.getUTCFullYear(), date.getUTCMonth() + 1, 0).getUTCDate();
}

export function clampTimestamp(value: Date | null | undefined): number {
  if (!value) return 0;
  const time = value.getTime();
  return Number.isFinite(time) ? time : 0;
}
