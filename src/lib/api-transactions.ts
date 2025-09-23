import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getCurrentUserId } from './session';

function resolveErrorCode(error: unknown): string | number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const record = error as Record<string, unknown>;
  return (
    (typeof record.code === 'string' ? record.code : undefined) ??
    (typeof record.status === 'number' ? record.status : undefined) ??
    (typeof record.status === 'string' ? record.status : undefined) ??
    resolveErrorCode(record?.cause as unknown)
  );
}

function mapFriendlyError(error: unknown, fallback: string) {
  const code = resolveErrorCode(error);
  if (code === 401 || code === 403 || code === '42501') {
    return new Error('Tidak punya izin. Coba muat ulang sesi.');
  }
  if (code === '23503') {
    return new Error('Tidak bisa menghapus karena ada data terkait. Coba ulangi.');
  }

  if (error instanceof Error) {
    if (/Failed to fetch/i.test(error.message)) {
      return new Error(fallback);
    }
    return new Error(error.message || fallback);
  }

  if (typeof error === 'string' && error.trim()) {
    return new Error(error);
  }

  const message =
    (typeof (error as PostgrestError | undefined)?.message === 'string' &&
      (error as PostgrestError).message) ||
    fallback;
  return new Error(message);
}

function toStringId(value: unknown) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    const idValue = (value as Record<string, unknown>).id;
    return typeof idValue === 'string' ? idValue : null;
  }
  return null;
}

export async function removeTransaction(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const { data, error } = await supabase.rpc('delete_transaction', { p_id: id });
    if (error) throw error;
    return Boolean(data);
  } catch (error) {
    throw mapFriendlyError(error, 'Gagal menghapus. Cek koneksi lalu coba lagi.');
  }
}

export async function removeTransactionsBulk(ids: string[]): Promise<number> {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  try {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (!unique.length) return 0;
    const { data, error } = await supabase.rpc('delete_transactions_bulk', {
      p_ids: unique,
    });
    if (error) throw error;
    if (typeof data === 'number') return data;
    if (Array.isArray(data)) {
      const count = data
        .map((value) => toStringId(value))
        .filter((value) => typeof value === 'string').length;
      return count;
    }
    return 0;
  } catch (error) {
    throw mapFriendlyError(error, 'Gagal menghapus. Cek koneksi lalu coba lagi.');
  }
}

export async function undoDeleteTransaction(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('Tidak punya izin. Coba muat ulang sesi.');
    }
    const { data, error } = await supabase
      .from('transactions')
      .select('id, rev')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data?.id) return false;
    const now = new Date().toISOString();
    const payload = {
      id: data.id,
      user_id: userId,
      deleted_at: null,
      updated_at: now,
      rev: (data.rev ?? 0) + 1,
    };
    const { data: updated, error: updateError } = await supabase
      .from('transactions')
      .upsert(payload, { onConflict: 'id' })
      .select('id')
      .maybeSingle();
    if (updateError) throw updateError;
    return Boolean(updated?.id);
  } catch (error) {
    throw mapFriendlyError(error, 'Gagal mengurungkan. Silakan refresh.');
  }
}

export async function undoDeleteTransactions(ids: string[]): Promise<number> {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  try {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (!unique.length) return 0;
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('Tidak punya izin. Coba muat ulang sesi.');
    }
    const { data, error } = await supabase
      .from('transactions')
      .select('id, rev')
      .eq('user_id', userId)
      .in('id', unique);
    if (error) throw error;
    if (!data || data.length === 0) return 0;
    const now = new Date().toISOString();
    const payload = data.map((row) => ({
      id: row.id,
      user_id: userId,
      deleted_at: null,
      updated_at: now,
      rev: (row.rev ?? 0) + 1,
    }));
    const { data: updated, error: updateError } = await supabase
      .from('transactions')
      .upsert(payload, { onConflict: 'id' })
      .select('id');
    if (updateError) throw updateError;
    if (!updated) return 0;
    return updated.length;
  } catch (error) {
    throw mapFriendlyError(error, 'Gagal mengurungkan. Silakan refresh.');
  }
}
