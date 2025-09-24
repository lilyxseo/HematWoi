import { supabase } from './supabase';
import {
  addGuestTx,
  getGuestTx,
  setGuestTx,
  type GuestTx,
  type GuestTxPayload,
} from './guestStore';

export type TransactionPayload = {
  amount: number;
  date: string;
  type: 'expense' | 'income';
  category_id?: string | null;
  note?: string | null;
};

type CloudTransaction = {
  id: string;
  user_id: string;
  amount: number;
  date: string;
  type: 'expense' | 'income';
  category_id: string | null;
  note: string | null;
  created_at?: string;
};

export { type GuestTx };
export { hasUnsyncedGuestTx, clearImported, markImported } from './guestStore';

export function listTransactionsGuest(): Promise<GuestTx[]> {
  return Promise.resolve(getGuestTx());
}

export function createTransactionGuest(payload: TransactionPayload): Promise<GuestTx> {
  const recordPayload: GuestTxPayload = {
    amount: Number(payload.amount) || 0,
    date: payload.date,
    type: payload.type,
    category_id: payload.category_id ?? null,
    note: payload.note ?? '',
  };
  const row = addGuestTx(recordPayload);
  return Promise.resolve(row);
}

export function deleteTransactionGuest(gid: string): Promise<boolean> {
  if (!gid) {
    return Promise.resolve(false);
  }
  const list = getGuestTx();
  const next = list.filter((item) => item.gid !== gid);
  setGuestTx(next);
  return Promise.resolve(next.length !== list.length);
}

export async function listTransactionsCloud(uid: string): Promise<CloudTransaction[]> {
  if (!uid) {
    return [];
  }
  const { data, error } = await supabase
    .from('transactions')
    .select('id, user_id, amount, date, type, category_id, note, created_at')
    .eq('user_id', uid)
    .order('date', { ascending: false });
  if (error) {
    console.error('[data] Failed to load cloud transactions', error);
    throw error;
  }
  return (data ?? []).map((item) => ({
    id: item.id as string,
    user_id: item.user_id as string,
    amount: Number(item.amount) || 0,
    date: item.date as string,
    type: item.type === 'income' ? 'income' : 'expense',
    category_id: (item.category_id as string | null) ?? null,
    note: (item.note as string | null) ?? null,
    created_at: item.created_at as string | undefined,
  }));
}

export async function createTransactionCloud(
  uid: string,
  payload: TransactionPayload,
): Promise<CloudTransaction> {
  if (!uid) {
    throw new Error('Harus login untuk menambahkan transaksi.');
  }
  const insertPayload = {
    user_id: uid,
    amount: Number(payload.amount) || 0,
    date: payload.date,
    type: payload.type === 'income' ? 'income' : 'expense',
    category_id: payload.category_id ?? null,
    note: payload.note ?? null,
  };
  const { data, error } = await supabase
    .from('transactions')
    .insert(insertPayload)
    .select('id, user_id, amount, date, type, category_id, note, created_at')
    .maybeSingle();
  if (error) {
    console.error('[data] Failed to create cloud transaction', error);
    throw error;
  }
  const row = data ?? insertPayload;
  return {
    id: (row as any).id ?? '',
    user_id: (row as any).user_id ?? uid,
    amount: Number((row as any).amount) || 0,
    date: (row as any).date,
    type: (row as any).type === 'income' ? 'income' : 'expense',
    category_id: ((row as any).category_id as string | null) ?? null,
    note: ((row as any).note as string | null) ?? null,
    created_at: (row as any).created_at,
  };
}

export async function deleteTransactionCloud(uid: string, id: string): Promise<boolean> {
  if (!uid || !id) {
    throw new Error('Data tidak lengkap untuk menghapus transaksi.');
  }
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('user_id', uid)
    .eq('id', id);
  if (error) {
    console.error('[data] Failed to delete cloud transaction', error);
    throw error;
  }
  return true;
}

export function getUnsyncedGuestCount(): number {
  const rows = getGuestTx();
  return rows.filter((item) => !item.imported).length;
}
