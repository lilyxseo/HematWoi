import {
  type HematWoiTransaction,
  mapTransactionsToSheetPayload,
  type SheetTransactionPayload,
} from '@/lib/syncMapper';

export type SheetSyncPayload = {
  secret: string;
  requestId: string;
  entity: 'transactions';
  items: SheetTransactionPayload[];
};

export type SheetSyncSuccessResponse = {
  ok: true;
  entity: 'transactions';
  appended: number;
  updated: number;
  skipped: number;
};

export type SheetSyncErrorResponse = {
  ok: false;
  error: string;
};

export type SheetSyncResponse = SheetSyncSuccessResponse | SheetSyncErrorResponse;

const buildRequestId = (): string =>
  `trx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export const sendSheetSync = async (
  payload: SheetSyncPayload,
): Promise<SheetSyncSuccessResponse> => {
  const syncUrl = import.meta.env.VITE_HEMATWOI_SYNC_URL;
  if (!syncUrl) {
    throw new Error('Missing VITE_HEMATWOI_SYNC_URL');
  }

  const response = await fetch(syncUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Sheet sync HTTP error: ${response.status}`);
  }

  const json = (await response.json()) as SheetSyncResponse;

  if (!json.ok) {
    throw new Error(json.error || 'Sheet sync failed');
  }

  return json;
};

export const syncTransactionsToSheet = async (
  items: HematWoiTransaction[],
): Promise<SheetSyncSuccessResponse> => {
  if (!items.length) {
    return {
      ok: true,
      entity: 'transactions',
      appended: 0,
      updated: 0,
      skipped: 0,
    };
  }

  const secret = import.meta.env.VITE_HEMATWOI_SYNC_SECRET;
  if (!secret) {
    throw new Error('Missing VITE_HEMATWOI_SYNC_SECRET');
  }

  return sendSheetSync({
    secret,
    requestId: buildRequestId(),
    entity: 'transactions',
    items: mapTransactionsToSheetPayload(items),
  });
};
