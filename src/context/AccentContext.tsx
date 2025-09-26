import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  getUserSettings,
  normalizeAccentHex,
  upsertAccentColor,
} from "../lib/api-user-settings";
import { supabase } from "../lib/supabase";

const DEFAULT_ACCENT = "#3898F8";
const STORAGE_KEY = "hw:accent-color";

type AccentContextValue = {
  accent: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
  setAccent: (hex: string) => Promise<{ ok: boolean; error?: string }>;
  refresh: () => Promise<void>;
};

const AccentContext = createContext<AccentContextValue | undefined>(undefined);

const fallbackValue: AccentContextValue = {
  accent: DEFAULT_ACCENT,
  loading: false,
  saving: false,
  error: null,
  setAccent: async () => ({ ok: true as const }),
  refresh: async () => {},
};

function readStoredAccent(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    try {
      return normalizeAccentHex(stored);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

type RgbColor = { r: number; g: number; b: number };

function hexToRgb(hex: string): RgbColor {
  const normalized = hex.slice(1);
  const full =
    normalized.length === 3
      ? `${normalized[0]}${normalized[0]}${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}`
      : normalized;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return { r, g, b };
}

function rgbChannelToHex(channel: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(channel)));
  return clamped.toString(16).padStart(2, "0");
}

function rgbToHex(color: RgbColor): string {
  return `#${rgbChannelToHex(color.r)}${rgbChannelToHex(color.g)}${rgbChannelToHex(color.b)}`.toUpperCase();
}

function mixColors(base: string, target: string, amount: number): string {
  const t = Math.max(0, Math.min(1, amount));
  const source = hexToRgb(base);
  const mix = hexToRgb(target);
  return rgbToHex({
    r: source.r * (1 - t) + mix.r * t,
    g: source.g * (1 - t) + mix.g * t,
    b: source.b * (1 - t) + mix.b * t,
  });
}

function lighten(hex: string, amount: number): string {
  return mixColors(hex, "#ffffff", amount);
}

function darken(hex: string, amount: number): string {
  return mixColors(hex, "#000000", amount);
}

function channelToLinear(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function getContrastText(color: RgbColor): string {
  const luminance =
    0.2126 * channelToLinear(color.r) +
    0.7152 * channelToLinear(color.g) +
    0.0722 * channelToLinear(color.b);
  return luminance > 0.58 ? "#0B1220" : "#FFFFFF";
}

export function useAccent(): AccentContextValue {
  const context = useContext(AccentContext);
  return context ?? fallbackValue;
}

export function AccentProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<string>(DEFAULT_ACCENT);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const applyAccent = useCallback((hex: string) => {
    const normalized = normalizeAccentHex(hex);
    setAccentState(normalized);

    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      /* ignore quota errors */
    }

    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    const rgb = hexToRgb(normalized);
    root.style.setProperty("--accent", normalized);
    root.style.setProperty("--accent-rgb", `${rgb.r} ${rgb.g} ${rgb.b}`);
    root.style.setProperty("--accent-soft", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);
    root.style.setProperty("--accent-ring", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`);
    root.style.setProperty("--accent-hover", lighten(normalized, 0.12));
    root.style.setProperty("--accent-active", darken(normalized, 0.18));
    root.style.setProperty("--accent-foreground", getContrastText(rgb));
  }, []);

  const resolveAccent = useCallback(
    async (uid: string | null): Promise<string> => {
      const stored = readStoredAccent();
      let next = stored ?? DEFAULT_ACCENT;

      if (uid) {
        try {
          const settings = await getUserSettings(uid);
          if (settings?.accent_color) {
            try {
              next = normalizeAccentHex(settings.accent_color);
            } catch {
              next = stored ?? DEFAULT_ACCENT;
            }
          } else if (stored) {
            next = stored;
            try {
              await upsertAccentColor(uid, stored);
            } catch {
              /* ignore sync failure - will retry later */
            }
          }
        } catch {
          next = stored ?? DEFAULT_ACCENT;
        }
      }

      return next;
    },
    []
  );

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUserId(data.session?.user?.id ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      data.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const nextAccent = await resolveAccent(userId);
      if (cancelled) return;
      applyAccent(nextAccent);
      setError(null);
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [userId, resolveAccent, applyAccent]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const nextAccent = await resolveAccent(userId);
    applyAccent(nextAccent);
    setError(null);
    setLoading(false);
  }, [applyAccent, resolveAccent, userId]);

  const setAccent = useCallback(
    async (hex: string) => {
      try {
        const normalized = normalizeAccentHex(hex);
        setError(null);
        applyAccent(normalized);

        if (userId) {
          setSaving(true);
          try {
            await upsertAccentColor(userId, normalized);
          } catch {
            setSaving(false);
            const message = "Gagal menyimpan warna aksen";
            setError(message);
            return { ok: false as const, error: message };
          }
          setSaving(false);
        }

        return { ok: true as const };
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Format warna harus #RGB atau #RRGGBB";
        setError(message);
        return { ok: false as const, error: message };
      }
    },
    [applyAccent, userId]
  );

  const value = useMemo(
    () => ({ accent, loading, saving, error, setAccent, refresh }),
    [accent, loading, saving, error, setAccent, refresh]
  );

  return <AccentContext.Provider value={value}>{children}</AccentContext.Provider>;
}
