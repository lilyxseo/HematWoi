import { useCallback, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  getDigestTodayKey,
  hasSeenDailyDigest,
  markDailyDigestSeen,
} from "./useDailyDigest";

interface UseShowDigestOnLoginOptions {
  userId?: string | null;
  onRequestOpen: () => void;
  todayKey?: string;
  enabled?: boolean;
}

export function useShowDigestOnLogin({
  userId,
  onRequestOpen,
  todayKey,
  enabled = true,
}: UseShowDigestOnLoginOptions) {
  const openedRef = useRef(false);

  const resolveDate = useCallback(() => todayKey ?? getDigestTodayKey(), [todayKey]);

  const triggerOpen = useCallback(
    (candidateId?: string | null) => {
      if (!enabled) return;
      const resolvedUser = candidateId ?? userId ?? null;
      if (!resolvedUser) return;
      const dateKey = resolveDate();
      if (hasSeenDailyDigest(dateKey, resolvedUser)) return;
      if (openedRef.current) return;
      openedRef.current = true;
      markDailyDigestSeen(dateKey, resolvedUser);
      onRequestOpen();
    },
    [enabled, onRequestOpen, resolveDate, userId],
  );

  useEffect(() => {
    openedRef.current = false;
  }, [userId, todayKey]);

  useEffect(() => {
    if (!enabled) return;
    triggerOpen(userId);
  }, [enabled, triggerOpen, userId]);

  useEffect(() => {
    if (!enabled) return;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        openedRef.current = false;
        return;
      }
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        triggerOpen(session?.user?.id ?? null);
      }
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [enabled, triggerOpen]);
}
