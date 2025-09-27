import { supabase } from './supabase';
import { getCurrentUserId } from './session';
import type { TransactionType } from './transactionsApi';

export interface TransactionTemplateRecord {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  amount: number;
  account_id: string | null;
  to_account_id: string | null;
  category_id: string | null;
  title: string | null;
  notes: string | null;
  created_at?: string;
}

export interface CreateTransactionTemplatePayload {
  name: string;
  type: TransactionType;
  amount: number;
  account_id: string;
  to_account_id?: string | null;
  category_id?: string | null;
  title?: string | null;
  notes?: string | null;
}

function validateTemplatePayload(payload: CreateTransactionTemplatePayload) {
  if (!payload.name?.trim()) {
    throw new Error('Nama template wajib diisi.');
  }
  if (!['income', 'expense', 'transfer'].includes(payload.type)) {
    throw new Error('Tipe template tidak valid.');
  }
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    throw new Error('Nominal template harus lebih besar dari 0.');
  }
  if (!payload.account_id) {
    throw new Error('Akun sumber wajib diisi.');
  }
  if (payload.type === 'transfer') {
    if (!payload.to_account_id) {
      throw new Error('Akun tujuan wajib diisi untuk template transfer.');
    }
    if (payload.to_account_id === payload.account_id) {
      throw new Error('Akun tujuan tidak boleh sama dengan akun sumber.');
    }
  }
  if (payload.type === 'expense' && !payload.category_id) {
    throw new Error('Kategori wajib diisi untuk template pengeluaran.');
  }
}

export async function listTransactionTemplates(): Promise<TransactionTemplateRecord[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda harus masuk untuk mengelola template transaksi.');
  }
  const { data, error } = await supabase
    .from('transaction_templates')
    .select(
      'id, user_id, name, type, amount, account_id, to_account_id, category_id, title, notes, created_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    throw new Error(error.message || 'Gagal mengambil template transaksi.');
  }
  return (data || []).map((item) => ({
    id: item.id,
    user_id: item.user_id,
    name: item.name,
    type: item.type as TransactionType,
    amount: Number(item.amount) || 0,
    account_id: item.account_id ?? null,
    to_account_id: item.to_account_id ?? null,
    category_id: item.category_id ?? null,
    title: item.title ?? null,
    notes: item.notes ?? null,
    created_at: item.created_at ?? undefined,
  }));
}

export async function createTransactionTemplate(
  payload: CreateTransactionTemplatePayload,
): Promise<TransactionTemplateRecord> {
  validateTemplatePayload(payload);
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda harus masuk untuk menyimpan template transaksi.');
  }

  const insertPayload = {
    user_id: userId,
    name: payload.name.trim(),
    type: payload.type,
    amount: payload.amount,
    account_id: payload.account_id,
    to_account_id: payload.type === 'transfer' ? payload.to_account_id ?? null : null,
    category_id: payload.type === 'transfer' ? null : payload.category_id ?? null,
    title: payload.title?.trim() || null,
    notes: payload.notes?.trim() || null,
  };

  const { data, error } = await supabase
    .from('transaction_templates')
    .insert(insertPayload)
    .select(
      'id, user_id, name, type, amount, account_id, to_account_id, category_id, title, notes, created_at',
    )
    .single();

  if (error) {
    throw new Error(error.message || 'Gagal menyimpan template transaksi.');
  }

  return {
    id: data.id,
    user_id: data.user_id,
    name: data.name,
    type: data.type as TransactionType,
    amount: Number(data.amount) || insertPayload.amount,
    account_id: data.account_id ?? null,
    to_account_id: data.to_account_id ?? null,
    category_id: data.category_id ?? null,
    title: data.title ?? null,
    notes: data.notes ?? null,
    created_at: data.created_at ?? undefined,
  };
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
