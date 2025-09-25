import { supabase } from './supabase.js';

export interface BudgetCategory {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  name: string;
  inserted_at: string | null;
  group_name: string | null;
  order_index: number | null;
}

export interface BudgetRecord {
  id: string;
  user_id: string;
  category_id: string | null;
  amount_planned: number;
  carryover_enabled: boolean;
  notes: string | null;
  period_month: string;
  created_at: string | null;
  updated_at: string | null;
  rev: number | null;
  current_spent: number | null;
  category: { id: string; name: string | null } | null;
}

export interface SpentByCategory {
  [categoryId: string]: number;
}

export interface UpsertBudgetInput {
  userId: string;
  period: string; // YYYY-MM
  categoryId: string;
  amountPlanned: number;
  carryoverEnabled: boolean;
  notes?: string | null;
  id?: string;
}

function ensurePeriodDate(period: string): string {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) {
    throw new Error('Periode tidak valid. Gunakan format YYYY-MM.');
  }
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toISOString().slice(0, 10);
}

function getNextMonthDate(periodDate: string): string {
  const date = new Date(periodDate);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function parseNumeric(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseFloat(value);
  return 0;
}

export async function listExpenseCategories(userId: string): Promise<BudgetCategory[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id,user_id,type,name,inserted_at,"group" as group_name,order_index')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .order('order_index', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    user_id: String(row.user_id),
    type: (row.type as 'income' | 'expense') ?? 'expense',
    name: String(row.name ?? ''),
    inserted_at: row.inserted_at ?? null,
    group_name: (row as { group_name?: string | null }).group_name ?? null,
    order_index:
      row.order_index === null || row.order_index === undefined
        ? null
        : Number.parseInt(String(row.order_index), 10),
  }));
}

export async function listBudgets(userId: string, period: string): Promise<BudgetRecord[]> {
  const periodDate = ensurePeriodDate(period);
  const { data, error } = await supabase
    .from('budgets')
    .select(
      'id,user_id,category_id,amount_planned,carryover_enabled,notes,period_month,created_at,updated_at,rev,current_spent,category:categories(id,name)'
    )
    .eq('user_id', userId)
    .eq('period_month', periodDate);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    user_id: String(row.user_id),
    category_id: row.category_id ? String(row.category_id) : null,
    amount_planned: parseNumeric(row.amount_planned),
    carryover_enabled: Boolean(row.carryover_enabled),
    notes: row.notes ?? null,
    period_month: String(row.period_month),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    rev: row.rev === undefined ? null : Number(row.rev ?? 0),
    current_spent: row.current_spent === undefined ? null : parseNumeric(row.current_spent),
    category: row.category
      ? { id: String(row.category.id), name: row.category.name ?? null }
      : null,
  }));
}

export async function computeSpentByCategory(
  userId: string,
  period: string
): Promise<SpentByCategory> {
  const periodDate = ensurePeriodDate(period);
  const nextMonth = getNextMonthDate(periodDate);

  const { data, error } = await supabase
    .from('transactions')
    .select('category_id, amount, date')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('type', 'expense')
    .gte('date', periodDate)
    .lt('date', nextMonth);

  if (error) throw error;

  const totals: SpentByCategory = {};
  (data ?? []).forEach((row) => {
    const categoryId = row.category_id ? String(row.category_id) : null;
    if (!categoryId) return;
    const amount = parseNumeric(row.amount);
    totals[categoryId] = (totals[categoryId] ?? 0) + amount;
  });
  return totals;
}

export async function upsertBudget(input: UpsertBudgetInput): Promise<void> {
  const payload: Record<string, unknown> = {
    category_id: input.categoryId,
    amount_planned: input.amountPlanned,
    carryover_enabled: input.carryoverEnabled,
    notes: input.notes ?? null,
    period_month: ensurePeriodDate(input.period),
  };

  if (input.id) {
    payload.id = input.id;
  }

  try {
    const { error } = await supabase.rpc('bud_upsert', payload);
    if (error) throw error;
    return;
  } catch (rpcError) {
    try {
      const { error: wrappedError } = await supabase.rpc('bud_upsert', { payload });
      if (!wrappedError) {
        return;
      }
    } catch (nestedError) {
      // Ignore and continue to fallback upsert below.
    }

    const upsertPayload: Record<string, unknown> = {
      user_id: input.userId,
      category_id: input.categoryId,
      amount_planned: input.amountPlanned,
      carryover_enabled: input.carryoverEnabled,
      notes: input.notes ?? null,
      period_month: ensurePeriodDate(input.period),
    };
    if (input.id) {
      upsertPayload.id = input.id;
    }

    const { error } = await supabase
      .from('budgets')
      .upsert(upsertPayload, { onConflict: 'user_id,category_id,period_month' });

    if (error) throw error;
    return;
  }
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase.from('budgets').delete().eq('id', id);
  if (error) throw error;
}
