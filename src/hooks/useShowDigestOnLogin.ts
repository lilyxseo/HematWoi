import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { todayJakarta } from './useDailyDigest';

const STORAGE_PREFIX = 'hw_digest_seen_';
const PENDING_KEY = 'hw:digest:pending';

type DigestStatus = {
  open: boolean;
  loading: boolean;
  userId: string | null;
  hasSeenToday: boolean;
  openManually: () => void;
  close: () => void;
  markSeen: () => void;
  error: string | null;
  clearError: () => void;
};

function buildKey(date: string, userId: string): string {
  return `${STORAGE_PREFIX}${date}_${userId}`;
}

function readSeen(key: string): boolean {
  if (!key) return false;
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeSeen(key: string): void {
  if (!key) return;
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    /* ignore */
  }
}

function readPendingFlag(): boolean {
  try {
    return window.sessionStorage.getItem(PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

function clearPendingFlag(): void {
  try {
    window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export default function useShowDigestOnLogin(): DigestStatus {
  const [open, setOpen] = useState(false);
  const [markOnClose, setMarkOnClose] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [seenKey, setSeenKey] = useState<string | null>(null);
  const [hasSeenToday, setHasSeenToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const evaluateForUser = useCallback(
    (uid: string | null, options: { auto?: boolean; force?: boolean; pending?: boolean } = {}) => {
      if (!uid) {
        setSeenKey(null);
        setHasSeenToday(false);
        if (options.force) {
          setMarkOnClose(false);
          setOpen(true);
        }
        return;
      }
      const today = todayJakarta();
      const key = buildKey(today, uid);
      setSeenKey(key);
      const seen = readSeen(key);
      setHasSeenToday(seen);

      const pending = options.pending ?? false;
      if (options.auto) {
        if (!seen) {
          setMarkOnClose(true);
          setOpen(true);
          if (pending) {
            clearPendingFlag();
          }
        } else if (pending) {
          clearPendingFlag();
        }
        return;
      }

      if (options.force) {
        setMarkOnClose(false);
        setOpen(true);
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) {
          throw sessionError;
        }
        const session = data.session ?? null;
        const uid = session?.user?.id ?? null;
        setUserId(uid);
        const pending = readPendingFlag();
        evaluateForUser(uid, { auto: true, pending });
        if (!pending) {
          clearPendingFlag();
        }
      })
      .catch((err) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Tidak dapat memuat sesi pengguna.';
        setError(message);
        setUserId(null);
        setSeenKey(null);
        setHasSeenToday(false);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') {
        setUserId(null);
        setOpen(false);
        setSeenKey(null);
        setHasSeenToday(false);
        return;
      }
      if (event === 'SIGNED_IN') {
        const uid = session?.user?.id ?? null;
        setUserId(uid);
        const pending = readPendingFlag();
        evaluateForUser(uid, { auto: true, pending });
      }
    });

    return () => {
      active = false;
      subscription.subscription?.unsubscribe();
    };
  }, [evaluateForUser]);

  const close = useCallback(() => {
    setOpen(false);
    if (markOnClose && seenKey) {
      writeSeen(seenKey);
      setHasSeenToday(true);
    }
    setMarkOnClose(false);
  }, [markOnClose, seenKey]);

  const markSeen = useCallback(() => {
    if (!seenKey) return;
    writeSeen(seenKey);
    setHasSeenToday(true);
  }, [seenKey]);

  const openManually = useCallback(() => {
    if (!userId) {
      setMarkOnClose(false);
      setOpen(true);
      return;
    }
    const today = todayJakarta();
    const key = buildKey(today, userId);
    setSeenKey(key);
    setMarkOnClose(false);
    setOpen(true);
  }, [userId]);

  const clearError = useCallback(() => setError(null), []);

  const state = useMemo(
    () => ({
      open,
      loading,
      userId,
      hasSeenToday,
      openManually,
      close,
      markSeen,
      error,
      clearError,
    }),
    [open, loading, userId, hasSeenToday, openManually, close, markSeen, error, clearError],
  );

  return state;
}
