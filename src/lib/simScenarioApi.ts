import type { PostgrestError } from '@supabase/supabase-js';
import {
  listBudgets,
  listWeeklyBudgets,
  computeSpent,
  type BudgetRow,
  type WeeklyBudgetsResult,
  type WeeklyBudgetWithSpent,
  upsertBudget,
  upsertWeeklyBudget,
} from './budgetApi';
import { supabase } from './supabase';
import {
  clampCurrency,
  normalizeNumber,
  projectValue,
  type ProjectionMode,
} from './simMath';

export type ScenarioStatus = 'draft' | 'applied' | 'archived';

export interface BudgetSimScenario {
  id: string;
  user_id: string;
  name: string;
  period_month: string;
  status: ScenarioStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetSimItem {
  id: string;
  scenario_id: string;
  category_id: string;
  delta_monthly: number;
  delta_weekly: Record<string, number> | null;
  created_at: string;
  updated_at: string;
}

export interface ScenarioItemInput {
  scenario_id: string;
  category_id: string;
  delta_monthly: number;
  delta_weekly?: Record<string, number> | null;
}

export interface BaselineCategoryData {
  categoryId: string;
  categoryName: string;
  categoryType: 'income' | 'expense' | null;
  monthlyPlanned: number;
  weeklyPlanned: Record<string, number>;
  weeklyActuals: Record<string, number>;
  actualMtd: number;
}

export interface BaselineData {
  periodMonth: string;
  categories: BaselineCategoryData[];
  weeks: WeeklyBudgetsResult['weeks'];
  totals: {
    monthlyPlanned: number;
    weeklyPlanned: number;
    actualMtd: number;
  };
}

export interface SimulationCategoryResult {
  categoryId: string;
  name: string;
  type: 'income' | 'expense' | null;
  baselinePlanned: number;
  baselineWeeklyPlanned: number;
  simulationPlanned: number;
  simulationWeeklyPlanned: number;
  deltaMonthly: number;
  deltaWeeklyTotal: number;
  actualMtd: number;
  projected: number;
  remaining: number;
  ratio: number;
  locked: boolean;
  weekly: Array<{
    weekStart: string;
    baseline: number;
    delta: number;
    simulation: number;
    spent: number;
  }>;
}

export interface RiskItem {
  categoryId: string;
  name: string;
  level: 'info' | 'watch' | 'warning' | 'critical';
  ratio: number;
  projected: number;
  planned: number;
}

export interface SimulationSummary {
  baselinePlanned: number;
  simulationPlanned: number;
  deltaPlanned: number;
  actualMtd: number;
  projected: number;
  remaining: number;
  incomeDelta: number;
  expenseDelta: number;
  netImpact: number;
}

export interface SimulationResult {
  categories: SimulationCategoryResult[];
  summary: SimulationSummary;
  risks: RiskItem[];
}

export interface BuildSimulationInput {
  baseline: BaselineData;
  items: Array<Pick<BudgetSimItem, 'category_id' | 'delta_monthly' | 'delta_weekly'>>;
  useWeeklyBudgets: boolean;
  projectionMode: ProjectionMode;
  lockedCategoryIds?: string[];
}

export interface ComputeSimulationParams {
  scenarioId: string;
  periodMonth: string;
  useWeeklyBudgets: boolean;
  projectionMode: ProjectionMode;
  lockedCategoryIds?: string[];
}

export interface ApplyScenarioResult {
  updatedMonthly: number;
  updatedWeekly: number;
  totalMonthlyChange: number;
  totalWeeklyChange: number;
  incomeDelta: number;
  expenseDelta: number;
}

function toMonthStart(period: string): string {
  if (!period) {
    throw new Error('Periode wajib diisi');
  }
  return period.length === 7 ? `${period}-01` : period;
}

function toPeriod(periodMonth: string): string {
  if (!periodMonth) {
    throw new Error('Periode wajib diisi');
  }
  return periodMonth.slice(0, 7);
}

function ensureNotError(error: PostgrestError | null): void {
  if (error) {
    throw error;
  }
}

export async function listScenarios({
  period_month,
}: {
  period_month: string;
}): Promise<BudgetSimScenario[]> {
  const { data, error } = await supabase
    .from('budget_sim_scenarios')
    .select('*')
    .eq('period_month', toMonthStart(period_month))
    .order('created_at', { ascending: true });
  ensureNotError(error);
  return (data ?? []) as BudgetSimScenario[];
}

export async function createScenario({
  name,
  period_month,
  notes,
}: {
  name: string;
  period_month: string;
  notes?: string | null;
}): Promise<BudgetSimScenario> {
  const payload = {
    name,
    period_month: toMonthStart(period_month),
    status: 'draft' as ScenarioStatus,
    notes: notes ?? null,
  };
  const { data, error } = await supabase
    .from('budget_sim_scenarios')
    .insert(payload)
    .select('*')
    .single();
  ensureNotError(error);
  return data as BudgetSimScenario;
}

export async function updateScenario(
  id: string,
  patch: Partial<Pick<BudgetSimScenario, 'name' | 'notes' | 'status'>>
): Promise<BudgetSimScenario> {
  const { data, error } = await supabase
    .from('budget_sim_scenarios')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  ensureNotError(error);
  return data as BudgetSimScenario;
}

export async function archiveScenario(id: string): Promise<void> {
  await updateScenario(id, { status: 'archived' });
}

export async function deleteScenario(id: string): Promise<void> {
  const { error } = await supabase.from('budget_sim_scenarios').delete().eq('id', id);
  ensureNotError(error);
}

export async function listScenarioItems(scenarioId: string): Promise<BudgetSimItem[]> {
  const { data, error } = await supabase
    .from('budget_sim_items')
    .select('*')
    .eq('scenario_id', scenarioId)
    .order('created_at', { ascending: true });
  ensureNotError(error);
  return (data ?? []) as BudgetSimItem[];
}

export async function upsertScenarioItem(input: ScenarioItemInput): Promise<BudgetSimItem> {
  const payload = {
    scenario_id: input.scenario_id,
    category_id: input.category_id,
    delta_monthly: Number.isFinite(input.delta_monthly) ? input.delta_monthly : 0,
    delta_weekly: input.delta_weekly ?? null,
  };
  const { data, error } = await supabase
    .from('budget_sim_items')
    .upsert(payload, { onConflict: 'scenario_id,category_id' })
    .select('*')
    .single();
  ensureNotError(error);
  return data as BudgetSimItem;
}

export async function deleteScenarioItem(id: string): Promise<void> {
  const { error } = await supabase.from('budget_sim_items').delete().eq('id', id);
  ensureNotError(error);
}

export async function duplicateScenario(id: string): Promise<BudgetSimScenario> {
  const scenario = await supabase
    .from('budget_sim_scenarios')
    .select('*')
    .eq('id', id)
    .single();
  ensureNotError(scenario.error);
  const original = scenario.data as BudgetSimScenario;
  const items = await listScenarioItems(id);
  const baseName = `${original.name} (Salinan)`;
  const created = await createScenario({
    name: baseName,
    period_month: original.period_month,
    notes: original.notes,
  });
  if (items.length > 0) {
    const payload = items.map((item) => ({
      scenario_id: created.id,
      category_id: item.category_id,
      delta_monthly: item.delta_monthly,
      delta_weekly: item.delta_weekly,
    }));
    const { error } = await supabase.from('budget_sim_items').insert(payload);
    ensureNotError(error);
  }
  return created;
}

function ensureCategory(map: Map<string, BaselineCategoryData>, row: BudgetRow): BaselineCategoryData {
  let existing = map.get(row.category_id);
  if (!existing) {
    existing = {
      categoryId: row.category_id,
      categoryName: row.category?.name ?? 'Tanpa kategori',
      categoryType: row.category?.type ?? null,
      monthlyPlanned: 0,
      weeklyPlanned: {},
      weeklyActuals: {},
      actualMtd: 0,
    };
    map.set(row.category_id, existing);
  }
  return existing;
}

function ensureCategoryById(
  map: Map<string, BaselineCategoryData>,
  id: string,
  fallback: { name: string; type: 'income' | 'expense' | null }
): BaselineCategoryData {
  let existing = map.get(id);
  if (!existing) {
    existing = {
      categoryId: id,
      categoryName: fallback.name,
      categoryType: fallback.type,
      monthlyPlanned: 0,
      weeklyPlanned: {},
      weeklyActuals: {},
      actualMtd: 0,
    };
    map.set(id, existing);
  }
  return existing;
}

export async function computeBaseline(period: string): Promise<BaselineData> {
  const [budgets, spentMap, weekly] = await Promise.all([
    listBudgets(period),
    computeSpent(period),
    listWeeklyBudgets(period),
  ]);
  const categories = new Map<string, BaselineCategoryData>();

  let totalMonthly = 0;
  for (const row of budgets) {
    const entry = ensureCategory(categories, row);
    entry.monthlyPlanned += normalizeNumber(row.amount_planned);
    totalMonthly += normalizeNumber(row.amount_planned);
  }

  let totalWeekly = 0;
  for (const row of weekly.rows) {
    const categoryId = row.category_id;
    const entry = ensureCategoryById(categories, categoryId, {
      name: row.category?.name ?? 'Tanpa kategori',
      type: row.category?.type ?? null,
    });
    const planned = normalizeNumber(row.amount_planned);
    entry.weeklyPlanned[row.week_start] = (entry.weeklyPlanned[row.week_start] ?? 0) + planned;
    entry.weeklyActuals[row.week_start] = (entry.weeklyActuals[row.week_start] ?? 0) +
      normalizeNumber((row as WeeklyBudgetWithSpent).spent);
    totalWeekly += planned;
  }

  for (const [categoryId, amount] of Object.entries(spentMap)) {
    const existing = categories.get(categoryId);
    if (existing) {
      existing.actualMtd = normalizeNumber(amount);
    } else {
      categories.set(categoryId, {
        categoryId,
        categoryName: 'Tanpa kategori',
        categoryType: null,
        monthlyPlanned: 0,
        weeklyPlanned: {},
        weeklyActuals: {},
        actualMtd: normalizeNumber(amount),
      });
    }
  }

  const sortedCategories = Array.from(categories.values()).sort((a, b) => {
    return a.categoryName.localeCompare(b.categoryName, 'id');
  });

  const actualTotal = sortedCategories.reduce((sum, entry) => sum + normalizeNumber(entry.actualMtd), 0);

  return {
    periodMonth: toMonthStart(period),
    categories: sortedCategories,
    weeks: weekly.weeks,
    totals: {
      monthlyPlanned: clampCurrency(totalMonthly),
      weeklyPlanned: clampCurrency(totalWeekly),
      actualMtd: clampCurrency(actualTotal),
    },
  };
}

function calculateWeeklySimulation(
  baseline: BaselineCategoryData,
  deltaWeekly: Record<string, number> | null | undefined
): Array<{ weekStart: string; baseline: number; delta: number; simulation: number; spent: number }> {
  const keys = new Set<string>([
    ...Object.keys(baseline.weeklyPlanned ?? {}),
    ...Object.keys(deltaWeekly ?? {}),
  ]);
  const weeks = Array.from(keys).sort();
  return weeks.map((weekStart) => {
    const base = normalizeNumber(baseline.weeklyPlanned?.[weekStart]);
    const delta = normalizeNumber(deltaWeekly?.[weekStart]);
    const simulation = base + delta;
    const spent = normalizeNumber(baseline.weeklyActuals?.[weekStart]);
    return {
      weekStart,
      baseline: clampCurrency(base),
      delta: clampCurrency(delta),
      simulation: clampCurrency(simulation),
      spent: clampCurrency(spent),
    };
  });
}

function classifyRisk(ratio: number): RiskItem['level'] {
  if (ratio >= 1) return 'critical';
  if (ratio >= 0.9) return 'warning';
  if (ratio >= 0.75) return 'watch';
  return 'info';
}

export function buildSimulation({
  baseline,
  items,
  useWeeklyBudgets,
  projectionMode,
  lockedCategoryIds = [],
}: BuildSimulationInput): SimulationResult {
  const lockedSet = new Set(lockedCategoryIds);
  const itemMap = new Map<string, { deltaMonthly: number; deltaWeekly: Record<string, number> | null }>();
  for (const item of items) {
    const deltaWeekly = item.delta_weekly ?? null;
    itemMap.set(item.category_id, {
      deltaMonthly: normalizeNumber(item.delta_monthly),
      deltaWeekly,
    });
  }

  const categories: SimulationCategoryResult[] = baseline.categories.map((base) => {
    const deltas = itemMap.get(base.categoryId) ?? { deltaMonthly: 0, deltaWeekly: null };
    const locked = lockedSet.has(base.categoryId);
    const effectiveMonthlyDelta = locked ? 0 : deltas.deltaMonthly;
    const weeklyDelta = locked ? null : deltas.deltaWeekly;
    const weekly = calculateWeeklySimulation(base, weeklyDelta ?? null);
    const baselineWeeklyTotal = weekly.reduce((sum, row) => sum + row.baseline, 0);
    const weeklyDeltaTotal = weekly.reduce((sum, row) => sum + row.delta, 0);
    const simulationWeeklyTotal = weekly.reduce((sum, row) => sum + row.simulation, 0);

    const baselinePlanned = useWeeklyBudgets ? baselineWeeklyTotal : base.monthlyPlanned;
    const simulationPlanned = useWeeklyBudgets
      ? simulationWeeklyTotal
      : base.monthlyPlanned + effectiveMonthlyDelta;

    const actual = normalizeNumber(base.actualMtd);
    const projected = clampCurrency(
      Math.max(
        actual,
        projectValue(projectionMode, {
          actual,
          periodMonth: baseline.periodMonth,
          weeklyActuals: weekly.map((row) => ({
            weekStart: row.weekStart,
            amount: row.spent,
          })),
        }) + (simulationPlanned - baselinePlanned)
      )
    );
    const remaining = clampCurrency(simulationPlanned - actual);
    const ratio = simulationPlanned > 0 ? projected / simulationPlanned : 0;

    return {
      categoryId: base.categoryId,
      name: base.categoryName,
      type: base.categoryType,
      baselinePlanned: clampCurrency(base.monthlyPlanned),
      baselineWeeklyPlanned: clampCurrency(baselineWeeklyTotal),
      simulationPlanned: clampCurrency(simulationPlanned),
      simulationWeeklyPlanned: clampCurrency(simulationWeeklyTotal),
      deltaMonthly: clampCurrency(effectiveMonthlyDelta),
      deltaWeeklyTotal: clampCurrency(weeklyDeltaTotal),
      actualMtd: clampCurrency(actual),
      projected,
      remaining,
      ratio,
      locked,
      weekly,
    };
  });

  const summary = categories.reduce(
    (acc, category) => {
      const baselineValue = useWeeklyBudgets ? category.baselineWeeklyPlanned : category.baselinePlanned;
      const simulationValue = useWeeklyBudgets ? category.simulationWeeklyPlanned : category.simulationPlanned;
      const delta = simulationValue - baselineValue;
      acc.baseline += baselineValue;
      acc.simulation += simulationValue;
      acc.delta += delta;
      acc.actual += category.actualMtd;
      acc.projected += category.projected;
      if (category.type === 'income') {
        acc.incomeDelta += delta;
      } else {
        acc.expenseDelta += delta;
      }
      return acc;
    },
    {
      baseline: 0,
      simulation: 0,
      delta: 0,
      actual: 0,
      projected: 0,
      incomeDelta: 0,
      expenseDelta: 0,
    }
  );

  const risks: RiskItem[] = categories
    .filter((category) => category.simulationPlanned > 0)
    .map((category) => {
      const level = classifyRisk(category.ratio);
      return {
        categoryId: category.categoryId,
        name: category.name,
        level,
        ratio: category.ratio,
        projected: category.projected,
        planned: category.simulationPlanned,
      };
    })
    .filter((risk) => risk.level !== 'info')
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 10);

  const result: SimulationResult = {
    categories,
    summary: {
      baselinePlanned: clampCurrency(summary.baseline),
      simulationPlanned: clampCurrency(summary.simulation),
      deltaPlanned: clampCurrency(summary.delta),
      actualMtd: clampCurrency(summary.actual),
      projected: clampCurrency(summary.projected),
      remaining: clampCurrency(summary.simulation - summary.actual),
      incomeDelta: clampCurrency(summary.incomeDelta),
      expenseDelta: clampCurrency(summary.expenseDelta),
      netImpact: clampCurrency(summary.incomeDelta - summary.expenseDelta),
    },
    risks,
  };
  return result;
}

export async function computeSimulation(params: ComputeSimulationParams): Promise<SimulationResult> {
  const [baseline, items] = await Promise.all([
    computeBaseline(params.periodMonth),
    listScenarioItems(params.scenarioId),
  ]);
  return buildSimulation({
    baseline,
    items,
    useWeeklyBudgets: params.useWeeklyBudgets,
    projectionMode: params.projectionMode,
    lockedCategoryIds: params.lockedCategoryIds,
  });
}

export async function applyScenario({
  scenarioId,
  periodMonth,
}: {
  scenarioId: string;
  periodMonth: string;
}): Promise<ApplyScenarioResult> {
  const [items, budgets, weekly] = await Promise.all([
    listScenarioItems(scenarioId),
    listBudgets(periodMonth),
    listWeeklyBudgets(periodMonth),
  ]);

  if (items.length === 0) {
    return {
      updatedMonthly: 0,
      updatedWeekly: 0,
      totalMonthlyChange: 0,
      totalWeeklyChange: 0,
      incomeDelta: 0,
      expenseDelta: 0,
    };
  }

  const monthlyByCategory = new Map<string, BudgetRow>();
  for (const budget of budgets) {
    monthlyByCategory.set(budget.category_id, budget);
  }

  const weeklyByCategoryWeek = new Map<string, WeeklyBudgetWithSpent>();
  for (const row of weekly.rows) {
    weeklyByCategoryWeek.set(`${row.category_id}:${row.week_start}`, row);
  }

  let updatedMonthly = 0;
  let updatedWeekly = 0;
  let totalMonthlyChange = 0;
  let totalWeeklyChange = 0;
  let incomeDelta = 0;
  let expenseDelta = 0;

  for (const item of items) {
    if (item.delta_monthly) {
      const baselineRow = monthlyByCategory.get(item.category_id);
      const baselineAmount = normalizeNumber(baselineRow?.amount_planned);
      const nextAmount = clampCurrency(baselineAmount + normalizeNumber(item.delta_monthly));
      await upsertBudget({
        id: baselineRow?.id,
        category_id: item.category_id,
        period: toPeriod(periodMonth),
        amount_planned: nextAmount,
        carryover_enabled: baselineRow?.carryover_enabled ?? false,
        notes: baselineRow?.notes ?? null,
      });
      updatedMonthly += 1;
      const delta = nextAmount - baselineAmount;
      totalMonthlyChange += delta;
      if (baselineRow?.category?.type === 'income') {
        incomeDelta += delta;
      } else {
        expenseDelta += delta;
      }
    }

    if (item.delta_weekly) {
      for (const [weekStart, deltaValue] of Object.entries(item.delta_weekly)) {
        if (!deltaValue) continue;
        const key = `${item.category_id}:${weekStart}`;
        const baselineRow = weeklyByCategoryWeek.get(key);
        const baselineAmount = normalizeNumber(baselineRow?.amount_planned);
        const nextAmount = clampCurrency(baselineAmount + normalizeNumber(deltaValue));
        await upsertWeeklyBudget({
          id: baselineRow?.id,
          category_id: item.category_id,
          week_start: weekStart,
          amount_planned: nextAmount,
          carryover_enabled: baselineRow?.carryover_enabled ?? false,
          notes: baselineRow?.notes ?? null,
        });
        updatedWeekly += 1;
        const delta = nextAmount - baselineAmount;
        totalWeeklyChange += delta;
        if (baselineRow?.category?.type === 'income') {
          incomeDelta += delta;
        } else {
          expenseDelta += delta;
        }
      }
    }
  }

  await updateScenario(scenarioId, { status: 'applied' });

  return {
    updatedMonthly,
    updatedWeekly,
    totalMonthlyChange: clampCurrency(totalMonthlyChange),
    totalWeeklyChange: clampCurrency(totalWeeklyChange),
    incomeDelta: clampCurrency(incomeDelta),
    expenseDelta: clampCurrency(expenseDelta),
  };
}

