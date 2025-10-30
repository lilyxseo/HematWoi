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
  type?: 'income' | 'expense' | 'transfer' | 'all';
  accountId?: string | null;
  search?: string;
  limit?: number;
  offset?: number;
};

export type UpdateTransactionPayload = {
  date: string;
  type: 'income' | 'expense' | 'transfer';
  category_id: string | null;
  amount: number;
  title?: string | null;
  notes?: string | null;
  account_id?: string | null;
  to_account_id?: string | null;
  merchant_id?: string | null;
};

const TRANSACTION_SELECT_COLUMNS =
  'id,user_id,date,type,category_id,amount,title,notes,account_id,to_account_id,merchant_id,updated_at';

function buildSearchFilter(keyword: string): string {
  const sanitized = keyword.replace(/[,]/g, '');
  const pattern = `%${sanitized}%`;
  return `title.ilike.${pattern},notes.ilike.${pattern},merchant_id.ilike.${pattern}`;
}

function normalizeLimit(limit?: number): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
    return 20;
  }
  return Math.min(Math.max(Math.floor(limit), 1), 100);
}

function normalizeOffset(offset?: number): number {
  if (typeof offset !== 'number' || !Number.isFinite(offset) || offset < 0) {
    return 0;
  }
  return Math.floor(offset);
}

export async function listTransactions(
  params: ListTransactionsParams,
): Promise<{ rows: Tx[]; total: number }> {
  const limit = normalizeLimit(params.limit);
  const offset = normalizeOffset(params.offset);

  try {
    const userId = await getCurrentUserId();
    let query = supabase
      .from('transactions')
      .select(TRANSACTION_SELECT_COLUMNS, { count: 'exact' })
      .eq('user_id', userId)
      .gte('date', params.startDate)
      .lte('date', params.endDate)
      .order('date', { ascending: false })
      .order('updated_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (params.type && params.type !== 'all') {
      query = query.eq('type', params.type);
    }

    if (params.accountId) {
      query = query.or(
        `account_id.eq.${params.accountId},to_account_id.eq.${params.accountId}`,
      );
    }

    if (params.search) {
      const filter = buildSearchFilter(params.search.trim());
      query = query.or(filter);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error('[transactions:list] Query failed', error);
      throw error;
    }

    return {
      rows: (data ?? []) as Tx[],
      total: typeof count === 'number' ? count : (data ?? []).length,
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
      console.error('[transactions:getById] Query failed', error);
      throw error;
    }

    return (data ?? null) as Tx | null;
  } catch (error) {
    console.error('[transactions:getById] Unexpected error', error);
    throw error;
  }
}

export async function updateTransaction(id: string, payload: UpdateTransactionPayload): Promise<Tx> {
  if (!id) {
    throw new Error('ID transaksi tidak valid.');
  }

  const amountValue = Number(payload.amount);
  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    throw new Error('Nominal transaksi harus lebih dari 0.');
  }

  try {
    const userId = await getCurrentUserId();
    const updates = {
      ...payload,
      amount: amountValue,
      updated_at: new Date().toISOString(),
    } satisfies UpdateTransactionPayload & { updated_at: string };

    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('user_id', userId)
      .eq('id', id)
      .select(TRANSACTION_SELECT_COLUMNS)
      .maybeSingle();

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
      .eq('user_id', userId)
      .eq('id', id);

    if (error) {
      console.error('[transactions:delete] Delete failed', error);
      throw error;
    }
  } catch (error) {
    console.error('[transactions:delete] Unexpected error', error);
    throw error;
  }
}
