import { parseISO, addMonths, startOfWeek, formatISO } from 'date-fns';
import { supabase } from './supabase';
import { getCurrentUserId, getUserToken } from './session';
import { calculateDaysElapsed, getDaysInMonth, projectAmount, type ProjectionMethod, type ProjectionContext } from './simMath';

export type ScenarioStatus = 'draft' | 'applied' | 'archived';

export interface BudgetSimScenario {
  id: string;
  user_id: string;
  name: string;
  period_month: string; // YYYY-MM-01
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

export interface BaselineCategorySnapshot {
  id: string;
  name: string;
  type: 'income' | 'expense';
  plannedMonthly: number;
  plannedWeekly: Record<string, number>;
  actualMtd: number;
  weeklyActuals: Record<string, number>;
  trailingWeeklyActuals: number[];
  carryoverEnabled?: boolean;
  notes?: string | null;
}

export interface BaselineData {
  periodMonth: string;
  monthStart: string;
  monthEndExclusive: string;
  daysInMonth: number;
  daysElapsed: number;
  weeks: string[];
  trailingWeeks: string[];
  categories: BaselineCategorySnapshot[];
}

export interface SimulationCategorySnapshot extends BaselineCategorySnapshot {
  deltaMonthly: number;
  deltaWeekly: Record<string, number>;
  simulatedMonthly: number;
  simulatedWeekly: Record<string, number>;
}

export interface SimulationSnapshot {
  scenario: BudgetSimScenario;
  baseline: BaselineData;
  categories: SimulationCategorySnapshot[];
}

export interface ListScenarioParams {
  period_month: string;
}

export async function listScenarios(params: ListScenarioParams): Promise<BudgetSimScenario[]> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  const { data, error } = await supabase
    .from('budget_sim_scenarios')
    .select('*')
    .eq('user_id', userId)
    .eq('period_month', params.period_month)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as BudgetSimScenario[];
}

export async function createScenario(payload: {
  name: string;
  period_month: string;
  notes?: string;
}): Promise<BudgetSimScenario> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  await getUserToken();
  const insertPayload = {
    user_id: userId,
    name: payload.name,
    period_month: payload.period_month,
    status: 'draft' as ScenarioStatus,
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
  id: string,
  payload: Partial<Pick<BudgetSimScenario, 'name' | 'notes' | 'status'>>
): Promise<BudgetSimScenario> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  await getUserToken();
  const { data, error } = await supabase
    .from('budget_sim_scenarios')
    .update(payload)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as BudgetSimScenario;
}

export async function deleteScenario(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  await getUserToken();
  const { error } = await supabase
    .from('budget_sim_scenarios')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
}

export async function archiveScenario(id: string): Promise<BudgetSimScenario> {
  return updateScenario(id, { status: 'archived' });
}

export async function duplicateScenario(id: string): Promise<BudgetSimScenario> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  const { data, error } = await supabase
    .from('budget_sim_scenarios')
    .select('*, items:budget_sim_items(*)')
    .eq('user_id', userId)
    .eq('id', id)
    .single();
  if (error) throw error;
  if (!data) throw new Error('Skenario tidak ditemukan');
  const scenario = data as BudgetSimScenario & { items?: BudgetSimItem[] };
  const nameCandidate = `${scenario.name} (Copy)`;
  const newScenario = await createScenario({
    name: nameCandidate,
    period_month: scenario.period_month,
    notes: scenario.notes ?? undefined,
  });
  const items = (data as any)?.items as BudgetSimItem[] | undefined;
  if (items && items.length) {
    const insertPayload = items.map((item) => ({
      scenario_id: newScenario.id,
      category_id: item.category_id,
      delta_monthly: item.delta_monthly ?? 0,
      delta_weekly: item.delta_weekly ?? null,
    }));
    const { error: insertError } = await supabase.from('budget_sim_items').insert(insertPayload);
    if (insertError) throw insertError;
  }
  return newScenario;
}

export async function listScenarioItems(scenarioId: string): Promise<BudgetSimItem[]> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  const { data, error } = await supabase
    .from('budget_sim_items')
    .select('*')
    .eq('scenario_id', scenarioId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as BudgetSimItem[];
}

export async function upsertScenarioItem(input: {
  scenario_id: string;
  category_id: string;
  delta_monthly?: number;
  delta_weekly?: Record<string, number> | null;
}): Promise<BudgetSimItem> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  await getUserToken();
  const normalizedDeltaMonthly = Number(input.delta_monthly ?? 0);
  const normalizedWeekly = input.delta_weekly ?? null;
  const payload = {
    scenario_id: input.scenario_id,
    category_id: input.category_id,
    delta_monthly: normalizedDeltaMonthly,
    delta_weekly: normalizedWeekly,
  };
  const { data, error } = await supabase
    .from('budget_sim_items')
    .upsert(payload, { onConflict: 'scenario_id,category_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as BudgetSimItem;
}

export async function deleteScenarioItem(scenarioId: string, categoryId: string): Promise<void> {
  const { error } = await supabase
    .from('budget_sim_items')
    .delete()
    .eq('scenario_id', scenarioId)
    .eq('category_id', categoryId);
  if (error) throw error;
}

function sumRecord(values: Record<string, number>): number {
  return Object.values(values).reduce((acc, value) => acc + Number(value ?? 0), 0);
}

function normalizeWeek(date: string): string {
  return startOfWeek(parseISO(date), { weekStartsOn: 1 }).toISOString().slice(0, 10);
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function fetchCategories(userId: string): Promise<{
  id: string;
  name: string;
  type: 'income' | 'expense';
}[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id,name,type')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? 'Tanpa nama'),
    type: (row.type === 'income' ? 'income' : 'expense') as 'income' | 'expense',
  }));
}

export interface ComputeBaselineOptions {
  includeTrailingWeeks?: number;
}

export async function computeBaseline(
  periodMonth: string,
  options: ComputeBaselineOptions = {}
): Promise<BaselineData> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  const monthStart = parseISO(periodMonth);
  const nextMonth = addMonths(monthStart, 1);
  const monthEndExclusive = formatISO(nextMonth, { representation: 'date' });
  const weeks: Set<string> = new Set();

  const [categories, monthlyResponse, weeklyResponse, transactionsResponse] = await Promise.all([
    fetchCategories(userId),
    supabase
      .from('budgets')
      .select('category_id,amount_planned,carryover_enabled,notes')
      .eq('user_id', userId)
      .eq('period_month', periodMonth),
    supabase
      .from('budgets_weekly')
      .select('category_id,planned_amount,week_start')
      .eq('user_id', userId)
      .gte('week_start', periodMonth)
      .lt('week_start', monthEndExclusive),
    supabase
      .from('transactions')
      .select('category_id,amount,date,type,to_account_id,deleted_at')
      .eq('user_id', userId)
      .gte('date', formatISO(monthStart, { representation: 'date' }))
      .lt('date', monthEndExclusive),
  ]);

  if (monthlyResponse.error) throw monthlyResponse.error;
  if (weeklyResponse.error) throw weeklyResponse.error;
  if (transactionsResponse.error) throw transactionsResponse.error;

  const monthlyMap = new Map<string, { amount: number; carryover: boolean; notes: string | null }>();
  for (const row of monthlyResponse.data ?? []) {
    const categoryId = String((row as any).category_id);
    monthlyMap.set(categoryId, {
      amount: toNumber((row as any).amount_planned),
      carryover: Boolean((row as any).carryover_enabled),
      notes: ((row as any).notes ?? null) as string | null,
    });
  }

  const weeklyMap = new Map<string, Record<string, number>>();
  for (const row of weeklyResponse.data ?? []) {
    const categoryId = String((row as any).category_id);
    const weekStart = normalizeWeek(String((row as any).week_start));
    weeks.add(weekStart);
    const amount = toNumber((row as any).planned_amount);
    const map = weeklyMap.get(categoryId) ?? {};
    map[weekStart] = amount;
    weeklyMap.set(categoryId, map);
  }

  const actualMap = new Map<string, number>();
  const weeklyActualMap = new Map<string, Record<string, number>>();
  for (const row of transactionsResponse.data ?? []) {
    if ((row as any).to_account_id) continue;
    if ((row as any).deleted_at) continue;
    const categoryId = (row as any).category_id ? String((row as any).category_id) : null;
    if (!categoryId) continue;
    const type = String((row as any).type ?? 'expense');
    if (type !== 'expense' && type !== 'income') continue;
    const amount = toNumber((row as any).amount);
    actualMap.set(categoryId, (actualMap.get(categoryId) ?? 0) + amount);
    const weekKey = normalizeWeek(String((row as any).date));
    weeks.add(weekKey);
    const catWeekly = weeklyActualMap.get(categoryId) ?? {};
    catWeekly[weekKey] = (catWeekly[weekKey] ?? 0) + amount;
    weeklyActualMap.set(categoryId, catWeekly);
  }

  const sortedWeeks = Array.from(weeks).sort();
  const trailingSeries = sortedWeeks.slice(-4);

  const categorySnapshots: BaselineCategorySnapshot[] = categories.map((category) => {
    const weeklyBudgets = weeklyMap.get(category.id) ?? {};
    const weeklyActuals = weeklyActualMap.get(category.id) ?? {};
    const trailing = trailingSeries.map((week) => toNumber(weeklyActuals[week]));
    return {
      id: category.id,
      name: category.name,
      type: category.type,
      plannedMonthly: monthlyMap.get(category.id)?.amount ?? 0,
      plannedWeekly: weeklyBudgets,
      actualMtd: actualMap.get(category.id) ?? 0,
      weeklyActuals,
      trailingWeeklyActuals: trailing,
      carryoverEnabled: monthlyMap.get(category.id)?.carryover,
      notes: monthlyMap.get(category.id)?.notes ?? null,
    };
  });

  return {
    periodMonth,
    monthStart: formatISO(monthStart, { representation: 'date' }),
    monthEndExclusive,
    daysInMonth: getDaysInMonth(periodMonth),
    daysElapsed: calculateDaysElapsed(periodMonth),
    weeks: sortedWeeks,
    trailingWeeks: trailingSeries,
    categories: categorySnapshots,
  };
}

export async function computeSimulation(
  scenarioId: string
): Promise<SimulationSnapshot> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  const { data, error } = await supabase
    .from('budget_sim_scenarios')
    .select('*, items:budget_sim_items(*)')
    .eq('user_id', userId)
    .eq('id', scenarioId)
    .single();
  if (error) throw error;
  if (!data) throw new Error('Skenario tidak ditemukan');
  const scenario = data as BudgetSimScenario & { items?: BudgetSimItem[] };
  const baseline = await computeBaseline(scenario.period_month);
  const itemMap = new Map<string, BudgetSimItem>();
  for (const item of scenario.items ?? []) {
    itemMap.set(item.category_id, item);
  }

  const categories: SimulationCategorySnapshot[] = baseline.categories.map((category) => {
    const item = itemMap.get(category.id);
    const deltaWeekly: Record<string, number> = {};
    if (item?.delta_weekly) {
      for (const [week, value] of Object.entries(item.delta_weekly)) {
        if (!value) continue;
        deltaWeekly[week] = toNumber(value);
      }
    }
    const simulatedWeekly: Record<string, number> = { ...category.plannedWeekly };
    for (const week of Object.keys(deltaWeekly)) {
      simulatedWeekly[week] = (simulatedWeekly[week] ?? 0) + deltaWeekly[week];
    }
    return {
      ...category,
      deltaMonthly: item ? toNumber(item.delta_monthly) : 0,
      deltaWeekly,
      simulatedMonthly: category.plannedMonthly + (item ? toNumber(item.delta_monthly) : 0),
      simulatedWeekly,
    };
  });

  return {
    scenario,
    baseline,
    categories,
  };
}

export interface ApplyScenarioResult {
  updatedMonthly: number;
  updatedWeekly: number;
}

export async function applyScenario(scenarioId: string): Promise<ApplyScenarioResult> {
  const { scenario, categories } = await computeSimulation(scenarioId);
  await getUserToken();
  const monthlyPayload = [] as {
    p_category_id: string;
    p_amount_planned: number;
    p_period_month: string;
    p_carryover_enabled: boolean;
    p_notes: string | null;
  }[];
  const weeklyPayload = [] as {
    category_id: string;
    week_start: string;
    planned_amount: number;
  }[];

  for (const category of categories) {
    const deltaMonthly = category.deltaMonthly;
    if (deltaMonthly) {
      monthlyPayload.push({
        p_category_id: category.id,
        p_amount_planned: category.simulatedMonthly,
        p_period_month: scenario.period_month,
        p_carryover_enabled: Boolean(category.carryoverEnabled),
        p_notes: category.notes ?? null,
      });
    }
    for (const [week, planned] of Object.entries(category.simulatedWeekly)) {
      if (category.plannedWeekly[week] === planned) continue;
      weeklyPayload.push({
        category_id: category.id,
        week_start: week,
        planned_amount: planned,
      });
    }
  }

  let updatedMonthly = 0;
  let updatedWeekly = 0;

  for (const payload of monthlyPayload) {
    const { error } = await supabase.rpc('bud_upsert', payload);
    if (error) throw error;
    updatedMonthly += 1;
  }

  for (const payload of weeklyPayload) {
    const { error } = await supabase
      .from('budgets_weekly')
      .upsert(
        {
          user_id: scenario.user_id,
          category_id: payload.category_id,
          week_start: payload.week_start,
          planned_amount: payload.planned_amount,
        },
        { onConflict: 'user_id,category_id,week_start' }
      );
    if (error) throw error;
    updatedWeekly += 1;
  }

  await updateScenario(scenarioId, { status: 'applied' });

  return { updatedMonthly, updatedWeekly };
}

export function computeTotals(
  snapshot: SimulationSnapshot,
  method: ProjectionMethod,
  includeWeekly: boolean
) {
  const context: ProjectionContext = {
    periodMonth: snapshot.baseline.periodMonth,
    daysInMonth: snapshot.baseline.daysInMonth,
    daysElapsed: snapshot.baseline.daysElapsed,
    totalWeeks: Math.max(snapshot.baseline.weeks.length, 1),
  };

  let baselineIncome = 0;
  let baselineExpense = 0;
  let simulationIncome = 0;
  let simulationExpense = 0;
  let actualMtdIncome = 0;
  let actualMtdExpense = 0;
  let projectedIncome = 0;
  let projectedExpense = 0;

  for (const category of snapshot.categories) {
    const baselineValue = includeWeekly
      ? sumRecord(category.plannedWeekly)
      : category.plannedMonthly;
    const simulatedValue = includeWeekly
      ? sumRecord(category.simulatedWeekly)
      : category.simulatedMonthly;
    const projection = projectAmount(method, context, {
      actualMtd: category.actualMtd,
      weeklyActuals: snapshot.baseline.weeks.map(
        (week) => category.weeklyActuals[week] ?? 0
      ),
      trailingWeeklyActuals: category.trailingWeeklyActuals,
    });
    if (category.type === 'income') {
      baselineIncome += baselineValue;
      simulationIncome += simulatedValue;
      actualMtdIncome += category.actualMtd;
      projectedIncome += projection;
    } else {
      baselineExpense += baselineValue;
      simulationExpense += simulatedValue;
      actualMtdExpense += category.actualMtd;
      projectedExpense += projection;
    }
  }

  return {
    baseline: {
      income: baselineIncome,
      expense: baselineExpense,
    },
    simulation: {
      income: simulationIncome,
      expense: simulationExpense,
    },
    actual: {
      income: actualMtdIncome,
      expense: actualMtdExpense,
    },
    projected: {
      income: projectedIncome,
      expense: projectedExpense,
    },
  };
}
