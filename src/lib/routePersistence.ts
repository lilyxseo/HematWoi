export const LAST_ROUTE_GLOBAL_KEY = "hw:lastRoute:global";
export const LAST_ROUTE_USER_PREFIX = "hw:lastRoute:uid:";

const BLACKLIST_PATHS = ["/auth", "/logout", "/404"] as const;

export type NormalizedPath = string;

type NullablePath = string | null | undefined;

export function normalizePath(path: string): NormalizedPath {
  let raw = typeof path === "string" ? path.trim() : "";
  if (!raw) return "/";

  if (!raw.startsWith("/")) {
    raw = `/${raw}`;
  }

  let working = raw;
  let hash = "";
  let search = "";

  const hashIndex = working.indexOf("#");
  if (hashIndex >= 0) {
    hash = working.slice(hashIndex);
    working = working.slice(0, hashIndex);
  }

  const searchIndex = working.indexOf("?");
  if (searchIndex >= 0) {
    search = working.slice(searchIndex);
    working = working.slice(0, searchIndex);
  }

  let pathname = working || "/";
  if (pathname.length > 1) {
    pathname = pathname.replace(/\/+$/, "");
    if (!pathname) {
      pathname = "/";
    }
  }

  return `${pathname}${search}${hash}`;
}

export function extractPathname(path: NullablePath): string | null {
  if (typeof path !== "string" || !path.trim()) {
    return null;
  }
  const normalized = normalizePath(path);
  const searchIndex = normalized.indexOf("?");
  const hashIndex = normalized.indexOf("#");
  const endIndex =
    searchIndex >= 0 && hashIndex >= 0
      ? Math.min(searchIndex, hashIndex)
      : searchIndex >= 0
        ? searchIndex
        : hashIndex >= 0
          ? hashIndex
          : normalized.length;
  const pathname = normalized.slice(0, endIndex);
  return pathname || "/";
}

export function samePath(a: NullablePath, b: NullablePath): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return normalizePath(a) === normalizePath(b);
}

export function isBlacklisted(path: NullablePath): boolean {
  const pathname = extractPathname(path);
  if (!pathname) return false;
  return BLACKLIST_PATHS.some((blocked) =>
    pathname === blocked || pathname.startsWith(`${blocked}/`)
  );
}

export function readFromStorage(key: string): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeToStorage(key: string, value: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
}

export function getUserStorageKey(uid: string): string {
  return `${LAST_ROUTE_USER_PREFIX}${uid}`;
}

export function readLastRouteForUser(
  uid: NullablePath
): NormalizedPath | null {
  const userId = typeof uid === "string" && uid ? uid : null;
  if (!userId) return null;
  const raw = readFromStorage(getUserStorageKey(userId));
  if (!raw) return null;
  const normalized = normalizePath(raw);
  if (isBlacklisted(normalized)) return null;
  return normalized;
}

export function readLastRouteGlobal(): NormalizedPath | null {
  const raw = readFromStorage(LAST_ROUTE_GLOBAL_KEY);
  if (!raw) return null;
  const normalized = normalizePath(raw);
  if (isBlacklisted(normalized)) return null;
  return normalized;
}

export function writeGlobalRoute(path: NullablePath): void {
  if (typeof path !== "string" || !path.trim()) return;
  const normalized = normalizePath(path);
  if (isBlacklisted(normalized)) return;
  writeToStorage(LAST_ROUTE_GLOBAL_KEY, normalized);
}

export function writeUserRoute(uid: NullablePath, path: NullablePath): void {
  const userId = typeof uid === "string" && uid ? uid : null;
  if (!userId || typeof path !== "string" || !path.trim()) return;
  const normalized = normalizePath(path);
  if (isBlacklisted(normalized)) return;
  writeToStorage(getUserStorageKey(userId), normalized);
}

export function writeLastRoute(uid: NullablePath, path: NullablePath): void {
  writeGlobalRoute(path);
  writeUserRoute(uid, path);
}

export function readUserRouteRaw(uid: NullablePath): string | null {
  const userId = typeof uid === "string" && uid ? uid : null;
  if (!userId) return null;
  return readFromStorage(getUserStorageKey(userId));
}

export function readGlobalRouteRaw(): string | null {
  return readFromStorage(LAST_ROUTE_GLOBAL_KEY);
}
