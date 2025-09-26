import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase.js";
import { getDigestTodayKey } from "./useDailyDigest";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "Asia/Jakarta";
const STORAGE_PREFIX = "hw_digest_seen";

function buildStorageKey(dateKey: string, userId: string): string {
  return `${STORAGE_PREFIX}_${dateKey}_${userId}`;
}

interface UseShowDigestOnLoginResult {
  open: boolean;
  ready: boolean;
  userId: string | null;
  todayKey: string;
  storageKey: string | null;
  openDigest: () => void;
  closeDigest: () => void;
  markSeen: () => void;
}

function getTodayKeyValue(): string {
  return dayjs().tz(TIMEZONE).format("YYYY-MM-DD");
}

export default function useShowDigestOnLogin(): UseShowDigestOnLoginResult {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [todayKey, setTodayKey] = useState<string>(() => getTodayKeyValue());
  const hasMarkedSeenRef = useRef(false);

  const storageKey = useMemo(() => {
    if (!userId) return null;
    return buildStorageKey(todayKey, userId);
  }, [todayKey, userId]);

  const ensureMarkedSeen = useCallback(() => {
    if (!storageKey) return;
    if (hasMarkedSeenRef.current) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, "1");
      hasMarkedSeenRef.current = true;
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.warn("[DailyDigest] Failed persisting seen flag", error);
      }
    }
  }, [storageKey]);

  const evaluateForUser = useCallback((sessionUserId: string | null) => {
      const currentKey = getDigestTodayKey();
      setTodayKey(currentKey);
      setUserId(sessionUserId);

      if (!sessionUserId) {
        hasMarkedSeenRef.current = false;
        setOpen(false);
        setReady(true);
        return;
      }

      const key = buildStorageKey(currentKey, sessionUserId);
      let seen = false;
      if (typeof window !== "undefined") {
        try {
          seen = window.localStorage.getItem(key) === "1";
        } catch {
          seen = false;
        }
      }

      hasMarkedSeenRef.current = seen;
      setOpen(!seen);
      setReady(true);
    }, []);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          evaluateForUser(null);
          return;
        }
        evaluateForUser(data.session?.user?.id ?? null);
      })
      .catch(() => {
        if (!active) return;
        evaluateForUser(null);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, _session: Session | null) => {
        if (!active) return;
        if (event === "SIGNED_OUT") {
          evaluateForUser(null);
          return;
        }
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
          evaluateForUser(_session?.user?.id ?? null);
        }
      },
    );

    return () => {
      active = false;
      subscription.subscription?.unsubscribe();
    };
  }, [evaluateForUser]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      setTodayKey((prev) => {
        const current = getTodayKeyValue();
        return prev === current ? prev : current;
      });
    };
    update();
    const timer = window.setInterval(update, 60_000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!userId) return;
    const key = buildStorageKey(todayKey, userId);
    let seen = false;
    if (typeof window !== "undefined") {
      try {
        seen = window.localStorage.getItem(key) === "1";
      } catch {
        seen = false;
      }
    }
    hasMarkedSeenRef.current = seen;
    if (!seen) {
      setOpen(true);
    }
  }, [ready, todayKey, userId]);

  useEffect(() => {
    if (!open) return;
    ensureMarkedSeen();
  }, [ensureMarkedSeen, open]);

  const openDigest = useCallback(() => {
    setOpen(true);
  }, []);

  const closeDigest = useCallback(() => {
    ensureMarkedSeen();
    setOpen(false);
  }, [ensureMarkedSeen]);

  return {
    open,
    ready,
    userId,
    todayKey,
    storageKey,
    openDigest,
    closeDigest,
    markSeen: ensureMarkedSeen,
  };
}
