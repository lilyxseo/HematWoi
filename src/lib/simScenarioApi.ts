import { supabase } from './supabase';
import { getCurrentUserId, getUserToken } from './session';
import {
  listBudgets,
  computeSpent,
  listWeeklyBudgets,
  upsertBudget,
  upsertWeeklyBudget,
  type BudgetRow,
  type WeeklyBudgetWithSpent,
} from './budgetApi';
import {
  calculateSimulation,
  sanitizeDraftItem,
  isDraftItemEmpty,
  type BaselineDataset,
  type BaselineCategoryData,
  type BaselineWeekMeta,
  type SimulationDraftItem,
  type SimulationResult,
  type ProjectionMode,
} from './simMath';

export type ScenarioStatus = 'draft' | 'applied' | 'archived';

export interface BudgetSimulationScenario {
  id: string;
  user_id: string;
  name: string;
  period_month: string; // YYYY-MM-01
  status: ScenarioStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetSimulationItem {
  id: string;
  scenario_id: string;
  category_id: string;
  delta_monthly: number;
  delta_weekly: Record<string, number> | null;
  created_at: string;
  updated_at: string;
}

export interface ListScenarioParams {
  period_month: string; // YYYY-MM-01 or YYYY-MM
  includeArchived?: boolean;
}

export interface CreateScenarioInput {
  name: string;
  period_month: string; // YYYY-MM or YYYY-MM-01
  notes?: string | null;
}

export interface UpdateScenarioInput {
  name?: string;
  status?: ScenarioStatus;
  notes?: string | null;
}

export interface SimulationOptions {
  includeWeekly: boolean;
  projectionMode: ProjectionMode;
  lockedCategoryIds?: Set<string>;
}

export interface SimulationComputationResult {
  scenario: BudgetSimulationScenario;
  baseline: BaselineDataset;
  result: SimulationResult;
}

export interface SyncScenarioItemsResult {
  upserted: number;
  deleted: number;
}

export interface ApplyScenarioResult {
  updatedMonthly: number;
  updatedWeekly: number;
  balanceImpact: number;
  totalDelta: number;
}

function toMonthKey(periodMonth: string): string {
  if (!periodMonth) return '';
  if (periodMonth.length === 7) return periodMonth;
  if (periodMonth.length === 10) return periodMonth.slice(0, 7);
  return periodMonth;
}

function toMonthStart(period: string): string {
  if (!period) return period;
  const key = toMonthKey(period);
  const [year, month] = key.split('-');
  if (!year || !month) return period;
  return `${year}-${month.padStart(2, '0')}-01`;
}

function ensureAuth(userId: string | null): asserts userId is string {
  if (!userId) {
    throw new Error('Silakan login terlebih dahulu');
  }
}

function normalizeDeltaWeekly(deltaWeekly: Record<string, number> | null | undefined): Record<string, number> {
  const result: Record<string, number> = {};
  if (!deltaWeekly) return result;
  for (const [key, value] of Object.entries(deltaWeekly)) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric === 0) continue;
    result[key] = numeric;
  }
  return result;
}

function buildBaselineWeeks(periodStart: string, weeks: BaselineWeekMeta[] | undefined): BaselineWeekMeta[] {
  if (weeks && weeks.length > 0) {
    return weeks.map((week) => ({ ...week }));
  }
  const startDate = new Date(`${periodStart}T00:00:00.000Z`);
  if (Number.isNaN(startDate.getTime())) {
    return [];
  }
  const list: BaselineWeekMeta[] = [];
  const cursor = new Date(startDate);
  let sequence = 1;
  while (cursor.getUTCMonth() === startDate.getUTCMonth()) {
    const weekStart = formatIsoDate(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    const endValue = formatIsoDate(weekEnd);
    list.push({
      start: weekStart,
      end: endValue,
      label: `Minggu ${sequence}`,
      sequence,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
    sequence += 1;
  }
  return list;
}

function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthMetadata(periodStart: string): { daysInMonth: number; daysElapsed: number } {
  const [yearStr, monthStr] = periodStart.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return { daysInMonth: 30, daysElapsed: 30 };
  }
  const firstDate = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const today = new Date();
  let daysElapsed = daysInMonth;
  if (today.getUTCFullYear() === year && today.getUTCMonth() + 1 === month) {
    daysElapsed = Math.min(today.getUTCDate(), daysInMonth);
  } else if (today < firstDate) {
    daysElapsed = 0;
  }
  return { daysInMonth, daysElapsed };
}

function mapBudgetRowToCategory(row: BudgetRow): BaselineCategoryData {
  const categoryId = row.category_id;
  const categoryName = row.category?.name ?? 'Tanpa kategori';
  const categoryType = (row.category?.type as 'income' | 'expense' | null) ?? null;
  return {
    categoryId,
    categoryName,
    categoryType,
    monthlyPlanned: Number(row.amount_planned ?? 0),
    weeklyPlanned: {},
    weeklyActual: {},
    actualMtd: 0,
  };
}

function mergeBaselineCategory(
  existing: BaselineCategoryData | undefined,
  incoming: Partial<BaselineCategoryData>
): BaselineCategoryData {
  if (!existing) {
    return {
      categoryId: incoming.categoryId!,
      categoryName: incoming.categoryName ?? 'Tanpa kategori',
      categoryType: incoming.categoryType ?? 'expense',
      monthlyPlanned: incoming.monthlyPlanned ?? 0,
      weeklyPlanned: incoming.weeklyPlanned ?? {},
      weeklyActual: incoming.weeklyActual ?? {},
      actualMtd: incoming.actualMtd ?? 0,
    };
  }
  return {
    categoryId: existing.categoryId,
    categoryName: incoming.categoryName ?? existing.categoryName,
    categoryType: incoming.categoryType ?? existing.categoryType,
    monthlyPlanned: incoming.monthlyPlanned ?? existing.monthlyPlanned,
    weeklyPlanned: { ...existing.weeklyPlanned, ...(incoming.weeklyPlanned ?? {}) },
    weeklyActual: { ...existing.weeklyActual, ...(incoming.weeklyActual ?? {}) },
    actualMtd: incoming.actualMtd ?? existing.actualMtd,
  };
}

export async function listScenarios({
  period_month,
  includeArchived = false,
}: ListScenarioParams): Promise<BudgetSimulationScenario[]> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  const monthStart = toMonthStart(period_month);
  let query = supabase
    .from('budget_sim_scenarios')
    .select('*')
    .eq('user_id', userId)
    .eq('period_month', monthStart)
    .order('created_at', { ascending: true });
  if (!includeArchived) {
    query = query.neq('status', 'archived');
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as BudgetSimulationScenario[];
}

export async function createScenario(input: CreateScenarioInput): Promise<BudgetSimulationScenario> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  await getUserToken();
  const monthStart = toMonthStart(input.period_month);
  const payload = {
    user_id: userId,
    name: input.name.trim(),
    period_month: monthStart,
    status: 'draft' as ScenarioStatus,
    notes: input.notes?.trim() || null,
  };
  const { data, error } = await supabase
    .from('budget_sim_scenarios')
    .insert(payload)
    .select()
    .single();
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new Error('Nama skenario sudah digunakan untuk bulan ini.');
    }
    throw error;
  }
  return data as BudgetSimulationScenario;
}

export async function updateScenario(
  id: string,
  patch: UpdateScenarioInput
): Promise<BudgetSimulationScenario> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  await getUserToken();
  const payload: Record<string, unknown> = {};
  if (typeof patch.name === 'string') {
    payload.name = patch.name.trim();
  }
  if (typeof patch.status === 'string') {
    payload.status = patch.status;
  }
  if (patch.notes !== undefined) {
    payload.notes = patch.notes ? patch.notes.trim() : null;
  }
  const { data, error } = await supabase
    .from('budget_sim_scenarios')
    .update(payload)
    .eq('user_id', userId)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new Error('Nama skenario sudah digunakan untuk bulan ini.');
    }
    throw error;
  }
  return data as BudgetSimulationScenario;
}

export async function deleteScenario(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  await getUserToken();
  const { error } = await supabase.from('budget_sim_scenarios').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}

export async function archiveScenario(id: string): Promise<BudgetSimulationScenario> {
  return updateScenario(id, { status: 'archived' });
}

export async function duplicateScenario(id: string): Promise<BudgetSimulationScenario> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  const { data, error } = await supabase
    .from('budget_sim_scenarios')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .single();
  if (error) throw error;
  const scenario = data as BudgetSimulationScenario;
  const existing = await listScenarios({ period_month: scenario.period_month, includeArchived: true });
  let suffix = 1;
  let candidate = `${scenario.name} (Salinan)`;
  const nameSet = new Set(existing.map((item) => item.name));
  while (nameSet.has(candidate)) {
    suffix += 1;
    candidate = `${scenario.name} (Salinan ${suffix})`;
  }
  const cloned = await createScenario({
    name: candidate,
    period_month: scenario.period_month,
    notes: scenario.notes,
  });
  const items = await listScenarioItems(id);
  if (items.length > 0) {
    const inserts = items.map((item) => ({
      scenario_id: cloned.id,
      category_id: item.category_id,
      delta_monthly: item.delta_monthly,
      delta_weekly: item.delta_weekly,
    }));
    const { error: itemError } = await supabase.from('budget_sim_items').insert(inserts);
    if (itemError) throw itemError;
  }
  return cloned;
}

export async function listScenarioItems(scenarioId: string): Promise<BudgetSimulationItem[]> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  const { data, error } = await supabase
    .from('budget_sim_items')
    .select('*')
    .eq('scenario_id', scenarioId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as BudgetSimulationItem[];
}

export async function upsertScenarioItem(input: {
  scenario_id: string;
  category_id: string;
  delta_monthly: number;
  delta_weekly?: Record<string, number> | null;
}): Promise<BudgetSimulationItem> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  await getUserToken();
  const deltaWeekly = normalizeDeltaWeekly(input.delta_weekly);
  const deltaMonthly = Number(input.delta_monthly ?? 0);
  if (deltaMonthly === 0 && Object.keys(deltaWeekly).length === 0) {
    throw new Error('Penyesuaian kosong tidak dapat disimpan.');
  }
  const payload = {
    scenario_id: input.scenario_id,
    category_id: input.category_id,
    delta_monthly: deltaMonthly,
    delta_weekly: Object.keys(deltaWeekly).length ? deltaWeekly : null,
  };
  const { data, error } = await supabase
    .from('budget_sim_items')
    .upsert(payload, { onConflict: 'scenario_id,category_id' })
    .select()
    .single();
  if (error) throw error;
  return data as BudgetSimulationItem;
}

export async function deleteScenarioItem(scenarioId: string, categoryId: string): Promise<void> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  await getUserToken();
  const { error } = await supabase
    .from('budget_sim_items')
    .delete()
    .eq('scenario_id', scenarioId)
    .eq('category_id', categoryId);
  if (error) throw error;
}

export async function syncScenarioItems(
  scenarioId: string,
  drafts: Record<string, SimulationDraftItem>
): Promise<SyncScenarioItemsResult> {
  const existing = await listScenarioItems(scenarioId);
  const existingByCategory = new Map(existing.map((item) => [item.category_id, item]));
  let upserted = 0;
  let deleted = 0;
  for (const [categoryId, draft] of Object.entries(drafts)) {
    const sanitized = sanitizeDraftItem(draft);
    if (isDraftItemEmpty(sanitized)) {
      if (existingByCategory.has(categoryId)) {
        await deleteScenarioItem(scenarioId, categoryId);
        deleted += 1;
      }
      continue;
    }
    await upsertScenarioItem({
      scenario_id: scenarioId,
      category_id: categoryId,
      delta_monthly: sanitized.deltaMonthly,
      delta_weekly: sanitized.deltaWeekly,
    });
    upserted += 1;
  }
  for (const item of existing) {
    if (!(item.category_id in drafts)) {
      await deleteScenarioItem(scenarioId, item.category_id);
      deleted += 1;
    }
  }
  return { upserted, deleted };
}

export async function computeBaseline(period: string): Promise<BaselineDataset> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  const periodKey = toMonthKey(period);
  const monthStart = toMonthStart(period);
  const [budgets, spentMap, weeklyBudgets] = await Promise.all([
    listBudgets(periodKey),
    computeSpent(periodKey),
    listWeeklyBudgets(periodKey),
  ]);

  const categoryMap = new Map<string, BaselineCategoryData>();
  for (const row of budgets) {
    const entry = mapBudgetRowToCategory(row);
    categoryMap.set(entry.categoryId, entry);
  }

  for (const summary of weeklyBudgets.summaryByCategory) {
    const existing = categoryMap.get(summary.category_id);
    const merged = mergeBaselineCategory(existing, {
      categoryId: summary.category_id,
      categoryName: summary.category_name,
      categoryType: summary.category_type,
    });
    categoryMap.set(summary.category_id, merged);
  }

  const weeklyPlanByCategory = new Map<string, Record<string, number>>();
  const weeklyActualByCategory = new Map<string, Record<string, number>>();

  for (const row of weeklyBudgets.rows as WeeklyBudgetWithSpent[]) {
    const categoryId = row.category_id;
    const existingPlan = weeklyPlanByCategory.get(categoryId) ?? {};
    existingPlan[row.week_start] = Number(row.amount_planned ?? 0);
    weeklyPlanByCategory.set(categoryId, existingPlan);
    const existingActual = weeklyActualByCategory.get(categoryId) ?? {};
    existingActual[row.week_start] = Number(row.spent ?? 0);
    weeklyActualByCategory.set(categoryId, existingActual);
    const existing = categoryMap.get(categoryId);
    const merged = mergeBaselineCategory(existing, {
      categoryId,
      categoryName: row.category?.name ?? existing?.categoryName,
      categoryType: (row.category?.type as 'income' | 'expense' | null) ?? existing?.categoryType ?? null,
    });
    categoryMap.set(categoryId, merged);
  }

  for (const [categoryId, plan] of weeklyPlanByCategory.entries()) {
    const existing = categoryMap.get(categoryId) ?? {
      categoryId,
      categoryName: 'Tanpa kategori',
      categoryType: 'expense',
      monthlyPlanned: 0,
      weeklyPlanned: {},
      weeklyActual: {},
      actualMtd: 0,
    };
    categoryMap.set(categoryId, {
      ...existing,
      weeklyPlanned: { ...existing.weeklyPlanned, ...plan },
    });
  }

  for (const [categoryId, actual] of weeklyActualByCategory.entries()) {
    const existing = categoryMap.get(categoryId);
    if (existing) {
      categoryMap.set(categoryId, {
        ...existing,
        weeklyActual: { ...existing.weeklyActual, ...actual },
      });
    }
  }

  for (const [categoryId, spent] of Object.entries(spentMap)) {
    const existing = categoryMap.get(categoryId);
    if (existing) {
      categoryMap.set(categoryId, { ...existing, actualMtd: Number(spent ?? 0) });
    } else {
      categoryMap.set(categoryId, {
        categoryId,
        categoryName: 'Tanpa kategori',
        categoryType: 'expense',
        monthlyPlanned: 0,
        weeklyPlanned: {},
        weeklyActual: {},
        actualMtd: Number(spent ?? 0),
      });
    }
  }

  const weeks = buildBaselineWeeks(monthStart, weeklyBudgets.weeks as BaselineWeekMeta[] | undefined);
  const { daysInMonth, daysElapsed } = getMonthMetadata(monthStart);

  return {
    period: periodKey,
    monthStart,
    weeks,
    categories: Array.from(categoryMap.values()),
    daysInMonth,
    daysElapsed,
  };
}

export async function computeSimulation(
  scenarioId: string,
  options: SimulationOptions
): Promise<SimulationComputationResult> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  const { data, error } = await supabase
    .from('budget_sim_scenarios')
    .select('*')
    .eq('user_id', userId)
    .eq('id', scenarioId)
    .single();
  if (error) throw error;
  const scenario = data as BudgetSimulationScenario;
  const [baseline, items] = await Promise.all([
    computeBaseline(scenario.period_month),
    listScenarioItems(scenarioId),
  ]);
  const itemMap: Record<string, SimulationDraftItem> = {};
  for (const item of items) {
    itemMap[item.category_id] = {
      deltaMonthly: Number(item.delta_monthly ?? 0),
      deltaWeekly: normalizeDeltaWeekly(item.delta_weekly),
    };
  }
  const result = calculateSimulation({
    baseline,
    items: itemMap,
    includeWeekly: options.includeWeekly,
    lockedCategoryIds: options.lockedCategoryIds,
    projectionMode: options.projectionMode,
  });
  return { scenario, baseline, result };
}

export async function applyScenario(
  scenarioId: string,
  options: SimulationOptions
): Promise<ApplyScenarioResult> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  const { data, error } = await supabase
    .from('budget_sim_scenarios')
    .select('*')
    .eq('user_id', userId)
    .eq('id', scenarioId)
    .single();
  if (error) throw error;
  const scenario = data as BudgetSimulationScenario;
  const [baseline, items] = await Promise.all([
    computeBaseline(scenario.period_month),
    listScenarioItems(scenarioId),
  ]);
  const drafts: Record<string, SimulationDraftItem> = {};
  for (const item of items) {
    drafts[item.category_id] = {
      deltaMonthly: Number(item.delta_monthly ?? 0),
      deltaWeekly: normalizeDeltaWeekly(item.delta_weekly),
    };
  }

  const simulation = calculateSimulation({
    baseline,
    items: drafts,
    includeWeekly: options.includeWeekly,
    lockedCategoryIds: options.lockedCategoryIds,
    projectionMode: options.projectionMode,
  });

  const budgets = await listBudgets(baseline.period);
  const weeklyBudgets = await listWeeklyBudgets(baseline.period);
  const budgetMap = new Map(budgets.map((row) => [row.category_id, row]));
  const weeklyMap = new Map(
    weeklyBudgets.rows.map((row) => [`${row.category_id}:${row.week_start}`, row])
  );

  let updatedMonthly = 0;
  let updatedWeekly = 0;

  for (const [categoryId, draft] of Object.entries(drafts)) {
    if (options.lockedCategoryIds?.has(categoryId)) {
      continue;
    }
    const sanitized = sanitizeDraftItem(draft);
    const monthlyDelta = sanitized.deltaMonthly ?? 0;
    const weeklyDelta = sanitized.deltaWeekly ?? {};
    const baselineRow = budgetMap.get(categoryId);
    const baselineMonthly = Number(baselineRow?.amount_planned ?? 0);
    const nextMonthly = Math.max(0, baselineMonthly + monthlyDelta);
    if (nextMonthly !== baselineMonthly) {
      await upsertBudget({
        category_id: categoryId,
        period: baseline.period,
        amount_planned: nextMonthly,
        carryover_enabled: baselineRow?.carryover_enabled ?? false,
        notes: baselineRow?.notes ?? undefined,
      });
      updatedMonthly += 1;
    }
    for (const [weekStart, delta] of Object.entries(weeklyDelta)) {
      if (!Number.isFinite(delta) || delta === 0) continue;
      const key = `${categoryId}:${weekStart}`;
      const weeklyRow = weeklyMap.get(key) as WeeklyBudgetWithSpent | undefined;
      const baselineWeekly = Number(weeklyRow?.amount_planned ?? 0);
      const nextWeekly = Math.max(0, baselineWeekly + delta);
      if (nextWeekly === baselineWeekly) continue;
      await upsertWeeklyBudget({
        id: weeklyRow?.id,
        category_id: categoryId,
        week_start: weekStart,
        amount_planned: nextWeekly,
        carryover_enabled: weeklyRow?.carryover_enabled ?? false,
        notes: weeklyRow?.notes ?? undefined,
      });
      updatedWeekly += 1;
    }
  }

  await updateScenario(scenarioId, { status: 'applied' });

  return {
    updatedMonthly,
    updatedWeekly,
    balanceImpact: simulation.summary.balanceImpact,
    totalDelta: simulation.summary.totalDeltaPlanned,
  };
}
