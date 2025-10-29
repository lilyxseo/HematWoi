import { supabase } from './supabase';

export type CalendarFilterState = {
  mode: 'expense' | 'all';
  categories: string[];
  accounts: string[];
  minAmount: number | null;
  maxAmount: number | null;
  search: string;
};

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
  merchant_name: string | null;
  receipt_url: string | null;
};

export type FetchMonthParams = {
  startDate: string;
  endDate: string;
  filters: CalendarFilterState;
  signal?: AbortSignal;
};

export type FetchDayParams = {
  date: string;
  filters: CalendarFilterState;
  signal?: AbortSignal;
};

function sanitizeIlike(value: string): string {
  return value
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/\s+/g, ' ')
    .trim();
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }
  const user = data?.user;
  if (!user) {
    throw new Error('Session berakhir, silakan login kembali.');
  }
  return user.id;
}

function applyCommonFilters(
  query: ReturnType<typeof supabase.from<'transactions'>>,
  filters: CalendarFilterState,
) {
  const types = filters.mode === 'expense' ? ['expense'] : ['expense', 'income'];
  query = query.in('type', types);
  if (filters.categories.length) {
    query = query.in('category_id', filters.categories);
  }
  if (filters.accounts.length) {
    query = query.in('account_id', filters.accounts);
  }
  if (filters.minAmount !== null && filters.minAmount !== undefined) {
    query = query.gte('amount', filters.minAmount);
  }
  if (filters.maxAmount !== null && filters.maxAmount !== undefined) {
    query = query.lte('amount', filters.maxAmount);
  }
  if (filters.search.trim()) {
    const pattern = `%${sanitizeIlike(filters.search)}%`;
    query = query.or(
      `title.ilike.${pattern},notes.ilike.${pattern},merchant.ilike.${pattern},merchant_name.ilike.${pattern}`,
    );
  }
  return query;
}

export async function fetchMonthTransactions({
  startDate,
  endDate,
  filters,
  signal,
}: FetchMonthParams): Promise<CalendarTransaction[]> {
  const userId = await requireUserId();

  let query = supabase
    .from('transactions')
    .select(
      'id,date,type,amount,title,notes,category_id,account_id,merchant_id,merchant,merchant_name,receipt_url',
    )
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })
    .order('inserted_at', { ascending: true, nullsLast: true });

  if (signal) {
    query = query.abortSignal(signal);
  }

  query = applyCommonFilters(query, filters);

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  const rows = (data ?? []) as (CalendarTransaction & { merchant?: string | null })[];
  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    type: row.type,
    amount: Number(row.amount ?? 0),
    title: row.title ?? null,
    notes: row.notes ?? null,
    category_id: row.category_id ?? null,
    account_id: row.account_id ?? null,
    merchant_id: row.merchant_id ?? null,
    merchant_name: row.merchant_name ?? row.merchant ?? null,
    receipt_url: row.receipt_url ?? null,
  }));
}

export async function fetchDayTransactions({
  date,
  filters,
  signal,
}: FetchDayParams): Promise<CalendarTransaction[]> {
  const userId = await requireUserId();

  let query = supabase
    .from('transactions')
    .select(
      'id,date,type,amount,title,notes,category_id,account_id,merchant_id,merchant,merchant_name,receipt_url',
    )
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('date', date)
    .order('type', { ascending: true })
    .order('amount', { ascending: false })
    .order('inserted_at', { ascending: true, nullsLast: true });

  if (signal) {
    query = query.abortSignal(signal);
  }

  query = applyCommonFilters(query, filters);

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  const rows = (data ?? []) as (CalendarTransaction & { merchant?: string | null })[];
  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    type: row.type,
    amount: Number(row.amount ?? 0),
    title: row.title ?? null,
    notes: row.notes ?? null,
    category_id: row.category_id ?? null,
    account_id: row.account_id ?? null,
    merchant_id: row.merchant_id ?? null,
    merchant_name: row.merchant_name ?? row.merchant ?? null,
    receipt_url: row.receipt_url ?? null,
  }));
}
