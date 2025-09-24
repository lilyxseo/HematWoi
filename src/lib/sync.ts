import type { SupabaseClient } from '@supabase/supabase-js';
import { idbGetAll, idbPut, idbStores } from './idb';

const SYNC_FLAG_PREFIX = 'hw:guestSynced:';
const CHUNK_SIZE = 500;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function ensureClientId(value: Record<string, any>) {
  if (value.client_id) return value.client_id;
  const id = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  value.client_id = id;
  if (!value.id) value.id = id;
  return id;
}

function normalizePayload(value: Record<string, any>, uid: string) {
  const clientId = ensureClientId(value);
  const updatedAt = value.updated_at ?? new Date().toISOString();
  return {
    ...value,
    user_id: uid,
    client_id: clientId,
    updated_at: updatedAt,
  };
}

async function upsertChunk(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, any>[],
): Promise<void> {
  if (!rows.length) return;
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: 'user_id,client_id' })
    .select('client_id');
  if (error) throw error;
}

export async function syncGuestToCloud(supabase: SupabaseClient, uid: string) {
  const stores = idbStores();
  for (const store of stores) {
    const records = await idbGetAll(store as any);
    if (!records.length) continue;
    const payloads = await Promise.all(
      records.map(async (row) => {
        const normalized = normalizePayload({ ...row }, uid);
        // ensure local copy has identifiers for future syncs
        await idbPut(store as any, normalized);
        return normalized;
      }),
    );

    const batches = chunkArray(payloads, CHUNK_SIZE);
    for (const batch of batches) {
      try {
        await upsertChunk(supabase, store, batch);
      } catch (err) {
        console.error(`[sync] Failed to sync ${store}`, err);
        throw err;
      }
    }
  }

  try {
    globalThis.localStorage?.setItem(
      `${SYNC_FLAG_PREFIX}${uid}`,
      new Date().toISOString(),
    );
  } catch (err) {
    console.warn('[sync] Failed to persist sync flag', err);
  }
}

export function getGuestSyncTimestamp(uid: string): string | null {
  try {
    return globalThis.localStorage?.getItem(`${SYNC_FLAG_PREFIX}${uid}`) ?? null;
  } catch {
    return null;
  }
}

