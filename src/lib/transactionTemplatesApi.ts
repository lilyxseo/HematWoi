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
  created_at: string | null;
  updated_at: string | null;
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

function assertValidTemplatePayload(payload: CreateTransactionTemplatePayload): void {
  const { name, type, amount, account_id, to_account_id, category_id } = payload;

  if (!name?.trim()) {
    throw new Error('Nama template wajib diisi.');
  }

  if (!['income', 'expense', 'transfer'].includes(type)) {
    throw new Error('Tipe template tidak valid.');
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Nominal template harus lebih besar dari 0.');
  }

  if (!account_id) {
    throw new Error('Pilih akun sumber untuk template.');
  }

  if (type === 'transfer') {
    if (!to_account_id) {
      throw new Error('Pilih akun tujuan untuk template transfer.');
    }
    if (to_account_id === account_id) {
      throw new Error('Akun tujuan tidak boleh sama dengan akun sumber.');
    }
  } else if (to_account_id) {
    throw new Error('Akun tujuan hanya digunakan untuk template transfer.');
  }

  if (type === 'expense' && !category_id) {
    throw new Error('Pilih kategori untuk template pengeluaran.');
  }
}

export async function listTransactionTemplates(): Promise<TransactionTemplateRecord[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from('transaction_templates')
    .select(
      'id, user_id, name, type, amount, account_id, to_account_id, category_id, title, notes, created_at, updated_at',
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(error.message || 'Gagal memuat template transaksi.');
  }

  return (data || []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    type: (row.type || 'expense') as TransactionType,
    amount: Number(row.amount ?? 0),
    account_id: row.account_id ?? null,
    to_account_id: row.to_account_id ?? null,
    category_id: row.category_id ?? null,
    title: row.title ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }));
}

export async function createTransactionTemplate(
  payload: CreateTransactionTemplatePayload,
): Promise<TransactionTemplateRecord> {
  assertValidTemplatePayload(payload);

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
      'id, user_id, name, type, amount, account_id, to_account_id, category_id, title, notes, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(error.message || 'Gagal menyimpan template transaksi.');
  }

  return {
    id: data.id,
    user_id: data.user_id,
    name: data.name,
    type: (data.type || payload.type) as TransactionType,
    amount: Number(data.amount ?? payload.amount),
    account_id: data.account_id ?? insertPayload.account_id ?? null,
    to_account_id: data.to_account_id ?? insertPayload.to_account_id ?? null,
    category_id: data.category_id ?? insertPayload.category_id ?? null,
    title: data.title ?? insertPayload.title ?? null,
    notes: data.notes ?? insertPayload.notes ?? null,
    created_at: data.created_at ?? null,
    updated_at: data.updated_at ?? null,
  };
}

export async function deleteTransactionTemplate(id: string): Promise<void> {
  if (!id) {
    throw new Error('Template tidak ditemukan.');
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda harus masuk untuk menghapus template transaksi.');
  }

  const { error } = await supabase.from('transaction_templates').delete().eq('id', id).eq('user_id', userId);

  if (error) {
    throw new Error(error.message || 'Gagal menghapus template transaksi.');
  }
}
