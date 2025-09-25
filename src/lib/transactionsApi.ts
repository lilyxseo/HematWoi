import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type TransactionType = 'income' | 'expense' | 'transfer';

export type CreateTransactionInput = {
  type: TransactionType;
  date: string;
  amount: number;
  account_id: string | null;
  to_account_id?: string | null;
  category_id?: string | null;
  merchant_id?: string | null;
  title?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  receipt_url?: string | null;
};

function toNullableString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return String(value);
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeId(value: unknown): string | null {
  const str = toNullableString(value);
  if (!str) return null;
  return str;
}

function sanitizeTags(tags: string[] | null | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  return Array.from(
    new Set(
      tags
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter((tag) => Boolean(tag))
        .map((tag) => tag.replace(/\s+/g, ' ')),
    ),
  );
}

function ensureValidDate(date: string): string {
  const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
  if (!DATE_REGEX.test(date)) {
    throw new Error('Tanggal tidak valid. Gunakan format YYYY-MM-DD.');
  }
  return date;
}

function normalizeType(type: TransactionType): TransactionType {
  if (type === 'income' || type === 'transfer') return type;
  return 'expense';
}

function resolveUserError(error: unknown): never {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
    throw new Error((error as any).message);
  }
  throw new Error('Anda harus login untuk membuat transaksi.');
}

function toFriendlyError(error: unknown, fallback = 'Gagal menyimpan transaksi.'): Error {
  if (!error) return new Error(fallback);
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  if (typeof error === 'object') {
    const typed = error as Partial<PostgrestError> & { details?: string };
    if (typed.message && typeof typed.message === 'string') {
      return new Error(typed.message);
    }
    if (typed.details && typeof typed.details === 'string') {
      return new Error(`${fallback.replace(/[:.]?$/, '')}: ${typed.details}`);
    }
  }
  return new Error(fallback);
}

export async function createTransaction(input: CreateTransactionInput) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    resolveUserError(authError);
  }
  const userId = authData?.user?.id;
  if (!userId) {
    resolveUserError(null);
  }

  const type = normalizeType(input.type);
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Jumlah transaksi harus lebih besar dari 0.');
  }

  const date = ensureValidDate(String(input.date ?? ''));
  const accountId = normalizeId(input.account_id);
  if (!accountId) {
    throw new Error('Akun sumber wajib diisi.');
  }

  let toAccountId = normalizeId(input.to_account_id);
  let categoryId = normalizeId(input.category_id);

  if (type === 'transfer') {
    if (!toAccountId) {
      throw new Error('Akun tujuan wajib diisi untuk transfer.');
    }
    if (toAccountId === accountId) {
      throw new Error('Akun tujuan tidak boleh sama dengan akun sumber.');
    }
    categoryId = null;
  } else {
    toAccountId = null;
    if (type === 'expense' && !categoryId) {
      throw new Error('Kategori wajib diisi untuk pengeluaran.');
    }
  }

  const notes = toNullableString(input.notes);
  const title = toNullableString(input.title);
  const merchantId = normalizeId(input.merchant_id);
  const receiptUrl = toNullableString(input.receipt_url);
  const tags = sanitizeTags(input.tags);

  const record: Record<string, any> = {
    user_id: userId,
    type,
    date,
    amount,
    account_id: accountId,
    to_account_id: toAccountId,
    category_id: categoryId,
    merchant_id: merchantId,
    title,
    notes,
    tags: tags.length ? tags : null,
    receipt_url: receiptUrl,
  };

  try {
    const { data, error } = await supabase
      .from('transactions')
      .insert([record])
      .select('id,user_id,type,date,amount,account_id,to_account_id,category_id,merchant_id,title,notes,tags,receipt_url')
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    throw toFriendlyError(error);
  }
}
