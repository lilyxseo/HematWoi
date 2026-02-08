import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { getCurrentUserId } from "../lib/session";
import { useMode } from "./useMode";

const STORAGE_KEY = "hw_dashboard_note_v1";
const STORAGE_UPDATED_KEY = "hw_dashboard_note_updated_at_v1";

const readLocalState = () => {
  try {
    return {
      note: localStorage.getItem(STORAGE_KEY) ?? "",
      updatedAt: localStorage.getItem(STORAGE_UPDATED_KEY) ?? null,
    };
  } catch {
    return { note: "", updatedAt: null };
  }
};

const writeLocalState = (note: string, updatedAt: string | null) => {
  try {
    localStorage.setItem(STORAGE_KEY, note);
    if (updatedAt) {
      localStorage.setItem(STORAGE_UPDATED_KEY, updatedAt);
    } else {
      localStorage.removeItem(STORAGE_UPDATED_KEY);
    }
  } catch {
    /* ignore */
  }
};

const toTimestamp = (value: string | null) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export function useDashboardNote() {
  const { mode } = useMode();
  const [userId, setUserId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [note, setNote] = useState(() => readLocalState().note);
  const [localUpdatedAt, setLocalUpdatedAt] = useState(
    () => readLocalState().updatedAt,
  );
  const [status, setStatus] = useState<
    "idle" | "saving" | "saved" | "offline" | "error"
  >("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    localUpdatedAt,
  );
  const skipLocalUpdateRef = useRef(false);
  const lastRemoteNoteRef = useRef<string | null>(null);
  const lastRemoteUpdatedAtRef = useRef<string | null>(null);
  const noteRef = useRef(note);
  const localUpdatedAtRef = useRef(localUpdatedAt);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    getCurrentUserId()
      .then((id) => {
        if (!active) return;
        setUserId(id ?? null);
      })
      .catch(() => {
        if (!active) return;
        setUserId(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const onlineMode = mode === "online";
  const isEffectivelyOffline = !onlineMode || !isOnline;
  const canSyncRemote = !isEffectivelyOffline && Boolean(userId);

  const dashboardNoteQuery = useQuery({
    queryKey: ["dashboard-note", userId],
    enabled: Boolean(userId) && canSyncRemote,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("dashboard_note,dashboard_note_updated_at")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async (nextNote: string) => {
      const { data, error } = await supabase
        .from("user_profiles")
        .update({ dashboard_note: nextNote })
        .eq("id", userId)
        .select("dashboard_note,dashboard_note_updated_at")
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: () => {
      if (!isEffectivelyOffline) {
        setStatus("saving");
      }
    },
    onSuccess: (data) => {
      if (!data) return;
      lastRemoteNoteRef.current = data.dashboard_note ?? "";
      lastRemoteUpdatedAtRef.current = data.dashboard_note_updated_at ?? null;
      setLastSavedAt(data.dashboard_note_updated_at ?? new Date().toISOString());
      if (data.dashboard_note_updated_at) {
        setLocalUpdatedAt(data.dashboard_note_updated_at);
      }
      setStatus("saved");
      queryClient.setQueryData(["dashboard-note", userId], data);
    },
    onError: () => {
      setStatus("error");
    },
  });

  useEffect(() => {
    if (!dashboardNoteQuery.data) return;
    const remoteNote = dashboardNoteQuery.data.dashboard_note ?? "";
    const remoteUpdatedAt = dashboardNoteQuery.data.dashboard_note_updated_at;
    const remoteTime = toTimestamp(remoteUpdatedAt ?? null);
    const localTime = toTimestamp(localUpdatedAtRef.current);
    const currentNote = noteRef.current;

    lastRemoteNoteRef.current = remoteNote;
    lastRemoteUpdatedAtRef.current = remoteUpdatedAt ?? null;

    if (remoteTime > localTime) {
      skipLocalUpdateRef.current = true;
      setNote(remoteNote);
      setLocalUpdatedAt(remoteUpdatedAt ?? null);
      setLastSavedAt(remoteUpdatedAt ?? null);
      setStatus("saved");
      return;
    }

    if (localTime > remoteTime && currentNote !== remoteNote && canSyncRemote) {
      updateNoteMutation.mutate(currentNote);
    }
  }, [dashboardNoteQuery.data, canSyncRemote, updateNoteMutation]);

  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  useEffect(() => {
    localUpdatedAtRef.current = localUpdatedAt;
  }, [localUpdatedAt]);

  useEffect(() => {
    if (skipLocalUpdateRef.current) {
      skipLocalUpdateRef.current = false;
      return;
    }
    const now = new Date().toISOString();
    setLocalUpdatedAt(now);
    if (isEffectivelyOffline) {
      setStatus("offline");
    } else if (userId) {
      setStatus("saving");
    } else {
      setStatus("idle");
    }
  }, [note, isEffectivelyOffline, userId]);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      writeLocalState(note, localUpdatedAt);
    }, 200);
    return () => window.clearTimeout(handler);
  }, [note, localUpdatedAt]);

  useEffect(() => {
    if (!canSyncRemote) return;
    if (note === lastRemoteNoteRef.current) return;
    const handler = window.setTimeout(() => {
      updateNoteMutation.mutate(note);
    }, 1000);
    return () => window.clearTimeout(handler);
  }, [note, canSyncRemote, updateNoteMutation]);

  useEffect(() => {
    if (!canSyncRemote) return;
    if (noteRef.current === lastRemoteNoteRef.current) return;
    updateNoteMutation.mutate(noteRef.current ?? "");
  }, [canSyncRemote, updateNoteMutation]);

  useEffect(() => {
    if (!canSyncRemote) return;
    if (updateNoteMutation.isPending) return;
    if (status === "error") return;
    if (note === lastRemoteNoteRef.current) return;
    setStatus("saving");
  }, [note, canSyncRemote, status, updateNoteMutation.isPending]);

  useEffect(() => {
    if (isEffectivelyOffline) {
      setStatus("offline");
    }
  }, [isEffectivelyOffline]);

  return {
    note,
    setNote,
    status,
    lastSavedAt,
  };
}
