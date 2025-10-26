export type ProjectionMode = 'linear-mtd' | 'trailing-weeks' | 'flat';

export interface ProjectionInput {
  actual: number;
  periodMonth: string; // YYYY-MM-01 or YYYY-MM
  weeklyActuals?: Array<{ weekStart: string; amount: number }>;
}

export function normalizeNumber(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

export function toMonthStart(period: string): string {
  if (period.length === 7) {
    return `${period}-01`;
  }
  return period;
}

function getMonthBounds(periodMonth: string): { start: Date; end: Date } {
  const normalized = toMonthStart(periodMonth);
  const base = new Date(`${normalized}T00:00:00.000Z`);
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0));
  return { start, end };
}

export function countMonthDays(periodMonth: string): number {
  const { start, end } = getMonthBounds(periodMonth);
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff + 1;
}

export function countElapsedDays(periodMonth: string): number {
  const { start } = getMonthBounds(periodMonth);
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  if (todayUTC < start) {
    return 0;
  }
  const diff = Math.round((todayUTC.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff + 1;
}

export function projectLinearMTD({ actual, periodMonth }: ProjectionInput): number {
  const elapsed = countElapsedDays(periodMonth);
  const totalDays = countMonthDays(periodMonth);
  if (elapsed <= 0) {
    return actual;
  }
  const average = actual / elapsed;
  return average * totalDays;
}

export function projectTrailingWeeks({ actual, weeklyActuals, periodMonth }: ProjectionInput): number {
  if (!weeklyActuals || weeklyActuals.length === 0) {
    return projectLinearMTD({ actual, weeklyActuals, periodMonth });
  }
  const sorted = [...weeklyActuals].sort((a, b) => (a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0));
  const lastFour = sorted.slice(-4);
  const total = lastFour.reduce((sum, week) => sum + normalizeNumber(week.amount), 0);
  const average = total / Math.max(1, lastFour.length);
  const weeksInMonth = Math.max(1, Math.round(countMonthDays(periodMonth) / 7));
  return average * weeksInMonth;
}

export function projectFlat({ actual }: ProjectionInput): number {
  return actual;
}

export function projectValue(mode: ProjectionMode, input: ProjectionInput): number {
  switch (mode) {
    case 'linear-mtd':
      return projectLinearMTD(input);
    case 'trailing-weeks':
      return projectTrailingWeeks(input);
    case 'flat':
    default:
      return projectFlat(input);
  }
}

export function clampCurrency(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const rounded = Math.round(value * 100) / 100;
  if (Object.is(rounded, -0)) {
    return 0;
  }
  return rounded;
}

