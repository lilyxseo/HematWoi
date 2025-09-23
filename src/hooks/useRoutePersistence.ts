import { MutableRefObject, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { isBlacklisted, writeLastRoute, buildFullPath } from "../lib/routePersistence";

const DEBOUNCE_MS = 150;

interface UseRoutePersistenceOptions {
  suppressNextWriteRef?: MutableRefObject<boolean>;
  getUserId?: () => string | null | undefined;
}

export default function useRoutePersistence(
  options: UseRoutePersistenceOptions = {}
): MutableRefObject<boolean> {
  const location = useLocation();
  const getUserId = options.getUserId;
  const internalSuppressRef = useRef(false);
  const suppressRef = options.suppressNextWriteRef ?? internalSuppressRef;
  const timerRef = useRef<number>();

  useEffect(() => {
    return () => {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const fullPath = buildFullPath({
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    });

    if (!fullPath || isBlacklisted(fullPath)) {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
      return;
    }

    if (suppressRef.current) {
      suppressRef.current = false;
      return;
    }

    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      (async () => {
        if (cancelled) return;
        let uid = getUserId?.();
        if (uid === undefined) {
          try {
            const { data } = await supabase.auth.getUser();
            uid = data.user?.id ?? null;
          } catch {
            uid = null;
          }
        }
        if (cancelled) return;
        writeLastRoute(uid ?? null, fullPath);
      })();
    }, DEBOUNCE_MS);

    timerRef.current = timeoutId;

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [location.pathname, location.search, location.hash, getUserId, suppressRef]);

  return suppressRef;
}
