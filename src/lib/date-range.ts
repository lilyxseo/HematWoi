const TIME_ZONE_OFFSET_HOURS = 7; // Asia/Jakarta (UTC+7)
const OFFSET_MS = TIME_ZONE_OFFSET_HOURS * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DateRangeValue = {
  start: string;
  end: string;
};

const pad = (value: number) => String(value).padStart(2, "0");

const toTzDate = (date: Date) => new Date(date.getTime() + OFFSET_MS);

const fromTzDateParts = (year: number, monthIndex: number, day: number) =>
  new Date(Date.UTC(year, monthIndex, day) - OFFSET_MS);

export const startOfDayInTz = (date: Date) => {
  const tzDate = toTzDate(date);
  return fromTzDateParts(
    tzDate.getUTCFullYear(),
    tzDate.getUTCMonth(),
    tzDate.getUTCDate()
  );
};

export const toDateInputValue = (date: Date) => {
  const tzDate = toTzDate(date);
  const year = tzDate.getUTCFullYear();
  const month = pad(tzDate.getUTCMonth() + 1);
  const day = pad(tzDate.getUTCDate());
  return `${year}-${month}-${day}`;
};

export const parseDateInput = (value: string) =>
  new Date(`${value}T00:00:00+07:00`);

export const ensureRangeOrder = ({ start, end }: DateRangeValue): DateRangeValue => {
  const startDate = parseDateInput(start);
  const endDate = parseDateInput(end);
  if (startDate.getTime() <= endDate.getTime()) {
    return { start, end };
  }
  return { start: end, end: start };
};

export const getTodayRange = (): DateRangeValue => {
  const today = startOfDayInTz(new Date());
  const value = toDateInputValue(today);
  return { start: value, end: value };
};

export const getThisWeekRange = (): DateRangeValue => {
  const today = startOfDayInTz(new Date());
  const tzToday = toTzDate(today);
  const weekday = tzToday.getUTCDay();
  const mondayOffset = (weekday + 6) % 7;
  const start = new Date(today.getTime() - mondayOffset * DAY_MS);
  return {
    start: toDateInputValue(start),
    end: toDateInputValue(today),
  };
};

export const getThisMonthRange = (): DateRangeValue => {
  const today = startOfDayInTz(new Date());
  const tzToday = toTzDate(today);
  const start = fromTzDateParts(tzToday.getUTCFullYear(), tzToday.getUTCMonth(), 1);
  return {
    start: toDateInputValue(start),
    end: toDateInputValue(today),
  };
};

export const toQueryDate = (date: Date) => toDateInputValue(date);

const monthFormatter = new Intl.DateTimeFormat("id-ID", {
  month: "short",
  timeZone: "Asia/Jakarta",
});

const dayFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  timeZone: "Asia/Jakarta",
});

const yearFormatter = new Intl.DateTimeFormat("id-ID", {
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

export const formatRangeLabel = ({ start, end }: DateRangeValue) => {
  const startDate = parseDateInput(start);
  const endDate = parseDateInput(end);

  const startMonth = monthFormatter.format(startDate);
  const endMonth = monthFormatter.format(endDate);
  const startYear = yearFormatter.format(startDate);
  const endYear = yearFormatter.format(endDate);
  const startDay = dayFormatter.format(startDate);
  const endDay = dayFormatter.format(endDate);

  if (startYear === endYear) {
    if (startMonth === endMonth) {
      return `${startDay}–${endDay} ${startMonth} ${startYear}`;
    }
    return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${startYear}`;
  }

  return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
};

