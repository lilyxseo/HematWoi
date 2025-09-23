const GLOBAL_KEY = 'hw:lastRoute:global';
const USER_KEY_PREFIX = 'hw:lastRoute:uid:';
const BLACKLIST = ['/auth', '/logout', '/404'];

const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

function toRelativePath(path: string): string | null {
  if (typeof path !== 'string') return null;
  const trimmed = path.trim();
  if (!trimmed) return null;

  if (ABSOLUTE_URL_PATTERN.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      return `${url.pathname}${url.search}${url.hash}` || '/';
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  return `/${trimmed}`;
}

function extractBasePath(path: string | null | undefined): string {
  const relative = typeof path === 'string' ? toRelativePath(path) : null;
  if (!relative) return '/';
  const hashIndex = relative.indexOf('#');
  const queryIndex = relative.indexOf('?');
  const endIndex = Math.min(
    hashIndex === -1 ? relative.length : hashIndex,
    queryIndex === -1 ? relative.length : queryIndex
  );
  const base = relative.slice(0, endIndex);
  return base || '/';
}

function sanitizeStoredRoute(path: string | null | undefined): string | null {
  if (typeof path !== 'string') return null;
  const relative = toRelativePath(path);
  if (!relative) return null;
  if (isBlacklisted(relative)) return null;
  return relative;
}

export function isBlacklisted(path: string | null | undefined): boolean {
  if (!path) return true;
  const base = extractBasePath(path);
  return BLACKLIST.some((blocked) =>
    base === blocked || base.startsWith(`${blocked}/`)
  );
}

export function isPrivateRoute(path: string | null | undefined): boolean {
  if (!path) return false;
  if (isBlacklisted(path)) return false;
  return true;
}

export function lastRouteKeyForUser(uid: string): string {
  return `${USER_KEY_PREFIX}${uid}`;
}

export function readLastRoute(uid?: string | null): string | null {
  const storage = getStorage();
  if (!storage) return null;

  const keys: string[] = [];
  if (uid) keys.push(lastRouteKeyForUser(uid));
  keys.push(GLOBAL_KEY);

  for (const key of keys) {
    try {
      const candidate = sanitizeStoredRoute(storage.getItem(key));
      if (candidate) return candidate;
    } catch {
      /* ignore */
    }
  }

  return null;
}

export function writeLastRoute(uid: string | null | undefined, path: string): void {
  const storage = getStorage();
  if (!storage) return;
  const sanitized = sanitizeStoredRoute(path);
  if (!sanitized) return;

  try {
    storage.setItem(GLOBAL_KEY, sanitized);
  } catch {
    /* ignore */
  }

  if (uid) {
    try {
      storage.setItem(lastRouteKeyForUser(uid), sanitized);
    } catch {
      /* ignore */
    }
  }
}

export function getGlobalLastRouteKey(): string {
  return GLOBAL_KEY;
}
