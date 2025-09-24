import { MutableRefObject, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { supabase } from "../lib/supabase";
import {
  isBlacklisted,
  normalizePath,
  writeGlobalRoute,
  writeUserRoute,
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

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const pathFromWindow = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const fullPath = normalizePath(pathFromWindow);

    if (isBlacklisted(fullPath)) {
      return;
    }

    if (suppressRef.current) {
      suppressRef.current = false;
      if (import.meta.env?.DEV) {
        console.debug("Route write skipped after restore");
      }
      return;
    }

    let cancelled = false;

    timerRef.current = window.setTimeout(async () => {
      if (cancelled) return;
      writeGlobalRoute(fullPath);

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

      if (typeof uid === "string" && uid) {
        writeUserRoute(uid, fullPath);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [location.pathname, location.search, location.hash, getUserId, suppressRef]);

  return suppressRef;
}
