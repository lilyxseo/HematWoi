const DB_NAME = 'hematwoi';
const DB_VERSION = 1;
const STORES = [
  'transactions',
  'categories',
  'accounts',
  'budgets',
  'goals',
  'debts',
  'subscriptions',
  'tags',
];

type StoreName = (typeof STORES)[number];

type StoreValue = Record<string, any> & { client_id: string };

let dbPromise: Promise<IDBDatabase | null> | null = null;
let fallback = false;

function openDatabase(): Promise<IDBDatabase | null> {
  if (fallback) return Promise.resolve(null);
  if (!('indexedDB' in globalThis)) {
    fallback = true;
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          STORES.forEach((name) => {
            if (!db.objectStoreNames.contains(name)) {
              db.createObjectStore(name, { keyPath: 'client_id' });
            }
          });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.warn('[idb] Falling back to localStorage', request.error);
          fallback = true;
          resolve(null);
        };
      } catch (err) {
        console.warn('[idb] Failed to open IndexedDB, using fallback', err);
        fallback = true;
        resolve(null);
      }
    });
  }
  return dbPromise;
}

function withStore<T>(
  name: StoreName,
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  return openDatabase().then((db) => {
    if (!db) throw new Error('IndexedDB not available');
    return new Promise<T>((resolve, reject) => {
      try {
        const tx = db.transaction(name, mode);
        const store = tx.objectStore(name);
        const result = handler(store);
        const maybePromise = Promise.resolve(result);
        maybePromise.then(resolve).catch(reject);
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  });
}

function lsKey(name: StoreName) {
  return `hw:idb:${name}`;
}

function loadFromLocalStorage(name: StoreName): StoreValue[] {
  if (!globalThis.localStorage) return [];
  try {
    const raw = globalThis.localStorage.getItem(lsKey(name));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === 'object');
  } catch (err) {
    console.warn('[idb] Failed to parse localStorage cache', err);
    return [];
  }
}

function saveToLocalStorage(name: StoreName, values: StoreValue[]) {
  if (!globalThis.localStorage) return;
  try {
    globalThis.localStorage.setItem(lsKey(name), JSON.stringify(values));
  } catch (err) {
    console.warn('[idb] Failed to persist localStorage cache', err);
  }
}

async function ensureArray(name: StoreName): Promise<StoreValue[]> {
  if (!fallback) {
    try {
      const rows = await withStore(name, 'readonly', (store) => {
        return new Promise<StoreValue[]>((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result as StoreValue[]);
          request.onerror = () => reject(request.error);
        });
      });
      return rows || [];
    } catch (err) {
      console.warn('[idb] Failed to read store, switching to fallback', err);
      fallback = true;
    }
  }
  const cache = loadFromLocalStorage(name);
  return cache;
}

export async function idbGetAll(name: StoreName): Promise<StoreValue[]> {
  return ensureArray(name);
}

export async function idbGet(
  name: StoreName,
  clientId: string,
): Promise<StoreValue | null> {
  if (!fallback) {
    try {
      return await withStore(name, 'readonly', (store) => {
        return new Promise<StoreValue | null>((resolve, reject) => {
          const request = store.get(clientId);
          request.onsuccess = () => resolve((request.result as StoreValue) ?? null);
          request.onerror = () => reject(request.error);
        });
      });
    } catch (err) {
      console.warn('[idb] Failed to get record, switching to fallback', err);
      fallback = true;
    }
  }
  const rows = loadFromLocalStorage(name);
  return rows.find((item) => item?.client_id === clientId) ?? null;
}

export async function idbPut(name: StoreName, value: StoreValue): Promise<void> {
  if (!value?.client_id) {
    throw new Error('idbPut requires client_id');
  }
  if (!fallback) {
    try {
      await withStore(name, 'readwrite', (store) => {
        return new Promise<void>((resolve, reject) => {
          const request = store.put(value);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      });
      return;
    } catch (err) {
      console.warn('[idb] Failed to write record, switching to fallback', err);
      fallback = true;
    }
  }
  const rows = loadFromLocalStorage(name);
  const next = rows.filter((item) => item?.client_id !== value.client_id);
  next.push(value);
  saveToLocalStorage(name, next);
}

export async function idbDelete(name: StoreName, clientId: string): Promise<void> {
  if (!fallback) {
    try {
      await withStore(name, 'readwrite', (store) => {
        return new Promise<void>((resolve, reject) => {
          const request = store.delete(clientId);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      });
      return;
    } catch (err) {
      console.warn('[idb] Failed to delete record, switching to fallback', err);
      fallback = true;
    }
  }
  const rows = loadFromLocalStorage(name);
  const next = rows.filter((item) => item?.client_id !== clientId);
  saveToLocalStorage(name, next);
}

export function idbClear(name: StoreName): Promise<void> {
  if (!fallback) {
    return withStore(name, 'readwrite', (store) => {
      return new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }).catch((err) => {
      console.warn('[idb] Failed to clear store, switching to fallback', err);
      fallback = true;
      saveToLocalStorage(name, []);
    });
  }
  saveToLocalStorage(name, []);
  return Promise.resolve();
}

export function idbUseFallback() {
  return fallback;
}

export function idbStores() {
  return [...STORES];
}

