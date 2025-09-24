import { MutableRefObject, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { supabase } from "../lib/supabase";
import {
  isBlacklisted,
  normalizePath,
  writeLastRoute,
} from "../lib/routePersistence";

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
  const timerRef = useRef<number | null>(null);
  const cachedUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const fullPath = normalizePath(
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    );

    if (isBlacklisted(fullPath)) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (suppressRef.current) {
      suppressRef.current = false;
      if (import.meta.env.DEV) {
        console.debug("Route write skipped after restore");
      }
      return;
    }

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    let cancelled = false;

    const timeoutId = window.setTimeout(() => {
      (async () => {
        if (cancelled) return;

        let uid = getUserId?.();
        if (uid !== undefined) {
          cachedUserIdRef.current = uid ?? null;
        } else {
          uid = cachedUserIdRef.current;
          if (uid === undefined) {
            try {
              const { data } = await supabase.auth.getUser();
              uid = data.user?.id ?? null;
            } catch {
              uid = null;
            }
            cachedUserIdRef.current = uid;
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
