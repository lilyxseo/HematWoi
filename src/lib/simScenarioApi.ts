import { supabase } from './supabase';
import { getCurrentUserId, getUserToken } from './session';
import {
  type BaselineCategoryData,
  type BaselineData,
  type ProjectionMethod,
  type ScenarioItemDelta,
  type SimulationOptions,
  type SimulationResult,
  buildSimulation,
  getMonthMetadata,
  normalizeMonthStart,
  toPeriod,
  toScenarioItemDelta,
} from './simMath';
import { upsertBudget, upsertWeeklyBudget } from './budgetApi';

type UUID = string;

type Nullable<T> = T | null;

export interface BudgetSimScenario {
  id: UUID;
  user_id: UUID;
  name: string;
  period_month: string;
  status: 'draft' | 'applied' | 'archived';
  notes: Nullable<string>;
  created_at: string;
  updated_at: string;
}

export interface BudgetSimScenarioItem {
  id: UUID;
  scenario_id: UUID;
  category_id: UUID;
  delta_monthly: number;
  delta_weekly: Record<string, number>;
  created_at: string;
  updated_at: string;
  category?: {
    id: UUID;
    name: string;
    type: 'income' | 'expense' | null;
  } | null;
}

export interface ListScenarioParams {
  period_month: string;
  includeArchived?: boolean;
}

export async function listScenarios({
  period_month,
  includeArchived = false,
}: ListScenarioParams): Promise<BudgetSimScenario[]> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  const monthStart = normalizeMonthStart(period_month);
  const query = supabase
    .from('budget_sim_scenarios')
    .select('*')
    .eq('user_id', userId)
    .eq('period_month', monthStart)
    .order('created_at', { ascending: true });
  if (!includeArchived) {
    query.neq('status', 'archived');
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as BudgetSimScenario[];
}

export interface CreateScenarioPayload {
  name: string;
  period_month: string;
  notes?: string;
}

export async function createScenario(payload: CreateScenarioPayload): Promise<BudgetSimScenario> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  const monthStart = normalizeMonthStart(payload.period_month);
  const insertPayload = {
    user_id: userId,
    name: payload.name,
    period_month: monthStart,
    status: 'draft' as const,
    notes: payload.notes ?? null,
  };
  const { data, error } = await supabase
    .from('budget_sim_scenarios')
    .insert(insertPayload)
    .select('*')
    .single();
  if (error) throw error;
  return data as BudgetSimScenario;
}

export async function updateScenario(
  id: UUID,
  patch: Partial<Pick<BudgetSimScenario, 'name' | 'status' | 'notes'>>
): Promise<BudgetSimScenario> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  const { data, error } = await supabase
    .from('budget_sim_scenarios')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as BudgetSimScenario;
}

export async function deleteScenario(id: UUID): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  const { error } = await supabase.from('budget_sim_scenarios').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}

export async function archiveScenario(id: UUID): Promise<BudgetSimScenario> {
  return updateScenario(id, { status: 'archived' });
}

async function fetchScenarioById(id: UUID): Promise<BudgetSimScenario> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  const { data, error } = await supabase
    .from('budget_sim_scenarios')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as BudgetSimScenario;
}

export async function duplicateScenario(id: UUID): Promise<BudgetSimScenario> {
  const scenario = await fetchScenarioById(id);
  const items = await listScenarioItems(id);
  const existing = await listScenarios({ period_month: scenario.period_month, includeArchived: true });
  const existingNames = new Set(existing.map((item) => item.name));
  let suffix = 1;
  let candidate = `${scenario.name} (Salinan)`;
  while (existingNames.has(candidate)) {
    suffix += 1;
    candidate = `${scenario.name} (Salinan ${suffix})`;
  }
  const clone = await createScenario({ name: candidate, period_month: scenario.period_month, notes: scenario.notes ?? undefined });
  if (!items.length) return clone;
  const payload = items.map((item) => ({
    scenario_id: clone.id,
    category_id: item.category_id,
    delta_monthly: item.delta_monthly,
    delta_weekly: item.delta_weekly ?? {},
  }));
  const { error } = await supabase.from('budget_sim_items').insert(payload);
  if (error) throw error;
  return clone;
}

export async function listScenarioItems(scenario_id: UUID): Promise<BudgetSimScenarioItem[]> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  const { data, error } = await supabase
    .from('budget_sim_items')
    .select('id,scenario_id,category_id,delta_monthly,delta_weekly,created_at,updated_at,category:categories(id,name,type)')
    .eq('scenario_id', scenario_id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((item) => ({
    ...item,
    delta_weekly: item.delta_weekly ?? {},
  })) as BudgetSimScenarioItem[];
}

export interface UpsertScenarioItemPayload {
  scenario_id: UUID;
  category_id: UUID;
  delta_monthly?: number;
  delta_weekly?: Record<string, number>;
}

export async function upsertScenarioItem(payload: UpsertScenarioItemPayload): Promise<BudgetSimScenarioItem> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  const deltaMonthly = Number(payload.delta_monthly ?? 0);
  const deltaWeekly = payload.delta_weekly ?? {};
  const hasWeekly = Object.values(deltaWeekly).some((value) => Number(value) !== 0);
  if (!hasWeekly && deltaMonthly === 0) {
    throw new Error('Setidaknya satu penyesuaian wajib diisi');
  }
  const upsertPayload = {
    scenario_id: payload.scenario_id,
    category_id: payload.category_id,
    delta_monthly: deltaMonthly,
    delta_weekly: deltaWeekly,
  };
  const { data, error } = await supabase
    .from('budget_sim_items')
    .upsert(upsertPayload, { onConflict: 'scenario_id,category_id' })
    .select('id,scenario_id,category_id,delta_monthly,delta_weekly,created_at,updated_at,category:categories(id,name,type)')
    .single();
  if (error) throw error;
  return {
    ...data,
    delta_weekly: data.delta_weekly ?? {},
  } as BudgetSimScenarioItem;
}

export async function removeScenarioItem(scenario_id: UUID, category_id: UUID): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  const { error } = await supabase
    .from('budget_sim_items')
    .delete()
    .eq('scenario_id', scenario_id)
    .eq('category_id', category_id);
  if (error) throw error;
}

function ensureCategory(
  map: Map<string, BaselineCategoryData & { recentTotal: number }>,
  categoryId: string,
  name: string,
  type: 'income' | 'expense' | null
): BaselineCategoryData & { recentTotal: number } {
  const existing = map.get(categoryId);
  if (existing) {
    if (!existing.categoryName && name) existing.categoryName = name;
    if (existing.categoryType == null && type != null) existing.categoryType = type;
    return existing;
  }
  const baseline: BaselineCategoryData & { recentTotal: number } = {
    categoryId,
    categoryName: name || 'Tanpa kategori',
    categoryType: type,
    monthlyPlanned: 0,
    weeklyPlanned: {},
    carryoverEnabled: false,
    weeklyCarryover: {},
    actualMtd: 0,
    weeklyActuals: {},
    recentWeeklyAverage: 0,
    recentTotal: 0,
  };
  map.set(categoryId, baseline);
  return baseline;
}

function getWeekStart(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, '0')}-${`${date.getUTCDate()}`.padStart(2, '0')}`;
}

function formatIso(date: Date): string {
  return `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, '0')}-${`${date.getUTCDate()}`.padStart(2, '0')}`;
}

export async function computeBaseline(period_month: string): Promise<BaselineData> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  const monthStart = normalizeMonthStart(period_month);
  const metadata = getMonthMetadata(monthStart);
  const period = toPeriod(monthStart);

  const [monthlyResponse, weeklyResponse, transactionsResponse] = await Promise.all([
    supabase
      .from('budgets')
      .select('category_id,planned,carry_rule,category:categories(id,name,type)')
      .eq('user_id', userId)
      .eq('period_month', monthStart),
    supabase
      .from('budgets_weekly')
      .select('category_id,planned,carry_rule,week_start,category:categories(id,name,type)')
      .eq('user_id', userId)
      .gte('week_start', monthStart)
      .lt('week_start', metadata.nextMonthStart),
    supabase
      .from('transactions')
      .select('category_id,amount,date,type,category:categories(id,name,type)')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('date', monthStart)
      .lt('date', metadata.nextMonthStart),
  ]);

  if (monthlyResponse.error) throw monthlyResponse.error;
  if (weeklyResponse.error) throw weeklyResponse.error;
  if (transactionsResponse.error) throw transactionsResponse.error;

  const categoryMap = new Map<string, BaselineCategoryData & { recentTotal: number }>();
  const weekSet = new Set<string>();

  const monthStartDate = new Date(`${monthStart}T00:00:00.000Z`);
  const nextMonthDate = new Date(`${metadata.nextMonthStart}T00:00:00.000Z`);
  const firstWeekCursor = new Date(`${getWeekStart(monthStart)}T00:00:00.000Z`);
  for (let cursor = new Date(firstWeekCursor); cursor < nextMonthDate; cursor.setUTCDate(cursor.getUTCDate() + 7)) {
    if (cursor >= monthStartDate && cursor < nextMonthDate) {
      weekSet.add(formatIso(cursor));
    }
  }

  for (const row of (monthlyResponse.data ?? []) as any[]) {
    const categoryId = row.category_id as string;
    if (!categoryId) continue;
    const categoryInfo = row.category ?? null;
    const baseline = ensureCategory(
      categoryMap,
      categoryId,
      categoryInfo?.name ?? 'Tanpa kategori',
      (categoryInfo?.type as 'income' | 'expense' | null) ?? null
    );
    const plannedAmount = Number(row.planned ?? row.planned_amount ?? 0);
    const carryRule = typeof row.carry_rule === 'string' ? row.carry_rule : null;
    baseline.monthlyPlanned = Number.isFinite(plannedAmount) ? plannedAmount : 0;
    baseline.carryoverEnabled = carryRule === 'carry-positive' || carryRule === 'carry-all';
  }

  for (const row of (weeklyResponse.data ?? []) as any[]) {
    const categoryId = row.category_id as string;
    if (!categoryId) continue;
    const weekStart = typeof row.week_start === 'string' ? row.week_start : null;
    if (!weekStart) continue;
    const normalizedWeek = getWeekStart(weekStart);
    weekSet.add(normalizedWeek);
    const categoryInfo = row.category ?? null;
    const baseline = ensureCategory(
      categoryMap,
      categoryId,
      categoryInfo?.name ?? 'Tanpa kategori',
      (categoryInfo?.type as 'income' | 'expense' | null) ?? null
    );
    const plannedAmount = Number(row.planned ?? row.planned_amount ?? 0);
    const carryRule = typeof row.carry_rule === 'string' ? row.carry_rule : null;
    baseline.weeklyPlanned[normalizedWeek] = Number.isFinite(plannedAmount) ? plannedAmount : 0;
    baseline.weeklyCarryover[normalizedWeek] =
      carryRule === 'carry-positive' || carryRule === 'carry-all';
  }

  const referenceDate = metadata.referenceDate;
  const referenceDateObj = new Date(`${referenceDate}T00:00:00.000Z`);
  const recentStartObj = new Date(referenceDateObj.getTime() - 27 * 24 * 60 * 60 * 1000);
  const recentStart = formatIso(recentStartObj);
  const referenceDays = metadata.daysElapsed > 0 ? metadata.daysElapsed : metadata.totalDays;
  const recentWeeksDenominator = Math.max(1, Math.min(4, Math.ceil(referenceDays / 7)));

  for (const row of (transactionsResponse.data ?? []) as any[]) {
    const categoryId = row.category_id as string | null;
    if (!categoryId) continue;
    const amount = Number(row.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    const date = typeof row.date === 'string' ? row.date : null;
    if (!date) continue;
    const categoryInfo = row.category ?? null;
    const baseline = ensureCategory(
      categoryMap,
      categoryId,
      categoryInfo?.name ?? 'Tanpa kategori',
      (categoryInfo?.type as 'income' | 'expense' | null) ?? null
    );
    baseline.actualMtd += amount;
    const weekStart = getWeekStart(date);
    baseline.weeklyActuals[weekStart] = (baseline.weeklyActuals[weekStart] ?? 0) + amount;
    weekSet.add(weekStart);
    if (date >= recentStart && date <= referenceDate) {
      baseline.recentTotal += amount;
    }
  }

  const categories: BaselineCategoryData[] = Array.from(categoryMap.values()).map((category) => ({
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    categoryType: category.categoryType,
    monthlyPlanned: category.monthlyPlanned,
    weeklyPlanned: category.weeklyPlanned,
    carryoverEnabled: category.carryoverEnabled,
    weeklyCarryover: category.weeklyCarryover,
    actualMtd: category.actualMtd,
    weeklyActuals: category.weeklyActuals,
    recentWeeklyAverage: category.recentTotal / recentWeeksDenominator,
  }));

  categories.sort((a, b) => a.categoryName.localeCompare(b.categoryName));

  const weeks = Array.from(weekSet).sort();

  return {
    periodMonth: monthStart,
    period,
    metadata,
    categories,
    weeks,
  };
}

export interface ComputeSimulationOptions extends Partial<SimulationOptions> {}

export interface ComputeSimulationResult {
  scenario: BudgetSimScenario;
  baseline: BaselineData;
  items: BudgetSimScenarioItem[];
  simulation: SimulationResult;
}

export async function computeSimulation(
  scenarioId: UUID,
  options: ComputeSimulationOptions = {}
): Promise<ComputeSimulationResult> {
  const scenario = await fetchScenarioById(scenarioId);
  const [baseline, items] = await Promise.all([
    computeBaseline(scenario.period_month),
    listScenarioItems(scenarioId),
  ]);
  const simulation = buildSimulation(baseline, items.map(toScenarioItemDelta), {
    includeWeekly: options.includeWeekly ?? true,
    projectionMethod: options.projectionMethod ?? 'linear',
  });
  return { scenario, baseline, items, simulation };
}

export interface ApplyScenarioResult {
  updatedBudgets: number;
  updatedWeeklyBudgets: number;
}

function clampBudget(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

export async function applyScenario(
  scenarioId: UUID,
  options: ComputeSimulationOptions = {}
): Promise<ApplyScenarioResult> {
  await getUserToken();
  const scenario = await fetchScenarioById(scenarioId);
  const [baseline, items] = await Promise.all([
    computeBaseline(scenario.period_month),
    listScenarioItems(scenarioId),
  ]);
  const simulation = buildSimulation(baseline, items.map(toScenarioItemDelta), {
    includeWeekly: options.includeWeekly ?? true,
    projectionMethod: options.projectionMethod ?? 'linear',
  });

  const period = baseline.period;
  const monthlyUpdates: Array<Promise<void>> = [];
  const weeklyUpdates: Array<Promise<void>> = [];
  const baselineMap = new Map(baseline.categories.map((category) => [category.categoryId, category]));

  for (const category of simulation.categories) {
    const baselineCategory = baselineMap.get(category.categoryId);
    if (category.deltaMonthly !== 0 || !baselineCategory) {
      const amount = clampBudget(category.baselineMonthly + category.deltaMonthly);
      monthlyUpdates.push(
        upsertBudget({
          category_id: category.categoryId,
          period,
          amount_planned: amount,
          carryover_enabled: baselineCategory?.carryoverEnabled ?? false,
        })
      );
    }
    for (const week of simulation.weeks) {
      const baselineAmount = baselineCategory?.weeklyPlanned[week] ?? 0;
      const delta = category.deltaWeekly[week] ?? 0;
      const amount = clampBudget((baselineCategory?.weeklyPlanned[week] ?? 0) + delta);
      if (delta === 0 && amount === baselineAmount) continue;
      weeklyUpdates.push(
        upsertWeeklyBudget({
          category_id: category.categoryId,
          week_start: week,
          amount_planned: amount,
          carryover_enabled: baselineCategory?.weeklyCarryover[week] ?? false,
        })
      );
    }
  }

  const [monthlyResult, weeklyResult] = await Promise.allSettled([
    Promise.all(monthlyUpdates),
    Promise.all(weeklyUpdates),
  ]);

  if (monthlyResult.status === 'rejected') throw monthlyResult.reason;
  if (weeklyResult.status === 'rejected') throw weeklyResult.reason;

  await updateScenario(scenarioId, { status: 'applied' });

  return {
    updatedBudgets: monthlyUpdates.length,
    updatedWeeklyBudgets: weeklyUpdates.length,
  };
}

export type { BaselineData, ProjectionMethod, SimulationOptions, SimulationResult };

