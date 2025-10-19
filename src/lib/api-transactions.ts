import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getCurrentUserId } from './session';
import {
  listTransactions as legacyListTransactions,
  getCachedTransactions as legacyGetCachedTransactions,
} from './api';

type TransactionRow = Record<string, any>;

type ListTransactionsParams = Record<string, unknown>;

type ListTransactionsResult = {
  rows: TransactionRow[];
  total?: number;
  page?: number;
  pageSize?: number;
};

function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as PostgrestError).code;
    if (typeof code === 'string') {
      return code;
    }
  }
  return undefined;
}

function getErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as PostgrestError).status;
    if (typeof status === 'number') {
      return status;
    }
    if (typeof status === 'string') {
      const parsed = Number.parseInt(status, 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function createFriendlyError(error: unknown, fallback: string): Error {
  const code = getErrorCode(error);
  const status = getErrorStatus(error);

  if (code === '23503') {
    return new Error('Tidak bisa menghapus karena ada data terkait. Coba ulangi.');
  }
  if (code === '42501' || code === 'PGRST301' || status === 401 || status === 403) {
    return new Error('Tidak punya izin. Coba muat ulang sesi.');
  }

  if (error instanceof Error && error.message) {
    return new Error(error.message);
  }
  if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
    return new Error((error as any).message);
  }
  return new Error(fallback);
}

export async function listTransactions(params: ListTransactionsParams = {}): Promise<ListTransactionsResult> {
  const result = await legacyListTransactions(params);
  const rows = Array.isArray(result?.rows)
    ? (result.rows as TransactionRow[]).filter((row) => !row?.deleted_at)
    : [];
  return { ...result, rows };
}

export async function getCachedTransactions(
  params: ListTransactionsParams = {},
): Promise<ListTransactionsResult> {
  const result = await legacyGetCachedTransactions(params);
  const rows = Array.isArray(result?.rows)
    ? (result.rows as TransactionRow[]).filter((row) => !row?.deleted_at)
    : [];
  return { ...result, rows };
}

export async function removeTransaction(id: string): Promise<boolean> {
  if (!id) {
    throw new Error('Gagal menghapus. Cek koneksi lalu coba lagi.');
  }
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Tidak punya izin. Coba muat ulang sesi.');
  }
  try {
    const { data, error } = await supabase.rpc('delete_transaction', { p_id: id });
    if (error) throw error;
    return Boolean(data);
  } catch (error) {
    throw createFriendlyError(error, 'Gagal menghapus. Cek koneksi lalu coba lagi.');
  }
}

export async function removeTransactionsBulk(ids: string[]): Promise<number> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return 0;
  }
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Tidak punya izin. Coba muat ulang sesi.');
  }
  try {
    const { data, error } = await supabase.rpc('delete_transactions_bulk', { p_ids: ids });
    if (error) throw error;
    if (typeof data === 'number') {
      return data;
    }
    if (Array.isArray(data)) {
      return data.length;
    }
    return ids.length;
  } catch (error) {
    throw createFriendlyError(error, 'Gagal menghapus. Cek koneksi lalu coba lagi.');
  }
}

export async function undoDeleteTransaction(id: string): Promise<boolean> {
  if (!id) {
    return false;
  }
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Tidak punya izin. Coba muat ulang sesi.');
  }
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, rev')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new Error('Tidak punya izin. Coba muat ulang sesi.');
    }
    const nextRev = ((data as { rev?: number | null }).rev ?? 0) + 1;
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ deleted_at: null, updated_at: now, rev: nextRev })
      .eq('id', id)
      .eq('user_id', userId);
    if (updateError) throw updateError;
    return true;
  } catch (error) {
    throw createFriendlyError(error, 'Gagal mengurungkan. Silakan refresh.');
  }
}

export async function undoDeleteTransactions(ids: string[]): Promise<number> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return 0;
  }
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Tidak punya izin. Coba muat ulang sesi.');
  }
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, rev')
      .eq('user_id', userId)
      .in('id', ids);
    if (error) throw error;
    if (!data || data.length === 0 || data.length < ids.length) {
      throw new Error('Tidak punya izin. Coba muat ulang sesi.');
    }
    const now = new Date().toISOString();
    await Promise.all(
      data.map(async (row) => {
        const nextRev = ((row as { rev?: number | null }).rev ?? 0) + 1;
        const { error: updateError } = await supabase
          .from('transactions')
          .update({ deleted_at: null, updated_at: now, rev: nextRev })
          .eq('id', row.id)
          .eq('user_id', userId);
        if (updateError) throw updateError;
      }),
    );
    return data.length;
  } catch (error) {
    throw createFriendlyError(error, 'Gagal mengurungkan. Silakan refresh.');
  }
}

