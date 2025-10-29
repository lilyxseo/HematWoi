import type { PostgrestError, PostgrestFilterBuilder } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getCurrentUserId } from './session';

export type CalendarFilter = {
  type: 'expense' | 'all';
  categoryIds: string[];
  accountIds: string[];
  amountMin: number | null;
  amountMax: number | null;
  search: string;
};

export function normalizeCalendarFilter(filters: CalendarFilter): CalendarFilter {
  return {
    type: filters.type === 'expense' ? 'expense' : 'all',
    categoryIds: Array.isArray(filters.categoryIds) ? [...new Set(filters.categoryIds)].sort() : [],
    accountIds: Array.isArray(filters.accountIds) ? [...new Set(filters.accountIds)].sort() : [],
    amountMin:
      typeof filters.amountMin === 'number' && Number.isFinite(filters.amountMin)
        ? filters.amountMin
        : null,
    amountMax:
      typeof filters.amountMax === 'number' && Number.isFinite(filters.amountMax)
        ? filters.amountMax
        : null,
    search: typeof filters.search === 'string' ? filters.search : '',
  } satisfies CalendarFilter;
}

export function serializeCalendarFilter(filters: CalendarFilter): string {
  return JSON.stringify(filters);
}

export type MonthAggregateRow = {
  id: string;
  type: string;
  amount: number;
  date: string | null;
  transaction_date: string | null;
  created_at?: string | null;
};

export type DayTransactionRow = MonthAggregateRow & {
  category_id: string | null;
  account_id: string | null;
  notes?: string | null;
  note?: string | null;
  title?: string | null;
  merchant_id?: string | null;
  merchant?: { id: string; name: string | null } | null;
  receipt_url?: string | null;
  to_account_id?: string | null;
};

export type MonthAggregateResponse = MonthAggregateRow[];
export type DayTransactionsResponse = DayTransactionRow[];

export type FetchMonthAggregatesParams = {
  startDate: string;
  endDate: string;
  filters: CalendarFilter;
};

export type FetchDayTransactionsParams = {
  date: string;
  filters: CalendarFilter;
};

type AnyQuery = PostgrestFilterBuilder<Record<string, unknown>, unknown, unknown>;

function isUndefinedColumn(error: unknown): boolean {
  if (!error) return false;
  const casted = error as Partial<PostgrestError>;
  return casted?.code === '42703' || /column .* does not exist/i.test(casted?.message ?? '');
}

function applyFilters(query: AnyQuery, filters: CalendarFilter): AnyQuery {
  const { type, categoryIds, accountIds, amountMin, amountMax, search } = filters;

  let next = query.is('deleted_at', null);

  if (type === 'expense') {
    next = next.eq('type', 'expense');
  } else {
    next = next.in('type', ['expense', 'income']);
  }

  if (Array.isArray(categoryIds) && categoryIds.length > 0) {
    next = next.in('category_id', categoryIds);
  }

  if (Array.isArray(accountIds) && accountIds.length > 0) {
    next = next.in('account_id', accountIds);
  }

  if (typeof amountMin === 'number' && Number.isFinite(amountMin)) {
    next = next.gte('amount', amountMin);
  }

  if (typeof amountMax === 'number' && Number.isFinite(amountMax)) {
    next = next.lte('amount', amountMax);
  }

  const normalizedSearch = search.trim();
  if (normalizedSearch) {
    const likePattern = `%${normalizedSearch.replace(/[%_]/g, '').replace(/\s+/g, '%')}%`;
    next = next.or(
      [
        `notes.ilike.${likePattern}`,
        `title.ilike.${likePattern}`,
        `note.ilike.${likePattern}`,
        `merchant_name.ilike.${likePattern}`,
        `merchant.ilike.${likePattern}`,
      ].join(','),
    );
  }

  return next;
}

function buildBaseQuery(columns: string[]): AnyQuery {
  return supabase.from('transactions').select(columns.join(','));
}

async function runMonthQuery(
  column: 'transaction_date' | 'date',
  params: FetchMonthAggregatesParams,
): Promise<MonthAggregateResponse> {
  const userId = await getCurrentUserId();
  let query = buildBaseQuery(['id', 'type', 'amount', 'transaction_date', 'date', 'created_at']).eq(
    'user_id',
    userId,
  );

  query = applyFilters(query, params.filters);
  query = query
    .gte(column, params.startDate)
    .lte(column, params.endDate)
    .order(column, { ascending: true, nullsLast: false })
    .order('created_at', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MonthAggregateResponse;
}

async function runDayQuery(
  column: 'transaction_date' | 'date',
  params: FetchDayTransactionsParams,
): Promise<DayTransactionsResponse> {
  const userId = await getCurrentUserId();
  let query = buildBaseQuery([
    'id',
    'type',
    'amount',
    'transaction_date',
    'date',
    'created_at',
    'category_id',
    'account_id',
    'notes',
    'note',
    'title',
    'merchant_id',
    'receipt_url',
    'to_account_id',
    'merchant:merchant_id (id, name)',
  ]).eq('user_id', userId);

  query = applyFilters(query, params.filters);
  query = query
    .gte(column, params.date)
    .lt(column, addOneDay(params.date))
    .order('created_at', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DayTransactionsResponse;
}

function addOneDay(dateISO: string): string {
  const date = new Date(dateISO);
  if (Number.isNaN(date.getTime())) {
    return dateISO;
  }
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

export async function fetchMonthAggregates(
  params: FetchMonthAggregatesParams,
): Promise<MonthAggregateResponse> {
  try {
    return await runMonthQuery('transaction_date', params);
  } catch (error) {
    if (isUndefinedColumn(error)) {
      return runMonthQuery('date', params);
    }
    throw error;
  }
}

export async function fetchDayTransactions(
  params: FetchDayTransactionsParams,
): Promise<DayTransactionsResponse> {
  try {
    return await runDayQuery('transaction_date', params);
  } catch (error) {
    if (isUndefinedColumn(error)) {
      return runDayQuery('date', params);
    }
    throw error;
  }
}
