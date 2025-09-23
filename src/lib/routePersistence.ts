export const LAST_ROUTE_GLOBAL_KEY = "hw:lastRoute:global";
export const LAST_ROUTE_USER_PREFIX = "hw:lastRoute:uid:";
export const BLACKLIST = ["/auth", "/logout", "/404"] as const;

export type NormalizedPath = string;

type NullablePath = string | null | undefined;

type ParsedPath = {
  pathname: string;
  search: string;
  hash: string;
};

function ensureLeadingSlash(path: string): string {
  if (!path.startsWith("/")) {
    return `/${path}`;
  }
  return path;
}

function parseRawPath(raw: string): ParsedPath | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let rest = trimmed;
  let hash = "";
  let search = "";

  const hashIndex = rest.indexOf("#");
  if (hashIndex >= 0) {
    hash = rest.slice(hashIndex);
    rest = rest.slice(0, hashIndex);
  }

  const searchIndex = rest.indexOf("?");
  if (searchIndex >= 0) {
    search = rest.slice(searchIndex);
    rest = rest.slice(0, searchIndex);
  }

  let pathname = rest || "/";
  pathname = ensureLeadingSlash(pathname);
  if (pathname.length > 1) {
    pathname = pathname.replace(/\/+$/, "");
  }

  return {
    pathname: pathname || "/",
    search,
    hash,
  };
}

export function normalizePath(path: NullablePath): NormalizedPath | null {
  const parsed = typeof path === "string" ? parseRawPath(path) : null;
  if (!parsed) return null;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function extractPathname(path: NullablePath): string | null {
  const normalized = normalizePath(path);
  if (!normalized) return null;

  let pathname = normalized;
  const hashIndex = pathname.indexOf("#");
  if (hashIndex >= 0) {
    pathname = pathname.slice(0, hashIndex);
  }
  const searchIndex = pathname.indexOf("?");
  if (searchIndex >= 0) {
    pathname = pathname.slice(0, searchIndex);
  }
  return pathname || "/";
}

export function samePath(a: NullablePath, b: NullablePath): boolean {
  const normA = normalizePath(a);
  const normB = normalizePath(b);
  if (normA === null && normB === null) return true;
  return normA === normB;
}

export function isBlacklisted(path: NullablePath): boolean {
  const pathname = extractPathname(path);
  if (!pathname) return true;
  return BLACKLIST.some(
    (blocked) => pathname === blocked || pathname.startsWith(`${blocked}/`)
  );
}

export function buildFullPath(input: {
  pathname: string;
  search?: string;
  hash?: string;
}): NormalizedPath {
  const search = input.search ?? "";
  const hash = input.hash ?? "";
  return (
    normalizePath(`${input.pathname}${search}${hash}`) ??
    normalizePath("/") ??
    "/"
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

export function readLastRoute(uid: NullablePath): NormalizedPath | null {
  const userId = typeof uid === "string" && uid ? uid : null;
  if (userId) {
    const userValue = normalizePath(
      readFromStorage(`${LAST_ROUTE_USER_PREFIX}${userId}`)
    );
    if (userValue && !isBlacklisted(userValue)) {
      return userValue;
    }
  }

  const globalValue = normalizePath(readFromStorage(LAST_ROUTE_GLOBAL_KEY));
  if (globalValue && !isBlacklisted(globalValue)) {
    return globalValue;
  }
  return null;
}

export function writeLastRoute(uid: NullablePath, path: NullablePath): void {
  const normalized = normalizePath(path);
  if (!normalized || isBlacklisted(normalized)) {
    return;
  }

  writeToStorage(LAST_ROUTE_GLOBAL_KEY, normalized);

  const userId = typeof uid === "string" && uid ? uid : null;
  if (userId) {
    writeToStorage(`${LAST_ROUTE_USER_PREFIX}${userId}`, normalized);
  }
}

export function getUserStorageKey(uid: string): string {
  return `${LAST_ROUTE_USER_PREFIX}${uid}`;
}

export function readUserRouteRaw(uid: NullablePath): string | null {
  const userId = typeof uid === "string" && uid ? uid : null;
  if (!userId) return null;
  return readFromStorage(`${LAST_ROUTE_USER_PREFIX}${userId}`);
}

export function readGlobalRouteRaw(): string | null {
  return readFromStorage(LAST_ROUTE_GLOBAL_KEY);
}
