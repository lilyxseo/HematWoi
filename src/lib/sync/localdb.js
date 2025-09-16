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

function cloneValue(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch (error) {
      console.warn("structuredClone failed, returning original value", error);
      return value;
    }
  }
  return value;
}

async function runSafely(label, action) {
  try {
    return await action();
  } catch (error) {
    console.error(`[localdb] ${label} failed`, error);
    throw error;
  }
}

export const dbCache = {
  async get(entity, id) {
    const key = cacheKey(entity, id);
    const value = await runSafely(`cache.get ${key}`, () => cache.getItem(key));
    return cloneValue(value);
  },
  async set(entity, record) {
    if (!record || !record.id) return;
    const key = cacheKey(entity, record.id);
    await runSafely(`cache.set ${key}`, () => cache.setItem(key, cloneValue(record)));
  },
  async list(entity) {
    const rows = [];
    await runSafely(`cache.list ${entity}`, () =>
      cache.iterate((value, key) => {
        if (key.startsWith(entity + ":")) rows.push(cloneValue(value));
      })
    );
    return rows;
  },
  async bulkSet(entity, records = []) {
    for (const r of records) await dbCache.set(entity, r);
  },
  async remove(entity, id) {
    const key = cacheKey(entity, id);
    await runSafely(`cache.remove ${key}`, () => cache.removeItem(key));
  },
};

export const oplogStore = {
  async add(op) {
    await runSafely(`oplog.add ${op?.opId ?? "unknown"}`, () =>
      oplog.setItem(op.opId, cloneValue(op))
    );
  },
  async listReady(now) {
    const ops = [];
    await runSafely("oplog.listReady", () =>
      oplog.iterate((value) => {
        if ((value.nextAt || 0) <= now) ops.push(cloneValue(value));
      })
    );
    ops.sort((a, b) => a.ts - b.ts);
    return ops;
  },
  async bulkRemove(ids = []) {
    for (const id of ids) {
      await runSafely(`oplog.remove ${id}`, () => oplog.removeItem(id));
    }
  },
  async markDeferred(id, attempts, nextAt, lastError) {
    const op = await runSafely(`oplog.get ${id}`, () => oplog.getItem(id));
    if (!op) return;
    op.attempts = attempts;
    op.nextAt = nextAt;
    op.lastError = lastError;
    await runSafely(`oplog.update ${id}`, () => oplog.setItem(id, cloneValue(op)));
  },
  async count() {
    let n = 0;
    await runSafely("oplog.count", () =>
      oplog.iterate(() => {
        n += 1;
      })
    );
    return n;
  },
};

export const conflictStore = {
  async add(conflict) {
    await runSafely(`conflicts.add ${conflict?.id ?? "unknown"}`, () =>
      conflicts.setItem(conflict.id, cloneValue(conflict))
    );
  },
};
