import localforage from "localforage";

const cache = localforage.createInstance({
  name: "hw-sync",
  storeName: "cache",
});

const oplog = localforage.createInstance({
  name: "hw-sync",
  storeName: "oplog",
});

const conflicts = localforage.createInstance({
  name: "hw-sync",
  storeName: "conflicts",
});

export async function getCache(entity) {
  return (await cache.getItem(entity)) || [];
}

export async function setCache(entity, rows) {
  await cache.setItem(entity, rows);
}

export async function enqueue(op) {
  const q = (await oplog.getItem("queue")) || [];
  q.push(op);
  await oplog.setItem("queue", q);
}

export async function getQueue() {
  return (await oplog.getItem("queue")) || [];
}

export async function setQueue(q) {
  await oplog.setItem("queue", q);
}

export async function logConflict(c) {
  const list = (await conflicts.getItem("list")) || [];
  list.push(c);
  await conflicts.setItem("list", list);
}

export async function clearAll() {
  await cache.clear();
  await oplog.clear();
  await conflicts.clear();
}

