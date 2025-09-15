import localforage from "localforage";

// Cache per entity
const cache = localforage.createInstance({ name: "hw-cache" });
// Operation log (outbox)
const oplog = localforage.createInstance({ name: "hw-oplog" });
// Conflict log for auditing
const conflicts = localforage.createInstance({ name: "hw-conflicts" });

function cacheKey(entity, id) {
  return `${entity}:${id}`;
}

export const dbCache = {
  async get(entity, id) {
    return cache.getItem(cacheKey(entity, id));
  },
  async set(entity, record) {
    if (!record || !record.id) return;
    await cache.setItem(cacheKey(entity, record.id), record);
  },
  async list(entity) {
    const rows = [];
    await cache.iterate((value, key) => {
      if (key.startsWith(entity + ":")) rows.push(value);
    });
    return rows;
  },
  async bulkSet(entity, records = []) {
    for (const r of records) await dbCache.set(entity, r);
  },
  async remove(entity, id) {
    await cache.removeItem(cacheKey(entity, id));
  },
};

export const oplogStore = {
  async add(op) {
    await oplog.setItem(op.opId, op);
  },
  async listReady(now) {
    const ops = [];
    await oplog.iterate((value) => {
      if ((value.nextAt || 0) <= now) ops.push(value);
    });
    ops.sort((a, b) => a.ts - b.ts);
    return ops;
  },
  async bulkRemove(ids = []) {
    for (const id of ids) await oplog.removeItem(id);
  },
  async markDeferred(id, attempts, nextAt, lastError) {
    const op = await oplog.getItem(id);
    if (!op) return;
    op.attempts = attempts;
    op.nextAt = nextAt;
    op.lastError = lastError;
    await oplog.setItem(id, op);
  },
  async count() {
    let n = 0;
    await oplog.iterate(() => {
      n += 1;
    });
    return n;
  },
};

export const conflictStore = {
  async add(conflict) {
    await conflicts.setItem(conflict.id, conflict);
  },
};
