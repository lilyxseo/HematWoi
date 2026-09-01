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

const TRANSACTION_SELECT_COLUMNS =
  'id,user_id,date,type,category_id,amount,title,notes,account_id,to_account_id,merchant_id,updated_at';

export type ListTransactionsParams = {
  from?: string;
  to?: string;
  type?: 'income' | 'expense' | 'transfer';
  accountId?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

function sanitizeLimit(input?: number): number {
  if (typeof input !== 'number' || !Number.isFinite(input) || input <= 0) {
    return 20;
  }
  return Math.min(Math.floor(input), 100);
}

function sanitizeOffset(input?: number): number {
  if (typeof input !== 'number' || !Number.isFinite(input) || input <= 0) {
    return 0;
  }
  return Math.floor(input);
}

function escapeSearchTerm(term: string): string {
  return term
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[%_]/g, (match) => `\\${match}`);
}

export async function listTransactions(
  params: ListTransactionsParams = {},
): Promise<{ rows: Tx[]; total: number }>
{
  try {
    const userId = await getCurrentUserId();
    const limit = sanitizeLimit(params.limit);
    const offset = sanitizeOffset(params.offset);

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

    if (params.type && params.type !== 'transfer' && params.type !== 'income' && params.type !== 'expense') {
      // ignore invalid values
    } else if (params.type) {
      query = query.eq('type', params.type);
    }

    if (params.accountId) {
      const trimmedAccountId = params.accountId.trim();
      if (trimmedAccountId) {
        query = query.or(
          `account_id.eq.${trimmedAccountId},to_account_id.eq.${trimmedAccountId}`,
        );
      }
    }

    if (params.search) {
      const trimmedSearch = params.search.trim();
      if (trimmedSearch) {
        const escaped = escapeSearchTerm(trimmedSearch);
        const pattern = `%${escaped}%`;
        query = query.or(
          `title.ilike."${pattern}",notes.ilike."${pattern}",merchant.ilike."${pattern}",merchant_name.ilike."${pattern}"`,
        );
      }
    }

    query = query
      .order('date', { ascending: false })
      .order('updated_at', { ascending: false, nullsLast: true })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error('[transactions:list] Query failed', error);
      throw error;
    }

    return {
      rows: (data ?? []) as Tx[],
      total: typeof count === 'number' && Number.isFinite(count) ? count : 0,
    };
  } catch (error) {
    console.error('[transactions:list] Unexpected error', error);
    throw error;
  }
}

export async function getTransactionById(id: string): Promise<Tx | null> {
  const trimmed = id?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('transactions')
      .select(TRANSACTION_SELECT_COLUMNS)
      .eq('user_id', userId)
      .eq('id', trimmed)
      .maybeSingle();

    if (error) {
      console.error('[transactions:get] Query failed', error);
      throw error;
    }

    return (data ?? null) as Tx | null;
  } catch (error) {
    console.error('[transactions:get] Unexpected error', error);
    throw error;
  }
}

export type UpdateTransactionInput = Partial<
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

export async function updateTransaction(
  id: string,
  payload: UpdateTransactionInput,
): Promise<Tx> {
  const trimmed = id?.trim();
  if (!trimmed) {
    throw new Error('ID transaksi tidak valid.');
  }

  const updates: Record<string, unknown> = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    updates[key] = value;
  });

  if (Object.keys(updates).length === 0) {
    throw new Error('Tidak ada perubahan untuk disimpan.');
  }

  try {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', trimmed)
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
  const trimmed = id?.trim();
  if (!trimmed) {
    throw new Error('ID transaksi tidak valid.');
  }

  try {
    const { error } = await supabase.from('transactions').delete().eq('id', trimmed);
    if (error) {
      console.error('[transactions:delete] Delete failed', error);
      throw error;
    }
  } catch (error) {
    console.error('[transactions:delete] Unexpected error', error);
    throw error;
  }
}
