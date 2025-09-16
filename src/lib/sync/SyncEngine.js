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

const TRANSACTION_COLUMNS = [
  "id",
  "user_id",
  "date",
  "type",
  "category_id",
  "account_id",
  "to_account_id",
  "merchant_id",
  "note",
  "amount",
  "receipt_url",
  "parent_id",
  "transfer_group_id",
  "deleted_at",
  "updated_at",
  "rev",
];

const errorListeners = new Set();

function requiresUserContext(entity) {
  return USER_SCOPED_TABLES.has(entity);
}

function emitError(error, context = {}) {
  for (const listener of errorListeners) {
    try {
      listener(error, context);
    } catch (listenerError) {
      console.error("Sync error listener failed", listenerError);
    }
  }
}

export function onError(fn) {
  errorListeners.add(fn);
  return () => errorListeners.delete(fn);
}

function sanitizeTransaction(record) {
  const cleaned = {};
  for (const key of TRANSACTION_COLUMNS) {
    if (record[key] !== undefined) cleaned[key] = record[key];
  }
  return cleaned;
}

function sanitizePayload(entity, record) {
  if (entity === "transactions") {
    return sanitizeTransaction(record);
  }
  return record;
}

function sanitizeForSupabase(entity, record) {
  const sanitized = sanitizePayload(entity, record);
  if (sanitized === record) return sanitized;
  const withoutNullish = {};
  for (const [key, value] of Object.entries(sanitized)) {
    if (value !== undefined) withoutNullish[key] = value;
  }
  return withoutNullish;
}

function handleSyncError(error, context = {}) {
  if (!error) return;
  if (error?.message === "offline") return;
  console.error("Sync error", { context, error });
  emitError(error, context);
}

async function sendOp(op) {
  if (op.type === "UPSERT") {
    const basePayload = op.meta?.normalized ? op.payload : normalizeRecord(op.payload);
    const payload = sanitizeForSupabase(op.entity, basePayload);
    if (op.entity === "transactions") {
      console.log("Syncing transaction payload:", payload);
    }
    const options = {};
    if (op.entity === "transactions") options.onConflict = "id";
    else if (op.meta?.onConflict) options.onConflict = op.meta.onConflict;
    const { error } = await supabase
      .from(op.entity)
      .upsert([payload], Object.keys(options).length ? options : undefined);
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
  const sanitized = sanitizeForSupabase(entity, payload);
  const normalized = normalizeRecord(sanitized);
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
  } catch (error) {
    handleSyncError(error, { entity, opId: op.opId, stage: "immediate" });
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
  try {
    const now = Date.now();
    const ops = await oplogStore.listReady(now);
    if (ops.length === 0) return;
    const groups = groupOps(ops);
    for (const g of groups) {
      const slice = g.items.slice(0, batchSize);
      try {
        if (g.type === "UPSERT") {
          const payloads = slice.map((o) => {
            const base = o.meta?.normalized ? o.payload : normalizeRecord(o.payload);
            const payload = sanitizeForSupabase(g.entity, base);
            if (g.entity === "transactions") {
              console.log("Syncing transaction payload:", payload);
            }
            return payload;
          });
          const options = {};
          if (g.entity === "transactions") options.onConflict = "id";
          else if (slice[0]?.meta?.onConflict) options.onConflict = slice[0].meta.onConflict;
          const { error } = await supabase
            .from(g.entity)
            .upsert(payloads, Object.keys(options).length ? options : undefined);
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
      } catch (error) {
        handleSyncError(error, { entity: g.entity, type: g.type });
        for (const o of slice) {
          const attempt = (o.attempts || 0) + 1;
          const delay = calcBackoff(attempt);
          await oplogStore.markDeferred(
            o.opId,
            attempt,
            Date.now() + delay,
            String(error?.message || error)
          );
        }
        break;
      }
      if (!navigator.onLine || window.__sync?.fakeOffline) break;
    }
  } catch (error) {
    handleSyncError(error, { stage: "flushQueue" });
  } finally {
    const remaining = await oplogStore.count();
    const nextStatus = remaining > 0 ? SyncStatus.SYNCING : SyncStatus.IDLE;
    setStatus(nextStatus);
  }
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
