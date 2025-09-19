import { supabase } from "../supabase";
import { getCurrentUserId } from "../session";
import { dbCache, oplogStore } from "./localdb";
import { processStoragePutBatch } from "./attachments";
import { calcBackoff, groupOps, normalizeRecord } from "./utils";

export const SYNC_INTERVAL_MS = 20000;
export const SYNC_BATCH_SIZE = 100;
export const MAX_RETRY_ATTEMPTS = 5;

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

const TRANSACTION_COLUMNS = new Set([
  "id",
  "user_id",
  "date",
  "type",
  "amount",
  "title",
  "notes",
  "account_id",
  "to_account_id",
  "category_id",
  "merchant_id",
  "parent_id",
  "transfer_group_id",
  "receipt_url",
  "deleted_at",
  "updated_at",
  "rev",
]);

const TRANSACTION_KEY_ALIASES = {
  note: "notes",
  notes: "notes",
  title: "title",
  account: "account_id",
  userId: "user_id",
  accountId: "account_id",
  toAccount: "to_account_id",
  toAccountId: "to_account_id",
  category: "category_id",
  categoryId: "category_id",
  merchant: "merchant_id",
  merchantId: "merchant_id",
  parentId: "parent_id",
  transferGroupId: "transfer_group_id",
  receiptUrl: "receipt_url",
  updatedAt: "updated_at",
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VALID_TRANSACTION_TYPES = new Set(["expense", "income", "transfer"]);
const VALID_CATEGORY_TYPES = new Set(["income", "expense"]);

const CATEGORY_SELECT_COLUMNS = undefined;

const TRANSACTION_UUID_FIELDS = [
  "id",
  "user_id",
  "account_id",
  "to_account_id",
  "category_id",
  "merchant_id",
  "parent_id",
  "transfer_group_id",
];

const SPLIT_FLAG_KEYS = [
  "is_split_child",
  "isSplitChild",
  "split_child",
  "splitChild",
];

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function extractUuidCandidate(value) {
  if (value == null) return null;
  if (typeof value === "object") {
    if (typeof value.id === "string") return extractUuidCandidate(value.id);
    if (typeof value.value === "string") return extractUuidCandidate(value.value);
    return null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return UUID_REGEX.test(trimmed) ? trimmed : null;
}

function toNullableUuid(value) {
  return extractUuidCandidate(value);
}

function toNullableText(value) {
  if (value == null) return null;
  const str = String(value);
  const trimmed = str.trim();
  return trimmed ? trimmed : null;
}

function toAmount(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }
  if (typeof value === "string") {
    const normalized = value.replace(/[\s,]/g, "");
    const parsed = Number.parseFloat(normalized);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }
  return 0;
}

function toIsoDate(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return new Date().toISOString();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function toTimestamp(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return null;
}

function toInteger(value) {
  if (value == null || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toBooleanFlag(value) {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return Boolean(value);
}

const errorListeners = new Set();

const reportedInvalidTransactionColumns = new Set();

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

function sanitizeTransaction(record = {}) {
  const normalized = {};
  const invalidColumns = new Set();
  for (const [rawKey, value] of Object.entries(record || {})) {
    if (value === undefined) continue;
    const key = TRANSACTION_KEY_ALIASES[rawKey] ?? rawKey;
    if (!TRANSACTION_COLUMNS.has(key)) {
      invalidColumns.add(rawKey);
      continue;
    }
    if (!hasOwn(normalized, key)) normalized[key] = value;
  }
  if (invalidColumns.size > 0) {
    const unseen = [...invalidColumns].filter(
      (column) => !reportedInvalidTransactionColumns.has(column)
    );
    unseen.forEach((column) => reportedInvalidTransactionColumns.add(column));
    if (unseen.length > 0) {
      const message = `Payload transaksi memiliki kolom tidak dikenal: ${unseen.join(
        ", "
      )}`;
      emitError(new Error(message), { entity: "transactions", stage: "sanitize" });
    }
  }

  const sanitized = {};

  for (const field of TRANSACTION_UUID_FIELDS) {
    if (hasOwn(normalized, field)) {
      const value = toNullableUuid(normalized[field]);
      sanitized[field] = value ?? null;
    }
  }

  let type = hasOwn(normalized, "type") ? String(normalized.type ?? "").toLowerCase() : "";
  if (!VALID_TRANSACTION_TYPES.has(type)) type = "expense";
  sanitized.type = type;

  sanitized.amount = toAmount(normalized.amount);
  sanitized.date = toIsoDate(normalized.date);

  if (hasOwn(normalized, "title")) sanitized.title = toNullableText(normalized.title);
  if (hasOwn(normalized, "notes")) sanitized.notes = toNullableText(normalized.notes);

  if (hasOwn(normalized, "receipt_url")) {
    sanitized.receipt_url = toNullableText(normalized.receipt_url);
  }

  if (hasOwn(normalized, "deleted_at")) {
    sanitized.deleted_at = toTimestamp(normalized.deleted_at);
  }

  if (hasOwn(normalized, "updated_at")) {
    sanitized.updated_at = toTimestamp(normalized.updated_at) ?? new Date().toISOString();
  }

  if (hasOwn(normalized, "rev")) {
    sanitized.rev = toInteger(normalized.rev);
  }

  const parentId = toNullableUuid(normalized.parent_id);
  const hasSplitFlag = SPLIT_FLAG_KEYS.some((key) => toBooleanFlag(record?.[key]));
  const isSplitChild = parentId != null || hasSplitFlag;
  if (hasOwn(normalized, "parent_id") || isSplitChild) {
    sanitized.parent_id = isSplitChild ? parentId : null;
  }

  if (sanitized.type !== "transfer") {
    if (hasOwn(normalized, "to_account_id") || hasOwn(sanitized, "to_account_id")) {
      sanitized.to_account_id = null;
    }
    if (hasOwn(normalized, "transfer_group_id") || hasOwn(sanitized, "transfer_group_id")) {
      sanitized.transfer_group_id = null;
    }
  } else {
    if (hasOwn(normalized, "to_account_id")) {
      sanitized.to_account_id = toNullableUuid(normalized.to_account_id);
    }
    if (hasOwn(normalized, "transfer_group_id")) {
      sanitized.transfer_group_id = toNullableUuid(normalized.transfer_group_id);
    }
  }

  return sanitized;
}

function sanitizeCategory(record = {}) {
  const sanitized = {};

  const id = toNullableUuid(record.id);
  if (id) sanitized.id = id;
  else if (hasOwn(record, "id")) sanitized.id = null;

  const userId = toNullableUuid(record.user_id);
  if (userId) sanitized.user_id = userId;
  else if (hasOwn(record, "user_id")) sanitized.user_id = null;

  let type = typeof record.type === "string" ? record.type.trim().toLowerCase() : "";
  if (!VALID_CATEGORY_TYPES.has(type)) type = "expense";
  sanitized.type = type;

  const rawName = record?.name;
  const name =
    rawName == null
      ? ""
      : typeof rawName === "string"
      ? rawName.trim()
      : String(rawName).trim();
  sanitized.name = name;

  if (hasOwn(record, "order_index")) {
    const value = record.order_index;
    let parsed = null;
    if (typeof value === "number" && Number.isFinite(value)) {
      parsed = value;
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        const n = Number.parseInt(trimmed, 10);
        if (Number.isFinite(n)) parsed = n;
      }
    }
    sanitized.order_index = parsed;
  }

  if (hasOwn(record, "group")) {
    sanitized.group = toNullableText(record.group);
  }

  if (hasOwn(record, "inserted_at")) {
    sanitized.inserted_at = toTimestamp(record.inserted_at);
  }

  console.debug("[SyncEngine] Sanitized category payload:", {
    before: record,
    after: sanitized,
  });

  return sanitized;
}

function sanitizePayload(entity, record) {
  if (entity === "transactions") {
    return sanitizeTransaction(record);
  }
  if (entity === "categories") {
    return sanitizeCategory(record);
  }
  return record;
}

function sanitizeForSupabase(entity, record) {
  const sanitized = sanitizePayload(entity, record);
  let finalRecord = sanitized;
  if (sanitized !== record) {
    finalRecord = {};
    for (const [key, value] of Object.entries(sanitized)) {
      if (value !== undefined) finalRecord[key] = value;
    }
  }
  if (entity === "transactions") {
    console.debug("[SyncEngine] Sanitized transaction payload:", {
      before: record,
      after: finalRecord,
    });
  }
  return finalRecord;
}

function getSelectColumns(entity) {
  if (entity === "categories") return CATEGORY_SELECT_COLUMNS;
  return undefined;
}

function handleSyncError(error, context = {}) {
  if (!error) return;
  if (error?.message === "offline") return;
  const message =
    context?.entity === "categories"
      ? "Sync categories gagal. Lihat konsol untuk detail."
      : "Sync gagal. Lihat konsol untuk detail.";
  const friendlyError = new Error(message);
  if (error instanceof Error) {
    friendlyError.cause = error;
  }
  console.error("Sync error", { context, error });
  emitError(friendlyError, context);
}

function logUpsertPayload(entity, payload) {
  const items = Array.isArray(payload) ? payload : [payload];
  console.debug(
    `[SyncEngine] Upserting ${items.length} ${entity} record${items.length > 1 ? "s" : ""}`,
    items
  );
}

async function sendOp(op) {
  if (op.type === "UPSERT") {
    const basePayload = op.meta?.normalized ? op.payload : normalizeRecord(op.payload);
    const payload = sanitizeForSupabase(op.entity, basePayload);
    logUpsertPayload(op.entity, payload);
    const query = supabase.from(op.entity).upsert([payload], { onConflict: "id" });
    const selectColumns = getSelectColumns(op.entity);
    const { data, error, status, statusText } = selectColumns
      ? await query.select(selectColumns)
      : await query;
    if (error) {
      console.error("[SyncEngine] Supabase upsert error", {
        entity: op.entity,
        status,
        statusText,
        error,
      });
      throw error;
    }
    if (selectColumns && Array.isArray(data) && data.length > 0) {
      await dbCache.bulkSet(op.entity, data);
    } else {
      await dbCache.set(op.entity, payload);
    }
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
            return sanitizeForSupabase(g.entity, base);
          });
          logUpsertPayload(g.entity, payloads);
          const query = supabase.from(g.entity).upsert(payloads, { onConflict: "id" });
          const selectColumns = getSelectColumns(g.entity);
          const { data, error, status, statusText } = selectColumns
            ? await query.select(selectColumns)
            : await query;
          if (error) {
            console.error("[SyncEngine] Supabase upsert error", {
              entity: g.entity,
              status,
              statusText,
              error,
            });
            throw error;
          }
          if (selectColumns && Array.isArray(data) && data.length > 0) {
            await dbCache.bulkSet(g.entity, data);
          } else {
            await dbCache.bulkSet(g.entity, payloads);
          }
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
          if (attempt >= MAX_RETRY_ATTEMPTS) {
            console.error("[SyncEngine] Max retry reached, dropping op", {
              opId: o.opId,
              entity: g.entity,
              type: g.type,
              attempts: attempt,
              error,
            });
            await oplogStore.bulkRemove([o.opId]);
            continue;
          }
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
