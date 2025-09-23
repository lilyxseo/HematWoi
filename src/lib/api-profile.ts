import type { Session, User, AuthError, AuthIdentity } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type ThemePreference = 'system' | 'light' | 'dark';
export type NotificationSettings = {
  weekly_summary: boolean;
  monthly_summary: boolean;
  bill_due: boolean;
  goal_reminder: boolean;
};

export interface UserProfileRecord {
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
  created_at: string;
  updated_at: string;
}

export interface ProfilePayload {
  profile: UserProfileRecord;
  user: User;
}

export interface SessionSummary {
  id: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  expiresAt: string | null;
  isCurrent: boolean;
  userAgent?: string | null;
}

type AccountPayload = {
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

type PreferencesPayload = {
  theme?: ThemePreference;
  currency?: string;
  locale?: string;
  date_format?: string;
  timezone?: string;
};

type PasswordPayload = {
  current_password: string;
  new_password: string;
  sign_out_others?: boolean;
};

type ExportFormat = 'json' | 'csv';

type Provider = 'google' | 'github';

const PROFILE_TABLE = 'user_profiles';
const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  weekly_summary: true,
  monthly_summary: false,
  bill_due: true,
  goal_reminder: true,
};

const DEFAULT_ERROR = 'Terjadi kesalahan tak terduga. Coba lagi.';
const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

function devLog(message: string, payload?: unknown) {
  if (import.meta.env?.DEV) {
    console.debug(`[HW][profile-api] ${message}`, payload);
  }
}

function normalizeError(error: unknown, fallback = DEFAULT_ERROR): Error {
  devLog('error', error);
  if (!error) return new Error(fallback);
  if (typeof error === 'string') return new Error(error || fallback);
  if (error instanceof Error) return new Error(error.message || fallback);
  if (typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return new Error(((error as { message?: string }).message as string) || fallback);
  }
  return new Error(fallback);
}

function ensureNotifications(value?: unknown): NotificationSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_NOTIFICATIONS };
  const obj = value as Record<string, unknown>;
  return {
    weekly_summary: Boolean(obj.weekly_summary ?? DEFAULT_NOTIFICATIONS.weekly_summary),
    monthly_summary: Boolean(obj.monthly_summary ?? DEFAULT_NOTIFICATIONS.monthly_summary),
    bill_due: Boolean(obj.bill_due ?? DEFAULT_NOTIFICATIONS.bill_due),
    goal_reminder: Boolean(obj.goal_reminder ?? DEFAULT_NOTIFICATIONS.goal_reminder),
  };
}

function sanitizeAccountPayload(values: AccountPayload): AccountPayload {
  const result: AccountPayload = {};
  if (typeof values.full_name === 'string') {
    const trimmed = values.full_name.trim();
    result.full_name = trimmed.length > 0 ? trimmed : null;
  }
  if (typeof values.username === 'string') {
    const trimmed = values.username.trim().toLowerCase();
    result.username = trimmed.length > 0 ? trimmed : null;
  }
  if (typeof values.avatar_url === 'string') {
    result.avatar_url = values.avatar_url.trim();
  }
  return result;
}

function sanitizePreferences(values: PreferencesPayload): PreferencesPayload {
  const result: PreferencesPayload = {};
  if (values.theme && ['system', 'light', 'dark'].includes(values.theme)) {
    result.theme = values.theme;
  }
  if (typeof values.currency === 'string') {
    result.currency = values.currency.trim().toUpperCase();
  }
  if (typeof values.locale === 'string') {
    result.locale = values.locale;
  }
  if (typeof values.date_format === 'string') {
    result.date_format = values.date_format;
  }
  if (typeof values.timezone === 'string') {
    result.timezone = values.timezone;
  }
  return result;
}

function mapProfileRow(row: Record<string, unknown>): UserProfileRecord {
  return {
    id: String(row.id ?? ''),
    full_name: row.full_name === null ? null : (row.full_name as string | null),
    username: row.username === null ? null : (row.username as string | null),
    avatar_url: row.avatar_url === null ? null : (row.avatar_url as string | null),
    currency: String(row.currency ?? 'IDR'),
    locale: String(row.locale ?? 'id-ID'),
    date_format: String(row.date_format ?? 'DD/MM/YYYY'),
    timezone: String(row.timezone ?? 'Asia/Jakarta'),
    theme: (row.theme as ThemePreference) ?? 'system',
    notifications: ensureNotifications(row.notifications),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

async function ensureProfileRow(user: User): Promise<UserProfileRecord> {
  const basePayload = {
    id: user.id,
    full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    avatar_url: user.user_metadata?.avatar_url ?? null,
    username: user.user_metadata?.user_name ?? user.user_metadata?.preferred_username ?? null,
  };
  try {
    const { data, error } = await supabase.from(PROFILE_TABLE).select('*').eq('id', user.id).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    if (data) {
      return mapProfileRow(data as Record<string, unknown>);
    }
    const insertPayload = {
      ...basePayload,
      currency: 'IDR',
      locale: 'id-ID',
      date_format: 'DD/MM/YYYY',
      timezone: 'Asia/Jakarta',
      theme: 'system' as const,
      notifications: DEFAULT_NOTIFICATIONS,
    };
    const { data: inserted, error: insertError } = await supabase
      .from(PROFILE_TABLE)
      .insert(insertPayload)
      .select('*')
      .single();
    if (insertError) throw insertError;
    return mapProfileRow(inserted as Record<string, unknown>);
  } catch (error) {
    throw normalizeError(error, 'Tidak dapat memuat profil. Coba lagi.');
  }
}

export async function getSession(): Promise<{ user: User; session: Session | null }> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session?.user) {
      throw new Error('Pengguna tidak ditemukan. Silakan masuk kembali.');
    }
    return { user: data.session.user, session: data.session };
  } catch (error) {
    throw normalizeError(error, 'Tidak dapat memeriksa sesi. Silakan masuk kembali.');
  }
}

export async function getProfile(): Promise<ProfilePayload> {
  try {
    const { user } = await getSession();
    const profile = await ensureProfileRow(user);
    return { profile, user };
  } catch (error) {
    throw normalizeError(error, 'Tidak dapat memuat profil. Coba lagi.');
  }
}

async function usernameExists(username: string, excludeId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select('id')
    .eq('username', username)
    .neq('id', excludeId)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return Boolean(data);
}

async function usernameTaken(username: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return Boolean(data);
}

function validateUsername(username: string | null | undefined): string | null {
  if (!username) return null;
  const pattern = /^[a-z0-9_]{3,30}$/;
  if (!pattern.test(username)) {
    return 'Username hanya boleh huruf, angka, atau underscore (3-30 karakter).';
  }
  return null;
}

export async function updateAccount(values: AccountPayload): Promise<UserProfileRecord> {
  try {
    const { user } = await getSession();
    const payload = sanitizeAccountPayload(values);
    if (payload.username) {
      const errorMessage = validateUsername(payload.username);
      if (errorMessage) throw new Error(errorMessage);
      const exists = await usernameExists(payload.username, user.id);
      if (exists) {
        throw new Error('Username sudah digunakan. Silakan pilih yang lain.');
      }
    }
    const { data, error } = await supabase
      .from(PROFILE_TABLE)
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('*')
      .single();
    if (error) throw error;
    return mapProfileRow(data as Record<string, unknown>);
  } catch (error) {
    throw normalizeError(error, 'Tidak bisa menyimpan profil. Cek koneksi atau coba lagi.');
  }
}

export async function checkUsernameAvailability(username: string): Promise<boolean> {
  try {
    const normalized = username.trim().toLowerCase();
    if (!normalized) return false;
    const errorMessage = validateUsername(normalized);
    if (errorMessage) {
      throw new Error(errorMessage);
    }
    const taken = await usernameTaken(normalized);
    return !taken;
  } catch (error) {
    throw normalizeError(error, 'Tidak dapat memeriksa username.');
  }
}

export async function uploadAvatar(file: File): Promise<{ url: string; path: string; profile: UserProfileRecord }> {
  try {
    if (!file) throw new Error('File avatar tidak ditemukan.');
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      throw new Error('Format avatar harus PNG, JPG, JPEG, atau WEBP.');
    }
    if (file.size > MAX_AVATAR_SIZE) {
      throw new Error('Ukuran avatar maksimal 2MB.');
    }
    const { user } = await getSession();
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const storagePath = `${user.id}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(storagePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });
    if (uploadError) throw uploadError;
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(storagePath, 60, { download: false });
    if (signedUrlError) throw signedUrlError;
    const signedUrl = `${signedUrlData?.signedUrl ?? ''}&v=${Date.now()}`;
    const updatedProfile = await updateAccount({ avatar_url: storagePath });
    return { url: signedUrl, path: storagePath, profile: updatedProfile };
  } catch (error) {
    throw normalizeError(error, 'Gagal mengunggah avatar. Pastikan koneksi stabil.');
  }
}

export async function refreshAvatarUrl(path: string): Promise<string> {
  try {
    if (!path) throw new Error('Avatar belum tersedia.');
    const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 60, { download: false });
    if (error) throw error;
    return `${data?.signedUrl ?? ''}&v=${Date.now()}`;
  } catch (error) {
    throw normalizeError(error, 'Tidak dapat memuat avatar.');
  }
}

export async function updatePreferences(values: PreferencesPayload): Promise<UserProfileRecord> {
  try {
    const { user } = await getSession();
    const payload = sanitizePreferences(values);
    if (!Object.keys(payload).length) {
      const { profile } = await getProfile();
      return profile;
    }
    const { data, error } = await supabase
      .from(PROFILE_TABLE)
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('*')
      .single();
    if (error) throw error;
    return mapProfileRow(data as Record<string, unknown>);
  } catch (error) {
    throw normalizeError(error, 'Tidak dapat menyimpan preferensi. Coba lagi.');
  }
}

export async function updateNotifications(partial: Partial<NotificationSettings>): Promise<UserProfileRecord> {
  try {
    const { user } = await getSession();
    const { profile } = await getProfile();
    const merged = { ...profile.notifications, ...partial };
    const { data, error } = await supabase
      .from(PROFILE_TABLE)
      .update({ notifications: merged, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('*')
      .single();
    if (error) throw error;
    return mapProfileRow(data as Record<string, unknown>);
  } catch (error) {
    throw normalizeError(error, 'Tidak dapat memperbarui notifikasi. Coba lagi.');
  }
}

export async function changePassword(values: PasswordPayload): Promise<void> {
  try {
    if (values.new_password.length < 6) {
      throw new Error('Kata sandi baru minimal 6 karakter.');
    }
    const { user } = await getSession();
    if (!user.email) {
      throw new Error('Email akun tidak tersedia.');
    }
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: values.current_password,
    });
    if (verifyError) {
      throw new Error('Kata sandi saat ini salah.');
    }
    const { error } = await supabase.auth.updateUser({ password: values.new_password });
    if (error) throw error;
    if (values.sign_out_others) {
      await supabase.auth.signOut({ scope: 'others' });
    }
  } catch (error) {
    if ((error as AuthError)?.code === 'session_not_found') {
      throw normalizeError(error, 'Sesi tidak valid. Silakan masuk kembali.');
    }
    throw normalizeError(error, 'Tidak dapat mengubah kata sandi. Coba lagi.');
  }
}

export async function listSessions(): Promise<SessionSummary[]> {
  try {
    const { session } = await getSession();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
    const summaries: SessionSummary[] = [];
    if (session) {
      summaries.push({
        id: session.access_token ?? session.refresh_token ?? session.user?.id ?? 'current',
        createdAt: session.created_at ?? null,
        lastSignInAt: userData.user?.last_sign_in_at ?? session.user?.last_sign_in_at ?? null,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
        isCurrent: true,
        userAgent,
      });
    }
    return summaries;
  } catch (error) {
    throw normalizeError(error, 'Tidak dapat memuat sesi aktif.');
  }
}

export async function signOutSession(sessionId?: string): Promise<void> {
  try {
    if (!sessionId || sessionId === 'others') {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      return;
    }
    if (sessionId === 'all') {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
      return;
    }
    const scope = sessionId === 'current' ? 'local' : 'others';
    const { error } = await supabase.auth.signOut({ scope });
    if (error) throw error;
  } catch (error) {
    throw normalizeError(error, 'Tidak dapat keluar dari sesi. Coba lagi.');
  }
}

function formatCsvValue(value: unknown): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0] ?? {});
  const headerLine = headers.map((header) => formatCsvValue(header)).join(',');
  const body = rows
    .map((row) => headers.map((header) => formatCsvValue((row as Record<string, unknown>)[header])).join(','))
    .join('\n');
  return `${headerLine}\n${body}`;
}

async function fetchTable<T extends Record<string, unknown>>(table: string, userId: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').eq('user_id', userId);
  if (error) throw error;
  return (data as T[]) ?? [];
}

export async function exportUserData(format: ExportFormat): Promise<Blob> {
  try {
    const { user } = await getSession();
    const userId = user.id;
    const [transactions, categories, goals, debts, subscriptions] = await Promise.all([
      fetchTable('transactions', userId),
      fetchTable('categories', userId),
      fetchTable('goals', userId),
      fetchTable('debts', userId),
      fetchTable('subscriptions', userId),
    ]);
    if (format === 'json') {
      const json = JSON.stringify(
        {
          exported_at: new Date().toISOString(),
          transactions,
          categories,
          goals,
          debts,
          subscriptions,
        },
        null,
        2,
      );
      return new Blob([json], { type: 'application/json;charset=utf-8' });
    }
    const segments: string[] = [];
    const makeSection = (label: string, rows: Record<string, unknown>[]) => {
      if (!rows.length) return;
      segments.push(`# ${label}`);
      segments.push(toCsv(rows));
      segments.push('');
    };
    makeSection('transactions', transactions as Record<string, unknown>[]);
    makeSection('categories', categories as Record<string, unknown>[]);
    makeSection('goals', goals as Record<string, unknown>[]);
    makeSection('debts', debts as Record<string, unknown>[]);
    makeSection('subscriptions', subscriptions as Record<string, unknown>[]);
    return new Blob([segments.join('\n')], { type: 'text/csv;charset=utf-8' });
  } catch (error) {
    throw normalizeError(error, 'Tidak dapat mengekspor data saat ini.');
  }
}

function findIdentity(user: User | null, provider: Provider): AuthIdentity | null {
  if (!user?.identities) return null;
  return (user.identities as AuthIdentity[]).find((identity) => identity.provider === provider) ?? null;
}

export async function unlinkProvider(provider: Provider): Promise<void> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const identity = findIdentity(data.user, provider);
    if (!identity) {
      throw new Error('Akun belum terhubung ke penyedia ini.');
    }
    const { error: unlinkError } = await supabase.auth.unlinkIdentity({ identity_id: identity.identity_id });
    if (unlinkError) throw unlinkError;
  } catch (error) {
    throw normalizeError(error, 'Tidak dapat memutuskan sambungan penyedia.');
  }
}

export async function getLinkedProviders(): Promise<Provider[]> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const providers = (data.user?.identities as AuthIdentity[] | undefined)?.map((identity) => identity.provider) ?? [];
    return providers.filter((provider): provider is Provider => provider === 'google' || provider === 'github');
  } catch (error) {
    throw normalizeError(error, 'Tidak dapat memuat integrasi.');
  }
}

export async function requestAccountDeletion(): Promise<string> {
  try {
    const { user } = await getSession();
    const { error } = await supabase.functions.invoke('delete-account', {
      body: { userId: user.id, email: user.email },
    });
    if (error) throw error;
    return 'Permintaan penghapusan akun dikirim. Kami akan mengonfirmasi melalui email dalam 24 jam.';
  } catch (error) {
    devLog('delete-account fallback', error);
    return 'Permintaan penghapusan akun dicatat. Jika tidak menerima balasan, kirim email ke support@hematwoi.app.';
  }
}
