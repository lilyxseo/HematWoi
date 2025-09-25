import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getCurrentUserId } from './session';

type TransactionType = 'income' | 'expense' | 'transfer';

type NullableString = string | null | undefined;

type CreateTransactionInput = {
  date: string;
  type: TransactionType;
  amount: number;
  account_id: string;
  to_account_id?: NullableString;
  category_id?: NullableString;
  merchant_id?: NullableString;
  title?: NullableString;
  notes?: NullableString;
  tags?: string[] | null;
  receipt_url?: NullableString;
};

type TransactionRow = {
  id: string;
  user_id: string;
  date: string;
  type: TransactionType;
  amount: number;
  account_id: string | null;
  to_account_id: string | null;
  category_id: string | null;
  merchant_id: string | null;
  title: string | null;
  notes: string | null;
  tags: string[] | null;
  receipt_url: string | null;
};

function normalizeType(type: string): TransactionType {
  if (type === 'income' || type === 'transfer') return type;
  return 'expense';
}

function createFriendlyError(error: unknown): Error {
  if (error instanceof Error && error.message) {
    return new Error(error.message);
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as PostgrestError).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return new Error(message);
    }
  }
  return new Error('Gagal menyimpan transaksi. Coba lagi.');
}

function sanitizeText(value: NullableString): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeTags(tags: string[] | null | undefined): string[] | null {
  if (!Array.isArray(tags)) return null;
  const cleaned = tags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter((tag) => tag.length > 0);
  return cleaned.length > 0 ? cleaned : null;
}

function validateDate(date: string | null | undefined): string {
  const value = typeof date === 'string' ? date.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Tanggal tidak valid. Gunakan format YYYY-MM-DD.');
  }
  return value;
}

function validateAmount(amount: number): number {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error('Nominal harus lebih besar dari 0.');
  }
  return numeric;
}

export async function createTransaction(input: CreateTransactionInput): Promise<TransactionRow> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda harus login untuk membuat transaksi.');
  }

  const type = normalizeType(input.type);
  const date = validateDate(input.date);
  const amount = validateAmount(input.amount);
  const accountId = sanitizeText(input.account_id);
  const toAccountId = sanitizeText(input.to_account_id ?? null);
  const categoryId = sanitizeText(input.category_id ?? null);
  const merchantId = sanitizeText(input.merchant_id ?? null);
  const title = sanitizeText(input.title);
  const notes = sanitizeText(input.notes);
  const receiptUrl = sanitizeText(input.receipt_url);
  const tags = sanitizeTags(input.tags);

  if (!accountId) {
    throw new Error('Pilih akun sumber terlebih dahulu.');
  }

  let finalCategoryId: string | null = categoryId;
  let finalToAccountId: string | null = toAccountId;

  if (type === 'transfer') {
    if (!toAccountId) {
      throw new Error('Pilih akun tujuan untuk transfer.');
    }
    if (toAccountId === accountId) {
      throw new Error('Akun tujuan tidak boleh sama dengan akun sumber.');
    }
    finalCategoryId = null;
  } else {
    finalToAccountId = null;
    if (type === 'expense' && !categoryId) {
      throw new Error('Kategori wajib diisi untuk pengeluaran.');
    }
  }

  const payload = {
    user_id: userId,
    date,
    type,
    amount,
    account_id: accountId,
    to_account_id: finalToAccountId,
    category_id: finalCategoryId,
    merchant_id: merchantId,
    title,
    notes,
    tags,
    receipt_url: receiptUrl,
  } as const;

  try {
    const { data, error } = await supabase
      .from('transactions')
      .insert(payload)
      .select(
        'id, user_id, date, type, amount, account_id, to_account_id, category_id, merchant_id, title, notes, tags, receipt_url',
      )
      .single();
    if (error) throw error;
    if (!data) {
      throw new Error('Transaksi tidak tersimpan. Coba lagi.');
    }
    return data as TransactionRow;
  } catch (error) {
    throw createFriendlyError(error);
  }
}

export type { CreateTransactionInput, TransactionRow };
