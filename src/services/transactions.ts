import { supabase } from '../lib/supabase';
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

export type ListTransactionsParams = {
  startDate: string;
  endDate: string;
  type?: 'income' | 'expense' | 'transfer';
  accountId?: string;
  search?: string;
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
};

export type UpdateTransactionPayload = Partial<{
  date: string;
  type: 'income' | 'expense' | 'transfer';
  category_id: string | null;
  amount: number;
  title: string | null;
  notes: string | null;
  account_id: string | null;
  to_account_id: string | null;
  merchant_id: string | null;
}>;

const TRANSACTION_SELECT_COLUMNS =
  'id,user_id,date,type,category_id,amount,title,notes,account_id,to_account_id,merchant_id,updated_at';

function normalizeRange(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.floor(value));
}

function sanitizeSearchTerm(term: string): string {
  return term.replace(/\s+/g, ' ').trim().replace(/'/g, "''");
}

export async function listTransactions({
  startDate,
  endDate,
  type,
  accountId,
  search,
  limit = 20,
  offset = 0,
  order = 'desc',
}: ListTransactionsParams): Promise<{ rows: Tx[]; total: number }> {
  const safeLimit = normalizeRange(limit, 20);
  const safeOffset = Math.max(0, Number.isFinite(offset) ? Math.floor(offset) : 0);

  try {
    const userId = await getCurrentUserId();
    let query = supabase
      .from('transactions')
      .select(TRANSACTION_SELECT_COLUMNS, { count: 'exact' })
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (type) {
      query = query.eq('type', type);
    }

    if (accountId) {
      query = query.or(`account_id.eq.${accountId},to_account_id.eq.${accountId}`);
    }

    if (search && search.trim()) {
      const sanitized = sanitizeSearchTerm(search);
      if (sanitized) {
        query = query.or(
          `title.ilike.%${sanitized}%,notes.ilike.%${sanitized}%,merchant_id.ilike.%${sanitized}%`,
        );
      }
    }

    const isAscending = order === 'asc';
    query = query
      .order('date', { ascending: isAscending })
      .order('updated_at', { ascending: isAscending, nullsLast: !isAscending });

    query = query.range(safeOffset, safeOffset + safeLimit - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error('[transactions:list] Query failed', error);
      throw error;
    }

    return {
      rows: (data ?? []) as Tx[],
      total: count ?? 0,
    };
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
      console.error('[transactions:list] Failed to fetch transaction by id', error);
      throw error;
    }

    return (data as Tx | null) ?? null;
  } catch (error) {
    console.error('[transactions:list] Unexpected error while fetching by id', error);
    throw error;
  }
}

export async function updateTransaction(
  id: string,
  payload: UpdateTransactionPayload,
): Promise<Tx> {
  if (!id) {
    throw new Error('ID transaksi tidak valid.');
  }

  if (payload.amount !== undefined && Number(payload.amount) <= 0) {
    throw new Error('Nominal transaksi harus lebih dari 0.');
  }

  const updates: Record<string, unknown> = {};
  (['date', 'type', 'amount', 'title', 'notes', 'account_id', 'to_account_id', 'merchant_id'] as const).forEach(
    (field) => {
      if (field in payload) {
        updates[field] = payload[field];
      }
    },
  );

  if ('category_id' in payload) {
    updates.category_id = payload.category_id;
  }

  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select(TRANSACTION_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error('[transactions:update] Update failed', error);
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
    return;
  }
  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[transactions:update] Delete failed', error);
      throw error;
    }
  } catch (error) {
    console.error('[transactions:update] Unexpected error while deleting', error);
    throw error;
  }
}
