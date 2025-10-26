export type ProjectionMode = 'linear-mtd' | 'four-week' | 'static';

export interface BaselineWeekMeta {
  start: string;
  end: string;
  label: string;
  sequence: number;
}

export interface BaselineCategoryData {
  categoryId: string;
  categoryName: string;
  categoryType: 'income' | 'expense' | null;
  monthlyPlanned: number;
  weeklyPlanned: Record<string, number>;
  weeklyActual: Record<string, number>;
  actualMtd: number;
}

export interface BaselineDataset {
  period: string; // YYYY-MM
  monthStart: string; // YYYY-MM-01
  weeks: BaselineWeekMeta[];
  categories: BaselineCategoryData[];
  daysInMonth: number;
  daysElapsed: number;
}

export interface SimulationDraftItem {
  deltaMonthly: number;
  deltaWeekly: Record<string, number>;
}

export interface SimulationInput {
  baseline: BaselineDataset;
  items: Record<string, SimulationDraftItem | undefined>;
  includeWeekly: boolean;
  lockedCategoryIds?: Set<string>;
  projectionMode: ProjectionMode;
}

export interface SimulationCategoryResult {
  categoryId: string;
  categoryName: string;
  categoryType: 'income' | 'expense' | null;
  baselinePlanned: number;
  simulatedPlanned: number;
  deltaPlanned: number;
  actualMtd: number;
  projectedEom: number;
  weeklyDetails: {
    weekStart: string;
    baseline: number;
    delta: number;
    simulated: number;
    actual: number;
  }[];
}

export interface SimulationRiskItem {
  categoryId: string;
  categoryName: string;
  categoryType: 'income' | 'expense' | null;
  projected: number;
  planned: number;
  progress: number;
}

export interface SimulationSummaryResult {
  totalBaselinePlanned: number;
  totalSimulatedPlanned: number;
  totalDeltaPlanned: number;
  totalActualMtd: number;
  totalProjected: number;
  balanceImpact: number;
}

export interface SimulationResult {
  summary: SimulationSummaryResult;
  categories: SimulationCategoryResult[];
  risks: SimulationRiskItem[];
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function sumValues(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

function projectLinear(actualMtd: number, daysElapsed: number, daysInMonth: number): number {
  if (daysElapsed <= 0 || daysInMonth <= 0) {
    return actualMtd;
  }
  if (actualMtd <= 0) {
    return 0;
  }
  const averagePerDay = actualMtd / daysElapsed;
  return averagePerDay * daysInMonth;
}

function projectFourWeekAverage(values: number[], numberOfWeeksInMonth: number): number {
  if (values.length === 0) {
    return 0;
  }
  const relevant = values.slice(-4);
  const average = sumValues(relevant) / relevant.length;
  if (!Number.isFinite(average) || average <= 0) {
    return 0;
  }
  return average * Math.max(1, numberOfWeeksInMonth);
}

function projectStatic(actualMtd: number): number {
  return Math.max(0, actualMtd);
}

function getWeeksInMonth(weeks: BaselineWeekMeta[]): number {
  if (!weeks.length) return 4;
  const uniqueStarts = new Set(weeks.map((week) => week.start));
  return uniqueStarts.size;
}

function computeProjected(
  category: BaselineCategoryData,
  weeklyDetails: SimulationCategoryResult['weeklyDetails'],
  input: SimulationInput
): number {
  const { projectionMode, baseline } = input;
  const actual = Math.max(0, toNumber(category.actualMtd));
  switch (projectionMode) {
    case 'static':
      return projectStatic(actual);
    case 'four-week': {
      const weeklyActuals = weeklyDetails
        .map((item) => Math.max(0, toNumber(item.actual)))
        .filter((value) => Number.isFinite(value));
      if (weeklyActuals.length === 0) {
        return projectLinear(actual, baseline.daysElapsed, baseline.daysInMonth);
      }
      return projectFourWeekAverage(weeklyActuals, getWeeksInMonth(baseline.weeks));
    }
    case 'linear-mtd':
    default:
      return projectLinear(actual, baseline.daysElapsed, baseline.daysInMonth);
  }
}

function computeWeeklyDetails(
  category: BaselineCategoryData,
  draftItem: SimulationDraftItem | undefined,
  weeks: BaselineWeekMeta[]
): SimulationCategoryResult['weeklyDetails'] {
  const deltaWeekly = draftItem?.deltaWeekly ?? {};
  const details: SimulationCategoryResult['weeklyDetails'] = [];
  for (const week of weeks) {
    const baselineValue = toNumber(category.weeklyPlanned[week.start]);
    const deltaValue = toNumber(deltaWeekly[week.start]);
    const actualValue = toNumber(category.weeklyActual[week.start]);
    const simulated = Math.max(0, baselineValue + deltaValue);
    details.push({
      weekStart: week.start,
      baseline: baselineValue,
      delta: deltaValue,
      simulated,
      actual: actualValue,
    });
  }
  return details;
}

export function calculateSimulation(input: SimulationInput): SimulationResult {
  const { baseline, items, includeWeekly, lockedCategoryIds } = input;
  const lockSet = lockedCategoryIds ?? new Set<string>();
  const categories: SimulationCategoryResult[] = [];
  let totalBaselinePlanned = 0;
  let totalSimulatedPlanned = 0;
  let totalActualMtd = 0;
  let totalProjected = 0;
  let balanceImpact = 0;

  for (const category of baseline.categories) {
    const draftItem = items[category.categoryId];
    const locked = lockSet.has(category.categoryId);
    const weeklyDetails = computeWeeklyDetails(category, draftItem, baseline.weeks);
    const weeklyBaselineSum = sumValues(weeklyDetails.map((detail) => detail.baseline));
    const weeklyDeltaSum = locked ? 0 : sumValues(weeklyDetails.map((detail) => detail.delta));
    const monthlyBaseline = Math.max(0, toNumber(category.monthlyPlanned));
    const monthlyDelta = locked ? 0 : toNumber(draftItem?.deltaMonthly ?? 0);

    const hasWeeklyBaseline = weeklyBaselineSum > 0;
    const baselinePlanned = includeWeekly && hasWeeklyBaseline ? weeklyBaselineSum : monthlyBaseline;
    const simulatedPlanned = includeWeekly && hasWeeklyBaseline
      ? Math.max(0, weeklyBaselineSum + weeklyDeltaSum)
      : Math.max(0, monthlyBaseline + monthlyDelta);

    const deltaPlanned = simulatedPlanned - baselinePlanned;

    const actualMtd = Math.max(0, toNumber(category.actualMtd));
    const projected = computeProjected(category, weeklyDetails, input);

    totalBaselinePlanned += baselinePlanned;
    totalSimulatedPlanned += simulatedPlanned;
    totalActualMtd += actualMtd;
    totalProjected += projected;

    if (category.categoryType === 'income') {
      balanceImpact += deltaPlanned;
    } else if (category.categoryType === 'expense' || !category.categoryType) {
      balanceImpact -= deltaPlanned;
    }

    categories.push({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      categoryType: category.categoryType,
      baselinePlanned,
      simulatedPlanned,
      deltaPlanned,
      actualMtd,
      projectedEom: projected,
      weeklyDetails,
    });
  }

  const risks: SimulationRiskItem[] = categories
    .map((category) => {
      const planned = category.simulatedPlanned;
      const projected = category.projectedEom;
      const progress = planned > 0 ? projected / planned : projected > 0 ? Infinity : 0;
      return {
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        categoryType: category.categoryType,
        planned,
        projected,
        progress,
      };
    })
    .filter((item) => item.progress >= 0.9)
    .sort((a, b) => b.progress - a.progress);

  return {
    summary: {
      totalBaselinePlanned,
      totalSimulatedPlanned,
      totalDeltaPlanned: totalSimulatedPlanned - totalBaselinePlanned,
      totalActualMtd,
      totalProjected,
      balanceImpact,
    },
    categories,
    risks,
  };
}

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  month: 'long',
  year: 'numeric',
});

export function formatMonthLabel(monthStart: string): string {
  try {
    const date = new Date(`${monthStart}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      return monthStart;
    }
    return MONTH_LABEL_FORMATTER.format(date);
  } catch (error) {
    return monthStart;
  }
}

export function formatCurrency(value: number, minimumFractionDigits = 0): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
    minimumFractionDigits,
  }).format(Math.round(value));
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const normalized = Math.max(0, value);
  if (!Number.isFinite(normalized)) {
    return '—';
  }
  return `${(normalized * 100).toFixed(0)}%`;
}

export function getRiskBadgeTone(progress: number): 'accent' | 'amber' | 'orange' | 'rose' {
  if (!Number.isFinite(progress)) {
    return 'rose';
  }
  if (progress <= 0.74) return 'accent';
  if (progress <= 0.89) return 'amber';
  if (progress <= 1.0) return 'orange';
  return 'rose';
}

export function sanitizeDraftItem(draft?: SimulationDraftItem | null): SimulationDraftItem {
  return {
    deltaMonthly: draft?.deltaMonthly ?? 0,
    deltaWeekly: draft?.deltaWeekly ? { ...draft.deltaWeekly } : {},
  };
}

export function isDraftItemEmpty(draft: SimulationDraftItem): boolean {
  const monthly = toNumber(draft.deltaMonthly);
  if (monthly !== 0) return false;
  for (const value of Object.values(draft.deltaWeekly)) {
    if (toNumber(value) !== 0) return false;
  }
  return true;
}
