import { supabase } from "../supabase";
import * as db from "./localdb";
import { calcBackoff, normalize } from "./utils.js";
export { calcBackoff, normalize } from "./utils.js";

class SyncEngine {
  constructor() {
    this.maxRetries = 5;
    this.listeners = new Set();
    this.syncing = false;
  }

  onStatus(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _notify(status) {
    this.syncing = status === "syncing";
    this.listeners.forEach((fn) => fn(status));
  }

  async enqueueOrRun(entity, type, payload) {
    const record = normalize(entity, payload);
    try {
      if (!navigator.onLine) throw new Error("offline");
      await this._apply(entity, type, record);
      await this._applyCache(entity, type, record);
      return { synced: true, record };
    } catch {
      const op = {
        opId: crypto.randomUUID(),
        entity,
        type,
        payload: record,
        ts: Date.now(),
      };
      await db.enqueue(op);
      await this._applyCache(entity, type, record);
      return { queued: true, record };
    }
  }

  async _apply(entity, type, record) {
    if (type === "UPSERT") {
      const { data: existing } = await supabase
        .from(entity)
        .select("rev")
        .eq("id", record.id)
        .single();
      if (existing && existing.rev > record.rev) {
        await db.logConflict({
          entity,
          id: record.id,
          localRev: record.rev,
          serverRev: existing.rev,
        });
      }
      const { error } = await supabase
        .from(entity)
        .upsert(record, { onConflict: "id" });
      if (error) throw error;
    } else {
      const { error } = await supabase.from(entity).delete().eq("id", record.id);
      if (error) throw error;
    }
  }

  async _applyCache(entity, type, record) {
    const cache = await db.getCache(entity);
    const idx = cache.findIndex((r) => r.id === record.id);
    if (type === "UPSERT") {
      if (idx >= 0) cache[idx] = { ...cache[idx], ...record };
      else cache.push(record);
    } else if (idx >= 0) {
      cache.splice(idx, 1);
    }
    await db.setCache(entity, cache);
  }

  async refreshEntityCache(entity) {
    if (!navigator.onLine) return;
    const { data, error } = await supabase.from(entity).select("*");
    if (error) throw error;
    await db.setCache(entity, data || []);
  }

  async flushQueue() {
    if (this.syncing) return;
    const queue = await db.getQueue();
    if (!queue.length) return;
    this._notify("syncing");
    const remaining = [];
    for (const op of queue) {
      const ok = await this._runWithRetry(op);
      if (!ok) remaining.push(op);
    }
    await db.setQueue(remaining);
    const processed = new Set(
      queue.filter((op) => !remaining.includes(op)).map((op) => op.entity)
    );
    for (const e of processed) {
      await this.refreshEntityCache(e);
    }
    this._notify("idle");
  }

  async _runWithRetry(op) {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        await this._apply(op.entity, op.type, op.payload);
        return true;
      } catch (err) {
        if (attempt === this.maxRetries - 1) {
          await db.logConflict({ op, error: err.message });
          return false;
        }
        await new Promise((res) => setTimeout(res, calcBackoff(attempt)));
      }
    }
  }
}

const engine = new SyncEngine();
export default engine;
export { SyncEngine };
