import { supabase } from '@/lib/supabase';
import type { HematWoiTransaction } from '@/lib/syncMapper';

const TRANSACTION_SYNC_SELECT = `
  id,
  user_id,
  date,
  month_key,
  type,
  category_id,
  category_name,
  account_id,
  account_name,
  amount,
  note,
  currency,
  status,
  created_at,
  updated_at,
  deleted_at,
  source,
  version,
  sheet_sync_status,
  sheet_last_synced_at,
  sheet_sync_error
`;

const ensureData = <T>(data: T[] | null, error: { message: string } | null): T[] => {
  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
};

export const getPendingTransactionsForSheetSync = async (
  limit = 20,
): Promise<HematWoiTransaction[]> => {
  const { data, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_SYNC_SELECT)
    .eq('sheet_sync_status', 'pending')
    .order('updated_at', { ascending: true })
    .limit(limit);

  return ensureData<HematWoiTransaction>(data, error);
};

export const getFailedTransactionsForSheetSync = async (
  limit = 20,
): Promise<HematWoiTransaction[]> => {
  const { data, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_SYNC_SELECT)
    .eq('sheet_sync_status', 'failed')
    .order('updated_at', { ascending: true })
    .limit(limit);

  return ensureData<HematWoiTransaction>(data, error);
};

export const markTransactionsSheetSynced = async (ids: string[]): Promise<void> => {
  if (!ids.length) return;

  const { error } = await supabase
    .from('transactions')
    .update({
      sheet_sync_status: 'synced',
      sheet_last_synced_at: new Date().toISOString(),
      sheet_sync_error: null,
    })
    .in('id', ids);

  if (error) {
    throw new Error(error.message);
  }
};

export const markTransactionsSheetFailed = async (
  ids: string[],
  errorMessage: string,
): Promise<void> => {
  if (!ids.length) return;

  const { error } = await supabase
    .from('transactions')
    .update({
      sheet_sync_status: 'failed',
      sheet_sync_error: errorMessage,
    })
    .in('id', ids);

  if (error) {
    throw new Error(error.message);
  }
};

export const markTransactionPendingSync = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('transactions')
    .update({
      sheet_sync_status: 'pending',
      sheet_sync_error: null,
    })
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
};
