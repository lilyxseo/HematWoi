export const BASE = 800;
export const MAX = 15000;
export const JITTER = 400;

export function calcBackoff(attempt, rand = Math.random) {
  return Math.min(BASE * 2 ** attempt, MAX) + Math.floor(rand() * JITTER);
}

export function groupOps(ops = []) {
  const map = new Map();
  for (const op of ops) {
    const key = `${op.entity}:${op.type}`;
    if (!map.has(key)) map.set(key, { entity: op.entity, type: op.type, items: [] });
    map.get(key).items.push(op);
  }
  return Array.from(map.values()).map((g) => {
    g.items.sort((a, b) => a.ts - b.ts);
    return g;
  });
}

export function normalizeRecord(rec) {
  const r = { ...rec };
  if (!r.id) r.id = crypto.randomUUID();
  if (!r.updated_at) r.updated_at = new Date().toISOString();
  return r;
}

export function resolveConflict(server, local, policy = "local") {
  if (policy === "server") return server;
  if (server.rev != null && local.rev != null) {
    return local.rev >= server.rev ? local : server;
  }
  const s = new Date(server.updated_at || 0).getTime();
  const l = new Date(local.updated_at || 0).getTime();
  return l >= s ? local : server;
}
