export type SheetSyncStatus = 'pending' | 'synced' | 'failed';

export type HematWoiTransaction = {
  id: string;
  user_id: string;
  date: string;
  month_key?: string | null;
  type: string;
  category_id?: string | null;
  category_name?: string | null;
  account_id?: string | null;
  account_name?: string | null;
  amount: number;
  note?: string | null;
  currency?: string | null;
  status?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  source?: string | null;
  version?: number | null;
  sheet_sync_status?: SheetSyncStatus | null;
  sheet_last_synced_at?: string | null;
  sheet_sync_error?: string | null;
};

export type SheetTransactionPayload = {
  id: string;
  user_id: string;
  date: string;
  month_key: string;
  type: string;
  category_id: string;
  category_name: string;
  account_id: string;
  account_name: string;
  amount: number;
  note: string;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  source: string;
  version: number;
};

const DEFAULT_SOURCE = 'hematwoi-web';
const DEFAULT_CURRENCY = 'IDR';
const DEFAULT_STATUS = 'active';

const toDate = (value: string): Date => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid transaction date: ${value}`);
  }

  return parsed;
};

export const buildMonthKey = (date: string): string => {
  const parsed = toDate(date);
  const year = parsed.getUTCFullYear();
  const month = `${parsed.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
};

export const normalizeTransactionForSheet = (
  transaction: HematWoiTransaction,
): SheetTransactionPayload => ({
  id: transaction.id,
  user_id: transaction.user_id,
  date: transaction.date,
  month_key: transaction.month_key?.trim() || buildMonthKey(transaction.date),
  type: transaction.type,
  category_id: transaction.category_id ?? '',
  category_name: transaction.category_name ?? '',
  account_id: transaction.account_id ?? '',
  account_name: transaction.account_name ?? '',
  amount: transaction.amount,
  note: transaction.note ?? '',
  currency: transaction.currency ?? DEFAULT_CURRENCY,
  status: transaction.status ?? DEFAULT_STATUS,
  created_at: transaction.created_at,
  updated_at: transaction.updated_at,
  deleted_at: transaction.deleted_at ?? null,
  source: transaction.source ?? DEFAULT_SOURCE,
  version: transaction.version ?? 1,
});

export const mapTransactionsToSheetPayload = (
  transactions: HematWoiTransaction[],
): SheetTransactionPayload[] =>
  transactions.map((transaction) => normalizeTransactionForSheet(transaction));
