import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import useRoutePersistence from "../hooks/useRoutePersistence";
import { useMode } from "../hooks/useMode";
import { supabase } from "../lib/supabase";
import {
  getPathname,
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
const KNOWN_PATHNAMES = new Set(
  [
    "/",
    "/transactions",
    "/transaction/add",
    "/add",
    "/budgets",
    "/goals",
    "/debts",
    "/debs",
    "/challenges",
    "/categories",
    "/subscriptions",
    "/data",
    "/import",
    "/profile",
    "/settings",
  ].map((path) => getPathname(path))
);

type RestoreResult = "restored" | "fallback" | "none";

export default function BootGate({ children }: BootGateProps) {
  const { mode } = useMode();
  const navigate = useNavigate();
  const location = useLocation();
  const suppressNextWriteRef = useRef(false);
  const restoredOnceRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);
  const latestLocationRef = useRef(location);
  const [bootReady, setBootReady] = useState(false);

  useRoutePersistence({
    suppressNextWriteRef,
    getUserId: () => currentUserIdRef.current,
  });

  useEffect(() => {
    latestLocationRef.current = location;
  }, [location]);

  const getCurrentPath = useCallback(() => {
    const current = latestLocationRef.current;
    return normalizePath(
      `${current.pathname}${current.search ?? ""}${current.hash ?? ""}`
    );
  }, []);

  const resolveStoredRoute = useCallback((uid: string | null) => {
    if (uid) {
      const userRaw = readUserRouteRaw(uid);
      if (typeof userRaw === "string" && userRaw.trim().length > 0) {
        return userRaw;
      }
    }
    const globalRaw = readGlobalRouteRaw();
    if (typeof globalRaw === "string" && globalRaw.trim().length > 0) {
      return globalRaw;
    }
    return null;
  }, []);

  const attemptRestore = useCallback(
    (raw: string | null): RestoreResult => {
      if (!raw) return "none";
      const candidate = normalizePath(raw);
      if (isBlacklisted(candidate)) {
        return "none";
      }

      const currentPath = getCurrentPath();
      if (samePath(currentPath, candidate)) {
        return "none";
      }

      const pathname = getPathname(candidate);
      if (!KNOWN_PATHNAMES.has(pathname)) {
        if (!samePath(currentPath, ROOT_PATH)) {
          navigate(ROOT_PATH, { replace: true });
          return "fallback";
        }
        return "none";
      }

      suppressNextWriteRef.current = true;
      if (import.meta.env.DEV) {
        console.debug(`Boot restore → ${candidate}`);
      }
      navigate(candidate, { replace: true });
      return "restored";
    },
    [getCurrentPath, navigate]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        const session = data.session ?? null;
        const uid = session?.user?.id ?? null;
        currentUserIdRef.current = uid;
        if (uid) {
          const target = resolveStoredRoute(uid);
          attemptRestore(target);
        }
        restoredOnceRef.current = Boolean(uid);
      } catch {
        restoredOnceRef.current = false;
      } finally {
        if (active) {
          setBootReady(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [attemptRestore, resolveStoredRoute]);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const uid = session?.user?.id ?? null;
        currentUserIdRef.current = uid;
        if (event === "SIGNED_OUT") {
          restoredOnceRef.current = false;
          return;
        }
        if (event !== "SIGNED_IN") {
          return;
        }
        if (restoredOnceRef.current) return;
        if (!uid) return;
        const target = resolveStoredRoute(uid);
        attemptRestore(target);
        restoredOnceRef.current = true;
      }
    );

    return () => {
      subscription.subscription?.unsubscribe();
    };
  }, [attemptRestore, resolveStoredRoute]);

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
