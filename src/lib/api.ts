import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type AccountType = 'cash' | 'bank' | 'ewallet' | 'other';

export interface AccountRecord {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  created_at: string | null;
  user_id?: string;
  sort_order?: number | null;
}

type CreateAccountPayload = {
  name: string;
  type: AccountType;
  currency?: string;
};

type UpdateAccountPayload = Partial<{
  name: string;
  type: AccountType;
  currency: string;
}>;

const ACCOUNT_TYPES: readonly AccountType[] = ['cash', 'bank', 'ewallet', 'other'] as const;

function normalizeAccountType(value: unknown): AccountType {
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (ACCOUNT_TYPES.includes(lowered as AccountType)) {
      return lowered as AccountType;
    }
  }
  return 'other';
}

function normalizeCurrency(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed.toUpperCase();
    }
  }
  return 'IDR';
}

function normalizeSortOrder(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeAccount(row: Record<string, any>): AccountRecord {
  return {
    id: String(row.id),
    name: typeof row.name === 'string' ? row.name : '',
    type: normalizeAccountType(row.type),
    currency: normalizeCurrency(row.currency),
    created_at: row.created_at ?? null,
    user_id: row.user_id ? String(row.user_id) : undefined,
    sort_order: normalizeSortOrder(row.sort_order),
  };
}

type KnownError = Partial<Pick<PostgrestError, 'code' | 'message' | 'details'>>;

function toUserMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const typed = error as KnownError;
    if (typed.code === '23505') {
      return 'Nama akun sudah digunakan. Silakan gunakan nama lain.';
    }
    if (typeof typed.message === 'string' && typed.message.trim()) {
      return `${fallback.replace(/[:.]?$/, '')}: ${typed.message}`;
    }
    if (typeof typed.details === 'string' && typed.details.trim()) {
      return `${fallback.replace(/[:.]?$/, '')}: ${typed.details}`;
    }
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return fallback;
}

export async function listAccounts(userId: string): Promise<AccountRecord[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id,name,type,currency,created_at,user_id,sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(toUserMessage(error, 'Gagal memuat akun.'));
  }

  return (data ?? []).map((row) => normalizeAccount(row));
}

export async function createAccount(
  userId: string,
  payload: CreateAccountPayload,
): Promise<AccountRecord> {
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name) {
    throw new Error('Nama akun wajib diisi.');
  }

  const record = {
    user_id: userId,
    name,
    type: normalizeAccountType(payload.type),
    currency: normalizeCurrency(payload.currency),
  };

  const { data, error } = await supabase
    .from('accounts')
    .insert([record])
    .select('id,name,type,currency,created_at,user_id,sort_order')
    .single();

  if (error) {
    throw new Error(toUserMessage(error, 'Gagal menambah akun.'));
  }

  if (!data) {
    throw new Error('Gagal menambah akun. Silakan coba lagi.');
  }

  return normalizeAccount(data);
}

export async function updateAccount(
  id: string,
  patch: UpdateAccountPayload,
): Promise<AccountRecord> {
  if (!id) {
    throw new Error('ID akun tidak valid.');
  }

  const updates: Record<string, any> = {};

  if (patch.name !== undefined) {
    const trimmed = typeof patch.name === 'string' ? patch.name.trim() : '';
    if (!trimmed) {
      throw new Error('Nama akun wajib diisi.');
    }
    updates.name = trimmed;
  }

  if (patch.type !== undefined) {
    updates.type = normalizeAccountType(patch.type);
  }

  if (patch.currency !== undefined) {
    updates.currency = normalizeCurrency(patch.currency);
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('Tidak ada perubahan untuk disimpan.');
  }

  const { data, error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', id)
    .select('id,name,type,currency,created_at,user_id,sort_order')
    .single();

  if (error) {
    throw new Error(toUserMessage(error, 'Gagal memperbarui akun.'));
  }

  if (!data) {
    throw new Error('Gagal memperbarui akun. Silakan coba lagi.');
  }

  return normalizeAccount(data);
}

export async function deleteAccount(id: string): Promise<void> {
  if (!id) {
    throw new Error('ID akun tidak valid.');
  }

  const { error } = await supabase.from('accounts').delete().eq('id', id);

  if (error) {
    throw new Error(toUserMessage(error, 'Gagal menghapus akun.'));
  }
}

export async function reorderAccounts(
  userId: string,
  orderedIds: string[],
): Promise<void> {
  if (!userId) {
    throw new Error('Anda harus login untuk mengatur urutan akun.');
  }
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return;
  }

  const payload = orderedIds.map((id, index) => ({
    id,
    user_id: userId,
    sort_order: index,
  }));

  const { error } = await supabase
    .from('accounts')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    throw new Error(toUserMessage(error, 'Gagal mengurutkan akun.'));
  }
}
