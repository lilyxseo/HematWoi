import { supabase } from '../lib/supabase';
import { getCurrentUserId } from './categories';

type TxType = 'income' | 'expense' | 'transfer';

export type Tx = {
  id: string;
  user_id: string;
  date: string;
  type: TxType;
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
  startDate?: string;
  endDate?: string;
  type?: TxType | 'all';
  accountId?: string;
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'date-desc' | 'date-asc';
};

export type UpdateTransactionPayload = Partial<
  Omit<Tx, 'id' | 'user_id'>
> & {
  type?: TxType;
};

const TRANSACTION_SELECT_COLUMNS =
  'id,user_id,date,type,category_id,amount,title,notes,account_id,to_account_id,merchant_id,updated_at';

function sanitizeSearchTerm(term: string): string {
  return term.replace(/[\u0000-\u001f]/g, '').replace(/[%_]/g, (match) => `\\${match}`);
}

export async function listTransactions(
  params: ListTransactionsParams,
): Promise<{ rows: Tx[]; total: number }> {
  try {
    const userId = await getCurrentUserId();
    const limit = Number.isFinite(params.limit) && params.limit ? Math.max(1, Math.trunc(params.limit)) : 20;
    const offset = Number.isFinite(params.offset) && params.offset ? Math.max(0, Math.trunc(params.offset)) : 0;
    const orderBy = params.orderBy ?? 'date-desc';

    let query = supabase
      .from('transactions')
      .select(TRANSACTION_SELECT_COLUMNS, { count: 'exact' })
      .eq('user_id', userId);

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
      const accountFilter = `account_id.eq.${params.accountId},to_account_id.eq.${params.accountId}`;
      query = query.or(accountFilter);
    }
    if (params.search && params.search.trim()) {
      const sanitized = sanitizeSearchTerm(params.search.trim());
      const like = `%${sanitized}%`;
      query = query.or(
        `title.ilike.${like},notes.ilike.${like},merchant_id.ilike.${like}`,
      );
    }

    if (orderBy === 'date-asc') {
      query = query.order('date', { ascending: true }).order('updated_at', { ascending: true, nullsFirst: false });
    } else {
      query = query.order('date', { ascending: false }).order('updated_at', { ascending: false, nullsFirst: false });
    }

    query = query.range(offset, offset + limit - 1);

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
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[transactions:list] Failed to fetch by id', error);
      throw error;
    }

    return (data as Tx | null) ?? null;
  } catch (error) {
    console.error('[transactions:list] Unexpected error while fetching by id', error);
    throw error;
  }
}

export async function updateTransaction(id: string, payload: UpdateTransactionPayload): Promise<Tx> {
  try {
    const userId = await getCurrentUserId();
    const cleanedPayload: Record<string, unknown> = { ...payload };

    if ('amount' in cleanedPayload && typeof cleanedPayload.amount === 'number') {
      cleanedPayload.amount = Number.isFinite(cleanedPayload.amount)
        ? cleanedPayload.amount
        : null;
    }

    const { data, error } = await supabase
      .from('transactions')
      .update(cleanedPayload)
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
    console.error('[transactions:update] Unexpected error during delete', error);
    throw error;
  }
}
