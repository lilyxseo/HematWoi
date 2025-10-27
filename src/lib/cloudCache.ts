const STORAGE_KEY = 'hematwoi:v3:cloudMeta';

type CloudCacheEntry = {
  lastFetched: number;
};

type CloudCacheMeta = Record<string, CloudCacheEntry>;

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readMeta(): CloudCacheMeta {
  if (!hasStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed).reduce<CloudCacheMeta>((acc, [key, value]) => {
        if (value && typeof value === 'object' && typeof (value as CloudCacheEntry).lastFetched === 'number') {
          acc[key] = { lastFetched: (value as CloudCacheEntry).lastFetched };
        }
        return acc;
      }, {});
    }
  } catch {
    /* ignore parse errors */
  }
  return {};
}

function writeMeta(meta: CloudCacheMeta): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch {
    /* ignore write errors */
  }
}

export function shouldFetchCloudData(key: string, ttl: number, now = Date.now()): boolean {
  if (!Number.isFinite(ttl) || ttl <= 0) {
    return true;
  }
  const meta = readMeta();
  const entry = meta[key];
  if (!entry || typeof entry.lastFetched !== 'number') {
    return true;
  }
  return now - entry.lastFetched >= ttl;
}

export function markCloudDataFetched(key: string, timestamp = Date.now()): void {
  if (!key) return;
  const meta = readMeta();
  meta[key] = { lastFetched: timestamp };
  writeMeta(meta);
}

export function clearCloudDataMeta(key?: string): void {
  if (key) {
    const meta = readMeta();
    if (meta[key]) {
      delete meta[key];
      writeMeta(meta);
    }
    return;
  }
  writeMeta({});
}

export function getCloudCacheMeta(): Record<string, number> {
  const meta = readMeta();
  return Object.fromEntries(
    Object.entries(meta).map(([key, value]) => [key, value.lastFetched]),
  );
}
