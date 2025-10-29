import type { PostgrestFilterBuilder } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type CalendarFilterMode = 'expense' | 'all';

export type CalendarFilters = {
  mode: CalendarFilterMode;
  categoryIds: string[];
  accountIds: string[];
  minAmount?: number | null;
  maxAmount?: number | null;
  search?: string;
};

export type CalendarMonthRow = {
  id: string;
  transaction_date: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  category_id: string | null;
  account_id: string | null;
  note: string | null;
  merchant_id: string | null;
};

export type CalendarDayTransaction = {
  id: string;
  transaction_date: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  category_id: string | null;
  account_id: string | null;
  note: string | null;
  merchant_id: string | null;
  receipt_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type MerchantRecord = {
  id: string;
  name: string;
};

function applyBaseFilters<T extends Record<string, any>>(
  query: PostgrestFilterBuilder<T>,
  filters: CalendarFilters,
): PostgrestFilterBuilder<T> {
  const { mode, categoryIds, accountIds, minAmount, maxAmount } = filters;

  if (mode === 'expense') {
    query = query.eq('type', 'expense');
  } else {
    query = query.in('type', ['expense', 'income']);
  }

  if (Array.isArray(categoryIds) && categoryIds.length > 0) {
    query = query.in(
      'category_id',
      categoryIds.map((value) => String(value)),
    );
  }

  if (Array.isArray(accountIds) && accountIds.length > 0) {
    query = query.in(
      'account_id',
      accountIds.map((value) => String(value)),
    );
  }

  if (typeof minAmount === 'number' && Number.isFinite(minAmount)) {
    query = query.gte('amount', minAmount);
  }

  if (typeof maxAmount === 'number' && Number.isFinite(maxAmount)) {
    query = query.lte('amount', maxAmount);
  }

  return query;
}

function normalizeRow(row: Record<string, any>): CalendarMonthRow | null {
  const id = row?.id ?? row?.uuid ?? null;
  const transactionDate = row?.transaction_date ?? row?.date ?? null;
  const type = row?.type ?? row?.transaction_type ?? null;

  if (!id || !transactionDate || !type) {
    return null;
  }

  const normalizedType =
    type === 'income' || type === 'expense' || type === 'transfer'
      ? type
      : Number(row?.amount ?? 0) < 0
        ? 'expense'
        : 'income';

  const amountValue = Number(row?.amount ?? 0);

  return {
    id: String(id),
    transaction_date: String(transactionDate),
    type: normalizedType,
    amount: Number.isFinite(amountValue) ? amountValue : 0,
    category_id:
      row?.category_id != null ? String(row.category_id) : null,
    account_id: row?.account_id != null ? String(row.account_id) : null,
    note: typeof row?.note === 'string' ? row.note : row?.notes ?? null,
    merchant_id:
      row?.merchant_id != null ? String(row.merchant_id) : row?.merchant ?? null,
  };
}

function normalizeDayRow(row: Record<string, any>): CalendarDayTransaction | null {
  const base = normalizeRow(row);
  if (!base) {
    return null;
  }

  return {
    ...base,
    receipt_url:
      typeof row?.receipt_url === 'string'
        ? row.receipt_url
        : row?.receipt ?? null,
    created_at: row?.created_at ? String(row.created_at) : null,
    updated_at: row?.updated_at ? String(row.updated_at) : null,
  };
}

export async function fetchMonthRows(
  start: string,
  end: string,
  filters: CalendarFilters,
  signal?: AbortSignal,
): Promise<CalendarMonthRow[]> {
  let query = supabase
    .from('transactions')
    .select(
      'id,transaction_date,type,amount,category_id,account_id,note,notes,merchant_id,merchant',
    )
    .gte('transaction_date', start)
    .lte('transaction_date', end)
    .neq('type', 'transfer')
    .order('transaction_date', { ascending: true });

  query = applyBaseFilters(query, filters);

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || 'Gagal memuat ringkasan transaksi.');
  }

  return (data ?? [])
    .map((row) => normalizeRow(row))
    .filter((row): row is CalendarMonthRow => Boolean(row));
}

export async function fetchDayRows(
  date: string,
  filters: CalendarFilters,
  signal?: AbortSignal,
): Promise<CalendarDayTransaction[]> {
  let query = supabase
    .from('transactions')
    .select(
      'id,transaction_date,type,amount,category_id,account_id,note,notes,merchant_id,merchant,receipt_url,receipt,created_at,updated_at',
    )
    .eq('transaction_date', date)
    .neq('type', 'transfer')
    .order('transaction_date', { ascending: true })
    .order('created_at', { ascending: true });

  query = applyBaseFilters(query, filters);

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || 'Gagal memuat transaksi harian.');
  }

  return (data ?? [])
    .map((row) => normalizeDayRow(row))
    .filter((row): row is CalendarDayTransaction => Boolean(row));
}

export async function fetchMerchants(signal?: AbortSignal): Promise<MerchantRecord[]> {
  let query = supabase
    .from('merchants')
    .select('id,name')
    .order('name', { ascending: true });

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || 'Gagal memuat merchant.');
  }

  return (data ?? [])
    .map((row) => ({
      id: String(row?.id ?? ''),
      name: typeof row?.name === 'string' && row.name.trim() ? row.name : '',
    }))
    .filter((row) => row.id);
}

