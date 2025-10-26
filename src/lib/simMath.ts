import { differenceInCalendarDays, endOfMonth, parseISO, startOfWeek, subWeeks } from 'date-fns';

type ProjectionMethod = 'linear' | 'fourWeek' | 'static';

export type { ProjectionMethod };

export interface ProjectionContext {
  periodMonth: string; // YYYY-MM-01
  daysInMonth: number;
  daysElapsed: number;
  totalWeeks: number;
}

export interface CategoryActualSeries {
  /** raw amount spent within the month */
  actualMtd: number;
  /** weekly totals aligned with context.weeks order */
  weeklyActuals: number[];
  /** trailing weeks actual totals (latest at end of array) */
  trailingWeeklyActuals: number[];
}

export function toMonthStart(period: string): string {
  if (period.length === 7) {
    return `${period}-01`;
  }
  return period;
}

export function getDaysInMonth(periodMonth: string): number {
  const start = parseISO(periodMonth);
  const end = endOfMonth(start);
  return differenceInCalendarDays(end, start) + 1;
}

export function calculateDaysElapsed(periodMonth: string): number {
  const start = parseISO(periodMonth);
  const today = new Date();
  const monthEnd = endOfMonth(start);
  if (today < start) {
    return 0;
  }
  if (today > monthEnd) {
    return differenceInCalendarDays(monthEnd, start) + 1;
  }
  return differenceInCalendarDays(today, start) + 1;
}

export function calculateLinearProjection(actual: number, daysElapsed: number, daysInMonth: number): number {
  if (!Number.isFinite(actual) || actual <= 0) {
    return Math.max(actual, 0);
  }
  if (!Number.isFinite(daysElapsed) || daysElapsed <= 0) {
    return Math.max(actual, 0);
  }
  const averagePerDay = actual / daysElapsed;
  return averagePerDay * daysInMonth;
}

export function calculateTrailingFourWeekProjection(
  weeklyActuals: number[],
  totalWeeks: number
): number {
  if (!weeklyActuals.length) {
    return 0;
  }
  const slice = weeklyActuals.slice(-4);
  const valid = slice.filter((value) => Number.isFinite(value));
  if (!valid.length) {
    return 0;
  }
  const avg = valid.reduce((acc, value) => acc + value, 0) / valid.length;
  return avg * Math.max(totalWeeks, 1);
}

export function calculateStaticProjection(actual: number): number {
  return Math.max(actual, 0);
}

export function projectAmount(
  method: ProjectionMethod,
  context: ProjectionContext,
  actualSeries: CategoryActualSeries
): number {
  switch (method) {
    case 'fourWeek':
      return calculateTrailingFourWeekProjection(actualSeries.trailingWeeklyActuals, context.totalWeeks);
    case 'static':
      return calculateStaticProjection(actualSeries.actualMtd);
    case 'linear':
    default:
      return calculateLinearProjection(actualSeries.actualMtd, context.daysElapsed, context.daysInMonth);
  }
}

export type RiskTier = 'low' | 'medium' | 'high' | 'critical';

export function getRiskTier(percentage: number): RiskTier {
  if (!Number.isFinite(percentage)) {
    return 'low';
  }
  if (percentage < 0.75) {
    return 'low';
  }
  if (percentage < 0.9) {
    return 'medium';
  }
  if (percentage <= 1) {
    return 'high';
  }
  return 'critical';
}

export function getWeekStartIso(date: string | Date): string {
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return startOfWeek(parsed, { weekStartsOn: 1 }).toISOString().slice(0, 10);
}

export function getTrailingWeekStarts(periodMonth: string, count: number): string[] {
  const periodStart = parseISO(periodMonth);
  const firstWeek = startOfWeek(periodStart, { weekStartsOn: 1 });
  const result: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const week = subWeeks(firstWeek, i);
    result.push(week.toISOString().slice(0, 10));
  }
  return result;
}
