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

async function adjustAccountBalance(accountId: string, userId: string, delta: number): Promise<void> {
  if (!accountId || !Number.isFinite(delta) || Math.abs(delta) < 0.000001) {
    return;
  }

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Akun tidak ditemukan.');
  }

  const balanceKey = ['balance', 'current_balance', 'initial_balance'].find((key) =>
    Object.prototype.hasOwnProperty.call(data, key),
  );

  if (!balanceKey) {
    return;
  }

  const currentBalance = Number((data as Record<string, unknown>)[balanceKey] ?? 0);
  const safeCurrentBalance = Number.isFinite(currentBalance) ? currentBalance : 0;
  const nextBalance = Number((safeCurrentBalance + delta).toFixed(2));

  const { error: updateError } = await supabase
    .from('accounts')
    .update({ [balanceKey]: nextBalance })
    .eq('id', accountId)
    .eq('user_id', userId);

  if (updateError) throw updateError;
}

async function applyBalanceDelta(params: {
  type: TransactionType;
  userId: string;
  amount: number;
  accountId: string;
  toAccountId: string | null;
}): Promise<void> {
  const { type, userId, amount, accountId, toAccountId } = params;
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  if (type === 'income') {
    await adjustAccountBalance(accountId, userId, amount);
    return;
  }

  if (type === 'expense') {
    await adjustAccountBalance(accountId, userId, -amount);
    return;
  }

  if (!toAccountId) {
    return;
  }

  await adjustAccountBalance(accountId, userId, -amount);
  try {
    await adjustAccountBalance(toAccountId, userId, amount);
  } catch (error) {
    await adjustAccountBalance(accountId, userId, amount);
    throw error;
  }
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
    .select('id, user_id, type, date, amount, account_id, to_account_id, category_id, merchant_id, title, notes, tags, receipt_url')
    .single();

  if (error) {
    throw new Error(error.message || 'Gagal menyimpan transaksi.');
  }

  const record = {
    ...data,
    amount: Number(data.amount ?? amount),
    account_id: data.account_id ?? account_id ?? null,
    to_account_id: data.to_account_id ?? (type === 'transfer' ? to_account_id ?? null : null),
    category_id: data.category_id ?? (type === 'transfer' ? null : category_id ?? null),
    merchant_id: data.merchant_id ?? merchant_id ?? null,
    title: data.title ?? title?.trim() ?? null,
    notes: data.notes ?? notes?.trim() ?? null,
  };

  try {
    const normalized = mapTransactionRow(record);
    if (normalized?.id) {
      await dbCache.set('transactions', normalized);
    }
  } catch (cacheError) {
    console.warn('Failed to update transaction cache', cacheError);
  }

  await applyBalanceDelta({
    type,
    userId,
    amount,
    accountId: account_id,
    toAccountId: type === 'transfer' ? to_account_id ?? null : null,
  });

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
  };
}
