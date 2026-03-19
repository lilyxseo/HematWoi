import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

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
  type?: 'income' | 'expense' | 'transfer';
  accountId?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export type UpdateTransactionPayload = Pick<
  Tx,
  'date' | 'type' | 'category_id' | 'amount' | 'title' | 'notes' | 'account_id' | 'to_account_id'
>;

const TRANSACTION_SELECT_COLUMNS =
  'id,user_id,date,type,category_id,amount,title,notes,account_id,to_account_id,merchant_id,updated_at';

const SESSION_READY_EVENTS = new Set([
  'SIGNED_IN',
  'INITIAL_SESSION',
  'TOKEN_REFRESHED',
]);

async function waitForSession(): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('[transactions:list] Failed to get session', sessionError);
    throw sessionError;
  }

  const userId = sessionData?.session?.user?.id;
  if (userId) {
    return userId;
  }

  return await new Promise<string>((resolve, reject) => {
    const { data, error } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && SESSION_READY_EVENTS.has(event)) {
        data?.subscription.unsubscribe();
        resolve(session.user.id);
        return;
      }

      if (event === 'SIGNED_OUT') {
        data?.subscription.unsubscribe();
        reject(new Error('Session berakhir, silakan login lagi.'));
      }
    });

    if (error) {
      data?.subscription.unsubscribe();
      reject(error);
    }
  });
}

function escapeSearchTerm(value: string): string {
  return value.replace(/[%_]/g, (match) => `\\${match}`).replace(/,/g, ' ');
}

function normalizeError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    return error;
  }

  if (error && typeof error === 'object') {
    const typed = error as Partial<PostgrestError>;
    const message = typed.message || typed.details;
    if (typeof message === 'string' && message.trim()) {
      return new Error(message);
    }
  }

  if (typeof error === 'string' && error.trim()) {
    return new Error(error);
  }

  return new Error(fallback);
}

export async function listTransactions(
  params: ListTransactionsParams = {},
): Promise<{ rows: Tx[]; total: number }>
{
  const limit = params.limit && params.limit > 0 ? params.limit : 20;
  const offset = params.offset && params.offset > 0 ? params.offset : 0;

  try {
    const userId = await waitForSession();

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

    if (params.type) {
      query = query.eq('type', params.type);
    }

    if (params.accountId) {
      const accountId = params.accountId;
      query = query.or(
        `account_id.eq.${accountId},to_account_id.eq.${accountId}`,
        { foreignTable: undefined },
      );
    }

    if (params.search) {
      const normalized = escapeSearchTerm(params.search.trim());
      if (normalized) {
        const pattern = `%${normalized}%`;
        query = query.or(
          `title.ilike.${pattern},notes.ilike.${pattern}`,
        );
      }
    }

    query = query
      .order('date', { ascending: false })
      .order('updated_at', { ascending: false, nullsLast: true });

    if (limit) {
      const toIndex = offset + limit - 1;
      query = query.range(offset, toIndex);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('[transactions:list] Query failed', { error, params });
      throw error;
    }

    const rows = (data ?? []) as Tx[];
    return {
      rows,
      total: typeof count === 'number' ? count : rows.length,
    };
  } catch (error) {
    console.error('[transactions:list] Unexpected error', error);
    throw normalizeError(error, 'Gagal memuat transaksi.');
  }
}

export async function getTransactionById(id: string): Promise<Tx | null> {
  if (!id) {
    return null;
  }

  try {
    const userId = await waitForSession();
    const { data, error } = await supabase
      .from('transactions')
      .select(TRANSACTION_SELECT_COLUMNS)
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[transactions:list] Failed to fetch transaction detail', {
        error,
        id,
      });
      throw error;
    }

    return (data as Tx | null) ?? null;
  } catch (error) {
    console.error('[transactions:list] Unexpected error while fetching detail', error);
    throw normalizeError(error, 'Gagal memuat detail transaksi.');
  }
}

export async function updateTransaction(id: string, payload: UpdateTransactionPayload): Promise<Tx> {
  if (!id) {
    throw new Error('ID transaksi tidak valid.');
  }

  const updates: UpdateTransactionPayload & { updated_at?: string } = {
    ...payload,
  };

  if (payload.type === 'transfer') {
    updates.category_id = null;
  }

  if (!updates.updated_at) {
    updates.updated_at = new Date().toISOString();
  }

  try {
    const userId = await waitForSession();
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('user_id', userId)
      .eq('id', id)
      .select(TRANSACTION_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error('[transactions:update] Failed to update transaction', {
        error,
        id,
      });
      throw error;
    }

    if (!data) {
      throw new Error('Transaksi tidak ditemukan.');
    }

    return data as Tx;
  } catch (error) {
    console.error('[transactions:update] Unexpected error', error);
    throw normalizeError(error, 'Gagal memperbarui transaksi.');
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  if (!id) {
    throw new Error('ID transaksi tidak valid.');
  }

  try {
    const userId = await waitForSession();
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);

    if (error) {
      console.error('[transactions:update] Failed to delete transaction', { error, id });
      throw error;
    }
  } catch (error) {
    console.error('[transactions:update] Unexpected error while deleting', error);
    throw normalizeError(error, 'Gagal menghapus transaksi.');
  }
}
