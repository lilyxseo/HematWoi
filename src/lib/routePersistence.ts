export const LAST_ROUTE_GLOBAL_KEY = "hw:lastRoute:global";
export const LAST_ROUTE_USER_PREFIX = "hw:lastRoute:uid:";

const BLACKLIST_PATTERNS = [
  /^\/auth(?:\/?|$)/,
  /^\/logout(?:\/?|$)/,
  /^\/404(?:\/?|$)/,
];

type NullableString = string | null | undefined;

function ensureLeadingSlash(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}

function splitPathComponents(raw: string): {
  pathname: string;
  search: string;
  hash: string;
} {
  let working = raw.trim();
  if (!working) {
    return { pathname: "/", search: "", hash: "" };
  }

  let hash = "";
  const hashIndex = working.indexOf("#");
  if (hashIndex >= 0) {
    hash = working.slice(hashIndex);
    working = working.slice(0, hashIndex);
  }

  let search = "";
  const searchIndex = working.indexOf("?");
  if (searchIndex >= 0) {
    search = working.slice(searchIndex);
    working = working.slice(0, searchIndex);
  }

  let pathname = working || "/";
  pathname = ensureLeadingSlash(pathname);
  if (pathname.length > 1) {
    pathname = pathname.replace(/\/+$/, "");
  }

  if (!pathname) pathname = "/";

  return { pathname, search, hash };
}

export function normalizePath(path?: NullableString): string {
  const raw = typeof path === "string" ? path : "/";
  const { pathname, search, hash } = splitPathComponents(raw);
  return `${pathname}${search}${hash}` || "/";
}

export function getPathname(path?: NullableString): string {
  const normalized = normalizePath(path);
  const searchIndex = normalized.indexOf("?");
  const hashIndex = normalized.indexOf("#");
  let end = normalized.length;
  if (searchIndex >= 0) {
    end = Math.min(end, searchIndex);
  }
  if (hashIndex >= 0) {
    end = Math.min(end, hashIndex);
  }
  const pathname = normalized.slice(0, end);
  return pathname || "/";
}

export function samePath(a?: NullableString, b?: NullableString): boolean {
  return normalizePath(a) === normalizePath(b);
}

export function isBlacklisted(path?: NullableString): boolean {
  const pathname = getPathname(path);
  return BLACKLIST_PATTERNS.some((pattern) => pattern.test(pathname));
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

export function readUserRouteRaw(uid?: NullableString): string | null {
  const userId = typeof uid === "string" && uid ? uid : null;
  if (!userId) return null;
  return readFromStorage(getUserStorageKey(userId));
}

export function readGlobalRouteRaw(): string | null {
  return readFromStorage(LAST_ROUTE_GLOBAL_KEY);
}

export function writeLastRoute(uid: NullableString, path: string): void {
  const normalized = normalizePath(path);
  if (isBlacklisted(normalized)) return;
  writeToStorage(LAST_ROUTE_GLOBAL_KEY, normalized);
  const userId = typeof uid === "string" && uid ? uid : null;
  if (userId) {
    writeToStorage(getUserStorageKey(userId), normalized);
  }
}
