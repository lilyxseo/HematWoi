import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import {
  getUserSettings,
  normalizeAccentHex,
  upsertAccentColor,
} from '../lib/api-user-settings';

const STORAGE_KEY = 'hw:accent';
export const DEFAULT_ACCENT = '#3898F8';

type AccentUpdateResult = {
  hex: string;
  synced: boolean;
  error?: Error;
};

type AccentContextValue = {
  accent: string;
  loading: boolean;
  lastErrorId: string | null;
  setAccent: (hex: string) => Promise<AccentUpdateResult>;
};

const AccentContext = createContext<AccentContextValue | undefined>(undefined);

function expandHex(value: string) {
  const clean = value.replace('#', '');
  if (clean.length === 3) {
    return `#${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`.toUpperCase();
  }
  if (clean.length === 6) {
    return `#${clean}`.toUpperCase();
  }
  return value.toUpperCase();
}

function readLocalAccent(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return normalizeAccentHex(stored);
  } catch {
    return null;
  }
}

function writeLocalAccent(hex: string) {
  try {
    localStorage.setItem(STORAGE_KEY, hex);
  } catch {
    /* ignore */
  }
}

function parseHexToRgb(hex: string): string | null {
  const normalized = expandHex(hex);
  if (!normalized.startsWith('#') || normalized.length !== 7) {
    return null;
  }
  const value = Number.parseInt(normalized.slice(1), 16);
  if (Number.isNaN(value)) {
    return null;
  }
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `${r} ${g} ${b}`;
}

function applyToDocument(hex: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--accent', hex);
  const rgb = parseHexToRgb(hex);
  if (rgb) {
    root.style.setProperty('--accent-rgb', rgb);
  }
}

export function AccentProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<string>(() => readLocalAccent() ?? DEFAULT_ACCENT);
  const [loading, setLoading] = useState(true);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [lastErrorId, setLastErrorId] = useState<string | null>(null);

  const commitAccent = useCallback((hex: string) => {
    const normalized = normalizeAccentHex(hex);
    setAccentState(normalized);
    applyToDocument(normalized);
    writeLocalAccent(normalized);
    return normalized;
  }, []);

  const syncForUser = useCallback(
    async (userId: string) => {
      const localAccent = readLocalAccent();
      let resolved = localAccent ?? DEFAULT_ACCENT;
      try {
        const remote = await getUserSettings(userId);
        const remoteAccent = remote?.accent_color ? normalizeAccentHex(remote.accent_color) : null;
        if (remoteAccent) {
          resolved = remoteAccent;
        } else if (localAccent) {
          resolved = normalizeAccentHex(localAccent);
          await upsertAccentColor(userId, resolved);
        }
      } catch {
        setLastErrorId('ACC-31');
      }
      commitAccent(resolved);
    },
    [commitAccent],
  );

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      setLoading(true);
      commitAccent(readLocalAccent() ?? DEFAULT_ACCENT);
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!active) return;
        if (error) throw error;
        const userId = data.session?.user?.id ?? null;
        setSessionUserId(userId);
        if (userId) {
          await syncForUser(userId);
        }
      } catch {
        if (active) {
          setLastErrorId('ACC-30');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void bootstrap();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const userId = session?.user?.id ?? null;
      setSessionUserId(userId);
      if (userId) {
        void syncForUser(userId);
      } else {
        const local = readLocalAccent() ?? DEFAULT_ACCENT;
        commitAccent(local);
      }
    });

    return () => {
      active = false;
      subscription.subscription?.unsubscribe();
    };
  }, [commitAccent, syncForUser]);

  const setAccent = useCallback(
    async (hex: string): Promise<AccentUpdateResult> => {
      setLastErrorId(null);
      const normalized = commitAccent(hex);
      if (!sessionUserId) {
        return { hex: normalized, synced: false };
      }
      try {
        await upsertAccentColor(sessionUserId, normalized);
        return { hex: normalized, synced: true };
      } catch (error) {
        setLastErrorId('ACC-32');
        return {
          hex: normalized,
          synced: false,
          error: error instanceof Error ? error : new Error('ACC-32'),
        };
      }
    },
    [commitAccent, sessionUserId],
  );

  const value = useMemo(
    () => ({
      accent,
      loading,
      lastErrorId,
      setAccent,
    }),
    [accent, lastErrorId, loading, setAccent],
  );

  return <AccentContext.Provider value={value}>{children}</AccentContext.Provider>;
}

export function useAccent(): AccentContextValue {
  const ctx = useContext(AccentContext);
  if (!ctx) {
    throw new Error('useAccent harus dipakai di dalam AccentProvider');
  }
  return ctx;
}
