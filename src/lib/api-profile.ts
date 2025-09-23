import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

const PROFILE_TABLE = 'user_profiles';
const AVATAR_BUCKET = 'avatars';

export type ThemePreference = 'system' | 'light' | 'dark';

export type NotificationSettings = {
  weekly_summary: boolean;
  monthly_summary: boolean;
  bill_due: boolean;
  goal_reminder: boolean;
};

export type UserProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  currency: string;
  locale: string;
  date_format: string;
  timezone: string;
  theme: ThemePreference;
  notifications: NotificationSettings;
  created_at?: string | null;
  updated_at?: string | null;
};

export type LinkedProvider = {
  id: string;
  provider: 'google' | 'github';
  email?: string | null;
  last_sign_in_at?: string | null;
};

export type SessionInfo = {
  id: string;
  isCurrent: boolean;
  lastSeenAt: string | null;
  userAgent: string | null;
  expiresAt: string | null;
};

type UploadResult = {
  storedPath: string;
  signedUrl: string;
};

type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
  sign_out_others?: boolean;
};

type UpdateAccountPayload = {
  full_name?: string | null;
  username?: string | null;
};

type UpdatePreferencesPayload = {
  theme?: ThemePreference;
  currency?: string;
  locale?: string;
  date_format?: string;
  timezone?: string;
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  weekly_summary: true,
  monthly_summary: false,
  bill_due: true,
  goal_reminder: true,
};

function logDevError(context: string, error: unknown) {
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.error(`[HW][profile-api][${context}]`, error);
  }
}

function toFriendlyError(message: string, error: unknown, context: string): Error {
  logDevError(context, error);
  return new Error(message);
}

function sanitizeUsername(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed;
}

function validateUsername(username: string) {
  const regex = /^[a-z0-9_]{3,30}$/;
  if (!regex.test(username)) {
    throw new Error('Username hanya boleh huruf, angka, atau underscore (3-30 karakter).');
  }
}

function ensureNotificationShape(settings: unknown): NotificationSettings {
  if (!settings || typeof settings !== 'object') {
    return { ...DEFAULT_NOTIFICATIONS };
  }
  const normalized = settings as Partial<NotificationSettings>;
  return {
    weekly_summary: Boolean(normalized.weekly_summary ?? DEFAULT_NOTIFICATIONS.weekly_summary),
    monthly_summary: Boolean(normalized.monthly_summary ?? DEFAULT_NOTIFICATIONS.monthly_summary),
    bill_due: Boolean(normalized.bill_due ?? DEFAULT_NOTIFICATIONS.bill_due),
    goal_reminder: Boolean(normalized.goal_reminder ?? DEFAULT_NOTIFICATIONS.goal_reminder),
  };
}

function parseAvatarPath(value: string | null): { path: string | null; version: string | null } {
  if (!value) return { path: null, version: null };
  try {
    const [path, query] = value.split('?');
    if (!query) return { path, version: null };
    const params = new URLSearchParams(query);
    const version = params.get('v');
    return { path, version };
  } catch {
    return { path: value, version: null };
  }
}

async function createSignedAvatarUrl(pathWithVersion: string | null): Promise<string | null> {
  if (!pathWithVersion) return null;
  const { path, version } = parseAvatarPath(pathWithVersion);
  if (!path) return null;
  const relativePath = path.startsWith(`${AVATAR_BUCKET}/`) ? path.slice(AVATAR_BUCKET.length + 1) : path;
  try {
    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(relativePath, 60, { download: false });
    if (error) throw error;
    if (!data?.signedUrl) return null;
    const url = new URL(data.signedUrl);
    const versionStamp = version ?? Date.now().toString();
    url.searchParams.set('v', versionStamp);
    return url.toString();
  } catch (error) {
    logDevError('createSignedAvatarUrl', error);
    return null;
  }
}

async function ensureProfileRow(user: User): Promise<UserProfile> {
  try {
    const { data, error } = await supabase
      .from(PROFILE_TABLE)
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      return {
        ...data,
        notifications: ensureNotificationShape(data.notifications),
      } as UserProfile;
    }
  } catch (error) {
    logDevError('ensureProfileRow:select', error);
    throw toFriendlyError('Tidak dapat memuat profil. Coba lagi.', error, 'ensureProfileRow');
  }

  const defaults: UserProfile = {
    id: user.id,
    full_name:
      (user.user_metadata?.full_name as string | null) ||
      (user.user_metadata?.name as string | null) ||
      null,
    username: null,
    avatar_url: null,
    currency: 'IDR',
    locale: 'id-ID',
    date_format: 'DD/MM/YYYY',
    timezone: 'Asia/Jakarta',
    theme: 'system',
    notifications: { ...DEFAULT_NOTIFICATIONS },
  };

  try {
    const { data, error } = await supabase
      .from(PROFILE_TABLE)
      .insert({
        id: defaults.id,
        full_name: defaults.full_name,
        username: defaults.username,
        avatar_url: defaults.avatar_url,
        currency: defaults.currency,
        locale: defaults.locale,
        date_format: defaults.date_format,
        timezone: defaults.timezone,
        theme: defaults.theme,
        notifications: defaults.notifications,
      })
      .select('*')
      .single();
    if (error) throw error;
    return {
      ...data,
      notifications: ensureNotificationShape(data.notifications),
    } as UserProfile;
  } catch (error) {
    throw toFriendlyError('Tidak dapat menyiapkan profil. Coba lagi.', error, 'ensureProfileRow:insert');
  }
}

export async function getSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session ?? null;
  } catch (error) {
    throw toFriendlyError('Tidak dapat memeriksa sesi. Silakan coba lagi.', error, 'getSession');
  }
}

export async function getProfile(): Promise<{
  user: User;
  profile: UserProfile;
  avatarSignedUrl: string | null;
  linkedProviders: LinkedProvider[];
}> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const user = data.user;
    if (!user) {
      throw new Error('Pengguna belum masuk.');
    }
    const profile = await ensureProfileRow(user);
    const avatarSignedUrl = await createSignedAvatarUrl(profile.avatar_url);
    const linkedProviders: LinkedProvider[] = (user.identities || [])
      .map((identity) => ({
        id: identity.id,
        provider: identity.provider as LinkedProvider['provider'],
        email: (identity.identity_data as Record<string, unknown> | null)?.email as string | null,
        last_sign_in_at: identity.last_sign_in_at ?? null,
      }))
      .filter((item) => item.provider === 'google' || item.provider === 'github');
    return {
      user,
      profile,
      avatarSignedUrl,
      linkedProviders,
    };
  } catch (error) {
    throw toFriendlyError('Tidak dapat memuat profil. Cek koneksi atau coba lagi.', error, 'getProfile');
  }
}

export async function checkUsernameAvailability(username: string): Promise<boolean> {
  const normalized = sanitizeUsername(username);
  if (!normalized) return false;
  try {
    validateUsername(normalized);
  } catch (error) {
    return false;
  }
  try {
    const session = await getSession();
    const userId = session?.user?.id;
    const { data, error } = await supabase
      .from(PROFILE_TABLE)
      .select('id')
      .eq('username', normalized)
      .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return true;
    if (data[0]?.id === userId) return true;
    return false;
  } catch (error) {
    logDevError('checkUsernameAvailability', error);
    return false;
  }
}

export async function updateAccount(payload: UpdateAccountPayload): Promise<UserProfile> {
  try {
    const session = await getSession();
    const userId = session?.user?.id;
    if (!userId) throw new Error('Kamu perlu masuk untuk memperbarui profil.');

    const updates: Record<string, unknown> = {};
    if (payload.full_name !== undefined) {
      const value = payload.full_name?.trim();
      updates.full_name = value && value.length > 0 ? value : null;
    }
    if (payload.username !== undefined) {
      const normalized = sanitizeUsername(payload.username);
      if (normalized) {
        validateUsername(normalized);
        const { data, error } = await supabase
          .from(PROFILE_TABLE)
          .select('id')
          .eq('username', normalized)
          .neq('id', userId)
          .limit(1);
        if (error) throw error;
        if (data && data.length > 0) {
          throw new Error('Username sudah digunakan.');
        }
        updates.username = normalized;
      } else {
        updates.username = null;
      }
    }

    if (Object.keys(updates).length === 0) {
      const profile = await ensureProfileRow(session!.user!);
      return profile;
    }

    const { data, error } = await supabase
      .from(PROFILE_TABLE)
      .update(updates)
      .eq('id', userId)
      .select('*')
      .single();
    if (error) throw error;
    return {
      ...data,
      notifications: ensureNotificationShape(data.notifications),
    } as UserProfile;
  } catch (error) {
    throw toFriendlyError('Tidak bisa menyimpan profil. Cek koneksi atau coba lagi.', error, 'updateAccount');
  }
}

function resolveAvatarExtension(file: File): string {
  const type = file.type || '';
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  const name = file.name.toLowerCase();
  if (name.endsWith('.png')) return 'png';
  if (name.endsWith('.webp')) return 'webp';
  if (name.endsWith('.jpeg') || name.endsWith('.jpg')) return 'jpg';
  return 'png';
}

export async function uploadAvatar(file: File): Promise<UploadResult> {
  if (!file) {
    throw new Error('File avatar tidak ditemukan.');
  }
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
    throw new Error('Format avatar harus PNG, JPG, atau WEBP.');
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Ukuran avatar maksimal 2MB.');
  }
  try {
    const session = await getSession();
    const userId = session?.user?.id;
    if (!userId) throw new Error('Kamu perlu masuk untuk mengunggah avatar.');
    const extension = resolveAvatarExtension(file);
    const path = `${userId}.${extension}`;
    const storedPath = `${AVATAR_BUCKET}/${path}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, {
        contentType: file.type,
        upsert: true,
        cacheControl: '0',
      });
    if (uploadError) throw uploadError;

    const versionedPath = `${storedPath}?v=${Date.now()}`;
    const { data, error } = await supabase
      .from(PROFILE_TABLE)
      .update({ avatar_url: versionedPath })
      .eq('id', userId)
      .select('avatar_url')
      .single();
    if (error) throw error;

    const signedUrl = await createSignedAvatarUrl(data.avatar_url);
    if (!signedUrl) {
      throw new Error('Avatar terunggah, tetapi tidak bisa menampilkan pratinjau.');
    }

    return { storedPath: data.avatar_url, signedUrl };
  } catch (error) {
    throw toFriendlyError('Tidak dapat mengunggah avatar. Coba lagi.', error, 'uploadAvatar');
  }
}

export async function updatePreferences(payload: UpdatePreferencesPayload): Promise<UserProfile> {
  try {
    const session = await getSession();
    const userId = session?.user?.id;
    if (!userId) throw new Error('Kamu perlu masuk untuk menyimpan preferensi.');

    const updates: Record<string, unknown> = {};
    if (payload.theme) {
      if (!['system', 'light', 'dark'].includes(payload.theme)) {
        throw new Error('Tema tidak valid.');
      }
      updates.theme = payload.theme;
    }
    if (payload.currency) {
      updates.currency = String(payload.currency).toUpperCase();
    }
    if (payload.locale) {
      updates.locale = payload.locale;
    }
    if (payload.date_format) {
      updates.date_format = payload.date_format;
    }
    if (payload.timezone) {
      updates.timezone = payload.timezone;
    }

    if (Object.keys(updates).length === 0) {
      const profile = await ensureProfileRow(session!.user!);
      return profile;
    }

    const { data, error } = await supabase
      .from(PROFILE_TABLE)
      .update(updates)
      .eq('id', userId)
      .select('*')
      .single();
    if (error) throw error;
    return {
      ...data,
      notifications: ensureNotificationShape(data.notifications),
    } as UserProfile;
  } catch (error) {
    throw toFriendlyError('Tidak dapat menyimpan preferensi. Coba lagi.', error, 'updatePreferences');
  }
}

export async function updateNotifications(partial: Partial<NotificationSettings>): Promise<NotificationSettings> {
  try {
    const session = await getSession();
    const userId = session?.user?.id;
    if (!userId) throw new Error('Kamu perlu masuk untuk menyimpan notifikasi.');

    const currentProfile = await ensureProfileRow(session.user!);
    const next = {
      ...ensureNotificationShape(currentProfile.notifications),
      ...partial,
    };

    const { data, error } = await supabase
      .from(PROFILE_TABLE)
      .update({ notifications: next })
      .eq('id', userId)
      .select('notifications')
      .single();
    if (error) throw error;
    return ensureNotificationShape(data.notifications);
  } catch (error) {
    throw toFriendlyError('Tidak bisa menyimpan pengaturan notifikasi.', error, 'updateNotifications');
  }
}

export async function changePassword({
  current_password,
  new_password,
  sign_out_others = false,
}: ChangePasswordPayload): Promise<void> {
  if (!current_password || !new_password) {
    throw new Error('Isi kata sandi saat ini dan baru.');
  }
  if (new_password.length < 6) {
    throw new Error('Kata sandi baru minimal 6 karakter.');
  }
  try {
    const session = await getSession();
    const user = session?.user;
    if (!user || !user.email) {
      throw new Error('Tidak dapat memverifikasi akun. Masuk kembali.');
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current_password,
    });
    if (reauthError) {
      throw new Error('Kata sandi saat ini salah.');
    }

    const { error } = await supabase.auth.updateUser({ password: new_password });
    if (error) throw error;

    if (sign_out_others) {
      await supabase.auth.signOut({ scope: 'others' });
    }
  } catch (error) {
    throw toFriendlyError('Tidak dapat mengubah kata sandi. Coba lagi.', error, 'changePassword');
  }
}

export async function listSessions(): Promise<SessionInfo[]> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const session = data.session;
    if (!session) return [];
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
    return [
      {
        id: session.user?.id ? `${session.user.id}-current` : 'current-session',
        isCurrent: true,
        lastSeenAt: session.user?.last_sign_in_at ?? null,
        userAgent,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      },
    ];
  } catch (error) {
    throw toFriendlyError('Tidak bisa memuat sesi aktif.', error, 'listSessions');
  }
}

export async function signOutSession(sessionId?: string | null): Promise<void> {
  try {
    if (!sessionId || sessionId.endsWith('current')) {
      await supabase.auth.signOut();
      return;
    }
    await supabase.auth.signOut({ scope: 'others' });
  } catch (error) {
    throw toFriendlyError('Tidak dapat keluar dari sesi tersebut.', error, 'signOutSession');
  }
}

export async function unlinkProvider(identityId: string): Promise<void> {
  if (!identityId) {
    throw new Error('Identitas tidak ditemukan.');
  }
  try {
    const { error } = await supabase.auth.unlinkIdentity({ identity_id: identityId });
    if (error) throw error;
  } catch (error) {
    throw toFriendlyError('Tidak dapat memutuskan sambungan akun sosial.', error, 'unlinkProvider');
  }
}

export async function refreshAvatarUrl(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const user = data.user;
    if (!user) return null;
    const profile = await ensureProfileRow(user);
    return createSignedAvatarUrl(profile.avatar_url);
  } catch (error) {
    throw toFriendlyError('Tidak dapat memperbarui avatar.', error, 'refreshAvatarUrl');
  }
}
