import { supabase } from './supabase';
import { getCurrentUserId } from './session';
import { dbCache } from './sync/localdb';
import { mapTransactionRow } from './api';

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface CreateTransactionPayload {
  type: TransactionType;
  date: string;
  amount: number;
  account_id: string;
  to_account_id?: string | null;
  category_id?: string | null;
  merchant_id?: string | null;
  title?: string | null;
  notes?: string | null;
  tags?: string[] | null;
}

export interface TransactionRecord {
  id: string;
  user_id: string;
  type: TransactionType;
  date: string;
  amount: number;
  account_id: string | null;
  to_account_id: string | null;
  category_id: string | null;
  merchant_id: string | null;
  title: string | null;
  notes: string | null;
  tags: string[] | null;
  receipt_url: string | null;
  category?: string | null;
  category_color?: string | null;
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function sanitizeTags(input?: string[] | null): string[] | null {
  if (!Array.isArray(input)) return null;
  const seen = new Set<string>();
  const filtered: string[] = [];
  for (const raw of input) {
    const tag = raw?.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    filtered.push(tag);
  }
  return filtered.length ? filtered : null;
}

export async function createTransaction(payload: CreateTransactionPayload): Promise<TransactionRecord> {
  const {
    type,
    date,
    amount,
    account_id,
    to_account_id,
    category_id,
    merchant_id,
    title,
    notes,
    tags,
  } = payload;

  if (!['income', 'expense', 'transfer'].includes(type)) {
    throw new Error('Tipe transaksi tidak valid.');
  }

  if (!isValidDate(date)) {
    throw new Error('Tanggal tidak valid.');
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Jumlah harus lebih besar dari 0.');
  }

  if (!account_id) {
    throw new Error('Akun sumber wajib dipilih.');
  }

  if (type === 'transfer') {
    if (!to_account_id) {
      throw new Error('Akun tujuan wajib dipilih untuk transfer.');
    }
    if (to_account_id === account_id) {
      throw new Error('Akun tujuan tidak boleh sama dengan akun sumber.');
    }
  } else if (to_account_id) {
    throw new Error('Akun tujuan hanya digunakan untuk transfer.');
  }

  if (type === 'expense' && !category_id) {
    throw new Error('Kategori wajib untuk pengeluaran.');
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda harus masuk untuk membuat transaksi.');
  }

  const insertPayload = {
    user_id: userId,
    type,
    date,
    amount,
    account_id,
    to_account_id: type === 'transfer' ? to_account_id ?? null : null,
    category_id: type === 'transfer' ? null : category_id ?? null,
    merchant_id: merchant_id ?? null,
    title: title?.trim() || null,
    notes: notes?.trim() || null,
    tags: sanitizeTags(tags) ?? null,
  };

  const { data, error } = await supabase
    .from('transactions')
    .insert(insertPayload)
    .select(
      'id, user_id, type, date, amount, account_id, to_account_id, category_id, merchant_id, title, notes, tags, receipt_url, categories(id, name, color)',
    )
    .single();

  if (error) {
    throw new Error(error.message || 'Gagal menyimpan transaksi.');
  }

  const categoryData = data?.categories ?? null;

  const record = {
    ...data,
    amount: Number(data.amount ?? amount),
    account_id: data.account_id ?? account_id ?? null,
    to_account_id: data.to_account_id ?? (type === 'transfer' ? to_account_id ?? null : null),
    category_id: data.category_id ?? (type === 'transfer' ? null : category_id ?? null),
    merchant_id: data.merchant_id ?? merchant_id ?? null,
    title: data.title ?? title?.trim() ?? null,
    notes: data.notes ?? notes?.trim() ?? null,
    category: categoryData?.name ?? null,
    category_color: categoryData?.color ?? null,
  };

  try {
    const normalized = mapTransactionRow(record);
    if (normalized?.id) {
      await dbCache.set('transactions', normalized);
    }
  } catch (cacheError) {
    console.warn('Failed to update transaction cache', cacheError);
  }

  return {
    id: data.id,
    user_id: data.user_id,
    type: data.type as TransactionType,
    date: data.date,
    amount: record.amount,
    account_id: record.account_id,
    to_account_id: record.to_account_id,
    category_id: record.category_id,
    merchant_id: record.merchant_id,
    title: record.title,
    notes: record.notes,
    tags: Array.isArray(data.tags) ? data.tags : null,
    receipt_url: data.receipt_url ?? null,
    category: categoryData?.name ?? null,
    category_color: categoryData?.color ?? null,
  };
}
