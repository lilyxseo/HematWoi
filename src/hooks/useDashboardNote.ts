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
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

export default function useDashboardNote() {
  const { user } = useSupabaseUser();
  const userId = user?.id ?? null;
  const storageKey = useMemo(() => `${STORAGE_PREFIX}${userId ?? 'guest'}`, [userId]);

  const [note, setNoteState] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [localUpdatedAt, setLocalUpdatedAt] = useState<number | null>(null);
  const [pendingSync, setPendingSync] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [isRemoteScheduled, setIsRemoteScheduled] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  const noteRef = useRef(note);
  const localUpdatedAtRef = useRef<number | null>(localUpdatedAt);
  const lastSyncedNoteRef = useRef('');
  const lastHandledRemoteAtRef = useRef<number | null>(null);
  const localSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      if (error && error.code !== 'PGRST116') throw error;
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
      return {
        updatedAt: toTimestamp(data?.dashboard_note_updated_at) ?? Date.now(),
        syncedNote: nextNote,
      };
    },
    onMutate: () => {
      setSyncError(false);
      setPendingSync(true);
    },
    onSuccess: ({ updatedAt, syncedNote }) => {
      lastHandledRemoteAtRef.current = updatedAt;

      if (noteRef.current !== syncedNote) {
        if (userId && isOnline) {
          setPendingSync(true);
        }
        return;
      }

      lastSyncedNoteRef.current = syncedNote;
      localUpdatedAtRef.current = updatedAt;
      setLocalUpdatedAt(updatedAt);
      setLastSavedAt(updatedAt);
      setPendingSync(false);
      setSyncError(false);

      writeLocalNote(storageKey, {
        note: syncedNote,
        localUpdatedAt: updatedAt,
      });
    },
    onError: () => {
      setSyncError(true);
      setPendingSync(true);
    },
  });

  const scheduleRemoteSync = useCallback(
    (nextNote: string) => {
      if (!userId || !isOnline) {
        setPendingSync(true);
        return;
      }

      setPendingSync(true);
      setIsRemoteScheduled(true);

      if (remoteSaveTimeoutRef.current) {
        clearTimeout(remoteSaveTimeoutRef.current);
      }

      remoteSaveTimeoutRef.current = setTimeout(() => {
        setIsRemoteScheduled(false);
        mutation.mutate({ nextNote });
      }, REMOTE_SAVE_DEBOUNCE);
    },
    [isOnline, mutation, userId],
  );

  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  useEffect(() => {
    localUpdatedAtRef.current = localUpdatedAt;
  }, [localUpdatedAt]);

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
    const initialNote = stored?.note ?? '';
    const initialTimestamp = stored?.localUpdatedAt ?? null;

    setNoteState(initialNote);
    setLocalUpdatedAt(initialTimestamp);
    setLastSavedAt(initialTimestamp);
    setPendingSync(false);
    setSyncError(false);
    setIsRemoteScheduled(false);

    noteRef.current = initialNote;
    localUpdatedAtRef.current = initialTimestamp;
    lastSyncedNoteRef.current = initialNote;
    lastHandledRemoteAtRef.current = null;

    if (localSaveTimeoutRef.current) clearTimeout(localSaveTimeoutRef.current);
    if (remoteSaveTimeoutRef.current) clearTimeout(remoteSaveTimeoutRef.current);
  }, [storageKey]);

  useEffect(() => {
    if (!noteQuery.data) return;

    const remoteNote = noteQuery.data.dashboard_note ?? '';
    const remoteUpdatedAt = toTimestamp(noteQuery.data.dashboard_note_updated_at);
    const localNote = noteRef.current;
    const localTs = localUpdatedAtRef.current ?? 0;
    const remoteTs = remoteUpdatedAt ?? 0;

    if (lastHandledRemoteAtRef.current === remoteTs) return;
    lastHandledRemoteAtRef.current = remoteTs;

    if (remoteTs > localTs) {
      setNoteState(remoteNote);
      setLocalUpdatedAt(remoteTs || null);
      setLastSavedAt(remoteTs || null);
      setPendingSync(false);
      setSyncError(false);

      noteRef.current = remoteNote;
      localUpdatedAtRef.current = remoteTs;
      lastSyncedNoteRef.current = remoteNote;

      writeLocalNote(storageKey, {
        note: remoteNote,
        localUpdatedAt: remoteTs,
      });
      return;
    }

    if (localTs > remoteTs && localNote !== remoteNote) {
      if (userId && isOnline) {
        scheduleRemoteSync(localNote);
      } else {
        setPendingSync(true);
      }
      return;
    }

    lastSyncedNoteRef.current = remoteNote;
    setPendingSync(false);
  }, [isOnline, noteQuery.data, scheduleRemoteSync, storageKey, userId]);

  useEffect(() => {
    return () => {
      if (localSaveTimeoutRef.current) clearTimeout(localSaveTimeoutRef.current);
      if (remoteSaveTimeoutRef.current) clearTimeout(remoteSaveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOnline || !pendingSync || !userId) return;
    if (noteRef.current === lastSyncedNoteRef.current) {
      setPendingSync(false);
      return;
    }
    scheduleRemoteSync(noteRef.current);
  }, [isOnline, pendingSync, scheduleRemoteSync, userId]);

  const setNote = useCallback(
    (value: string) => {
      setNoteState(value);

      const updatedAt = Date.now();
      setLocalUpdatedAt(updatedAt);
      localUpdatedAtRef.current = updatedAt;
      noteRef.current = value;

      if (localSaveTimeoutRef.current) {
        clearTimeout(localSaveTimeoutRef.current);
      }

      localSaveTimeoutRef.current = setTimeout(() => {
        writeLocalNote(storageKey, {
          note: value,
          localUpdatedAt: updatedAt,
        });
      }, LOCAL_SAVE_DEBOUNCE);

      const hasUnsyncedChanges = value !== lastSyncedNoteRef.current;
      if (!hasUnsyncedChanges) {
        setPendingSync(false);
        setSyncError(false);
        setIsRemoteScheduled(false);
        return;
      }

      setPendingSync(true);
      setSyncError(false);

      if (!userId || !isOnline) return;
      scheduleRemoteSync(value);
    },
    [isOnline, scheduleRemoteSync, storageKey, userId],
  );

  const status = useMemo<DashboardNoteStatus>(() => {
    const hasUnsyncedChanges = note !== lastSyncedNoteRef.current;

    if (syncError && hasUnsyncedChanges) return 'error';
    if (!isOnline && hasUnsyncedChanges) return 'offline';
    if (hasUnsyncedChanges && (isRemoteScheduled || mutation.isPending || pendingSync)) {
      return 'saving';
    }
    return 'saved';
  }, [isOnline, isRemoteScheduled, mutation.isPending, note, pendingSync, syncError]);

  return {
    note,
    status,
    lastSavedAt,
    isLoading: noteQuery.isLoading,
    isOnline,
    setNote,
  };
}
