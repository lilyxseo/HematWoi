import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import useSupabaseUser from './useSupabaseUser';

type DashboardNoteStatus = 'saved' | 'saving' | 'offline' | 'error';

type DashboardNoteRow = {
  dashboard_note: string | null;
  dashboard_note_updated_at: string | null;
} | null;

type LocalNotePayload = {
  note: string;
  localUpdatedAt: number;
};

const STORAGE_PREFIX = 'hematwoi:dashboard-note:';
const LOCAL_SAVE_DEBOUNCE = 200;
const REMOTE_SAVE_DEBOUNCE = 1000;

const readLocalNote = (key: string): LocalNotePayload | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as LocalNotePayload;
  } catch (error) {
    console.warn('[dashboard-note] gagal membaca localStorage', error);
    return null;
  }
};

const writeLocalNote = (key: string, payload: LocalNotePayload) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    console.warn('[dashboard-note] gagal menulis localStorage', error);
  }
};

const toTimestamp = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
};

export default function useDashboardNote() {
  const { user } = useSupabaseUser();
  const userId = user?.id ?? null;
  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}${userId ?? 'guest'}`,
    [userId],
  );

  const [note, setNote] = useState('');
  const [status, setStatus] = useState<DashboardNoteStatus>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [localUpdatedAt, setLocalUpdatedAt] = useState<number | null>(null);
  const [pendingSync, setPendingSync] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  const lastSyncedNoteRef = useRef('');
  const skipLocalWriteRef = useRef(false);
  const localSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const stored = readLocalNote(storageKey);
    skipLocalWriteRef.current = true;
    setNote(stored?.note ?? '');
    setLocalUpdatedAt(stored?.localUpdatedAt ?? null);
    setLastSavedAt(stored?.localUpdatedAt ?? null);
    lastSyncedNoteRef.current = stored?.note ?? '';
    setPendingSync(false);
    setStatus('saved');
  }, [storageKey]);

  const noteQuery = useQuery<DashboardNoteRow>({
    queryKey: ['dashboard-note', userId],
    enabled: Boolean(userId),
    retry: 1,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('user_profiles')
        .select('dashboard_note, dashboard_note_updated_at')
        .eq('id', userId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      return data ?? null;
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ nextNote }: { nextNote: string }) => {
      if (!userId) throw new Error('User tidak ditemukan');
      const { data, error } = await supabase
        .from('user_profiles')
        .update({ dashboard_note: nextNote })
        .eq('id', userId)
        .select('dashboard_note_updated_at')
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    onMutate: () => {
      setStatus('saving');
      setPendingSync(true);
    },
    onSuccess: (data, variables) => {
      const updatedAt =
        toTimestamp(data?.dashboard_note_updated_at) ?? Date.now();
      lastSyncedNoteRef.current = variables.nextNote;
      setLastSavedAt(updatedAt);
      setLocalUpdatedAt(updatedAt);
      setPendingSync(false);
      setStatus('saved');
      writeLocalNote(storageKey, {
        note: variables.nextNote,
        localUpdatedAt: updatedAt,
      });
    },
    onError: () => {
      setStatus('error');
    },
  });

  useEffect(() => {
    if (!noteQuery.data) return;

    const remoteNote = noteQuery.data.dashboard_note ?? '';
    const remoteUpdatedAt = toTimestamp(
      noteQuery.data.dashboard_note_updated_at,
    );
    const currentLocal = readLocalNote(storageKey);
    const localNote = currentLocal?.note ?? note;
    const localTs = currentLocal?.localUpdatedAt ?? localUpdatedAt ?? 0;
    const remoteTs = remoteUpdatedAt ?? 0;

    if (!localNote && !localTs && !remoteNote && !remoteTs) {
      return;
    }

    if (remoteTs > localTs) {
      skipLocalWriteRef.current = true;
      setNote(remoteNote);
      setLocalUpdatedAt(remoteTs || null);
      setLastSavedAt(remoteTs || null);
      lastSyncedNoteRef.current = remoteNote;
      writeLocalNote(storageKey, {
        note: remoteNote,
        localUpdatedAt: remoteTs,
      });
      setPendingSync(false);
      setStatus('saved');
      return;
    }

    if (localTs > remoteTs) {
      skipLocalWriteRef.current = true;
      setNote(localNote);
      setLocalUpdatedAt(localTs || null);
      setLastSavedAt(localTs || null);
      if (isOnline && userId && !mutation.isPending) {
        mutation.mutate({ nextNote: localNote });
      } else {
        setPendingSync(true);
        setStatus('offline');
      }
      return;
    }

    if (!lastSyncedNoteRef.current) {
      lastSyncedNoteRef.current = localNote;
    }
  }, [
    noteQuery.data,
    storageKey,
    isOnline,
    userId,
    mutation,
    localUpdatedAt,
    note,
  ]);

  useEffect(() => {
    if (skipLocalWriteRef.current) {
      skipLocalWriteRef.current = false;
      return;
    }

    const updatedAt = Date.now();
    setLocalUpdatedAt(updatedAt);
    setLastSavedAt(updatedAt);

    if (localSaveTimeoutRef.current) {
      clearTimeout(localSaveTimeoutRef.current);
    }

    localSaveTimeoutRef.current = setTimeout(() => {
      writeLocalNote(storageKey, { note, localUpdatedAt: updatedAt });
    }, LOCAL_SAVE_DEBOUNCE);

    if (note !== lastSyncedNoteRef.current) {
      if (isOnline) {
        setStatus('saving');
      } else {
        setStatus('offline');
        setPendingSync(true);
      }
    }

    return () => {
      if (localSaveTimeoutRef.current) {
        clearTimeout(localSaveTimeoutRef.current);
      }
    };
  }, [note, storageKey, isOnline]);

  useEffect(() => {
    if (!userId || !isOnline) return;
    if (note === lastSyncedNoteRef.current) return;
    if (mutation.isPending) return;

    setPendingSync(true);

    if (remoteSaveTimeoutRef.current) {
      clearTimeout(remoteSaveTimeoutRef.current);
    }

    remoteSaveTimeoutRef.current = setTimeout(() => {
      mutation.mutate({ nextNote: note });
    }, REMOTE_SAVE_DEBOUNCE);

    return () => {
      if (remoteSaveTimeoutRef.current) {
        clearTimeout(remoteSaveTimeoutRef.current);
      }
    };
  }, [note, userId, isOnline, mutation]);

  useEffect(() => {
    if (!isOnline) return;
    if (!pendingSync) return;
    if (!userId) return;
    if (note === lastSyncedNoteRef.current) {
      setPendingSync(false);
      setStatus('saved');
      return;
    }
    if (mutation.isPending) return;
    mutation.mutate({ nextNote: note });
  }, [isOnline, pendingSync, note, userId, mutation]);

  useEffect(() => {
    if (isOnline) return;
    if (note !== lastSyncedNoteRef.current) {
      setStatus('offline');
      setPendingSync(true);
    }
  }, [isOnline, note]);

  const updateNote = useCallback((value: string) => {
    setNote(value);
  }, []);

  return {
    note,
    status,
    lastSavedAt,
    isLoading: noteQuery.isLoading,
    isOnline,
    setNote: updateNote,
  };
}
