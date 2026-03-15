import {
  getFailedTransactionsForSheetSync,
  getPendingTransactionsForSheetSync,
  markTransactionsSheetFailed,
  markTransactionsSheetSynced,
} from '@/lib/supabaseSheetSync';
import { syncTransactionsToSheet } from '@/services/sheetSync';

const MAX_BATCH_SIZE = 20;
const DEBOUNCE_MS = 2500;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncRunning = false;

const parseErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return 'Unknown sheet sync error';
};

const runBatchSync = async (
  ids: string[],
  runner: () => Promise<void>,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await runner();
    await markTransactionsSheetSynced(ids);
    return { ok: true };
  } catch (error) {
    const errorMessage = parseErrorMessage(error);
    await markTransactionsSheetFailed(ids, errorMessage);
    return { ok: false, error: errorMessage };
  }
};

export const syncPendingTransactions = async (): Promise<void> => {
  if (isSyncRunning) return;
  isSyncRunning = true;

  try {
    const pending = await getPendingTransactionsForSheetSync(MAX_BATCH_SIZE);
    if (!pending.length) return;

    const ids = pending.map((item) => item.id);
    await runBatchSync(ids, async () => {
      await syncTransactionsToSheet(pending);
    });
  } finally {
    isSyncRunning = false;
  }
};

export const retryFailedSheetSync = async (): Promise<void> => {
  if (isSyncRunning) return;
  isSyncRunning = true;

  try {
    const failed = await getFailedTransactionsForSheetSync(MAX_BATCH_SIZE);
    if (!failed.length) return;

    const ids = failed.map((item) => item.id);
    await runBatchSync(ids, async () => {
      await syncTransactionsToSheet(failed);
    });
  } finally {
    isSyncRunning = false;
  }
};

export const scheduleSheetSync = (): void => {
  if (syncTimer) {
    clearTimeout(syncTimer);
  }

  syncTimer = setTimeout(() => {
    syncTimer = null;

    void syncPendingTransactions().catch((error) => {
      // Sync should never crash UI lifecycle.
      console.error('[sheet-sync] background sync failed', error);
    });
  }, DEBOUNCE_MS);
};
