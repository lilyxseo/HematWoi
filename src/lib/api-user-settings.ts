import { supabase } from './supabase';

export interface UserSettingsRow {
  user_id: string;
  accent_color: string | null;
}

const HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeHex(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Warna aksen wajib diisi (ACC-01).');
  }
  const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (!HEX_REGEX.test(prefixed)) {
    throw new Error('Format warna tidak valid (ACC-02).');
  }
  const hex = prefixed.length === 4
    ? `#${prefixed[1]}${prefixed[1]}${prefixed[2]}${prefixed[2]}${prefixed[3]}${prefixed[3]}`
    : prefixed;
  return hex.toUpperCase();
}

export function normalizeAccentHex(input: string): string {
  return normalizeHex(input);
}

export async function getUserSettings(userId: string): Promise<UserSettingsRow | null> {
  if (!userId?.trim()) {
    throw new Error('ID pengguna tidak valid (ACC-10).');
  }

  const { data, error } = await supabase
    .from('user_settings')
    .select('user_id, accent_color')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error('Gagal memuat pengaturan warna (ACC-11).');
  }

  if (!data) {
    return null;
  }

  return {
    user_id: String(data.user_id),
    accent_color: typeof data.accent_color === 'string' ? data.accent_color : null,
  };
}

export async function upsertAccentColor(userId: string, hex: string): Promise<string> {
  if (!userId?.trim()) {
    throw new Error('ID pengguna tidak valid (ACC-20).');
  }
  const normalized = normalizeHex(hex);

  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, accent_color: normalized }, { onConflict: 'user_id' });

  if (error) {
    throw new Error('Gagal menyimpan warna aksen (ACC-21).');
  }

  return normalized;
}
