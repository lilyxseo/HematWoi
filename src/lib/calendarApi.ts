import type { PostgrestFilterBuilder } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type CalendarTypeFilter = 'expense' | 'all';

export interface CalendarFilters {
  type: CalendarTypeFilter;
  categories: string[];
  accounts: string[];
  minAmount?: number | null;
  maxAmount?: number | null;
  search?: string;
}

export interface MonthTransactionRow {
  id: string;
  date: string;
  type: string;
  amount: number;
}

export interface DayTransactionRow {
  id: string;
  date: string;
  type: string;
  amount: number;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  note: string | null;
  merchant: string | null;
  receipt_url: string | null;
  account_id: string | null;
  account_name: string | null;
  inserted_at: string | null;
}

type TransactionQuery = PostgrestFilterBuilder<any, any, any>;

type RangeOptions = {
  startDate: string;
  endDate: string;
  filters: CalendarFilters;
};

type DayOptions = {
  date: string;
  filters: CalendarFilters;
};

function normalizeList(values: string[] | undefined | null): string[] {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }
  const result: string[] = [];
  values.forEach((value) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!result.includes(trimmed)) {
      result.push(trimmed);
    }
  });
  return result;
}

function escapeLikeValue(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export function normalizeCalendarFilters(
  filters: CalendarFilters,
): CalendarFilters {
  const type: CalendarTypeFilter = filters.type === 'all' ? 'all' : 'expense';
  const categories = normalizeList(filters.categories);
  const accounts = normalizeList(filters.accounts);
  const minAmount =
    typeof filters.minAmount === 'number' && Number.isFinite(filters.minAmount)
      ? filters.minAmount
      : null;
  const maxAmount =
    typeof filters.maxAmount === 'number' && Number.isFinite(filters.maxAmount)
      ? filters.maxAmount
      : null;
  const search = filters.search?.trim() ?? '';
  return {
    type,
    categories,
    accounts,
    minAmount,
    maxAmount,
    search,
  };
}

function applyFilters(query: TransactionQuery, filters: CalendarFilters): TransactionQuery {
  const normalized = normalizeCalendarFilters(filters);
  const allowedTypes =
    normalized.type === 'expense' ? ['expense'] : ['expense', 'income'];

  let builder = query.in('type', allowedTypes);

  if (normalized.categories.length) {
    builder = builder.in('category_id', normalized.categories);
  }

  if (normalized.accounts.length) {
    builder = builder.in('account_id', normalized.accounts);
  }

  if (
    typeof normalized.minAmount === 'number' &&
    Number.isFinite(normalized.minAmount)
  ) {
    builder = builder.gte('amount', normalized.minAmount);
  }

  if (
    typeof normalized.maxAmount === 'number' &&
    Number.isFinite(normalized.maxAmount)
  ) {
    builder = builder.lte('amount', normalized.maxAmount);
  }

  const search = normalized.search;
  if (search) {
    const escaped = escapeLikeValue(search);
    const pattern = `%${escaped.replace(/\s+/g, '%')}%`;
    const orFilters = [
      `note.ilike.${pattern}`,
      `notes.ilike.${pattern}`,
      `title.ilike.${pattern}`,
      `merchant.ilike.${pattern}`,
      `merchant_name.ilike.${pattern}`,
    ];
    builder = builder.or(orFilters.join(','));
  }

  return builder;
}

export async function fetchMonthTransactions({
  startDate,
  endDate,
  filters,
}: RangeOptions): Promise<MonthTransactionRow[]> {
  const normalizedFilters = normalizeCalendarFilters(filters);
  let query = supabase
    .from('transactions')
    .select('id, date, type, amount')
    .gte('date', startDate)
    .lte('date', endDate);

  query = applyFilters(query, normalizedFilters);

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  return rows
    .map((row) => ({
      id: String(row.id ?? ''),
      date: String(row.date ?? '').slice(0, 10),
      type: String(row.type ?? ''),
      amount: Number(row.amount ?? 0),
    }))
    .filter((row) => row.id && row.date);
}

export async function fetchDayTransactions({
  date,
  filters,
}: DayOptions): Promise<DayTransactionRow[]> {
  const normalizedFilters = normalizeCalendarFilters(filters);
  let query = supabase
    .from('transactions')
    .select(
      `id, date, type, amount, category_id, note, notes, title, merchant, merchant_name, receipt_url, account_id, inserted_at,
       categories:categories(id, name, color),
       accounts:accounts(id, name)`
    )
    .eq('date', date)
    .order('inserted_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true, nullsFirst: false });

  query = applyFilters(query, normalizedFilters);

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => {
    const category =
      row.categories ?? row.category ?? row.category_ref ?? null;
    const account = row.accounts ?? row.account ?? null;
    const categoryName =
      category?.name ?? row.category_name ?? row.category ?? null;
    const categoryColor =
      category?.color ?? row.category_color ?? null;
    const accountName = account?.name ?? row.account_name ?? row.account ?? null;
    const merchantName =
      row.merchant_name ?? row.merchant ?? row.merchants?.name ?? null;
    const note =
      row.note ?? row.notes ?? row.title ?? null;

    return {
      id: String(row.id ?? ''),
      date: String(row.date ?? '').slice(0, 10),
      type: String(row.type ?? ''),
      amount: Number(row.amount ?? 0),
      category_id: row.category_id ? String(row.category_id) : category?.id ?? null,
      category_name: categoryName ? String(categoryName) : null,
      category_color: categoryColor ? String(categoryColor) : null,
      note: note ? String(note) : null,
      merchant: merchantName ? String(merchantName) : null,
      receipt_url: row.receipt_url ? String(row.receipt_url) : null,
      account_id: row.account_id ? String(row.account_id) : account?.id ?? null,
      account_name: accountName ? String(accountName) : null,
      inserted_at: row.inserted_at ? String(row.inserted_at) : row.created_at ? String(row.created_at) : null,
    };
  });
}
