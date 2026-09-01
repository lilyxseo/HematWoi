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
  from?: string;
  to?: string;
  type?: Tx['type'] | 'all';
  accountId?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export type UpdateTransactionPayload = {
  date: string;
  type: Tx['type'];
  category_id: string | null;
  amount: number;
  title: string | null;
  notes: string | null;
  account_id: string | null;
  to_account_id: string | null;
  merchant_id: string | null;
};

const TRANSACTION_SELECT_COLUMNS =
  'id,user_id,date,type,category_id,amount,title,notes,account_id,to_account_id,merchant_id,updated_at';

function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[%_]/g, (match) => `\\${match}`);
}

function normalizeLimit(limit?: number): number | undefined {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
    return undefined;
  }
  return Math.min(Math.floor(limit), 100);
}

function normalizeOffset(offset?: number): number {
  if (typeof offset !== 'number' || !Number.isFinite(offset) || offset < 0) {
    return 0;
  }
  return Math.floor(offset);
}

export async function listTransactions(
  params: ListTransactionsParams = {},
): Promise<{ rows: Tx[]; total: number }> {
  const limit = normalizeLimit(params.limit ?? 20);
  const offset = normalizeOffset(params.offset ?? 0);
  const userId = await getCurrentUserId();

  const execute = async (includeMerchantName: boolean) => {
    let query = supabase
      .from('transactions')
      .select(TRANSACTION_SELECT_COLUMNS, { count: 'exact' })
      .eq('user_id', userId);

    if (params.from) {
      query = query.gte('date', params.from);
    }
    if (params.to) {
      query = query.lte('date', params.to);
    }
    if (params.type && params.type !== 'all') {
      query = query.eq('type', params.type);
    }
    if (params.accountId) {
      query = query.or(
        `account_id.eq.${params.accountId},to_account_id.eq.${params.accountId}`,
      );
    }
    if (params.search && params.search.trim()) {
      const like = `%${sanitizeSearchTerm(params.search.trim())}%`;
      const filters = [
        `title.ilike.${like}`,
        `notes.ilike.${like}`,
        `merchant_id.ilike.${like}`,
      ];
      if (includeMerchantName) {
        filters.push(`merchant_name.ilike.${like}`);
      }
      query = query.or(filters.join(','));
    }

    query = query
      .order('date', { ascending: false })
      .order('updated_at', { ascending: false, nullsLast: false });

    if (typeof limit === 'number') {
      const rangeStart = offset;
      const rangeEnd = rangeStart + limit - 1;
      query = query.range(rangeStart, rangeEnd);
    }

    const { data, error, count } = await query;
    if (error) {
      throw error;
    }

    const rows = (data ?? []) as Tx[];
    return {
      rows,
      total: typeof count === 'number' ? count : rows.length,
    };
  };

  try {
    return await execute(true);
  } catch (primaryError) {
    const message =
      typeof primaryError === 'object' && primaryError && 'message' in primaryError
        ? String((primaryError as { message?: unknown }).message ?? '')
        : '';
    if (message.toLowerCase().includes('merchant_name')) {
      try {
        return await execute(false);
      } catch (fallbackError) {
        console.error('[transactions:list] Failed to list transactions', fallbackError);
        throw fallbackError;
      }
    }
    console.error('[transactions:list] Failed to list transactions', primaryError);
    throw primaryError;
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
      throw error;
    }

    return (data ?? null) as Tx | null;
  } catch (error) {
    console.error('[transactions:list] Failed to fetch transaction detail', error);
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
  if (payload.amount <= 0 || !Number.isFinite(payload.amount)) {
    throw new Error('Jumlah transaksi harus lebih dari 0.');
  }
  try {
    const userId = await getCurrentUserId();
    const updates = {
      ...payload,
      category_id:
        payload.type === 'transfer' ? null : payload.category_id ?? null,
      to_account_id:
        payload.type === 'transfer' ? payload.to_account_id ?? null : null,
    };

    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('user_id', userId)
      .eq('id', id)
      .select(TRANSACTION_SELECT_COLUMNS)
      .single();

    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error('Gagal memperbarui transaksi.');
    }

    return data as Tx;
  } catch (error) {
    console.error('[transactions:update] Failed to update transaction', error);
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
      throw error;
    }
  } catch (error) {
    console.error('[transactions:update] Failed to delete transaction', error);
    throw error;
  }
}
