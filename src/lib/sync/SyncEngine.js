import { supabase } from "../supabase";
import { getCurrentUserId } from "../session";
import { dbCache, oplogStore } from "./localdb";
import { processStoragePutBatch } from "./attachments";
import { calcBackoff, groupOps, normalizeRecord } from "./utils";

export const SYNC_INTERVAL_MS = 20000;
export const SYNC_BATCH_SIZE = 100;

export const SyncStatus = {
  OFFLINE: "OFFLINE",
  IDLE: "IDLE",
  SYNCING: "SYNCING",
};

let status = navigator.onLine ? SyncStatus.IDLE : SyncStatus.OFFLINE;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn(status));
}

function setStatus(s) {
  status = s;
  emit();
}

export function onStatusChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getOrCreateClientTag() {
  let tag = localStorage.getItem("hw:clientTag");
  if (!tag) {
    tag = crypto.randomUUID();
    localStorage.setItem("hw:clientTag", tag);
  }
  return tag;
}

const clientTag = getOrCreateClientTag();

const USER_SCOPED_TABLES = new Set([
  "transactions",
  "categories",
  "budgets",
  "subscriptions",
  "goals",
  "challenges",
  "transaction_tags",
  "receipts",
  "accounts",
  "merchants",
  "tags",
]);

function requiresUserContext(entity) {
  return USER_SCOPED_TABLES.has(entity);
}

async function sendOp(op) {
  if (op.type === "UPSERT") {
    const payload = op.meta?.normalized ? op.payload : normalizeRecord(op.payload);
    const onConflict = op.meta?.onConflict || "id";
    const { error } = await supabase.from(op.entity).upsert([payload], { onConflict });
    if (error) throw error;
    await dbCache.set(op.entity, payload);
  } else if (op.type === "DELETE") {
    const { error } = await supabase.from(op.entity).delete().eq("id", op.payload.id);
    if (error) throw error;
    await dbCache.remove(op.entity, op.payload.id);
  } else if (op.type === "STORAGE_PUT") {
    await processStoragePutBatch([op]);
  }
}

async function tryImmediate(op) {
  if (!navigator.onLine || window.__sync?.fakeOffline) throw new Error("offline");
  await sendOp(op);
}

export async function upsert(entity, record) {
  const payload = { ...record };
  if (requiresUserContext(entity)) {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error("Pengguna belum masuk");
    if (!payload.user_id) payload.user_id = userId;
  }
  const normalized = normalizeRecord(payload);
  const op = {
    opId: crypto.randomUUID(),
    entity,
    type: "UPSERT",
    payload: normalized,
    attempts: 0,
    nextAt: 0,
    ts: Date.now(),
    clientTag,
    meta: { normalized: true },
  };
  try {
    await tryImmediate(op);
  } catch {
    await dbCache.set(entity, normalized); // optimistic
    await oplogStore.add(op);
    setStatus(SyncStatus.OFFLINE);
  }
  return normalized;
}

export async function remove(entity, id) {
  const op = {
    opId: crypto.randomUUID(),
    entity,
    type: "DELETE",
    payload: { id },
    attempts: 0,
    nextAt: 0,
    ts: Date.now(),
    clientTag,
  };
  try {
    await tryImmediate(op);
  } catch {
    await dbCache.remove(entity, id);
    await oplogStore.add(op);
    setStatus(SyncStatus.OFFLINE);
  }
}

export async function flushQueue({ batchSize = SYNC_BATCH_SIZE } = {}) {
  if (!navigator.onLine || window.__sync?.fakeOffline) return;
  setStatus(SyncStatus.SYNCING);
  const now = Date.now();
  const ops = await oplogStore.listReady(now);
  if (ops.length === 0) {
    setStatus(SyncStatus.IDLE);
    return;
  }
  const groups = groupOps(ops);
  for (const g of groups) {
    const slice = g.items.slice(0, batchSize);
    try {
      if (g.type === "UPSERT") {
        const payloads = slice.map((o) =>
          o.meta?.normalized ? o.payload : normalizeRecord(o.payload)
        );
        const onConflict = slice[0]?.meta?.onConflict || "id";
        const { error } = await supabase
          .from(g.entity)
          .upsert(payloads, { onConflict });
        if (error) throw error;
        await dbCache.bulkSet(g.entity, payloads);
      } else if (g.type === "DELETE") {
        const ids = slice.map((o) => o.payload.id);
        const { error } = await supabase.from(g.entity).delete().in("id", ids);
        if (error) throw error;
        for (const id of ids) await dbCache.remove(g.entity, id);
      } else if (g.type === "STORAGE_PUT") {
        await processStoragePutBatch(slice);
      }
      await oplogStore.bulkRemove(slice.map((o) => o.opId));
    } catch (e) {
      for (const o of slice) {
        const attempt = (o.attempts || 0) + 1;
        const delay = calcBackoff(attempt);
        await oplogStore.markDeferred(
          o.opId,
          attempt,
          Date.now() + delay,
          String(e.message || e)
        );
      }
      break;
    }
    if (!navigator.onLine || window.__sync?.fakeOffline) break;
  }
  const remaining = await oplogStore.count();
  setStatus(remaining > 0 ? SyncStatus.SYNCING : SyncStatus.IDLE);
}

export async function pending() {
  return oplogStore.count();
}

export function wireRealtime() {
  ["transactions", "categories"].forEach((table) => {
    supabase
      .channel(`rt:${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, async (payload) => {
        const rec = payload.new || payload.record;
        if (!rec) return;
        await dbCache.set(table, rec);
        emit();
      })
      .subscribe();
  });
}

export function initSyncEngine() {
  window.addEventListener("online", () => {
    setStatus(SyncStatus.IDLE);
    flushQueue();
  });
  window.addEventListener("offline", () => setStatus(SyncStatus.OFFLINE));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") flushQueue();
  });
  setInterval(() => flushQueue(), SYNC_INTERVAL_MS);
  wireRealtime();
  emit();
}
