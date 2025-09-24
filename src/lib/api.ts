import { supabase } from './supabase';
import { getCurrentUserId } from './session';

export type AccountType = 'cash' | 'bank' | 'ewallet' | 'other';

export interface AccountRecord {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface AccountInput {
  name: string;
  type: AccountType;
  currency?: string;
}

export type AccountPatch = Partial<Pick<AccountInput, 'name' | 'type' | 'currency'>>;

function ensureAuth(userId: string | null | undefined): asserts userId is string {
  if (!userId) {
    throw new Error('Anda harus login untuk mengelola akun.');
  }
}

function toUserMessage(prefix: string, error: unknown): string {
  if (error instanceof Error && error.message) {
    return `${prefix}: ${error.message}`;
  }
  if (typeof error === 'string' && error.trim()) {
    return `${prefix}: ${error}`;
  }
  return `${prefix}. Silakan coba lagi.`;
}

function normalizeCurrency(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return 'IDR';
  return trimmed.toUpperCase();
}

function normalizeAccount(row: Record<string, any>, userFallback: string): AccountRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id ?? userFallback),
    name: (row.name ?? '').toString(),
    type: (row.type as AccountType) ?? 'other',
    currency: normalizeCurrency(row.currency),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export async function listAccounts(userId?: string): Promise<AccountRecord[]> {
  const authUserId = userId ?? (await getCurrentUserId());
  ensureAuth(authUserId);
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('id, user_id, name, type, currency, created_at, updated_at')
      .eq('user_id', authUserId)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data ?? []).map((row) => normalizeAccount(row, authUserId));
  } catch (error) {
    throw new Error(toUserMessage('Gagal memuat akun', error));
  }
}

export async function createAccount(payload: AccountInput, userId?: string): Promise<AccountRecord> {
  const authUserId = userId ?? (await getCurrentUserId());
  ensureAuth(authUserId);

  const name = payload.name?.trim();
  if (!name) {
    throw new Error('Nama akun wajib diisi.');
  }

  const insertData = {
    name,
    type: payload.type ?? 'other',
    currency: normalizeCurrency(payload.currency),
    user_id: authUserId,
  };

  try {
    const { data, error } = await supabase
      .from('accounts')
      .insert(insertData)
      .select('id, user_id, name, type, currency, created_at, updated_at')
      .single();

    if (error) throw error;
    if (!data) {
      throw new Error('Respon server tidak valid.');
    }

    return normalizeAccount(data, authUserId);
  } catch (error) {
    throw new Error(toUserMessage('Gagal menambah akun', error));
  }
}

export async function updateAccount(
  id: string,
  patch: AccountPatch,
  userId?: string
): Promise<AccountRecord> {
  const authUserId = userId ?? (await getCurrentUserId());
  ensureAuth(authUserId);

  if (!id) {
    throw new Error('ID akun tidak valid.');
  }

  const updates: Record<string, any> = {};

  if (patch.name !== undefined) {
    const trimmed = patch.name?.trim();
    if (!trimmed) {
      throw new Error('Nama akun wajib diisi.');
    }
    updates.name = trimmed;
  }

  if (patch.type !== undefined) {
    updates.type = patch.type;
  }

  if (patch.currency !== undefined) {
    updates.currency = normalizeCurrency(patch.currency);
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('Tidak ada perubahan untuk disimpan.');
  }

  try {
    const { data, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', authUserId)
      .select('id, user_id, name, type, currency, created_at, updated_at')
      .single();

    if (error) throw error;
    if (!data) {
      throw new Error('Respon server tidak valid.');
    }

    return normalizeAccount(data, authUserId);
  } catch (error) {
    throw new Error(toUserMessage('Gagal memperbarui akun', error));
  }
}

export async function deleteAccount(id: string, userId?: string): Promise<void> {
  const authUserId = userId ?? (await getCurrentUserId());
  ensureAuth(authUserId);

  if (!id) {
    throw new Error('ID akun tidak valid.');
  }

  try {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id)
      .eq('user_id', authUserId);

    if (error) throw error;
  } catch (error) {
    throw new Error(toUserMessage('Gagal menghapus akun', error));
  }
}
