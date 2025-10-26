import { supabase } from './supabase';
import { getCurrentUserId, getUserToken } from './session';
import {
  computeSpent,
  listBudgets,
  listCategoriesExpense,
  listWeeklyBudgets,
  upsertBudget,
  upsertWeeklyBudget,
  type BudgetRow,
  type WeeklyBudgetsResult,
  type WeeklyBudgetWithSpent,
} from './budgetApi';
import type { ExpenseCategory } from './budgetApi';

type UUID = string;

export type SimulationProjectionMethod = 'linear' | 'recent' | 'static';

export type SimulationWeeklyKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type SimulationWeeklyDelta = Record<SimulationWeeklyKey, number>;

export interface BudgetSimulationScenarioSummary {
  id: UUID;
  name: string;
  period: string; // YYYY-MM
  includeWeekly: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetSimulationItemRecord {
  id: UUID;
  scenarioId: UUID;
  categoryId: UUID;
  deltaMonthly: number;
  deltaWeekly: SimulationWeeklyDelta;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetSimulationScenarioDetail extends BudgetSimulationScenarioSummary {
  items: BudgetSimulationItemRecord[];
}

export interface BudgetSimulationBaselineCategory {
  categoryId: UUID;
  name: string;
  type: 'income' | 'expense' | null;
  plannedMonthly: number;
  plannedWeekly: number;
  carryoverEnabled: boolean;
}

export interface BudgetSimulationBaselineData {
  period: string;
  monthStart: string;
  categories: BudgetSimulationBaselineCategory[];
  categoryById: Map<UUID, BudgetSimulationBaselineCategory>;
  monthlyBudgets: BudgetRow[];
  weeklyBudgets: WeeklyBudgetsResult;
  weeklyRowsByCategory: Map<UUID, WeeklyBudgetWithSpent[]>;
  actualByCategory: Record<UUID, number>;
}

export interface BudgetSimulationSnapshotCategory {
  categoryId: UUID;
  name: string;
  type: 'income' | 'expense' | null;
  baselinePlanned: number;
  scenarioPlanned: number;
  baselineMonthly: number;
  scenarioMonthly: number;
  baselineWeekly: number;
  scenarioWeekly: number;
  deltaMonthly: number;
  deltaWeekly: number;
  actual: number;
  projected: number;
  ratio: number;
  status: 'safe' | 'caution' | 'warning' | 'over';
  locked: boolean;
}

export interface BudgetSimulationSnapshotTotals {
  planned: number;
  plannedBaseline: number;
  actual: number;
  projected: number;
  remaining: number;
  remainingBaseline: number;
  deltaPlanned: number;
  deltaProjected: number;
}

export interface BudgetSimulationSnapshot {
  categories: BudgetSimulationSnapshotCategory[];
  totals: BudgetSimulationSnapshotTotals;
}

export interface BudgetSimulationDraftItem {
  deltaMonthly: number;
  deltaWeekly: SimulationWeeklyDelta;
  locked: boolean;
}

export interface ApplySimulationResult {
  monthlyUpdates: Array<{ categoryId: UUID; before: number; after: number }>;
  weeklyUpdates: Array<{
    categoryId: UUID;
    weekStart: string;
    before: number;
    after: number;
  }>;
}

function createEmptyWeeklyDelta(): SimulationWeeklyDelta {
  return { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 };
}

function sanitizeNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function sanitizeWeeklyDelta(value: unknown): SimulationWeeklyDelta {
  if (!value || typeof value !== 'object') {
    return createEmptyWeeklyDelta();
  }
  const entries = value as Record<string, unknown>;
  const result = createEmptyWeeklyDelta();
  (Object.keys(result) as SimulationWeeklyKey[]).forEach((key) => {
    result[key] = sanitizeNumber(entries[key]);
  });
  return result;
}

function toMonthStart(period: string): string {
  const [yearStr, monthStr] = period.split('-');
  if (!yearStr || !monthStr) {
    throw new Error('Periode harus dalam format YYYY-MM');
  }
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    throw new Error('Periode harus dalam format YYYY-MM');
  }
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-01`;
}

function toPeriod(monthStart: string): string {
  if (!monthStart) return '';
  const [yearStr, monthStr] = monthStart.split('-');
  if (!yearStr || !monthStr) return '';
  return `${yearStr}-${monthStr}`;
}

async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Pengguna belum masuk');
  }
  return userId;
}

async function ensureWriteAccess(): Promise<void> {
  try {
    await getUserToken();
  } catch (error) {
    if (error instanceof Error && error.message === 'Not signed in') {
      throw new Error('Silakan login untuk menyimpan perubahan');
    }
    throw error;
  }
}

function mapScenarioRow(row: any): BudgetSimulationScenarioSummary {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Tanpa Nama'),
    period: toPeriod(String(row.period_month ?? '')),
    includeWeekly: Boolean(row.include_weekly ?? true),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

function mapItemRow(row: any): BudgetSimulationItemRecord {
  return {
    id: String(row.id),
    scenarioId: String(row.scenario_id),
    categoryId: String(row.category_id),
    deltaMonthly: sanitizeNumber(row.delta_monthly),
    deltaWeekly: sanitizeWeeklyDelta(row.delta_weekly),
    locked: Boolean(row.locked ?? false),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

export async function listBudgetSimulationScenarios(period: string): Promise<BudgetSimulationScenarioSummary[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('budget_sim_scenarios')
    .select('id,name,period_month,include_weekly,created_at,updated_at')
    .eq('user_id', userId)
    .eq('period_month', toMonthStart(period))
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapScenarioRow);
}

export async function fetchBudgetSimulationScenario(id: string): Promise<BudgetSimulationScenarioDetail | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('budget_sim_scenarios')
    .select('id,name,period_month,include_weekly,created_at,updated_at,items:budget_sim_items(*)')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const summary = mapScenarioRow(data);
  const items: BudgetSimulationItemRecord[] = Array.isArray((data as any).items)
    ? ((data as any).items as any[]).map(mapItemRow)
    : [];
  return {
    ...summary,
    items,
  };
}

export async function createBudgetSimulationScenario(options: {
  name: string;
  period: string;
  includeWeekly?: boolean;
  sourceScenarioId?: string | null;
}): Promise<BudgetSimulationScenarioDetail> {
  const userId = await requireUserId();
  await ensureWriteAccess();
  const { data, error } = await supabase
    .from('budget_sim_scenarios')
    .insert({
      user_id: userId,
      name: options.name,
      period_month: toMonthStart(options.period),
      include_weekly: options.includeWeekly ?? true,
    })
    .select('id,name,period_month,include_weekly,created_at,updated_at')
    .single();
  if (error) throw error;
  const scenario = mapScenarioRow(data);
  if (options.sourceScenarioId) {
    const { data: existingItems, error: itemsError } = await supabase
      .from('budget_sim_items')
      .select('category_id,delta_monthly,delta_weekly,locked')
      .eq('scenario_id', options.sourceScenarioId);
    if (itemsError) throw itemsError;
    if (existingItems && existingItems.length > 0) {
      const payload = existingItems.map((item) => ({
        scenario_id: scenario.id,
        category_id: item.category_id,
        delta_monthly: sanitizeNumber(item.delta_monthly),
        delta_weekly: item.delta_weekly ?? null,
        locked: Boolean(item.locked ?? false),
      }));
      const { error: insertError } = await supabase
        .from('budget_sim_items')
        .insert(payload);
      if (insertError) throw insertError;
    }
  }
  const full = await fetchBudgetSimulationScenario(scenario.id);
  if (!full) {
    return { ...scenario, items: [] };
  }
  return full;
}

export async function updateBudgetSimulationScenario(
  id: string,
  updates: Partial<{ name: string; includeWeekly: boolean }>,
): Promise<void> {
  if (!updates.name && typeof updates.includeWeekly === 'undefined') return;
  await requireUserId();
  await ensureWriteAccess();
  const payload: Record<string, unknown> = {};
  if (typeof updates.name === 'string') payload.name = updates.name;
  if (typeof updates.includeWeekly === 'boolean') payload.include_weekly = updates.includeWeekly;
  const { error } = await supabase
    .from('budget_sim_scenarios')
    .update(payload)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteBudgetSimulationScenario(id: string): Promise<void> {
  await requireUserId();
  await ensureWriteAccess();
  const { error } = await supabase.from('budget_sim_scenarios').delete().eq('id', id);
  if (error) throw error;
}

export async function saveBudgetSimulationItems(
  scenarioId: string,
  items: Record<UUID, BudgetSimulationDraftItem>,
): Promise<void> {
  await requireUserId();
  await ensureWriteAccess();
  const rows = Object.entries(items)
    .filter(([, item]) => {
      const monthly = Number(item.deltaMonthly ?? 0);
      const weeklyTotal = sumWeeklyDelta(item.deltaWeekly);
      return Math.abs(monthly) > 0.0001 || Math.abs(weeklyTotal) > 0.0001 || item.locked;
    })
    .map(([categoryId, item]) => ({
      scenario_id: scenarioId,
      category_id: categoryId,
      delta_monthly: Number(item.deltaMonthly ?? 0),
      delta_weekly: serializeWeeklyDelta(item.deltaWeekly),
      locked: Boolean(item.locked ?? false),
    }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from('budget_sim_items')
      .upsert(rows, { onConflict: 'scenario_id,category_id' });
    if (error) throw error;
  }

  const { data: existingItems, error: existingError } = await supabase
    .from('budget_sim_items')
    .select('id,category_id')
    .eq('scenario_id', scenarioId);
  if (existingError) throw existingError;

  const keep = new Set(rows.map((row) => row.category_id));
  const toDelete = (existingItems ?? [])
    .filter((row) => !keep.has(String(row.category_id)))
    .map((row) => String(row.id));

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('budget_sim_items')
      .delete()
      .in('id', toDelete);
    if (deleteError) throw deleteError;
  }
}

export function createEmptyDraftItem(): BudgetSimulationDraftItem {
  return {
    deltaMonthly: 0,
    deltaWeekly: createEmptyWeeklyDelta(),
    locked: false,
  };
}

function buildCategoryMap(categories: ExpenseCategory[]): Map<UUID, ExpenseCategory> {
  const map = new Map<UUID, ExpenseCategory>();
  categories.forEach((category) => {
    map.set(category.id, category);
  });
  return map;
}

export async function fetchBudgetSimulationBaseline(period: string): Promise<BudgetSimulationBaselineData> {
  const [categories, budgets, actualByCategory, weekly] = await Promise.all([
    listCategoriesExpense(),
    listBudgets(period),
    computeSpent(period),
    listWeeklyBudgets(period),
  ]);

  const categoryRecords = buildCategoryMap(categories);
  const categoryMap = new Map<UUID, BudgetSimulationBaselineCategory>();

  budgets.forEach((row) => {
    const categoryId = row.category_id as UUID | null;
    if (!categoryId) return;
    const existing = categoryMap.get(categoryId);
    const categoryInfo = categoryRecords.get(categoryId);
    const base: BudgetSimulationBaselineCategory = existing ?? {
      categoryId,
      name: row.category?.name ?? categoryInfo?.name ?? 'Tidak diketahui',
      type: (row.category?.type ?? categoryInfo?.type ?? 'expense') as 'income' | 'expense' | null,
      plannedMonthly: 0,
      plannedWeekly: 0,
      carryoverEnabled: Boolean(row.carryover_enabled),
    };
    base.plannedMonthly += sanitizeNumber(row.amount_planned);
    base.carryoverEnabled = base.carryoverEnabled || Boolean(row.carryover_enabled);
    categoryMap.set(categoryId, base);
  });

  categories.forEach((category) => {
    if (categoryMap.has(category.id)) return;
    categoryMap.set(category.id, {
      categoryId: category.id,
      name: category.name,
      type: category.type ?? 'expense',
      plannedMonthly: 0,
      plannedWeekly: 0,
      carryoverEnabled: false,
    });
  });

  weekly.summaryByCategory.forEach((summary) => {
    const categoryId = summary.category_id as UUID;
    const base = categoryMap.get(categoryId);
    if (base) {
      base.plannedWeekly = sanitizeNumber(summary.planned);
    } else {
      categoryMap.set(categoryId, {
        categoryId,
        name: summary.category_name,
        type: summary.category_type,
        plannedMonthly: 0,
        plannedWeekly: sanitizeNumber(summary.planned),
        carryoverEnabled: false,
      });
    }
  });

  Object.keys(actualByCategory).forEach((categoryId) => {
    if (!categoryMap.has(categoryId)) {
      categoryMap.set(categoryId, {
        categoryId,
        name: 'Kategori tidak diketahui',
        type: 'expense',
        plannedMonthly: 0,
        plannedWeekly: 0,
        carryoverEnabled: false,
      });
    }
  });

  const categoriesList = Array.from(categoryMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'id-ID'),
  );

  const weeklyRowsByCategory = new Map<UUID, WeeklyBudgetWithSpent[]>();
  weekly.rows.forEach((row) => {
    const categoryId = row.category_id as UUID | null;
    if (!categoryId) return;
    const list = weeklyRowsByCategory.get(categoryId) ?? [];
    list.push(row);
    weeklyRowsByCategory.set(categoryId, list);
  });

  return {
    period,
    monthStart: toMonthStart(period),
    categories: categoriesList,
    categoryById: categoryMap,
    monthlyBudgets: budgets,
    weeklyBudgets: weekly,
    weeklyRowsByCategory,
    actualByCategory,
  };
}

function sumWeeklyDelta(delta: SimulationWeeklyDelta | undefined): number {
  if (!delta) return 0;
  return (Object.keys(delta) as SimulationWeeklyKey[]).reduce((acc, key) => acc + sanitizeNumber(delta[key]), 0);
}

function serializeWeeklyDelta(delta: SimulationWeeklyDelta): Record<string, number> | null {
  const total = sumWeeklyDelta(delta);
  if (Math.abs(total) < 0.0001) {
    return null;
  }
  const result: Record<string, number> = {};
  (Object.keys(delta) as SimulationWeeklyKey[]).forEach((key) => {
    const value = sanitizeNumber(delta[key]);
    if (Math.abs(value) > 0.0001) {
      result[key] = value;
    }
  });
  return Object.keys(result).length > 0 ? result : null;
}

function deriveStatus(ratio: number): 'safe' | 'caution' | 'warning' | 'over' {
  if (!Number.isFinite(ratio) || ratio <= 0.74) return 'safe';
  if (ratio <= 0.89) return 'caution';
  if (ratio <= 1.0) return 'warning';
  return 'over';
}

interface ProjectionOptions {
  method: SimulationProjectionMethod;
  includeCarryover: boolean;
  carryoverEnabled: boolean;
  carryoverAmount: number;
  actual: number;
  planned: number;
  daysElapsed: number;
  daysInMonth: number;
}

function computeProjection({
  method,
  includeCarryover,
  carryoverEnabled,
  carryoverAmount,
  actual,
  planned,
  daysElapsed,
  daysInMonth,
}: ProjectionOptions): number {
  const safeActual = Math.max(actual, 0);
  if (method === 'static' || daysElapsed <= 0) {
    return Math.max(safeActual, includeCarryover && carryoverEnabled ? safeActual + carryoverAmount : safeActual);
  }

  const effectiveDaysElapsed = Math.max(daysElapsed, 1);
  if (method === 'linear') {
    const dailyAverage = safeActual / effectiveDaysElapsed;
    const projected = dailyAverage * Math.max(daysInMonth, effectiveDaysElapsed);
    const withCarryover = includeCarryover && carryoverEnabled ? projected + carryoverAmount : projected;
    return Math.max(safeActual, withCarryover);
  }

  const weeksElapsed = Math.max(effectiveDaysElapsed / 7, 1 / 7);
  const projectedWeeks = Math.max(Math.min(daysInMonth / 7, 4), weeksElapsed);
  const weeklyAverage = safeActual / weeksElapsed;
  const projected = weeklyAverage * projectedWeeks;
  const withCarryover = includeCarryover && carryoverEnabled ? projected + carryoverAmount : projected;
  return Math.max(safeActual, withCarryover);
}

function getDaysInfo(period: string): { daysInMonth: number; daysElapsed: number } {
  const [yearStr, monthStr] = period.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return { daysInMonth: 30, daysElapsed: 0 };
  }
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const daysInMonth = Math.round((nextMonth.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24));
  const now = new Date();
  if (now < monthStart) {
    return { daysInMonth, daysElapsed: 0 };
  }
  const capped = now > nextMonth ? nextMonth : now;
  const diff = Math.floor((capped.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24));
  return { daysInMonth, daysElapsed: Math.min(daysInMonth, diff + 1) };
}

export interface SnapshotOptions {
  baseline: BudgetSimulationBaselineData;
  items: Record<UUID, BudgetSimulationDraftItem>;
  includeWeekly: boolean;
  method: SimulationProjectionMethod;
  includeCarryover: boolean;
}

export function computeBudgetSimulationSnapshot({
  baseline,
  items,
  includeWeekly,
  method,
  includeCarryover,
}: SnapshotOptions): BudgetSimulationSnapshot {
  const { daysElapsed, daysInMonth } = getDaysInfo(baseline.period);
  const categories: BudgetSimulationSnapshotCategory[] = [];
  let plannedTotal = 0;
  let plannedBaselineTotal = 0;
  let projectedTotal = 0;
  let actualTotal = 0;

  baseline.categories.forEach((category) => {
    const baselineWeekly = includeWeekly ? category.plannedWeekly : 0;
    const item = items[category.categoryId];
    const locked = Boolean(item?.locked);
    const deltaMonthly = locked ? 0 : sanitizeNumber(item?.deltaMonthly ?? 0);
    const weeklyDelta = locked ? 0 : sumWeeklyDelta(item?.deltaWeekly ?? createEmptyWeeklyDelta());
    const scenarioMonthly = category.plannedMonthly + deltaMonthly;
    const scenarioWeekly = includeWeekly ? category.plannedWeekly + weeklyDelta : 0;
    const baselinePlanned = category.plannedMonthly + baselineWeekly;
    const scenarioPlanned = Math.max(0, scenarioMonthly + scenarioWeekly);
    const actual = sanitizeNumber(baseline.actualByCategory[category.categoryId] ?? 0);
    const carryoverAmount = Math.max(0, baselinePlanned - actual);
    const projected = computeProjection({
      method,
      includeCarryover,
      carryoverEnabled: category.carryoverEnabled,
      carryoverAmount,
      actual,
      planned: scenarioPlanned,
      daysElapsed,
      daysInMonth,
    });
    const ratio = scenarioPlanned > 0 ? projected / scenarioPlanned : 0;
    const status = deriveStatus(ratio);

    categories.push({
      categoryId: category.categoryId,
      name: category.name,
      type: category.type,
      baselinePlanned,
      scenarioPlanned,
      baselineMonthly: category.plannedMonthly,
      scenarioMonthly,
      baselineWeekly: category.plannedWeekly,
      scenarioWeekly,
      deltaMonthly,
      deltaWeekly: weeklyDelta,
      actual,
      projected,
      ratio,
      status,
      locked,
    });

    plannedTotal += scenarioPlanned;
    plannedBaselineTotal += baselinePlanned;
    projectedTotal += projected;
    actualTotal += actual;
  });

  const remaining = plannedTotal - actualTotal;
  const remainingBaseline = plannedBaselineTotal - actualTotal;

  return {
    categories,
    totals: {
      planned: plannedTotal,
      plannedBaseline: plannedBaselineTotal,
      actual: actualTotal,
      projected: projectedTotal,
      remaining,
      remainingBaseline,
      deltaPlanned: plannedTotal - plannedBaselineTotal,
      deltaProjected: projectedTotal - plannedBaselineTotal,
    },
  };
}

export interface ApplySimulationOptions {
  period: string;
  baseline: BudgetSimulationBaselineData;
  items: Record<UUID, BudgetSimulationDraftItem>;
  includeWeekly: boolean;
}

export async function applyBudgetSimulation({
  period,
  baseline,
  items,
  includeWeekly,
}: ApplySimulationOptions): Promise<ApplySimulationResult> {
  await requireUserId();
  await ensureWriteAccess();

  const monthlyUpdates: ApplySimulationResult['monthlyUpdates'] = [];
  const weeklyUpdates: ApplySimulationResult['weeklyUpdates'] = [];

  const monthlyByCategory = new Map<UUID, { amount: number; carryover: boolean; notes: string | null }>();
  baseline.monthlyBudgets.forEach((row) => {
    const categoryId = row.category_id as UUID | null;
    if (!categoryId) return;
    const entry = monthlyByCategory.get(categoryId) ?? {
      amount: 0,
      carryover: Boolean(row.carryover_enabled),
      notes: row.notes ?? null,
    };
    entry.amount += sanitizeNumber(row.amount_planned);
    entry.carryover = entry.carryover || Boolean(row.carryover_enabled);
    entry.notes = entry.notes ?? (row.notes ?? null);
    monthlyByCategory.set(categoryId, entry);
  });

  for (const category of baseline.categories) {
    const item = items[category.categoryId];
    const locked = Boolean(item?.locked);
    const deltaMonthly = locked ? 0 : sanitizeNumber(item?.deltaMonthly ?? 0);
    if (Math.abs(deltaMonthly) < 0.0001 && monthlyByCategory.has(category.categoryId) === false) {
      continue;
    }
    const baselineEntry = monthlyByCategory.get(category.categoryId) ?? {
      amount: 0,
      carryover: category.carryoverEnabled,
      notes: null,
    };
    const nextAmount = Math.max(0, baselineEntry.amount + deltaMonthly);
    if (Math.abs(nextAmount - baselineEntry.amount) < 0.0001) {
      continue;
    }
    await upsertBudget({
      category_id: category.categoryId,
      amount_planned: nextAmount,
      carryover_enabled: baselineEntry.carryover,
      period,
      notes: baselineEntry.notes,
    });
    monthlyUpdates.push({
      categoryId: category.categoryId,
      before: baselineEntry.amount,
      after: nextAmount,
    });
  }

  if (includeWeekly) {
    const weeks = baseline.weeklyBudgets.weeks;
    for (const category of baseline.categories) {
      const item = items[category.categoryId];
      if (!item || item.locked) continue;
      const weeklyDelta = sumWeeklyDelta(item.deltaWeekly ?? createEmptyWeeklyDelta());
      if (Math.abs(weeklyDelta) < 0.0001) continue;
      const rows = baseline.weeklyRowsByCategory.get(category.categoryId) ?? [];
      if (rows.length === 0) {
        const weeksToUse = weeks.length ? weeks : [];
        const distribution = weeksToUse.length || 1;
        const perWeek = weeklyDelta / distribution;
        if (weeksToUse.length === 0) continue;
        await Promise.all(
          weeksToUse.map(async (week) => {
            const amount = Math.max(0, perWeek);
            if (Math.abs(amount) < 0.0001) return;
            await upsertWeeklyBudget({
              category_id: category.categoryId,
              amount_planned: amount,
              carryover_enabled: category.carryoverEnabled,
              week_start: week.start,
            });
            weeklyUpdates.push({
              categoryId: category.categoryId,
              weekStart: week.start,
              before: 0,
              after: amount,
            });
          }),
        );
        continue;
      }
      const baselineTotal = rows.reduce((acc, row) => acc + sanitizeNumber(row.amount_planned), 0);
      const distributionBase = baselineTotal > 0 ? baselineTotal : rows.length;
      await Promise.all(
        rows.map(async (row) => {
          const weight = baselineTotal > 0 ? row.amount_planned / distributionBase : 1 / rows.length;
          const adjustment = weeklyDelta * weight;
          const nextAmount = Math.max(0, sanitizeNumber(row.amount_planned) + adjustment);
          if (Math.abs(nextAmount - sanitizeNumber(row.amount_planned)) < 0.0001) return;
          await upsertWeeklyBudget({
            id: row.id,
            category_id: row.category_id,
            amount_planned: nextAmount,
            carryover_enabled: Boolean(row.carryover_enabled),
            week_start: row.week_start,
            notes: row.notes ?? undefined,
          });
          weeklyUpdates.push({
            categoryId: category.categoryId,
            weekStart: row.week_start,
            before: sanitizeNumber(row.amount_planned),
            after: nextAmount,
          });
        }),
      );
    }
  }

  return { monthlyUpdates, weeklyUpdates };
}

export function buildDraftFromItems(items: BudgetSimulationItemRecord[]): Record<UUID, BudgetSimulationDraftItem> {
  const result: Record<UUID, BudgetSimulationDraftItem> = {};
  items.forEach((item) => {
    result[item.categoryId] = {
      deltaMonthly: sanitizeNumber(item.deltaMonthly),
      deltaWeekly: sanitizeWeeklyDelta(item.deltaWeekly),
      locked: Boolean(item.locked ?? false),
    };
  });
  return result;
}

