import { type BudgetSimScenarioItem } from './simScenarioApi';

export type ProjectionMethod = 'linear' | 'recent' | 'flat';

export interface MonthMetadata {
  monthStart: string;
  nextMonthStart: string;
  totalDays: number;
  daysElapsed: number;
  referenceDate: string;
  weeksInMonth: number;
}

export interface BaselineCategoryData {
  categoryId: string;
  categoryName: string;
  categoryType: 'income' | 'expense' | null;
  monthlyPlanned: number;
  weeklyPlanned: Record<string, number>;
  carryoverEnabled: boolean;
  weeklyCarryover: Record<string, boolean>;
  actualMtd: number;
  weeklyActuals: Record<string, number>;
  recentWeeklyAverage: number;
}

export interface BaselineData {
  periodMonth: string;
  period: string;
  metadata: MonthMetadata;
  categories: BaselineCategoryData[];
  weeks: string[];
}

export interface ScenarioItemDelta {
  categoryId: string;
  deltaMonthly: number;
  deltaWeekly: Record<string, number>;
  categoryName?: string;
  categoryType?: 'income' | 'expense' | null;
}

export interface SimulationOptions {
  includeWeekly: boolean;
  projectionMethod: ProjectionMethod;
}

export type RiskLevel = 'accent' | 'amber' | 'orange' | 'rose';

export interface SimulationCategoryResult {
  categoryId: string;
  categoryName: string;
  categoryType: 'income' | 'expense' | null;
  baselineMonthly: number;
  baselinePlanned: number;
  baselineWeekly: Record<string, number>;
  deltaMonthly: number;
  deltaWeekly: Record<string, number>;
  simulationWeekly: Record<string, number>;
  simulationPlanned: number;
  actualMtd: number;
  projectionBase: number;
  projectedEom: number;
  ratio: number;
  totalDelta: number;
  riskLevel: RiskLevel;
}

export interface SimulationTotals {
  baselinePlanned: number;
  simulationPlanned: number;
  actualMtd: number;
  projectedEom: number;
  deltaPlanned: number;
}

export interface SimulationImpact {
  incomeDelta: number;
  expenseDelta: number;
  netDelta: number;
}

export interface RiskEntry {
  categoryId: string;
  categoryName: string;
  planned: number;
  projected: number;
  ratio: number;
  level: RiskLevel;
}

export interface SimulationResult {
  categories: SimulationCategoryResult[];
  totals: SimulationTotals;
  impact: SimulationImpact;
  risks: RiskEntry[];
  weeks: string[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatIsoDateUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeMonthStart(input: string): string {
  if (!input) {
    throw new Error('period_month wajib diisi');
  }
  if (/^\d{4}-\d{2}$/.test(input)) {
    return `${input}-01`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [year, month] = input.split('-').map((value) => Number.parseInt(value, 10));
    const normalized = new Date(Date.UTC(year, month - 1, 1));
    return formatIsoDateUTC(normalized);
  }
  throw new Error('Format period_month tidak valid');
}

export function toPeriod(input: string): string {
  const normalized = normalizeMonthStart(input);
  return normalized.slice(0, 7);
}

export function getMonthMetadata(periodMonth: string, todayInput: Date = new Date()): MonthMetadata {
  const monthStart = normalizeMonthStart(periodMonth);
  const startDate = new Date(`${monthStart}T00:00:00.000Z`);
  const nextMonthDate = new Date(startDate.getTime());
  nextMonthDate.setUTCDate(1);
  nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1);
  const totalDays = Math.round((nextMonthDate.getTime() - startDate.getTime()) / MS_PER_DAY);
  const endDate = new Date(nextMonthDate.getTime() - MS_PER_DAY);

  const todayTime = todayInput.getTime();
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  let daysElapsed = 0;
  if (todayTime < startTime) {
    daysElapsed = 0;
  } else if (todayTime > endTime) {
    daysElapsed = totalDays;
  } else {
    const diff = Math.floor((todayTime - startTime) / MS_PER_DAY);
    daysElapsed = diff + 1;
  }

  const clamped = Math.min(Math.max(todayTime, startTime), endTime);
  const referenceDate = formatIsoDateUTC(new Date(clamped));
  const weeksInMonth = Math.max(1, Math.ceil(totalDays / 7));

  return {
    monthStart,
    nextMonthStart: formatIsoDateUTC(nextMonthDate),
    totalDays,
    daysElapsed,
    referenceDate,
    weeksInMonth,
  };
}

export function mergeWeeks(base: string[], additional: Iterable<string>): string[] {
  const set = new Set(base);
  for (const value of additional) {
    if (value) set.add(value);
  }
  return Array.from(set).sort();
}

function sumRecordValues(record: Record<string, number>, keys?: Iterable<string>): number {
  if (!record) return 0;
  if (!keys) {
    return Object.values(record).reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
  }
  let total = 0;
  for (const key of keys) {
    const value = record[key];
    if (Number.isFinite(value)) {
      total += value;
    }
  }
  return total;
}

function calculateProjectionBase(
  baseline: BaselineCategoryData,
  metadata: MonthMetadata,
  method: ProjectionMethod
): number {
  switch (method) {
    case 'linear': {
      if (metadata.daysElapsed <= 0) return baseline.actualMtd;
      const avg = baseline.actualMtd / metadata.daysElapsed;
      if (!Number.isFinite(avg) || avg < 0) return baseline.actualMtd;
      return avg * metadata.totalDays;
    }
    case 'recent': {
      const avg = baseline.recentWeeklyAverage;
      if (!Number.isFinite(avg) || avg <= 0) {
        return baseline.actualMtd;
      }
      return avg * metadata.weeksInMonth;
    }
    case 'flat':
    default:
      return baseline.actualMtd;
  }
}

export function getRiskLevel(ratio: number): RiskLevel {
  if (!Number.isFinite(ratio) || ratio <= 0.74) return 'accent';
  if (ratio <= 0.89) return 'amber';
  if (ratio <= 1) return 'orange';
  return 'rose';
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value;
}

function createEmptyBaseline(
  categoryId: string,
  name: string,
  type: 'income' | 'expense' | null
): BaselineCategoryData {
  return {
    categoryId,
    categoryName: name,
    categoryType: type,
    monthlyPlanned: 0,
    weeklyPlanned: {},
    carryoverEnabled: false,
    weeklyCarryover: {},
    actualMtd: 0,
    weeklyActuals: {},
    recentWeeklyAverage: 0,
  };
}

export function buildSimulation(
  baseline: BaselineData,
  items: ScenarioItemDelta[] | BudgetSimScenarioItem[],
  options: SimulationOptions
): SimulationResult {
  const { metadata } = baseline;
  const baselineMap = new Map<string, BaselineCategoryData>();
  for (const category of baseline.categories) {
    baselineMap.set(category.categoryId, category);
  }

  const scenarioMap = new Map<string, ScenarioItemDelta>();
  const weekAccumulator = new Set<string>(baseline.weeks);

  for (const item of items) {
    const deltaWeekly: Record<string, number> = { ...item.deltaWeekly };
    Object.keys(deltaWeekly).forEach((key) => {
      if (!key || !Number.isFinite(deltaWeekly[key]!)) {
        delete deltaWeekly[key];
      } else {
        weekAccumulator.add(key);
      }
    });
    scenarioMap.set(item.categoryId, {
      categoryId: item.categoryId,
      deltaMonthly: Number.isFinite(item.deltaMonthly) ? item.deltaMonthly : 0,
      deltaWeekly,
      categoryName: (item as ScenarioItemDelta).categoryName ?? (item as BudgetSimScenarioItem).category?.name,
      categoryType: (item as ScenarioItemDelta).categoryType ?? (item as BudgetSimScenarioItem).category?.type ?? null,
    });
    const baselineEntry = baselineMap.get(item.categoryId);
    if (!baselineEntry) {
      const name =
        (item as ScenarioItemDelta).categoryName ??
        (item as BudgetSimScenarioItem).category?.name ??
        'Kategori tanpa nama';
      const type =
        (item as ScenarioItemDelta).categoryType ??
        (((item as BudgetSimScenarioItem).category?.type as 'income' | 'expense' | null) ?? null);
      baselineMap.set(item.categoryId, createEmptyBaseline(item.categoryId, name, type));
    }
  }

  const orderedWeeks = Array.from(weekAccumulator).sort();

  const categories: SimulationCategoryResult[] = [];
  let baselineTotal = 0;
  let simulationTotal = 0;
  let actualTotal = 0;
  let projectedTotal = 0;
  let incomeDelta = 0;
  let expenseDelta = 0;

  for (const [categoryId, baselineCategory] of Array.from(baselineMap.entries()).sort((a, b) => {
    return a[1].categoryName.localeCompare(b[1].categoryName);
  })) {
    const scenarioItem = scenarioMap.get(categoryId);
    const deltaMonthly = scenarioItem?.deltaMonthly ?? 0;
    const deltaWeekly = scenarioItem?.deltaWeekly ?? {};
    const baselineWeekly: Record<string, number> = {};
    const simulationWeekly: Record<string, number> = {};

    for (const week of orderedWeeks) {
      const base = Number(baselineCategory.weeklyPlanned[week] ?? 0);
      const delta = Number(deltaWeekly[week] ?? 0);
      baselineWeekly[week] = base;
      simulationWeekly[week] = clampNonNegative(base + delta);
    }

    const deltaWeeklySum = Object.values(simulationWeekly).reduce((total, value, index, array) => {
      const week = orderedWeeks[index];
      const base = baselineWeekly[week!] ?? 0;
      return total + (value - base);
    }, 0);

    const baselineReference = options.includeWeekly
      ? sumRecordValues(baselineWeekly, orderedWeeks)
      : baselineCategory.monthlyPlanned;
    const totalDelta = deltaMonthly + deltaWeeklySum;
    const simulationPlanned = clampNonNegative(baselineReference + totalDelta);
    const projectionBase = calculateProjectionBase(baselineCategory, metadata, options.projectionMethod);
    const projectedEom = Math.max(baselineCategory.actualMtd, projectionBase + totalDelta);
    const ratio = simulationPlanned > 0 ? projectedEom / simulationPlanned : 0;
    const riskLevel = getRiskLevel(ratio);

    baselineTotal += baselineReference;
    simulationTotal += simulationPlanned;
    actualTotal += baselineCategory.actualMtd;
    projectedTotal += projectedEom;

    if (baselineCategory.categoryType === 'income') {
      incomeDelta += simulationPlanned - baselineReference;
    } else {
      expenseDelta += simulationPlanned - baselineReference;
    }

    categories.push({
      categoryId,
      categoryName: baselineCategory.categoryName,
      categoryType: baselineCategory.categoryType,
      baselineMonthly: baselineCategory.monthlyPlanned,
      baselinePlanned: baselineReference,
      baselineWeekly,
      deltaMonthly,
      deltaWeekly,
      simulationWeekly,
      simulationPlanned,
      actualMtd: baselineCategory.actualMtd,
      projectionBase,
      projectedEom,
      ratio,
      totalDelta,
      riskLevel,
    });
  }

  const deltaPlanned = simulationTotal - baselineTotal;
  const netDelta = incomeDelta - expenseDelta;

  const risks: RiskEntry[] = categories
    .filter((category) => category.ratio >= 0.9)
    .map((category) => ({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      planned: category.simulationPlanned,
      projected: category.projectedEom,
      ratio: category.ratio,
      level: category.riskLevel,
    }));

  return {
    categories,
    totals: {
      baselinePlanned: baselineTotal,
      simulationPlanned: simulationTotal,
      actualMtd: actualTotal,
      projectedEom: projectedTotal,
      deltaPlanned,
    },
    impact: {
      incomeDelta,
      expenseDelta,
      netDelta,
    },
    risks,
    weeks: orderedWeeks,
  };
}

export function toScenarioItemDelta(item: BudgetSimScenarioItem): ScenarioItemDelta {
  return {
    categoryId: item.category_id,
    deltaMonthly: Number.isFinite(item.delta_monthly) ? item.delta_monthly : 0,
    deltaWeekly: { ...item.delta_weekly },
    categoryName: item.category?.name,
    categoryType: (item.category?.type as 'income' | 'expense' | null) ?? null,
  };
}

