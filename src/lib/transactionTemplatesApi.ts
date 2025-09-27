import { supabase } from './supabase';
import { getCurrentUserId } from './session';
import type { TransactionType } from './transactionsApi';

export interface TransactionTemplateRecord {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  amount: number | null;
  account_id: string | null;
  to_account_id: string | null;
  category_id: string | null;
  title: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TransactionTemplatePayload {
  name: string;
  type: TransactionType;
  amount?: number | null;
  account_id?: string | null;
  to_account_id?: string | null;
  category_id?: string | null;
  title?: string | null;
  notes?: string | null;
}

function mapTemplateRow(row: Record<string, any>): TransactionTemplateRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: typeof row.name === 'string' ? row.name : '',
    type: (row.type as TransactionType) ?? 'expense',
    amount: row.amount != null ? Number(row.amount) : null,
    account_id: row.account_id ? String(row.account_id) : null,
    to_account_id: row.to_account_id ? String(row.to_account_id) : null,
    category_id: row.category_id ? String(row.category_id) : null,
    title: row.title ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export async function listTransactionTemplates(): Promise<TransactionTemplateRecord[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('transaction_templates')
    .select(
      'id, user_id, name, type, amount, account_id, to_account_id, category_id, title, notes, created_at, updated_at',
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false, nullsLast: false })
    .order('created_at', { ascending: false, nullsLast: false });

  if (error) {
    throw new Error(error.message || 'Gagal memuat template transaksi.');
  }

  return (data ?? []).map((row) => mapTemplateRow(row));
}

export async function createTransactionTemplate(
  payload: TransactionTemplatePayload,
): Promise<TransactionTemplateRecord> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda harus masuk untuk menyimpan template transaksi.');
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name) {
    throw new Error('Nama template wajib diisi.');
  }

  const templateType: TransactionType = ['income', 'expense', 'transfer'].includes(payload.type)
    ? payload.type
    : 'expense';

  const hasAmount = typeof payload.amount === 'number' && Number.isFinite(payload.amount);

  const insertPayload = {
    user_id: userId,
    name,
    type: templateType,
    amount: hasAmount ? Number(payload.amount) : null,
    account_id: payload.account_id || null,
    to_account_id: templateType === 'transfer' ? payload.to_account_id || null : null,
    category_id: templateType !== 'transfer' ? payload.category_id || null : null,
    title: payload.title?.trim() || null,
    notes: payload.notes?.trim() || null,
  };

  const { data, error } = await supabase
    .from('transaction_templates')
    .insert(insertPayload)
    .select(
      'id, user_id, name, type, amount, account_id, to_account_id, category_id, title, notes, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(error.message || 'Gagal menyimpan template transaksi.');
  }

  return mapTemplateRow(data);
}

export async function deleteTransactionTemplate(id: string): Promise<void> {
  if (!id) {
    throw new Error('ID template tidak valid.');
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda harus masuk untuk menghapus template transaksi.');
  }

  const { error } = await supabase
    .from('transaction_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message || 'Gagal menghapus template transaksi.');
  }
}
