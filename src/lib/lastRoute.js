const GLOBAL_KEY = "hw:lastRoute:global";
const UID_PREFIX = "hw:lastRoute:uid:";
const BLACKLIST_PATHS = ["/auth", "/logout", "/404"];
const NOT_FOUND_PATTERNS = ["/404", "not-found"];
const PUBLIC_PREFIXES = ["/auth", "/logout"];

function parseRoute(path) {
  if (typeof path !== "string") return null;
  const trimmed = path.trim();
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
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, "");
  if (!pathname) pathname = "/";

  return { pathname, search, hash };
}

export function normalizeRoute(path) {
  const parsed = parseRoute(path);
  if (!parsed) return null;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function isBlacklisted(path) {
  const parsed = parseRoute(path);
  if (!parsed) return true;
  const { pathname } = parsed;
  if (
    BLACKLIST_PATHS.some(
      (blocked) => pathname === blocked || pathname.startsWith(`${blocked}/`)
    )
  ) {
    return true;
  }
  return NOT_FOUND_PATTERNS.some((pattern) => pathname.includes(pattern));
}

export function isPrivateRoute(path) {
  const parsed = parseRoute(path);
  if (!parsed) return false;
  const { pathname } = parsed;
  if (pathname === "/") return true;
  return !PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function sanitizeStoredRoute(path) {
  const normalized = normalizeRoute(path);
  if (!normalized) return null;
  if (isBlacklisted(normalized)) return null;
  return normalized;
}

function getUserKey(uid) {
  return `${UID_PREFIX}${uid}`;
}

export function readLastRoute(uid) {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    if (uid) {
      const userValue = window.localStorage.getItem(getUserKey(uid));
      const sanitized = sanitizeStoredRoute(userValue);
      if (sanitized) return sanitized;
    }
    const globalValue = window.localStorage.getItem(GLOBAL_KEY);
    const sanitizedGlobal = sanitizeStoredRoute(globalValue);
    if (sanitizedGlobal) return sanitizedGlobal;
  } catch {
    // ignore storage errors
  }
  return null;
}

export function writeLastRoute(uid, path) {
  if (typeof window === "undefined" || !window.localStorage) return;
  const sanitized = sanitizeStoredRoute(path);
  if (!sanitized) return;
  try {
    window.localStorage.setItem(GLOBAL_KEY, sanitized);
    if (uid) {
      window.localStorage.setItem(getUserKey(uid), sanitized);
    }
  } catch {
    // ignore storage errors
  }
}

export function clearGlobalLastRoute() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(GLOBAL_KEY);
  } catch {
    // ignore
  }
}

export const LAST_ROUTE_GLOBAL_KEY = GLOBAL_KEY;
export const LAST_ROUTE_USER_PREFIX = UID_PREFIX;
