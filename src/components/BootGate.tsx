import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import useRoutePersistence from "../hooks/useRoutePersistence";
import { useMode } from "../hooks/useMode";
import { supabase } from "../lib/supabase";
import {
  extractPathname,
  isBlacklisted,
  normalizePath,
  readGlobalRouteRaw,
  readUserRouteRaw,
  samePath,
} from "../lib/routePersistence";

interface BootGateProps {
  children: ReactNode;
}

const ROOT_PATH = normalizePath("/");
const KNOWN_ROUTE_PATHS = new Set(
  [
    "/",
    "/transactions",
    "/budgets",
    "/debts",
    "/goals",
    "/challenges",
    "/categories",
    "/subscriptions",
    "/data",
    "/import",
    "/transaction/add",
    "/add",
    "/settings",
    "/profile",
    "/dashboard",
  ].map((path) => extractPathname(normalizePath(path)) ?? "/")
);

type ResolvedRoute = {
  target: string | null;
  invalid: boolean;
};

function isKnownRoute(path: string | null): boolean {
  if (!path) return false;
  const pathname = extractPathname(path);
  if (!pathname) return false;
  return KNOWN_ROUTE_PATHS.has(pathname);
}

function resolveStoredRouteFor(uid: string | null): ResolvedRoute {
  if (uid) {
    const raw = readUserRouteRaw(uid);
    if (typeof raw === "string" && raw.trim()) {
      const normalized = normalizePath(raw);
      if (!isBlacklisted(normalized)) {
        if (isKnownRoute(normalized)) {
          return { target: normalized, invalid: false };
        }
        return { target: null, invalid: true };
      }
      return { target: null, invalid: false };
    }
  }

  const fallback = readGlobalRouteRaw();
  if (typeof fallback === "string" && fallback.trim()) {
    const normalized = normalizePath(fallback);
    if (!isBlacklisted(normalized)) {
      if (isKnownRoute(normalized)) {
        return { target: normalized, invalid: false };
      }
      return { target: null, invalid: true };
    }
    return { target: null, invalid: false };
  }

  return { target: null, invalid: false };
}

export default function BootGate({ children }: BootGateProps) {
  const { mode } = useMode();
  const navigate = useNavigate();
  const location = useLocation();

  const suppressNextWriteRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const lastRestoredUserRef = useRef<string | null>(null);
  const restoredOnceRef = useRef(false);
  const bootHandledRef = useRef(false);
  const latestPathRef = useRef(
    normalizePath(
      `${location.pathname}${location.search}${location.hash}`
    )
  );
  const [bootReady, setBootReady] = useState(false);

  useRoutePersistence({
    suppressNextWriteRef,
    getUserId: () => userIdRef.current ?? undefined,
  });

  useEffect(() => {
    latestPathRef.current = normalizePath(
      `${location.pathname}${location.search}${location.hash}`
    );
  }, [location.pathname, location.search, location.hash]);

  const handleRestore = useCallback(
    (uid: string | null, options: { fallbackToRootOnEmpty?: boolean } = {}) => {
      const { fallbackToRootOnEmpty = false } = options;
      const { target, invalid } = resolveStoredRouteFor(uid);
      const current = latestPathRef.current;
      let restored = false;
      let fellBack = false;

      if (target && !samePath(current, target)) {
        suppressNextWriteRef.current = true;
        if (import.meta.env?.DEV) {
          console.debug(`Boot restore → ${target}`);
        }
        navigate(target, { replace: true });
        restored = true;
      } else if (invalid && !samePath(current, ROOT_PATH)) {
        navigate(ROOT_PATH, { replace: true });
        fellBack = true;
      } else if (fallbackToRootOnEmpty && !target && !samePath(current, ROOT_PATH)) {
        navigate(ROOT_PATH, { replace: true });
        fellBack = true;
      }

      return { restored, fellBack };
    },
    [navigate]
  );

  useEffect(() => {
    if (bootHandledRef.current) return;
    bootHandledRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        const session = data.session ?? null;
        const uid = session?.user?.id ?? null;
        userIdRef.current = uid;
        const { restored, fellBack } = handleRestore(uid);
        if (restored || fellBack) {
          lastRestoredUserRef.current = uid;
        }
        restoredOnceRef.current = true;
      } catch {
        restoredOnceRef.current = true;
      } finally {
        if (!cancelled) {
          setBootReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [handleRestore]);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const uid = session?.user?.id ?? null;
        userIdRef.current = uid;

        if (event === "SIGNED_OUT") {
          lastRestoredUserRef.current = null;
          restoredOnceRef.current = false;
          return;
        }

        if (event !== "SIGNED_IN" || !uid) {
          return;
        }

        if (lastRestoredUserRef.current === uid && restoredOnceRef.current) {
          return;
        }

        const { restored, fellBack } = handleRestore(uid, {
          fallbackToRootOnEmpty: true,
        });
        if (restored || fellBack) {
          lastRestoredUserRef.current = uid;
          restoredOnceRef.current = true;
        }
      }
    );

    return () => {
      subscription.subscription?.unsubscribe();
    };
  }, [handleRestore]);

  if (!bootReady || !mode) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg text-text">
        <div className="space-y-2 text-center">
          <div className="text-2xl font-semibold">HematWoi</div>
          <p className="text-sm text-muted">Menyiapkan dasbor…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
