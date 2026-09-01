import { supabase } from '../lib/supabase';
import type { Category } from './categories';
import { getCurrentUserId } from './categories';

type TransactionType = 'income' | 'expense' | 'transfer';

export type Tx = {
  id: string;
  user_id: string;
  date: string;
  type: TransactionType;
  category_id: string | null;
  amount: number;
  title: string | null;
  notes: string | null;
  account_id: string | null;
  to_account_id: string | null;
  merchant_id: string | null;
  updated_at: string | null;
};

export type ListTransactionsParams = {
  from?: string;
  to?: string;
  type?: TransactionType | 'all';
  accountId?: string;
  search?: string;
  limit?: number;
  offset?: number;
  includeCategoryDetails?: boolean;
};

export type ListTransactionsResult = {
  rows: Tx[];
  total: number;
  categoryMap: Record<string, Category>;
};

const TRANSACTION_SELECT_COLUMNS =
  'id,user_id,date,type,category_id,amount,title,notes,account_id,to_account_id,merchant_id,updated_at';

function sanitizeSearchTerm(term: string): string {
  return term.replace(/[\0\n\r\t%_]/g, '').trim();
}

function mapCategoriesById(categories: Category[]): Record<string, Category> {
  return categories.reduce<Record<string, Category>>((acc, category) => {
    acc[category.id] = category;
    return acc;
  }, {});
}

export async function listTransactions({
  from,
  to,
  type,
  accountId,
  search,
  limit = 20,
  offset = 0,
  includeCategoryDetails = false,
}: ListTransactionsParams): Promise<ListTransactionsResult> {
  try {
    const userId = await getCurrentUserId();
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const safeOffset = Math.max(0, offset);
    const rangeStart = safeOffset;
    const rangeEnd = rangeStart + safeLimit - 1;

    let query = supabase
      .from('transactions')
      .select(TRANSACTION_SELECT_COLUMNS, { count: 'exact' })
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('updated_at', { ascending: false, nullsLast: true });

    if (from) {
      query = query.gte('date', from);
    }

    if (to) {
      query = query.lte('date', to);
    }

    if (type && type !== 'all') {
      query = query.eq('type', type);
    }

    if (accountId) {
      query = query.or(`account_id.eq.${accountId},to_account_id.eq.${accountId}`);
    }

    if (search && search.trim()) {
      const normalized = sanitizeSearchTerm(search);
      if (normalized) {
        const pattern = `%${normalized}%`;
        query = query.or(`title.ilike.${pattern},notes.ilike.${pattern},merchant_id.ilike.${pattern}`);
      }
    }

    const { data, error, count } = await query.range(rangeStart, rangeEnd);

    if (error) {
      console.error('[transactions:list] Query failed', error);
      throw error;
    }

    const rows = (data ?? []) as Tx[];
    const total = typeof count === 'number' ? count : rows.length;

    if (!includeCategoryDetails) {
      return { rows, total, categoryMap: {} };
    }

    const categoryIds = Array.from(
      new Set(rows.map((row) => row.category_id).filter((id): id is string => Boolean(id))),
    );

    if (!categoryIds.length) {
      return { rows, total, categoryMap: {} };
    }

    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('id,user_id,type,name,group_name,order_index,inserted_at')
      .eq('user_id', userId)
      .in('id', categoryIds);

    if (categoriesError) {
      console.error('[transactions:list] Failed to load categories', categoriesError);
      throw categoriesError;
    }

    const categories = (categoriesData ?? []) as Category[];
    return { rows, total, categoryMap: mapCategoriesById(categories) };
  } catch (error) {
    console.error('[transactions:list] Unexpected error', error);
    throw error;
  }
}

export async function getTransactionById(id: string): Promise<Tx | null> {
  if (!id) {
    return null;
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
      console.error('[transactions:detail] Query failed', error);
      throw error;
    }

    return (data as Tx) ?? null;
  } catch (error) {
    console.error('[transactions:detail] Unexpected error', error);
    throw error;
  }
}

export type UpdateTransactionPayload = Partial<
  Pick<
    Tx,
    | 'date'
    | 'type'
    | 'category_id'
    | 'amount'
    | 'title'
    | 'notes'
    | 'account_id'
    | 'to_account_id'
    | 'merchant_id'
  >
>;

export async function updateTransaction(id: string, payload: UpdateTransactionPayload): Promise<Tx> {
  if (!id) {
    throw new Error('ID transaksi tidak valid.');
  }

  const updates: Record<string, unknown> = {};

  if (payload.date !== undefined) {
    updates.date = payload.date;
  }
  if (payload.type !== undefined) {
    updates.type = payload.type;
  }
  if (payload.category_id !== undefined) {
    updates.category_id = payload.category_id;
  }
  if (payload.amount !== undefined) {
    updates.amount = payload.amount;
  }
  if (payload.title !== undefined) {
    updates.title = payload.title;
  }
  if (payload.notes !== undefined) {
    updates.notes = payload.notes;
  }
  if (payload.account_id !== undefined) {
    updates.account_id = payload.account_id;
  }
  if (payload.to_account_id !== undefined) {
    updates.to_account_id = payload.to_account_id;
  }
  if (payload.merchant_id !== undefined) {
    updates.merchant_id = payload.merchant_id;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('Tidak ada perubahan yang disimpan.');
  }

  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('user_id', userId)
      .eq('id', id)
      .select(TRANSACTION_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error('[transactions:update] Query failed', error);
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
    throw new Error('ID transaksi tidak valid.');
  }

  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);

    if (error) {
      console.error('[transactions:delete] Query failed', error);
      throw error;
    }
  } catch (error) {
    console.error('[transactions:delete] Unexpected error', error);
    throw error;
  }
}
