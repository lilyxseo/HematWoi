import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import useRoutePersistence from "../hooks/useRoutePersistence";
import { useMode } from "../hooks/useMode";
import { supabase } from "../lib/supabase";
import {
  buildFullPath,
  isBlacklisted,
  normalizePath,
  readGlobalRouteRaw,
  readUserRouteRaw,
  samePath,
} from "../lib/routePersistence";

interface BootGateProps {
  children: ReactNode;
}

const ROOT_PATH = normalizePath("/") ?? "/";
const AUTH_PATH = normalizePath("/auth");
const DEFAULT_PATHS = [ROOT_PATH, AUTH_PATH].filter(
  (value): value is string => typeof value === "string" && value.length > 0
);

export default function BootGate({ children }: BootGateProps) {
  const { mode } = useMode();
  const navigate = useNavigate();
  const location = useLocation();
  const suppressNextWriteRef = useRef(false);
  const restoredOnceRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);
  const latestLocationRef = useRef(location);
  const initialLoadRef = useRef(true);
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
    return buildFullPath({
      pathname: current.pathname,
      search: current.search,
      hash: current.hash,
    });
  }, []);

  const shouldAllowRestore = useCallback(
    (currentPath: string | null) => {
      if (!currentPath) return true;
      if (initialLoadRef.current) return true;
      return DEFAULT_PATHS.some((allowed) => samePath(currentPath, allowed));
    },
    []
  );

  const resolveStoredRoute = useCallback((uid: string | null) => {
    const userRaw = readUserRouteRaw(uid);
    const hasUserValue = typeof userRaw === "string" && userRaw.trim().length > 0;
    const normalizedUser = normalizePath(userRaw);
    const userValid = !!normalizedUser && !isBlacklisted(normalizedUser);
    if (userValid) {
      return { target: normalizedUser, invalid: false };
    }

    const globalRaw = readGlobalRouteRaw();
    const hasGlobalValue = typeof globalRaw === "string" && globalRaw.trim().length > 0;
    const normalizedGlobal = normalizePath(globalRaw);
    const globalValid = !!normalizedGlobal && !isBlacklisted(normalizedGlobal);
    if (globalValid) {
      return { target: normalizedGlobal, invalid: false };
    }

    const invalid = (hasUserValue && !userValid) || (hasGlobalValue && !globalValid);
    return { target: null, invalid };
  }, []);

  const attemptFallbackToRoot = useCallback(() => {
    const currentPath = getCurrentPath();
    if (!shouldAllowRestore(currentPath)) {
      return false;
    }
    if (samePath(currentPath, ROOT_PATH)) {
      return false;
    }
    suppressNextWriteRef.current = true;
    if (import.meta.env.DEV) {
      console.debug(`Restored route -> ${ROOT_PATH}`);
    }
    navigate(ROOT_PATH, { replace: true });
    return true;
  }, [getCurrentPath, navigate, shouldAllowRestore]);

  const attemptRestore = useCallback(
    (candidate: string | null) => {
      const currentPath = getCurrentPath();
      if (!shouldAllowRestore(currentPath)) {
        return false;
      }

      const normalizedCandidate = normalizePath(candidate);
      if (!normalizedCandidate || isBlacklisted(normalizedCandidate)) {
        return false;
      }

      if (samePath(currentPath, normalizedCandidate)) {
        return false;
      }

      suppressNextWriteRef.current = true;
      if (import.meta.env.DEV) {
        console.debug(`Restored route -> ${normalizedCandidate}`);
      }
      navigate(normalizedCandidate, { replace: true });
      return true;
    },
    [getCurrentPath, navigate, shouldAllowRestore]
  );

  useEffect(() => {
    let active = true;
    const initialPath = getCurrentPath();
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        const session = data.session ?? null;
        const uid = session?.user?.id ?? null;
        currentUserIdRef.current = uid;
        const { target, invalid } = resolveStoredRoute(uid);
        const currentPath = getCurrentPath();
        const userNavigated = !samePath(currentPath, initialPath);
        let restored = false;
        if (!userNavigated) {
          restored = attemptRestore(target);
          if (!restored && invalid) {
            attemptFallbackToRoot();
          }
        }
        restoredOnceRef.current = Boolean(session?.user);
      } catch {
        restoredOnceRef.current = false;
      } finally {
        if (active) {
          initialLoadRef.current = false;
          setBootReady(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [attemptFallbackToRoot, attemptRestore, getCurrentPath, resolveStoredRoute]);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        currentUserIdRef.current = session?.user?.id ?? null;
        if (event === "SIGNED_IN") {
          if (!session?.user) return;
          if (!restoredOnceRef.current) {
            const { target, invalid } = resolveStoredRoute(session.user.id);
            const restored = attemptRestore(target);
            if (!restored && invalid) {
              attemptFallbackToRoot();
            }
            restoredOnceRef.current = true;
          }
        }
        if (event === "SIGNED_OUT") {
          restoredOnceRef.current = false;
        }
      }
    );

    return () => {
      subscription.subscription?.unsubscribe();
    };
  }, [attemptFallbackToRoot, attemptRestore, resolveStoredRoute]);

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
