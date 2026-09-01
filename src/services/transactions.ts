import { supabase } from '../lib/supabase';
import type { Category } from './categories';
import { getCurrentUserId } from './categories';

export type Tx = {
  id: string;
  user_id: string;
  date: string;
  type: 'income' | 'expense' | 'transfer';
  category_id: string | null;
  amount: number;
  title: string | null;
  notes: string | null;
  account_id: string | null;
  to_account_id: string | null;
  merchant_id: string | null;
  updated_at: string | null;
};

type ListTransactionsParams = {
  page: number;
  limit: number;
  startDate?: string | null;
  endDate?: string | null;
  type?: 'income' | 'expense' | 'transfer' | 'all';
  accountId?: string | null;
  search?: string | null;
};

type CategoryMap = Record<string, Category>;

const TRANSACTION_SELECT_COLUMNS =
  'id,user_id,date,type,category_id,amount,title,notes,account_id,to_account_id,merchant_id,updated_at';

function toRange(page: number, limit: number): { from: number; to: number } {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 20;
  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit - 1;
  return { from, to };
}

function normalizeSearchTerm(term: string | null | undefined): string | null {
  if (!term) return null;
  const trimmed = term.trim();
  if (!trimmed) return null;
  return `%${trimmed.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
}

async function fetchCategoriesForTransactions(
  userId: string,
  categoryIds: string[],
): Promise<CategoryMap> {
  if (!categoryIds.length) {
    return {};
  }

  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id,user_id,type,name,group_name,order_index,inserted_at')
      .eq('user_id', userId)
      .in('id', categoryIds);

    if (error) {
      console.error('[transactions:list] Failed to fetch categories for transactions', error);
      throw error;
    }

    const map: CategoryMap = {};
    (data ?? []).forEach((row) => {
      map[row.id as string] = row as Category;
    });
    return map;
  } catch (error) {
    console.error('[transactions:list] Unexpected error while fetching categories', error);
    return {};
  }
}

export async function listTransactions(
  params: ListTransactionsParams,
): Promise<{ rows: Tx[]; total: number; categories?: CategoryMap }> {
  try {
    const userId = await getCurrentUserId();
    const { page, limit } = params;
    const { from, to } = toRange(page, limit);

    let query = supabase
      .from('transactions')
      .select(TRANSACTION_SELECT_COLUMNS, { count: 'exact' })
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('updated_at', { ascending: false, nullsLast: true })
      .range(from, to);

    if (params.startDate) {
      query = query.gte('date', params.startDate);
    }
    if (params.endDate) {
      query = query.lte('date', params.endDate);
    }
    if (params.type && params.type !== 'all') {
      query = query.eq('type', params.type);
    }
    if (params.accountId) {
      query = query.or(
        `account_id.eq.${params.accountId},to_account_id.eq.${params.accountId}`,
      );
    }

    const searchTerm = normalizeSearchTerm(params.search);
    if (searchTerm) {
      query = query.or(
        `title.ilike.${searchTerm},notes.ilike.${searchTerm},merchant.ilike.${searchTerm}`,
      );
    }

    const { data, error, count } = await query;
    if (error) {
      console.error('[transactions:list] Failed to fetch transactions', error);
      throw error;
    }

    const rows = (data ?? []) as Tx[];
    const categoryIds = Array.from(
      new Set(rows.map((row) => row.category_id).filter((id): id is string => Boolean(id))),
    );
    const categories = await fetchCategoriesForTransactions(userId, categoryIds);

    return {
      rows,
      total: count ?? rows.length,
      categories,
    };
  } catch (error) {
    console.error('[transactions:list] Unexpected error', error);
    throw error;
  }
}

export async function getTransactionById(id: string): Promise<Tx | null> {
  if (!id) {
    throw new Error('ID transaksi wajib diisi.');
  }

  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('transactions')
      .select(TRANSACTION_SELECT_COLUMNS)
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[transactions:list] Failed to fetch transaction by id', error);
      throw error;
    }

    return (data ?? null) as Tx | null;
  } catch (error) {
    console.error('[transactions:list] Unexpected error fetching transaction', error);
    throw error;
  }
}

export async function updateTransaction(id: string, payload: Partial<Tx>): Promise<Tx> {
  if (!id) {
    throw new Error('ID transaksi wajib diisi.');
  }

  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('transactions')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .select(TRANSACTION_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error('[transactions:update] Failed to update transaction', error);
      throw error;
    }

    if (!data) {
      throw new Error('Transaksi tidak ditemukan.');
    }

    return data as Tx;
  } catch (error) {
    console.error('[transactions:update] Unexpected error', error);
    throw error;
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  if (!id) {
    throw new Error('ID transaksi wajib diisi.');
  }

  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[transactions:update] Failed to delete transaction', error);
      throw error;
    }
  } catch (error) {
    console.error('[transactions:update] Unexpected error during delete', error);
    throw error;
  }
}

