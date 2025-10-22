import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

const isDevelopment = Boolean(
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'),
);

function logDevError(scope: string, error: unknown) {
  if (isDevelopment) {
    // eslint-disable-next-line no-console
    console.error(`[HW][profile-api] ${scope}`, error);
  }
}

function wrapError(scope: string, error: unknown, fallback: string): never {
  logDevError(scope, error);
  if (error instanceof Error && error.message) {
    const wrapped = new Error(error.message);
    (wrapped as { cause?: unknown }).cause = error.cause ?? error;
    throw wrapped;
  }
  throw new Error(fallback);
}

export type ThemeMode = 'system' | 'light' | 'dark';

export interface ProfileNotifications {
  weekly_summary: boolean;
  monthly_summary: boolean;
  bill_due: boolean;
  goal_reminder: boolean;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  avatar_signed_url: string | null;
  currency: string;
  locale: string;
  date_format: string;
  timezone: string;
  theme: ThemeMode;
  notifications: ProfileNotifications;
  created_at: string;
  updated_at: string;
}

export interface SessionInfo {
  id: string;
  created_at: string | null;
  expires_at: string | null;
  last_sign_in_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  label: string;
  current: boolean;
}

export interface PasswordChangePayload {
  current_password: string;
  new_password: string;
  sign_out_other?: boolean;
}

export interface PasswordChangeResult {
  signed_out_other: boolean;
}

export interface PasswordCreatePayload {
  new_password: string;
  sign_out_other?: boolean;
}

function normalizeUsername(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed;
}

function validateUsername(username: string | null) {
  if (!username) return;
  if (username.length < 3 || username.length > 30) {
    throw new Error('Username harus 3-30 karakter.');
  }
  if (!/^[_a-z0-9]+$/.test(username)) {
    throw new Error('Username hanya boleh huruf, angka, atau underscore.');
  }
}

function sanitizePartial<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

const AVATAR_SIGNED_URL_TTL = 3600; // 1 hour

async function resolveAvatarUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const { data, error } = await supabase.storage
      .from('avatars')
      .createSignedUrl(path, AVATAR_SIGNED_URL_TTL);
    if (error) throw error;
    const signed = data?.signedUrl ?? null;
    if (!signed) return null;
    const cacheBuster = `v=${Date.now()}`;
    return signed.includes('?') ? `${signed}&${cacheBuster}` : `${signed}?${cacheBuster}`;
  } catch (error) {
    logDevError('resolveAvatarUrl', error);
    return null;
  }
}

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    wrapError('getUser', error, 'Tidak bisa memuat sesi.');
  }
  const user = data.user;
  if (!user) {
    throw new Error('Kamu belum masuk.');
  }
  return user;
}

async function mapProfileRow(row: any): Promise<UserProfile> {
  return {
    id: row.id,
    full_name: row.full_name ?? null,
    username: row.username ?? null,
    avatar_url: row.avatar_url ?? null,
    avatar_signed_url: await resolveAvatarUrl(row.avatar_url ?? null),
    currency: row.currency ?? 'IDR',
    locale: row.locale ?? 'id-ID',
    date_format: row.date_format ?? 'DD/MM/YYYY',
    timezone: row.timezone ?? 'Asia/Jakarta',
    theme: (row.theme as ThemeMode) ?? 'system',
    notifications: {
      weekly_summary: Boolean(row.notifications?.weekly_summary ?? true),
      monthly_summary: Boolean(row.notifications?.monthly_summary ?? false),
      bill_due: Boolean(row.notifications?.bill_due ?? true),
      goal_reminder: Boolean(row.notifications?.goal_reminder ?? true),
    },
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

export async function getSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return { user: data.session?.user ?? null };
  } catch (error) {
    wrapError('getSession', error, 'Tidak bisa memuat sesi.');
  }
}

export async function getProfile(): Promise<UserProfile> {
  try {
    const user = await requireUser();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    if (!data) {
      const defaults = {
        id: user.id,
        full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
        username: null,
        avatar_url: null,
        currency: 'IDR',
        locale: 'id-ID',
        date_format: 'DD/MM/YYYY',
        timezone: 'Asia/Jakarta',
        theme: 'system',
        notifications: {
          weekly_summary: true,
          monthly_summary: false,
          bill_due: true,
          goal_reminder: true,
        },
      };
      const { data: inserted, error: insertError } = await supabase
        .from('user_profiles')
        .insert(defaults)
        .select('*')
        .single();
      if (insertError) throw insertError;
      return mapProfileRow(inserted);
    }
    return mapProfileRow(data);
  } catch (error) {
    wrapError('getProfile', error, 'Tidak bisa memuat profil.');
  }
}

export async function checkUsernameAvailability(username: string): Promise<boolean> {
  try {
    const normalized = normalizeUsername(username);
    if (!normalized) {
      throw new Error('Username tidak valid.');
    }
    validateUsername(normalized);
    const user = await requireUser();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('username', normalized)
      .neq('id', user.id)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    return !data;
  } catch (error) {
    wrapError('checkUsernameAvailability', error, 'Tidak bisa mengecek username.');
  }
}

export async function updateAccount(payload: { full_name?: string; username?: string | null }): Promise<UserProfile> {
  try {
    const user = await requireUser();
    const updatePayload: Record<string, unknown> = {};
    if (payload.full_name !== undefined) {
      const fullName = payload.full_name?.trim();
      updatePayload.full_name = fullName ? fullName : null;
    }
    if (payload.username !== undefined) {
      const username = normalizeUsername(payload.username);
      if (username) {
        validateUsername(username);
        const available = await checkUsernameAvailability(username);
        if (!available) {
          throw new Error('Username sudah dipakai.');
        }
      }
      updatePayload.username = username;
    }
    if (Object.keys(updatePayload).length === 0) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return mapProfileRow(data);
    }
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updatePayload)
      .eq('id', user.id)
      .select('*')
      .single();
    if (error) throw error;
    return mapProfileRow(data);
  } catch (error) {
    wrapError('updateAccount', error, 'Tidak bisa menyimpan profil. Cek koneksi atau coba lagi.');
  }
}

export async function uploadAvatar(file: File): Promise<UserProfile> {
  try {
    if (!file) {
      throw new Error('File tidak ditemukan.');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('Ukuran avatar maksimal 2MB.');
    }
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Format avatar harus PNG, JPG, atau WEBP.');
    }
    const user = await requireUser();
    const extension = file.name?.split('.').pop()?.toLowerCase();
    const ext = extension && ['png', 'jpg', 'jpeg', 'webp'].includes(extension) ? extension : file.type.split('/')[1];
    const path = `avatars/${user.id}.${ext || 'png'}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });
    if (uploadError) throw uploadError;
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ avatar_url: path })
      .eq('id', user.id)
      .select('*')
      .single();
    if (error) throw error;
    return mapProfileRow(data);
  } catch (error) {
    wrapError('uploadAvatar', error, 'Tidak bisa mengunggah avatar.');
  }
}

export async function updatePreferences(payload: {
  theme?: ThemeMode;
  currency?: string;
  locale?: string;
  date_format?: string;
  timezone?: string;
}): Promise<UserProfile> {
  try {
    const user = await requireUser();
    const updatePayload = sanitizePartial({
      theme: payload.theme,
      currency: payload.currency?.trim(),
      locale: payload.locale?.trim(),
      date_format: payload.date_format?.trim(),
      timezone: payload.timezone?.trim(),
    });
    if (Object.keys(updatePayload).length === 0) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return mapProfileRow(data);
    }
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updatePayload)
      .eq('id', user.id)
      .select('*')
      .single();
    if (error) throw error;
    return mapProfileRow(data);
  } catch (error) {
    wrapError('updatePreferences', error, 'Tidak bisa menyimpan preferensi.');
  }
}

export async function updateNotifications(partial: Partial<ProfileNotifications>): Promise<UserProfile> {
  try {
    const user = await requireUser();
    const { data: current, error: currentError } = await supabase
      .from('user_profiles')
      .select('notifications')
      .eq('id', user.id)
      .single();
    if (currentError) throw currentError;
    const merged = {
      weekly_summary: Boolean(current?.notifications?.weekly_summary ?? true),
      monthly_summary: Boolean(current?.notifications?.monthly_summary ?? false),
      bill_due: Boolean(current?.notifications?.bill_due ?? true),
      goal_reminder: Boolean(current?.notifications?.goal_reminder ?? true),
      ...partial,
    } satisfies ProfileNotifications;
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ notifications: merged })
      .eq('id', user.id)
      .select('*')
      .single();
    if (error) throw error;
    return mapProfileRow(data);
  } catch (error) {
    wrapError('updateNotifications', error, 'Tidak bisa menyimpan notifikasi.');
  }
}

export async function changePassword(payload: PasswordChangePayload): Promise<PasswordChangeResult> {
  try {
    if (!payload.current_password || !payload.new_password) {
      throw new Error('Password lama dan baru wajib diisi.');
    }
    if (payload.new_password.length < 6) {
      throw new Error('Password baru minimal 6 karakter.');
    }
    if (payload.new_password === payload.current_password) {
      throw new Error('Password baru tidak boleh sama dengan password lama.');
    }
    const user = await requireUser();
    const email = user.email;
    if (!email) {
      throw new Error('Email akun tidak ditemukan.');
    }
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: payload.current_password,
    });
    if (reauthError) {
      throw new Error('Password lama salah.');
    }
    const { error } = await supabase.auth.updateUser({ password: payload.new_password });
    if (error) throw error;
    if (payload.sign_out_other) {
      await supabase.auth.signOut({ scope: 'global' });
      return { signed_out_other: true };
    }
    return { signed_out_other: false };
  } catch (error) {
    wrapError('changePassword', error, 'Tidak bisa mengganti password.');
  }
}

export async function createPassword(payload: PasswordCreatePayload): Promise<PasswordChangeResult> {
  try {
    if (!payload.new_password) {
      throw new Error('Password baru wajib diisi.');
    }
    if (payload.new_password.length < 6) {
      throw new Error('Password baru minimal 6 karakter.');
    }
    const user = await requireUser();
    const hasPassword = Boolean(
      user.identities?.some((identity: { provider?: string | null }) => identity.provider === 'email'),
    );
    if (hasPassword) {
      throw new Error('Password sudah tersedia untuk akun ini.');
    }
    const { error } = await supabase.auth.updateUser({ password: payload.new_password });
    if (error) throw error;
    if (payload.sign_out_other) {
      await supabase.auth.signOut({ scope: 'global' });
      return { signed_out_other: true };
    }
    return { signed_out_other: false };
  } catch (error) {
    wrapError('createPassword', error, 'Tidak bisa membuat password.');
  }
}

function detectDeviceLabel(agent: string | null | undefined) {
  if (!agent) return 'Perangkat tidak dikenal';
  const normalized = agent.toLowerCase();
  if (normalized.includes('iphone')) return 'iPhone';
  if (normalized.includes('ipad')) return 'iPad';
  if (normalized.includes('android')) return 'Android';
  if (normalized.includes('mac os')) return 'Mac';
  if (normalized.includes('windows')) return 'Windows';
  if (normalized.includes('linux')) return 'Linux';
  return 'Perangkat tidak dikenal';
}

function parseTimestamp(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed) && trimmed.length >= 10 && !Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return null;
}

function toNullableString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function buildCurrentSessionInfo(session: Session | null): SessionInfo | null {
  if (!session) return null;
  const browserAgent =
    typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
      ? navigator.userAgent
      : '';
  const storedAgent = (session.user as any)?.user_metadata?.user_agent as string | undefined;
  const agent = storedAgent || browserAgent || null;
  return {
    id: session.refresh_token ?? session.access_token ?? 'current',
    created_at: session.user?.created_at ?? null,
    expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    last_sign_in_at: session.user?.last_sign_in_at ?? null,
    ip_address: (session.user as any)?.user_metadata?.last_sign_in_ip ?? null,
    user_agent: agent,
    label: detectDeviceLabel(agent),
    current: true,
  };
}

function mapSessionRecord(row: any, activeTokens: Set<string>): SessionInfo | null {
  if (!row || typeof row !== 'object') return null;
  const rawId =
    row.session_id ?? row.id ?? row.sessionid ?? row.refresh_token ?? row.access_token ?? null;
  const id = rawId ? String(rawId) : null;
  if (!id) return null;
  const agent =
    toNullableString(row.user_agent ?? row.useragent ?? row.ua ?? row.device_agent ?? null) ?? null;
  const refreshToken = toNullableString(row.refresh_token ?? row.session_token ?? null);
  const accessToken = toNullableString(row.access_token ?? null);
  const isCurrentFlag = Boolean(row.is_current ?? row.current ?? false);
  const isCurrentCandidate = [refreshToken, accessToken, id].some(
    (token) => (token ? activeTokens.has(token) : false),
  );

  return {
    id,
    created_at: parseTimestamp(row.created_at ?? row.inserted_at ?? null),
    expires_at: parseTimestamp(row.expires_at ?? row.expire_at ?? row.expired_at ?? null),
    last_sign_in_at: parseTimestamp(
      row.last_sign_in_at ?? row.updated_at ?? row.last_active_at ?? row.created_at ?? null,
    ),
    ip_address: toNullableString(row.ip_address ?? row.ip ?? row.client_ip ?? null),
    user_agent: agent,
    label: detectDeviceLabel(agent),
    current: isCurrentFlag || isCurrentCandidate,
  };
}

function deduplicateSessions(sessions: SessionInfo[]): SessionInfo[] {
  const seen = new Set<string>();
  const result: SessionInfo[] = [];
  for (const session of sessions) {
    const key = session.id ?? JSON.stringify([session.user_agent, session.last_sign_in_at]);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(session);
  }
  return result;
}

export async function listSessions(): Promise<SessionInfo[]> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const session = data.session;
    if (!session) return [];

    const tokens = new Set<string>();
    if (session.access_token) tokens.add(session.access_token);
    if (session.refresh_token) tokens.add(session.refresh_token);

    let userId = session.user?.id ?? null;
    if (!userId) {
      try {
        const user = await requireUser();
        userId = user.id;
      } catch (userError) {
        logDevError('listSessions:requireUser', userError);
      }
    }

    const aggregated: SessionInfo[] = [];
    if (userId) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('list_user_sessions', {
          target_user_id: userId,
          user_id: userId,
        });
        if (!rpcError && Array.isArray(rpcData)) {
          for (const row of rpcData) {
            const mapped = mapSessionRecord(row, tokens);
            if (mapped) {
              aggregated.push(mapped);
            }
          }
        } else if (rpcError) {
          logDevError('listSessions:rpc', rpcError);
        }
      } catch (rpcError) {
        logDevError('listSessions:rpc-exception', rpcError);
      }
    }

    const currentInfo = buildCurrentSessionInfo(session);
    if (aggregated.length === 0) {
      return currentInfo ? [currentInfo] : [];
    }

    if (currentInfo && !aggregated.some((item) => item.current)) {
      aggregated.unshift(currentInfo);
    }

    return deduplicateSessions(aggregated);
  } catch (error) {
    wrapError('listSessions', error, 'Tidak bisa memuat sesi.');
  }
}

export async function signOutSession(sessionId?: string): Promise<void> {
  try {
    if (!sessionId) {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
      return;
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const currentRefresh = data.session?.refresh_token ?? null;
    const currentAccess = data.session?.access_token ?? null;
    if (sessionId === currentRefresh || sessionId === currentAccess) {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
      return;
    }
    try {
      const { error: rpcError } = await supabase.rpc('sign_out_session', {
        target_session_id: sessionId,
      });
      if (!rpcError) {
        return;
      }
      logDevError('signOutSession:rpc', rpcError);
    } catch (rpcError) {
      logDevError('signOutSession:rpc-exception', rpcError);
    }
    const { error: globalError } = await supabase.auth.signOut({ scope: 'others' });
    if (globalError) throw globalError;
  } catch (error) {
    wrapError('signOutSession', error, 'Tidak bisa keluar dari sesi.');
  }
}

export async function unlinkProvider(provider: 'google' | 'github'): Promise<void> {
  try {
    const user = await requireUser();
    const identity = user.identities?.find((item) => item.provider === provider);
    if (!identity) {
      throw new Error('Integrasi tidak ditemukan.');
    }
    const { error } = await supabase.auth.unlinkIdentity({ identityId: identity.identity_id });
    if (error) throw error;
  } catch (error) {
    wrapError('unlinkProvider', error, 'Tidak bisa memutuskan sambungan.');
  }
}

export async function requestAccountDeletion(): Promise<{ status: 'success' | 'unavailable'; message: string }> {
  try {
    const user = await requireUser();
    try {
      const { error } = await supabase.functions.invoke('delete-account', {
        body: { user_id: user.id },
      });
      if (error) throw error;
      await supabase.auth.signOut({ scope: 'global' });
      return { status: 'success', message: 'Permintaan hapus akun dikirim.' };
    } catch (invokeError) {
      logDevError('requestAccountDeletion:invoke', invokeError);
      return {
        status: 'unavailable',
        message: 'Hubungi tim dukungan untuk penghapusan akun. Belum ada otomatisasi tersedia.',
      };
    }
  } catch (error) {
    wrapError('requestAccountDeletion', error, 'Tidak bisa memproses hapus akun.');
  }
}

export async function exportUserData(): Promise<Record<string, unknown[]>> {
  try {
    const user = await requireUser();
    const tables = ['transactions', 'categories', 'goals', 'debts', 'subscriptions'];
    const result: Record<string, unknown[]> = {};
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*').eq('user_id', user.id);
      if (error) throw error;
      result[table] = Array.isArray(data) ? data : [];
    }
    return result;
  } catch (error) {
    wrapError('exportUserData', error, 'Tidak bisa mengekspor data.');
  }
}
