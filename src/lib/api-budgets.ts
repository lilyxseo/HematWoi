import { supabase } from './supabase';
import { getCurrentUserId } from './session';
import { formatCurrency } from './format';

export type CarryRule = 'none' | 'carry-positive' | 'carry-all' | 'reset-zero';
export type BudgetSortKey = 'name' | 'planned' | 'actual' | 'remaining';
export type BudgetStatusFilter = 'all' | 'on-track' | 'overspend';
export type BudgetCopyStrategy = 'clone' | 'rollover-rules';

type UUID = string;

type Nullable<T> = T | null;

export interface BudgetRecord {
  id: string;
  user_id: string;
  period_month: string; // ISO date (YYYY-MM-01)
  category_id: Nullable<string>;
  name: Nullable<string>;
  planned: number;
  rollover_in: number;
  rollover_out: number;
  carry_rule: CarryRule;
  note: Nullable<string>;
  created_at: string;
  updated_at: string;
  activity?: BudgetActivity;
}

export interface BudgetActivity {
  period_month: string;
  category_id: Nullable<string>;
  actual: number;
  inflow: number;
  outflow: number;
}

export interface BudgetInput {
  id?: string;
  period: string; // YYYY-MM
  category_id?: string | null;
  name?: string | null;
  planned: number;
  carry_rule: CarryRule;
  note?: string | null;
  rollover_in?: number;
  rollover_out?: number;
}

export interface BudgetFilter {
  period: string;
  q?: string;
  categoryId?: string | null;
  withActivity?: boolean;
}

export interface BudgetSummary {
  planned: number;
  actual: number;
  remaining: number;
  overspend: number;
  coverageDays: number | null;
}

export interface BudgetRuleRecord {
  id: string;
  user_id: string;
  category_id: Nullable<string>;
  rule_type: 'percent-income' | 'fixed' | 'smart';
  value: number;
  active: boolean;
  note: Nullable<string>;
  created_at: string;
  updated_at: string;
}

export interface BudgetChangeRecord {
  id: string;
  user_id: string;
  budget_id: string;
  delta: number;
  reason: Nullable<string>;
  created_at: string;
}

export interface CopyBudgetsPayload {
  fromPeriod: string;
  toPeriod: string;
  strategy: BudgetCopyStrategy;
  includeRolloverIn?: boolean;
}

export interface ApplyRolloverResult {
  updated: BudgetRecord[];
}

interface ListBudgetsOptions extends BudgetFilter {
  sort?: BudgetSortKey;
}

interface PeriodOptions {
  months?: number;
  anchor?: string; // YYYY-MM
}

function logDev(error: unknown, scope: string) {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.error(`[HW][budgets-api] ${scope}`, error);
  }
}

function toISODate(period: string): string {
  if (!period) {
    throw new Error('Periode tidak valid');
  }
  if (period.length === 10 && period.includes('-')) return period;
  return `${period}-01`;
}

function parseNumber(value: unknown): number {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function ensureAuth(userId: string | null | undefined) {
  if (!userId) {
    throw new Error('Anda harus login untuk mengakses anggaran');
  }
}

function isRelationMissing(error: any, relation: string): boolean {
  if (!error) return false;
  const message = typeof error === 'string' ? error : (error as any)?.message ?? '';
  if (typeof message !== 'string') return false;
  const normalized = message.toLowerCase();
  return normalized.includes('does not exist') && normalized.includes(relation.toLowerCase());
}

function mapBudgetRow(row: Record<string, any>): BudgetRecord {
  const period = row.period_month ?? row.month ?? row.period ?? null;
  const resolvedPeriod = period ? toISODate(String(period).slice(0, 7)) : new Date().toISOString().slice(0, 10);
  const nameFromRelation = row.category?.name ?? row.categories?.name ?? row.category_name ?? null;
  const planned = parseNumber(row.planned);
  const rolloverIn = parseNumber(row.rollover_in);
  const rolloverOut = parseNumber(row.rollover_out);
  const note = row.note ?? null;
  const carryRule: CarryRule = (row.carry_rule as CarryRule) ?? 'carry-positive';
  const baseActivity = row.activity
    ? {
        period_month: row.activity.period_month ?? resolvedPeriod,
        category_id: row.activity.category_id ?? row.category_id ?? null,
        actual: parseNumber(row.activity.actual),
        inflow: parseNumber(row.activity.inflow),
        outflow: parseNumber(row.activity.outflow),
      }
    : undefined;
  const fallbackActual = parseNumber(row.actual ?? row.current_spent ?? row.spent ?? baseActivity?.actual ?? 0);
  const activity = baseActivity ?? {
    period_month: resolvedPeriod,
    category_id: row.category_id ?? null,
    actual: fallbackActual,
    inflow: parseNumber(row.inflow ?? 0),
    outflow: parseNumber(row.outflow ?? fallbackActual),
  };

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    period_month: resolvedPeriod,
    category_id: row.category_id ?? null,
    name: row.name ?? nameFromRelation ?? null,
    planned,
    rollover_in: rolloverIn,
    rollover_out: rolloverOut,
    carry_rule: carryRule,
    note,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
    activity,
  };
}

async function fetchBudgetActivity(periodIso: string): Promise<Map<string | null, BudgetActivity>> {
  const map = new Map<string | null, BudgetActivity>();
  const { data, error } = await supabase
    .from('budget_activity')
    .select('period_month, category_id, actual, inflow, outflow')
    .eq('period_month', periodIso);

  if (error) {
    if (isRelationMissing(error, 'budget_activity')) {
      return map;
    }
    throw error;
  }

  for (const row of data ?? []) {
    const categoryId = (row as Record<string, any>).category_id ?? null;
    map.set(categoryId, {
      period_month: toISODate(String((row as Record<string, any>).period_month).slice(0, 7)),
      category_id: categoryId,
      actual: parseNumber((row as Record<string, any>).actual),
      inflow: parseNumber((row as Record<string, any>).inflow),
      outflow: parseNumber((row as Record<string, any>).outflow),
    });
  }

  return map;
}

function mapRuleRow(row: Record<string, any>): BudgetRuleRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    category_id: row.category_id ?? null,
    rule_type: row.rule_type,
    value: parseNumber(row.value),
    active: Boolean(row.active ?? true),
    note: row.note ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

function sanitizeSearch(value?: string | null) {
  if (!value) return '';
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

function daysInPeriod(periodIso: string): number {
  const date = new Date(`${periodIso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return 30;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export async function getPeriods(options: PeriodOptions = {}): Promise<string[]> {
  const { months = 13, anchor } = options;
  const now = anchor ? new Date(`${anchor}-01T00:00:00Z`) : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error('Anchor periode tidak valid');
  }
  const periods: string[] = [];
  for (let i = 0; i < months; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    periods.push(month);
  }
  return periods;
}

export async function listBudgets(options: ListBudgetsOptions): Promise<BudgetRecord[]> {
  const { period, q, categoryId, withActivity = true, sort } = options;
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);
    const periodIso = toISODate(period);

    let query = supabase
      .from('budgets')
      .select(
        'id, user_id, period_month, category_id, name, planned, rollover_in, rollover_out, carry_rule, note, created_at, updated_at, category:categories(id, name)'
      )
      .eq('user_id', userId)
      .eq('period_month', periodIso);

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }
    if (q) {
      query = query.or(
        [
          `name.ilike.%${sanitizeSearch(q)}%`,
          `note.ilike.%${sanitizeSearch(q)}%`,
        ].join(',')
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    let activityMap: Map<string | null, BudgetActivity> | null = null;
    if (withActivity) {
      try {
        activityMap = await fetchBudgetActivity(periodIso);
      } catch (activityError) {
        logDev(activityError, 'fetchBudgetActivity');
      }
    }

    const mapped = (data ?? []).map((row) => {
      const activity = activityMap?.get((row as Record<string, any>).category_id ?? null);
      const hydrated = activity ? { ...(row as Record<string, any>), activity } : row;
      return mapBudgetRow(hydrated as Record<string, any>);
    });

    if (sort) {
      mapped.sort((a, b) => {
        switch (sort) {
          case 'planned':
            return b.planned - a.planned;
          case 'actual':
            return (b.activity?.actual ?? 0) - (a.activity?.actual ?? 0);
          case 'remaining': {
            const remainA = a.planned + a.rollover_in - (a.activity?.actual ?? 0);
            const remainB = b.planned + b.rollover_in - (b.activity?.actual ?? 0);
            return remainB - remainA;
          }
          case 'name':
          default: {
            const nameA = (a.name ?? '').toLowerCase();
            const nameB = (b.name ?? '').toLowerCase();
            return nameA.localeCompare(nameB);
          }
        }
      });
    }

    return mapped;
  } catch (error) {
    logDev(error, 'listBudgets');
    if (error instanceof Error && error.message) {
      throw new Error(`Gagal memuat anggaran: ${error.message}`);
    }
    throw new Error('Gagal memuat anggaran');
  }
}

export async function upsertBudget(payload: BudgetInput): Promise<BudgetRecord> {
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);
    const periodIso = toISODate(payload.period);
    if (!payload.category_id && !payload.name) {
      throw new Error('Nama anggaran wajib diisi untuk envelope tanpa kategori');
    }
    const body: Record<string, any> = {
      id: payload.id,
      user_id: userId,
      period_month: periodIso,
      category_id: payload.category_id ?? null,
      name: payload.name ?? null,
      planned: Number(payload.planned ?? 0),
      carry_rule: payload.carry_rule,
      note: payload.note ?? null,
      rollover_in: Number(payload.rollover_in ?? 0),
      rollover_out: Number(payload.rollover_out ?? 0),
    };

    const { data, error } = await supabase
      .from('budgets')
      .upsert(body)
      .select(
        'id, user_id, period_month, category_id, name, planned, rollover_in, rollover_out, carry_rule, note, created_at, updated_at, category:categories(id, name)'
      )
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Tidak ada data yang dikembalikan');
    return mapBudgetRow(data);
  } catch (error) {
    logDev(error, 'upsertBudget');
    if (error instanceof Error && error.message) {
      throw new Error(`Gagal menyimpan anggaran: ${error.message}`);
    }
    throw new Error('Gagal menyimpan anggaran');
  }
}

export async function bulkUpsertBudgets(payloads: BudgetInput[]): Promise<BudgetRecord[]> {
  if (!payloads.length) return [];
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);
    const rows = payloads.map((p) => {
      if (!p.category_id && !p.name) {
        throw new Error('Nama anggaran wajib diisi untuk envelope tanpa kategori');
      }
      const row: Record<string, any> = {
        id: p.id,
        user_id: userId,
        period_month: toISODate(p.period),
        category_id: p.category_id ?? null,
        name: p.name ?? null,
        planned: Number(p.planned ?? 0),
        carry_rule: p.carry_rule,
        note: p.note ?? null,
        rollover_in: Number(p.rollover_in ?? 0),
        rollover_out: Number(p.rollover_out ?? 0),
      };
      return row;
    });
    const { data, error } = await supabase
      .from('budgets')
      .upsert(rows)
      .select(
        'id, user_id, period_month, category_id, name, planned, rollover_in, rollover_out, carry_rule, note, created_at, updated_at, category:categories(id, name)'
      );
    if (error) throw error;
    return (data ?? []).map(mapBudgetRow);
  } catch (error) {
    logDev(error, 'bulkUpsertBudgets');
    if (error instanceof Error && error.message) {
      throw new Error(`Gagal menyimpan anggaran: ${error.message}`);
    }
    throw new Error('Gagal menyimpan anggaran');
  }
}

export async function deleteBudget(id: UUID): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    logDev(error, 'deleteBudget');
    if (error instanceof Error && error.message) {
      throw new Error(`Gagal menghapus anggaran: ${error.message}`);
    }
    throw new Error('Gagal menghapus anggaran');
  }
}

export async function copyBudgets(payload: CopyBudgetsPayload): Promise<BudgetRecord[]> {
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);
    const fromIso = toISODate(payload.fromPeriod);
    const toIso = toISODate(payload.toPeriod);

    const { data: rows, error } = await supabase
      .from('budgets')
      .select(
        'id, user_id, period_month, category_id, name, planned, rollover_in, rollover_out, carry_rule, note, category:categories(id, name)'
      )
      .eq('user_id', userId)
      .eq('period_month', fromIso);
    if (error) throw error;

    if (!rows?.length) return [];

    const cloned = rows.map((row) => ({
      user_id: userId,
      period_month: toIso,
      category_id: row.category_id ?? null,
      name: row.name ?? null,
      planned: parseNumber(row.planned ?? 0),
      carry_rule: (row.carry_rule as CarryRule) ?? 'carry-positive',
      note: row.note ?? null,
      rollover_in: parseNumber(row.rollover_in ?? 0),
      rollover_out: parseNumber(row.rollover_out ?? 0),
    }));

    const { data: inserted, error: upsertError } = await supabase
      .from('budgets')
      .upsert(cloned)
      .select(
        'id, user_id, period_month, category_id, name, planned, rollover_in, rollover_out, carry_rule, note, created_at, updated_at, category:categories(id, name)'
      );
    if (upsertError) throw upsertError;
    return (inserted ?? []).map(mapBudgetRow);
  } catch (error) {
    logDev(error, 'copyBudgets');
    if (error instanceof Error && error.message) {
      throw new Error(`Gagal menyalin anggaran: ${error.message}`);
    }
    throw new Error('Gagal menyalin anggaran');
  }
}

export async function computeRollover(options: { period: string }): Promise<BudgetRecord[]> {
  void options;
  throw new Error('Fitur rollover belum tersedia pada skema anggaran saat ini.');
}

export async function applyRolloverToNext(options: { period: string }): Promise<ApplyRolloverResult> {
  void options;
  throw new Error('Fitur rollover belum tersedia pada skema anggaran saat ini.');
}

export async function listRules(): Promise<BudgetRuleRecord[]> {
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);
    const { data, error } = await supabase
      .from('budget_rules')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      if (isRelationMissing(error, 'budget_rules')) return [];
      throw error;
    }
    return (data ?? []).map(mapRuleRow);
  } catch (error) {
    logDev(error, 'listRules');
    if (error instanceof Error && error.message) {
      throw new Error(`Gagal memuat aturan: ${error.message}`);
    }
    throw new Error('Gagal memuat aturan');
  }
}

export async function upsertRule(rule: Partial<BudgetRuleRecord>): Promise<BudgetRuleRecord> {
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);
    const payload = {
      id: rule.id ?? undefined,
      user_id: userId,
      category_id: rule.category_id ?? null,
      rule_type: rule.rule_type ?? 'fixed',
      value: Number(rule.value ?? 0),
      active: rule.active ?? true,
      note: rule.note ?? null,
    };
    const { data, error } = await supabase
      .from('budget_rules')
      .upsert(payload)
      .select('*')
      .maybeSingle();
    if (error) {
      if (isRelationMissing(error, 'budget_rules')) {
        throw new Error('Fitur aturan anggaran belum tersedia pada skema ini.');
      }
      throw error;
    }
    if (!data) throw new Error('Aturan tidak tersedia');
    return mapRuleRow(data);
  } catch (error) {
    logDev(error, 'upsertRule');
    if (error instanceof Error && error.message) {
      throw new Error(`Gagal menyimpan aturan: ${error.message}`);
    }
    throw new Error('Gagal menyimpan aturan');
  }
}

export async function deleteRule(id: UUID): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);
    const { error } = await supabase
      .from('budget_rules')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);
    if (error) {
      if (isRelationMissing(error, 'budget_rules')) {
        throw new Error('Fitur aturan anggaran belum tersedia pada skema ini.');
      }
      throw error;
    }
  } catch (error) {
    logDev(error, 'deleteRule');
    if (error instanceof Error && error.message) {
      throw new Error(`Gagal menghapus aturan: ${error.message}`);
    }
    throw new Error('Gagal menghapus aturan');
  }
}

export async function getSummary(options: { period: string }): Promise<BudgetSummary> {
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);
    const periodIso = toISODate(options.period);
    const { data: budgetsData, error } = await supabase
      .from('budgets')
      .select('category_id, planned, rollover_in, rollover_out')
      .eq('user_id', userId)
      .eq('period_month', periodIso);
    if (error) throw error;

    let activityMap: Map<string | null, BudgetActivity> | null = null;
    try {
      activityMap = await fetchBudgetActivity(periodIso);
    } catch (activityError) {
      logDev(activityError, 'fetchBudgetActivity');
    }

    const totalPlanned = (budgetsData ?? []).reduce((sum, row) => sum + parseNumber(row.planned), 0);
    const totalRolloverIn = (budgetsData ?? []).reduce(
      (sum, row) => sum + parseNumber(row.rollover_in),
      0
    );
    const totalRolloverOut = (budgetsData ?? []).reduce(
      (sum, row) => sum + parseNumber(row.rollover_out),
      0
    );
    const totalActual = (budgetsData ?? []).reduce((sum, row) => {
      const categoryId = (row as Record<string, any>).category_id ?? null;
      const activity = activityMap?.get(categoryId);
      return sum + parseNumber(activity?.actual ?? 0);
    }, 0);
    const remaining = totalPlanned + totalRolloverIn - totalRolloverOut - totalActual;
    const overspend = remaining < 0 ? Math.abs(remaining) : 0;

    let coverageDays: number | null = null;
    if (totalActual > 0) {
      const days = daysInPeriod(periodIso);
      const avg = totalActual / days;
      coverageDays = avg > 0 ? Math.max(Math.floor(remaining / avg), 0) : null;
    }

    return {
      planned: totalPlanned,
      actual: totalActual,
      remaining,
      overspend,
      coverageDays,
    };
  } catch (error) {
    logDev(error, 'getSummary');
    if (error instanceof Error && error.message) {
      throw new Error(`Gagal memuat ringkasan: ${error.message}`);
    }
    throw new Error('Gagal memuat ringkasan');
  }
}

export function formatBudgetAmount(value: number): string {
  return formatCurrency(value, 'IDR');
}
