import { supabase } from "./supabase";

export interface UserSettings {
  user_id: string;
  accent_color: string | null;
}

export const ACCENT_HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeAccentHex(input: string): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed) {
    throw new Error("Warna aksen wajib diisi");
  }

  const prefixed = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;

  if (!ACCENT_HEX_PATTERN.test(prefixed)) {
    throw new Error("Format warna harus #RGB atau #RRGGBB");
  }

  const hex = prefixed.length === 4
    ? `#${prefixed[1]}${prefixed[1]}${prefixed[2]}${prefixed[2]}${prefixed[3]}${prefixed[3]}`
    : prefixed;

  return hex.toUpperCase();
}

export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("user_id, accent_color")
    .eq("user_id", userId)
    .maybeSingle<UserSettings>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function upsertAccentColor(userId: string, hex: string): Promise<UserSettings | null> {
  const normalized = normalizeAccentHex(hex);

  const { data, error } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, accent_color: normalized }, { onConflict: "user_id" })
    .select("user_id, accent_color")
    .maybeSingle<UserSettings>();

  if (error) {
    throw error;
  }

  return data ?? null;
}
