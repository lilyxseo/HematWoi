import { createTransactionCloud, listTransactionsGuest, markImported } from './data';
import { clearImported, type GuestTx } from './guestStore';

export type SyncResult = { synced: number; failed: number };

export async function syncGuestTransactionsToCloud(uid: string): Promise<SyncResult> {
  if (!uid) {
    return { synced: 0, failed: 0 };
  }
  const rows = await listTransactionsGuest();
  const pending = rows.filter((item) => !item.imported);
  if (pending.length === 0) {
    return { synced: 0, failed: 0 };
  }

  const successIds: string[] = [];
  let failed = 0;

  for (const tx of pending) {
    try {
      await createTransactionCloud(uid, mapGuestToCloudPayload(tx));
      successIds.push(tx.gid);
    } catch (error) {
      console.error('[syncSimple] Failed to sync transaction', error);
      failed += 1;
    }
  }

  if (successIds.length > 0) {
    markImported(successIds);
    clearImported();
  }

  return { synced: successIds.length, failed };
}

function mapGuestToCloudPayload(tx: GuestTx) {
  return {
    amount: Number(tx.amount) || 0,
    date: tx.date,
    type: tx.type === 'income' ? 'income' : 'expense',
    category_id: tx.category_id ?? null,
    note: tx.note ?? null,
  } as const;
}
