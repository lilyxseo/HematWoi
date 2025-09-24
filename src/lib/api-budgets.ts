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

export class BudgetRulesUnavailableError extends Error {
  constructor(message = 'Budget rules belum tersedia di proyek Supabase Anda') {
    super(message);
    this.name = 'BudgetRulesUnavailableError';
  }
}

let budgetRulesAvailable: boolean | null = null;

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  if (code === '42P01' || code === 'PGRST116' || code === 'PGRST114') return true;
  const message = String((error as { message?: string }).message ?? '').toLowerCase();
  const details = String((error as { details?: string }).details ?? '').toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('not exist') ||
    details.includes('does not exist') ||
    details.includes('not exist')
  );
}

function wrapBudgetError(message: string, error: unknown): Error {
  if (error instanceof Error) {
    const wrapped = new Error(`${message}: ${error.message}`);
    (wrapped as Error & { cause?: unknown }).cause = error;
    return wrapped;
  }
  return new Error(message);
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

function mapBudgetRow(row: Record<string, any>): BudgetRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    period_month: row.period_month,
    category_id: row.category_id ?? null,
    name: row.name ?? null,
    planned: parseNumber(row.planned),
    rollover_in: parseNumber(row.rollover_in),
    rollover_out: parseNumber(row.rollover_out),
    carry_rule: (row.carry_rule as CarryRule) ?? 'carry-positive',
    note: row.note ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
    activity: row.activity
      ? {
          period_month: row.activity.period_month ?? row.period_month,
          category_id: row.activity.category_id ?? row.category_id ?? null,
          actual: parseNumber(row.activity.actual),
          inflow: parseNumber(row.activity.inflow),
          outflow: parseNumber(row.activity.outflow),
        }
      : undefined,
  };
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
      .select('*')
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

    const mapped = (data ?? []).map(mapBudgetRow);

    if (withActivity && mapped.length) {
      const { data: activityRows, error: activityError } = await supabase
        .from('budget_activity')
        .select('period_month, category_id, actual, inflow, outflow')
        .eq('period_month', periodIso);
      if (activityError) throw activityError;
      const map = new Map<string, BudgetActivity>();
      (activityRows ?? []).forEach((row) => {
        const key = `${row.period_month ?? periodIso}__${row.category_id ?? 'null'}`;
        map.set(key, {
          period_month: row.period_month ?? periodIso,
          category_id: row.category_id ?? null,
          actual: parseNumber(row.actual),
          inflow: parseNumber(row.inflow),
          outflow: parseNumber(row.outflow),
        });
      });
      mapped.forEach((item) => {
        const key = `${item.period_month}__${item.category_id ?? 'null'}`;
        if (map.has(key)) {
          item.activity = map.get(key);
        } else {
          item.activity = {
            period_month: item.period_month,
            category_id: item.category_id ?? null,
            actual: 0,
            inflow: 0,
            outflow: 0,
          };
        }
      });
    }

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
    const body = {
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
      .upsert(body, { onConflict: 'user_id,period_month,category_key' })
      .select('*')
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
      return {
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
    });
    const { data, error } = await supabase
      .from('budgets')
      .upsert(rows, { onConflict: 'user_id,period_month,category_key' })
      .select('*');
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
      .select('*')
      .eq('user_id', userId)
      .eq('period_month', fromIso);
    if (error) throw error;

    if (!rows?.length) return [];

    const cloned = rows.map((row) => {
      const resolvedName = row.category_id ? row.name ?? null : row.name ?? 'Envelope';
      const base: any = {
        user_id: userId,
        period_month: toIso,
        category_id: row.category_id ?? null,
        name: resolvedName,
        planned: row.planned,
        carry_rule: row.carry_rule,
        note: row.note ?? null,
        rollover_in: payload.includeRolloverIn ? row.rollover_out ?? 0 : 0,
        rollover_out: 0,
      };
      if (payload.strategy === 'rollover-rules') {
        base.planned = row.planned;
        base.rollover_in = payload.includeRolloverIn ? row.rollover_out ?? 0 : 0;
      }
      return base;
    });

    const { data: inserted, error: upsertError } = await supabase
      .from('budgets')
      .upsert(cloned, { onConflict: 'user_id,period_month,category_key' })
      .select('*');
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
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);
    const periodIso = toISODate(options.period);

    const { data: budgetsData, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', userId)
      .eq('period_month', periodIso);
    if (error) throw error;

    const { data: activityData, error: activityError } = await supabase
      .from('budget_activity')
      .select('category_id, period_month, actual')
      .eq('period_month', periodIso);
    if (activityError) throw activityError;

    const activityMap = new Map<string, number>();
    (activityData ?? []).forEach((row) => {
      const key = `${row.period_month ?? periodIso}__${row.category_id ?? 'null'}`;
      activityMap.set(key, parseNumber(row.actual));
    });

    const rowsToUpdate = (budgetsData ?? []).map((row) => {
      const key = `${periodIso}__${row.category_id ?? 'null'}`;
      const actual = activityMap.get(key) ?? 0;
      const remaining = parseNumber(row.planned) + parseNumber(row.rollover_in) - actual;
      let rolloverOut = 0;
      switch (row.carry_rule) {
        case 'carry-all':
          rolloverOut = remaining;
          break;
        case 'carry-positive':
          rolloverOut = Math.max(remaining, 0);
          break;
        case 'reset-zero':
        case 'none':
        default:
          rolloverOut = 0;
      }
      return {
        ...row,
        rollover_out: rolloverOut,
      };
    });

    const { data: updated, error: updateError } = await supabase
      .from('budgets')
      .upsert(rowsToUpdate)
      .select('*');
    if (updateError) throw updateError;
    return (updated ?? []).map(mapBudgetRow);
  } catch (error) {
    logDev(error, 'computeRollover');
    if (error instanceof Error && error.message) {
      throw new Error(`Gagal menghitung rollover: ${error.message}`);
    }
    throw new Error('Gagal menghitung rollover');
  }
}

export async function applyRolloverToNext(options: { period: string }): Promise<ApplyRolloverResult> {
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);
    const periodIso = toISODate(options.period);
    const currentDate = new Date(`${periodIso}T00:00:00Z`);
    if (Number.isNaN(currentDate.getTime())) {
      throw new Error('Periode tidak valid');
    }
    const next = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 1));
    const nextIso = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;

    const { data: currentRows, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', userId)
      .eq('period_month', periodIso);
    if (error) throw error;

    if (!currentRows?.length) {
      return { updated: [] };
    }

    const updates: any[] = [];
    for (const row of currentRows) {
      const resolvedName = row.category_id ? row.name ?? null : row.name ?? 'Envelope';
      const nextBase = {
        user_id: userId,
        period_month: nextIso,
        category_id: row.category_id ?? null,
        name: resolvedName,
        planned: row.planned,
        carry_rule: row.carry_rule,
        note: row.note ?? null,
        rollover_in: Number(row.rollover_out ?? 0),
      };
      updates.push(nextBase);
    }

    const { data: upserted, error: upsertError } = await supabase
      .from('budgets')
      .upsert(updates, { onConflict: 'user_id,period_month,category_key' })
      .select('*');
    if (upsertError) throw upsertError;

    return { updated: (upserted ?? []).map(mapBudgetRow) };
  } catch (error) {
    logDev(error, 'applyRolloverToNext');
    if (error instanceof Error && error.message) {
      throw new Error(`Gagal menerapkan rollover: ${error.message}`);
    }
    throw new Error('Gagal menerapkan rollover');
  }
}

export async function listRules(): Promise<BudgetRuleRecord[]> {
  if (budgetRulesAvailable === false) {
    throw new BudgetRulesUnavailableError();
  }
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);
    const { data, error } = await supabase
      .from('budget_rules')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    budgetRulesAvailable = true;
    return (data ?? []).map(mapRuleRow);
  } catch (error) {
    logDev(error, 'listRules');
    if (isMissingTableError(error)) {
      budgetRulesAvailable = false;
      throw new BudgetRulesUnavailableError();
    }
    throw wrapBudgetError('Gagal memuat aturan', error);
  }
}

export async function upsertRule(rule: Partial<BudgetRuleRecord>): Promise<BudgetRuleRecord> {
  if (budgetRulesAvailable === false) {
    throw new BudgetRulesUnavailableError();
  }
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
    if (error) throw error;
    if (!data) throw new Error('Aturan tidak tersedia');
    budgetRulesAvailable = true;
    return mapRuleRow(data);
  } catch (error) {
    logDev(error, 'upsertRule');
    if (isMissingTableError(error)) {
      budgetRulesAvailable = false;
      throw new BudgetRulesUnavailableError();
    }
    throw wrapBudgetError('Gagal menyimpan aturan', error);
  }
}

export async function deleteRule(id: UUID): Promise<void> {
  if (budgetRulesAvailable === false) {
    throw new BudgetRulesUnavailableError();
  }
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);
    const { error } = await supabase
      .from('budget_rules')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    logDev(error, 'deleteRule');
    if (isMissingTableError(error)) {
      budgetRulesAvailable = false;
      throw new BudgetRulesUnavailableError();
    }
    throw wrapBudgetError('Gagal menghapus aturan', error);
  }
}

export async function getSummary(options: { period: string }): Promise<BudgetSummary> {
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);
    const periodIso = toISODate(options.period);
    const { data: budgetsData, error } = await supabase
      .from('budgets')
      .select('planned, rollover_in, rollover_out')
      .eq('user_id', userId)
      .eq('period_month', periodIso);
    if (error) throw error;

    const { data: activityData, error: activityError } = await supabase
      .from('budget_activity')
      .select('actual, category_id, period_month')
      .eq('period_month', periodIso);
    if (activityError) throw activityError;

    const totalPlanned = (budgetsData ?? []).reduce((sum, row) => sum + parseNumber(row.planned), 0);
    const totalRolloverIn = (budgetsData ?? []).reduce((sum, row) => sum + parseNumber(row.rollover_in), 0);
    const totalActual = (activityData ?? []).reduce((sum, row) => sum + parseNumber(row.actual), 0);
    const remaining = totalPlanned + totalRolloverIn - totalActual;
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
