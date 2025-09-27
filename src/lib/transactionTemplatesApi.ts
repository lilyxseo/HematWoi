import { supabase } from './supabase';
import { getCurrentUserId } from './session';
import type { TransactionType } from './transactionsApi';

const TEMPLATE_FIELDS =
  'id,user_id,name,type,amount,account_id,to_account_id,category_id,title,notes,created_at';

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
}

export interface CreateTransactionTemplatePayload {
  name: string;
  type: TransactionType;
  amount: number;
  account_id?: string | null;
  to_account_id?: string | null;
  category_id?: string | null;
  title?: string | null;
  notes?: string | null;
}

function normalizeTemplate(row: Record<string, any>): TransactionTemplateRecord {
  const rawType = typeof row.type === 'string' ? row.type.toLowerCase() : 'expense';
  const type: TransactionType =
    rawType === 'income' || rawType === 'transfer' ? (rawType as TransactionType) : 'expense';
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: typeof row.name === 'string' ? row.name : '',
    type,
    amount: row.amount !== undefined && row.amount !== null ? Number(row.amount) : null,
    account_id: row.account_id ? String(row.account_id) : null,
    to_account_id: row.to_account_id ? String(row.to_account_id) : null,
    category_id: row.category_id ? String(row.category_id) : null,
    title: row.title ? String(row.title) : null,
    notes: row.notes ? String(row.notes) : null,
    created_at: row.created_at ?? null,
  };
}

function sanitizeOptionalText(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function listTransactionTemplates(): Promise<TransactionTemplateRecord[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from('transaction_templates')
    .select(TEMPLATE_FIELDS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Gagal memuat template transaksi.');
  }

  return (data ?? []).map((row) => normalizeTemplate(row));
}

export async function createTransactionTemplate(
  payload: CreateTransactionTemplatePayload,
): Promise<TransactionTemplateRecord> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda harus masuk untuk menyimpan template.');
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name) {
    throw new Error('Nama template wajib diisi.');
  }

  if (!['income', 'expense', 'transfer'].includes(payload.type)) {
    throw new Error('Tipe template tidak valid.');
  }

  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    throw new Error('Nominal template wajib lebih besar dari 0.');
  }

  const record = {
    user_id: userId,
    name,
    type: payload.type,
    amount: payload.amount,
    account_id: sanitizeOptionalText(payload.account_id) ?? null,
    to_account_id: payload.type === 'transfer' ? sanitizeOptionalText(payload.to_account_id) ?? null : null,
    category_id: payload.type === 'transfer' ? null : sanitizeOptionalText(payload.category_id) ?? null,
    title: sanitizeOptionalText(payload.title),
    notes: sanitizeOptionalText(payload.notes),
  };

  const { data, error } = await supabase
    .from('transaction_templates')
    .insert(record)
    .select(TEMPLATE_FIELDS)
    .single();

  if (error) {
    throw new Error(error.message || 'Gagal menyimpan template transaksi.');
  }

  if (!data) {
    throw new Error('Template transaksi tidak berhasil disimpan.');
  }

  return normalizeTemplate(data);
}

export async function deleteTransactionTemplate(id: string): Promise<void> {
  if (!id) {
    throw new Error('ID template tidak valid.');
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda harus masuk untuk menghapus template.');
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
