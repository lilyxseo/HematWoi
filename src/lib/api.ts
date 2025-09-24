import { supabase } from './supabase';

export * from './api.legacy.js';

export interface BudgetMonthRecord {
  id: string;
  category_id: string | null;
  period_month: string;
  amount_planned: number;
  current_spent: number;
  rollover_in: number;
  rollover_out: number;
  carry_rule: string | null;
  note: string | null;
  name: string | null;
}

function normalizeMonthISO(value: string): string {
  if (!value) {
    throw new Error('Periode bulan wajib diisi');
  }

  if (/^\d{4}-\d{2}$/.test(value)) {
    const [yearStr, monthStr] = value.split('-');
    const year = Number.parseInt(yearStr, 10);
    const monthIndex = Number.parseInt(monthStr, 10) - 1;
    const normalized = new Date(Date.UTC(year, monthIndex, 1));
    if (Number.isNaN(normalized.getTime())) {
      throw new Error('Format periode tidak valid');
    }
    return normalized.toISOString().slice(0, 10);
  }

  const base = value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) {
    throw new Error('Format periode tidak valid');
  }
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function toNumber(value: unknown): number {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function listBudgetsByMonth(
  userId: string,
  monthISO: string
): Promise<BudgetMonthRecord[]> {
  if (!userId) {
    throw new Error('User ID wajib diisi');
  }

  const periodIso = normalizeMonthISO(monthISO);

  const { data, error } = await supabase
    .from('budgets')
    .select(
      `
        id,
        category_id,
        period_month,
        amount_planned:planned,
        rollover_in,
        rollover_out,
        carry_rule,
        note,
        name
      `
    )
    .eq('user_id', userId)
    .eq('period_month', periodIso)
    .order('category_id', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true, nullsFirst: true });

  if (error) {
    throw error;
  }

  const rows: BudgetMonthRecord[] = (data ?? []).map((row) => ({
    id: String(row.id),
    category_id: row.category_id ?? null,
    period_month: typeof row.period_month === 'string'
      ? row.period_month
      : new Date(row.period_month).toISOString().slice(0, 10),
    amount_planned: toNumber((row as any).amount_planned ?? (row as any).planned),
    current_spent: 0,
    rollover_in: toNumber(row.rollover_in),
    rollover_out: toNumber(row.rollover_out),
    carry_rule: row.carry_rule ?? null,
    note: row.note ?? null,
    name: row.name ?? null,
  }));

  if (!rows.length) {
    return rows;
  }

  const { data: activityRows, error: activityError } = await supabase
    .from('budget_activity')
    .select('category_id, period_month, actual')
    .eq('period_month', periodIso);

  if (activityError) {
    throw activityError;
  }

  const spentByCategory = new Map<string, number>();
  (activityRows ?? []).forEach((activity) => {
    const key = activity.category_id ?? 'null';
    spentByCategory.set(key, toNumber(activity.actual));
  });

  rows.forEach((row) => {
    const key = row.category_id ?? 'null';
    if (spentByCategory.has(key)) {
      row.current_spent = spentByCategory.get(key) ?? 0;
    } else {
      row.current_spent = 0;
    }
  });

  return rows;
}
