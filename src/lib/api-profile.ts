import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

const PROFILE_TABLE = 'user_profiles';
const AVATAR_BUCKET = 'avatars';

export type ThemePreference = 'system' | 'light' | 'dark';
export type NotificationKey = 'weekly_summary' | 'monthly_summary' | 'bill_due' | 'goal_reminder';

export interface NotificationsSettings {
  weekly_summary: boolean;
  monthly_summary: boolean;
  bill_due: boolean;
  goal_reminder: boolean;
}

export interface ProfileRecord {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  currency: string;
  locale: string;
  date_format: string;
  timezone: string;
  theme: ThemePreference;
  notifications: NotificationsSettings;
  created_at: string | null;
  updated_at: string | null;
}

export interface SessionInfo {
  id: string;
  createdAt: string | null;
  expiresAt: string | null;
  lastSignInAt: string | null;
  deviceLabel: string;
  current: boolean;
  ipAddress?: string | null;
}

export interface UpdateAccountPayload {
  full_name?: string;
  username?: string;
  avatar_url?: string | null;
}

export interface UpdatePreferencesPayload {
  theme?: ThemePreference;
  currency?: string;
  locale?: string;
  date_format?: string;
  timezone?: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
  signOutOthers?: boolean;
}

const DEFAULT_NOTIFICATIONS: NotificationsSettings = {
  weekly_summary: true,
  monthly_summary: false,
  bill_due: true,
  goal_reminder: true,
};

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

function logDev(context: string, error: unknown) {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
    console.error('[HW][profile-api]', context, error);
  }
}

function createError(message: string): Error {
  return new Error(message);
}

function normalizeString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeProfileRow(row: any): ProfileRecord {
  const notificationsRaw = (row?.notifications ?? {}) as Partial<NotificationsSettings>;
  const notifications: NotificationsSettings = {
    ...DEFAULT_NOTIFICATIONS,
    ...(typeof notificationsRaw === 'object' && notificationsRaw ? notificationsRaw : {}),
  } as NotificationsSettings;

  return {
    id: String(row?.id ?? ''),
    full_name: normalizeString(row?.full_name),
    username: normalizeString(row?.username),
    avatar_url: typeof row?.avatar_url === 'string' ? row.avatar_url : null,
    currency: normalizeString(row?.currency) || 'IDR',
    locale: normalizeString(row?.locale) || 'id-ID',
    date_format: normalizeString(row?.date_format) || 'DD/MM/YYYY',
    timezone: normalizeString(row?.timezone) || 'Asia/Jakarta',
    theme: (['system', 'light', 'dark'] as ThemePreference[]).includes(row?.theme)
      ? (row.theme as ThemePreference)
      : 'system',
    notifications,
    created_at: typeof row?.created_at === 'string' ? row.created_at : null,
    updated_at: typeof row?.updated_at === 'string' ? row.updated_at : null,
  };
}

async function requireUser(context: string): Promise<User> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const user = data.user;
    if (!user) {
      throw createError('Sesi kamu berakhir. Silakan masuk kembali.');
    }
    return user;
  } catch (error) {
    logDev(`requireUser:${context}`, error);
    throw createError('Sesi kamu berakhir. Silakan masuk kembali.');
  }
}

export async function getSession(): Promise<{ user: User | null }> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return { user: data.user ?? null };
  } catch (error) {
    logDev('getSession', error);
    throw createError('Tidak bisa memuat sesi. Coba lagi.');
  }
}

export async function getProfile(): Promise<ProfileRecord> {
  const user = await requireUser('getProfile');
  try {
    const { data, error } = await supabase
      .from(PROFILE_TABLE)
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      return normalizeProfileRow(data);
    }
    const { data: inserted, error: insertError } = await supabase
      .from(PROFILE_TABLE)
      .insert({ id: user.id })
      .select('*')
      .single();
    if (insertError) throw insertError;
    return normalizeProfileRow(inserted);
  } catch (error) {
    logDev('getProfile', error);
    throw createError('Tidak bisa memuat profil. Coba lagi beberapa saat lagi.');
  }
}

export async function updateAccount(payload: UpdateAccountPayload): Promise<ProfileRecord> {
  const user = await requireUser('updateAccount');
  try {
    const updates: Record<string, any> = {};
    if (Object.prototype.hasOwnProperty.call(payload, 'full_name')) {
      updates.full_name = payload.full_name ? payload.full_name.trim() : null;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'username')) {
      const username = payload.username ? payload.username.trim().toLowerCase() : '';
      if (username && !USERNAME_REGEX.test(username)) {
        throw createError('Username hanya boleh huruf, angka, atau underscore (3-30 karakter).');
      }
      if (username) {
        const { data: existing, error: existingError } = await supabase
          .from(PROFILE_TABLE)
          .select('id')
          .eq('username', username)
          .neq('id', user.id)
          .maybeSingle();
        if (existingError && existingError.code !== 'PGRST116') {
          throw existingError;
        }
        if (existing) {
          throw createError('Username sudah dipakai. Pilih yang lain.');
        }
        updates.username = username;
      } else {
        updates.username = null;
      }
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'avatar_url')) {
      updates.avatar_url = payload.avatar_url ?? null;
    }
    if (Object.keys(updates).length === 0) {
      const { data } = await supabase
        .from(PROFILE_TABLE)
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      return normalizeProfileRow(data ?? {});
    }
    const { data, error } = await supabase
      .from(PROFILE_TABLE)
      .update(updates)
      .eq('id', user.id)
      .select('*')
      .single();
    if (error) throw error;
    return normalizeProfileRow(data);
  } catch (error) {
    logDev('updateAccount', error);
    if (error instanceof Error && error.message.includes('Username hanya')) {
      throw error;
    }
    if (error instanceof Error && error.message.includes('Username sudah')) {
      throw error;
    }
    throw createError('Tidak bisa menyimpan akun. Coba lagi.');
  }
}

export async function checkUsernameAvailability(username: string): Promise<boolean> {
  const user = await requireUser('checkUsernameAvailability');
  const normalized = username.trim().toLowerCase();
  if (!normalized) return false;
  if (!USERNAME_REGEX.test(normalized)) return false;
  try {
    const { data, error } = await supabase
      .from(PROFILE_TABLE)
      .select('id')
      .eq('username', normalized)
      .neq('id', user.id)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return !data;
  } catch (error) {
    logDev('checkUsernameAvailability', error);
    throw createError('Tidak bisa memeriksa ketersediaan username. Coba lagi.');
  }
}

function resolveAvatarExtension(file: File): string {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/jpeg') return file.name.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
  if (file.type === 'image/jpg') return 'jpg';
  const name = file.name.toLowerCase();
  if (name.endsWith('.png')) return 'png';
  if (name.endsWith('.webp')) return 'webp';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'jpg';
  return 'png';
}

export async function uploadAvatar(file: File): Promise<ProfileRecord> {
  const user = await requireUser('uploadAvatar');
  try {
    if (!(file instanceof File)) {
      throw createError('Berkas avatar tidak valid.');
    }
    if (!ALLOWED_AVATAR_TYPES.has(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
      throw createError('Format avatar harus PNG, JPG, atau WEBP.');
    }
    if (file.size > MAX_AVATAR_SIZE) {
      throw createError('Ukuran avatar maksimal 2MB.');
    }
    const ext = resolveAvatarExtension(file);
    const path = `${user.id}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(`avatars/${path}`, file, {
        upsert: true,
        contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        cacheControl: '3600',
      });
    if (uploadError) throw uploadError;

    const storage = supabase.storage.from(AVATAR_BUCKET);
    let publicUrl: string | null = null;
    try {
      const { data } = storage.getPublicUrl(`avatars/${path}`);
      publicUrl = data.publicUrl ?? null;
    } catch (urlError) {
      logDev('uploadAvatar:getPublicUrl', urlError);
    }
    if (!publicUrl) {
      const { data: signed, error: signedError } = await storage.createSignedUrl(`avatars/${path}`, 60);
      if (signedError) throw signedError;
      publicUrl = signed?.signedUrl ?? null;
    }
    if (!publicUrl) {
      throw createError('Gagal mengambil URL avatar.');
    }
    const versionedUrl = `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
    return await updateAccount({ avatar_url: versionedUrl });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Berkas avatar')) throw error;
    if (error instanceof Error && error.message.startsWith('Format avatar')) throw error;
    if (error instanceof Error && error.message.startsWith('Ukuran avatar')) throw error;
    logDev('uploadAvatar', error);
    throw createError('Tidak bisa mengunggah avatar. Coba lagi.');
  }
}

export async function updatePreferences(payload: UpdatePreferencesPayload): Promise<ProfileRecord> {
  const user = await requireUser('updatePreferences');
  try {
    const updates: Record<string, any> = {};
    if (payload.theme) {
      const theme = payload.theme;
      if (!['system', 'light', 'dark'].includes(theme)) {
        throw createError('Tema tidak valid.');
      }
      updates.theme = theme;
    }
    if (payload.currency) {
      updates.currency = payload.currency.trim().toUpperCase();
    }
    if (payload.locale) {
      updates.locale = payload.locale.trim();
    }
    if (payload.date_format) {
      updates.date_format = payload.date_format.trim();
    }
    if (payload.timezone) {
      updates.timezone = payload.timezone.trim();
    }
    if (Object.keys(updates).length === 0) {
      const { data } = await supabase
        .from(PROFILE_TABLE)
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      return normalizeProfileRow(data ?? {});
    }
    const { data, error } = await supabase
      .from(PROFILE_TABLE)
      .update(updates)
      .eq('id', user.id)
      .select('*')
      .single();
    if (error) throw error;
    return normalizeProfileRow(data);
  } catch (error) {
    if (error instanceof Error && error.message === 'Tema tidak valid.') throw error;
    logDev('updatePreferences', error);
    throw createError('Tidak bisa menyimpan preferensi. Coba lagi.');
  }
}

export async function updateNotifications(partial: Partial<NotificationsSettings>): Promise<ProfileRecord> {
  const user = await requireUser('updateNotifications');
  try {
    const nextNotifications: NotificationsSettings = {
      ...DEFAULT_NOTIFICATIONS,
      ...(partial ?? {}),
    };
    const { data, error } = await supabase
      .from(PROFILE_TABLE)
      .update({ notifications: nextNotifications })
      .eq('id', user.id)
      .select('*')
      .single();
    if (error) throw error;
    return normalizeProfileRow(data);
  } catch (error) {
    logDev('updateNotifications', error);
    throw createError('Tidak bisa menyimpan notifikasi. Coba lagi.');
  }
}

export async function changePassword({ current_password, new_password, signOutOthers }: ChangePasswordPayload): Promise<void> {
  const user = await requireUser('changePassword');
  try {
    const nextPassword = new_password?.trim();
    if (!nextPassword || nextPassword.length < 6) {
      throw createError('Kata sandi baru minimal 6 karakter.');
    }
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const email = userData.user?.email;
    if (email) {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: current_password,
      });
      if (reauthError) {
        throw createError('Kata sandi saat ini salah.');
      }
    }
    const { error } = await supabase.auth.updateUser({ password: nextPassword });
    if (error) throw error;
    if (signOutOthers) {
      const authAny = supabase.auth as unknown as { signOut?: (options?: { scope?: 'global' | 'local' | 'others' }) => Promise<{ error: any }>; };
      if (typeof authAny.signOut === 'function') {
        await authAny.signOut({ scope: 'others' });
      }
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes('minimal') || error.message.includes('salah'))) {
      throw error;
    }
    logDev('changePassword', error);
    throw createError('Tidak bisa mengubah kata sandi. Coba lagi.');
  }
}

export async function listSessions(): Promise<SessionInfo[]> {
  await requireUser('listSessions');
  try {
    const authAny = supabase.auth as unknown as {
      getSessions?: () => Promise<{ data: { sessions: Session[] | null }; error: any }>; // optional API
    };
    let sessions: Session[] = [];
    if (typeof authAny.getSessions === 'function') {
      const { data, error } = await authAny.getSessions();
      if (error) throw error;
      sessions = data.sessions ?? [];
    }
    if (sessions.length === 0) {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (data.session) {
        sessions = [data.session];
      }
    }
    const currentAccessToken = sessions[0]?.access_token ?? null;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    return sessions.map((session, index) => {
      const createdAt = session.user?.created_at ?? null;
      const lastSignInAt = session.user?.last_sign_in_at ?? null;
      const expiresAt = session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null;
      const token = session.access_token ?? '';
      const current = currentAccessToken ? token === currentAccessToken : index === 0;
      return {
        id: token || `${index}`,
        createdAt,
        expiresAt,
        lastSignInAt,
        deviceLabel: current ? formatDeviceLabel(ua) : 'Perangkat lain',
        current,
        ipAddress: (session as any).ip ?? null,
      };
    });
  } catch (error) {
    logDev('listSessions', error);
    throw createError('Tidak bisa mengambil daftar sesi. Coba lagi.');
  }
}

function formatDeviceLabel(ua: string): string {
  if (!ua) return 'Perangkat ini';
  const lower = ua.toLowerCase();
  if (lower.includes('iphone') || lower.includes('ipad')) return 'Perangkat iOS ini';
  if (lower.includes('android')) return 'Perangkat Android ini';
  if (lower.includes('mac os') || lower.includes('macintosh')) return 'Mac ini';
  if (lower.includes('windows')) return 'Windows PC ini';
  if (lower.includes('linux')) return 'Perangkat Linux ini';
  return 'Perangkat ini';
}

export async function signOutSession(scope: 'current' | 'others' | 'all' = 'current'): Promise<void> {
  await requireUser('signOutSession');
  try {
    const authAny = supabase.auth as unknown as {
      signOut?: (options?: { scope?: 'global' | 'local' | 'others' }) => Promise<{ error: any } | { data?: any; error?: any }>;
    };
    if (typeof authAny.signOut !== 'function') {
      throw createError('Fungsi keluar tidak tersedia.');
    }
    const scopeMap: Record<typeof scope, 'global' | 'local' | 'others'> = {
      current: 'local',
      others: 'others',
      all: 'global',
    };
    const result = await authAny.signOut({ scope: scopeMap[scope] });
    const error = (result as any)?.error;
    if (error) throw error;
  } catch (error) {
    if (error instanceof Error && error.message.includes('tidak tersedia')) throw error;
    logDev('signOutSession', error);
    throw createError('Tidak bisa keluar dari sesi. Coba lagi.');
  }
}

export async function unlinkProvider(provider: 'google' | 'github'): Promise<void> {
  await requireUser('unlinkProvider');
  try {
    const authAny = supabase.auth as unknown as {
      getUserIdentities?: () => Promise<{ data: { identities: Array<{ identity_id: string; provider: string }> | null }; error: any }>;
      unlinkIdentity?: (payload: { identity_id: string }) => Promise<{ data: any; error: any }>;
    };
    if (typeof authAny.getUserIdentities !== 'function' || typeof authAny.unlinkIdentity !== 'function') {
      throw createError('Pemutusan sambungan penyedia belum didukung.');
    }
    const { data, error } = await authAny.getUserIdentities();
    if (error) throw error;
    const identities = data.identities ?? [];
    const match = identities.find((item) => item.provider === provider);
    if (!match) {
      throw createError('Penyedia belum tersambung.');
    }
    const { error: unlinkError } = await authAny.unlinkIdentity({ identity_id: match.identity_id });
    if (unlinkError) throw unlinkError;
  } catch (error) {
    if (error instanceof Error && (error.message.includes('belum') || error.message.includes('Penyedia'))) {
      throw error;
    }
    logDev('unlinkProvider', error);
    throw createError('Tidak bisa memutuskan sambungan penyedia. Coba lagi.');
  }
}
