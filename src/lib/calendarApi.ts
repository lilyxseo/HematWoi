import { addMonths, endOfMonth, formatISO, startOfDay, startOfMonth } from 'date-fns';
import { PostgrestFilterBuilder } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getCurrentUserId } from './session';

export type CalendarTransaction = {
  id: string;
  date: string;
  type: 'income' | 'expense';
  amount: number;
  title: string | null;
  notes: string | null;
  category_id: string | null;
  account_id: string | null;
  merchant_id: string | null;
  merchant_name?: string | null;
  receipt_url: string | null;
};

export type CalendarFilters = {
  includeIncome: boolean;
  categoryIds: string[];
  accountIds: string[];
  minAmount?: number | null;
  maxAmount?: number | null;
  search?: string;
};

export type MonthQueryPayload = {
  month: Date;
  filters: CalendarFilters;
};

export type DayQueryPayload = {
  date: string;
  filters: CalendarFilters;
};

type TransactionRow = {
  id: string;
  date: string;
  type: string;
  amount: number;
  title?: string | null;
  notes?: string | null;
  category_id?: string | null;
  account_id?: string | null;
  merchant_id?: string | null;
  merchant_name?: string | null;
  receipt_url?: string | null;
  merchant?: {
    id: string;
    name: string | null;
  } | null;
};

const BASE_SELECT =
  'id,date,type,amount,title,notes,category_id,account_id,merchant_id,receipt_url,merchant:merchant_id (id,name)';

function normalizeFilters(filters: CalendarFilters): CalendarFilters {
  return {
    includeIncome: Boolean(filters.includeIncome),
    categoryIds: Array.from(new Set(filters.categoryIds || [])).filter(Boolean),
    accountIds: Array.from(new Set(filters.accountIds || [])).filter(Boolean),
    minAmount:
      typeof filters.minAmount === 'number' && Number.isFinite(filters.minAmount)
        ? filters.minAmount
        : filters.minAmount == null
          ? undefined
          : Number(filters.minAmount) || undefined,
    maxAmount:
      typeof filters.maxAmount === 'number' && Number.isFinite(filters.maxAmount)
        ? filters.maxAmount
        : filters.maxAmount == null
          ? undefined
          : Number(filters.maxAmount) || undefined,
    search: filters.search?.trim() || undefined,
  } as CalendarFilters;
}

function applyFilters(
  query: PostgrestFilterBuilder<any, any, any>,
  filters: CalendarFilters,
) {
  const normalized = normalizeFilters(filters);

  const types = normalized.includeIncome ? ['expense', 'income'] : ['expense'];
  query = query.in('type', types);

  if (normalized.categoryIds.length) {
    query = query.in('category_id', normalized.categoryIds);
  }

  if (normalized.accountIds.length) {
    query = query.in('account_id', normalized.accountIds);
  }

  if (normalized.minAmount !== undefined) {
    query = query.gte('amount', normalized.minAmount);
  }

  if (normalized.maxAmount !== undefined) {
    query = query.lte('amount', normalized.maxAmount);
  }

  if (normalized.search) {
    const sanitized = normalized.search.replace(/[,%]/g, '');
    const pattern = `%${sanitized}%`;
    const clauses = [
      `title.ilike.${pattern}`,
      `notes.ilike.${pattern}`,
      `merchant_name.ilike.${pattern}`,
      `merchant.ilike.${pattern}`,
    ];
    query = query.or(clauses.join(','));
  }

  return query;
}

function mapRow(row: TransactionRow): CalendarTransaction {
  return {
    id: row.id,
    date: row.date,
    type: row.type as 'income' | 'expense',
    amount: Number(row.amount ?? 0),
    title: row.title ?? null,
    notes: row.notes ?? null,
    category_id: row.category_id ?? null,
    account_id: row.account_id ?? null,
    merchant_id: row.merchant_id ?? null,
    merchant_name:
      row.merchant_name ?? row.merchant?.name ?? null,
    receipt_url: row.receipt_url ?? null,
  };
}

export async function fetchMonthTransactions({
  month,
  filters,
}: MonthQueryPayload): Promise<CalendarTransaction[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Session berakhir, silakan login kembali.');
  }

  const from = formatISO(startOfMonth(month), { representation: 'date' });
  const to = formatISO(endOfMonth(month), { representation: 'date' });

  let query = supabase
    .from('transactions')
    .select(BASE_SELECT)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });

  query = applyFilters(query, filters);

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRow);
}

export async function fetchPreviousMonthTotals({
  month,
  filters,
}: MonthQueryPayload): Promise<{ income: number; expense: number }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Session berakhir, silakan login kembali.');
  }

  const previous = addMonths(startOfMonth(month), -1);
  const from = formatISO(previous, { representation: 'date' });
  const to = formatISO(endOfMonth(previous), { representation: 'date' });

  let query = supabase
    .from('transactions')
    .select('type,amount')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('date', from)
    .lte('date', to);

  query = applyFilters(query, filters);

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  let income = 0;
  let expense = 0;
  (data ?? []).forEach((row) => {
    const amount = Number(row.amount ?? 0);
    if (row.type === 'income') {
      income += amount;
    } else if (row.type === 'expense') {
      expense += amount;
    }
  });

  return { income, expense };
}

export async function fetchDayTransactions({
  date,
  filters,
}: DayQueryPayload): Promise<CalendarTransaction[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Session berakhir, silakan login kembali.');
  }

  const normalizedDate = formatISO(startOfDay(new Date(date)), {
    representation: 'date',
  });

  let query = supabase
    .from('transactions')
    .select(BASE_SELECT)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('date', normalizedDate)
    .order('created_at', { ascending: true });

  query = applyFilters(query, filters);

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRow);
}

export function serializeFilters(filters: CalendarFilters): string {
  const normalized = normalizeFilters(filters);
  return JSON.stringify({
    includeIncome: normalized.includeIncome,
    categoryIds: normalized.categoryIds.slice().sort(),
    accountIds: normalized.accountIds.slice().sort(),
    minAmount: normalized.minAmount ?? null,
    maxAmount: normalized.maxAmount ?? null,
    search: normalized.search ?? null,
  });
}
