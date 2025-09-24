import { supabase } from './supabase';

type AccessLevel = 'public' | 'user' | 'admin';

type RouteRow = {
  id: string | number;
  route: string;
  access_level: AccessLevel;
  is_enabled: boolean;
  updated_at?: string | null;
};

type UserProfileRow = {
  id: string;
  email?: string | null;
  username?: string | null;
  role: 'user' | 'admin';
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

const isDevelopment = Boolean(
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'),
);

function logDevError(scope: string, error: unknown) {
  if (!isDevelopment) return;
  // eslint-disable-next-line no-console
  console.error(`[admin-api:${scope}]`, error);
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

export async function listRoutes(): Promise<RouteRow[]> {
  try {
    const { data, error } = await supabase
      .from('app_routes_access')
      .select('id, route, access_level, is_enabled, updated_at')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      route: row.route ?? '',
      access_level: (row.access_level as AccessLevel) ?? 'public',
      is_enabled: Boolean(row.is_enabled),
      updated_at: row.updated_at ?? null,
    }));
  } catch (error) {
    wrapError('listRoutes', error, 'Gagal memuat daftar akses.');
  }
}

export async function upsertRoute(payload: {
  route: string;
  access_level: AccessLevel;
  is_enabled: boolean;
}): Promise<RouteRow> {
  try {
    const { data, error } = await supabase
      .from('app_routes_access')
      .upsert(
        { route: payload.route, access_level: payload.access_level, is_enabled: payload.is_enabled },
        { onConflict: 'route' },
      )
      .select('id, route, access_level, is_enabled, updated_at')
      .single();
    if (error) throw error;
    return {
      id: data.id,
      route: data.route ?? payload.route,
      access_level: (data.access_level as AccessLevel) ?? payload.access_level,
      is_enabled: Boolean(data.is_enabled ?? payload.is_enabled),
      updated_at: data.updated_at ?? null,
    };
  } catch (error) {
    wrapError('upsertRoute', error, 'Gagal menyimpan akses route.');
  }
}

export async function deleteRoute(id: string | number) {
  try {
    const { error } = await supabase.from('app_routes_access').delete().eq('id', id);
    if (error) throw error;
  } catch (error) {
    wrapError('deleteRoute', error, 'Gagal menghapus route.');
  }
}

export async function listUsers(): Promise<UserProfileRow[]> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, email, username, role, is_active, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      email: row.email ?? null,
      username: row.username ?? null,
      role: ((row.role as string) === 'admin' ? 'admin' : 'user') as 'user' | 'admin',
      is_active: row.is_active !== false,
      created_at: row.created_at ?? null,
      updated_at: row.updated_at ?? null,
    }));
  } catch (error) {
    wrapError('listUsers', error, 'Gagal memuat daftar pengguna.');
  }
}

export async function updateUserProfile(
  id: string,
  updates: Partial<{ role: 'user' | 'admin'; is_active: boolean }>,
): Promise<UserProfileRow> {
  try {
    const payload = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined),
    );
    const { data, error } = await supabase
      .from('user_profiles')
      .update(payload)
      .eq('id', id)
      .select('id, email, username, role, is_active, created_at, updated_at')
      .single();
    if (error) throw error;
    return {
      id: data.id,
      email: data.email ?? null,
      username: data.username ?? null,
      role: ((data.role as string) === 'admin' ? 'admin' : 'user') as 'user' | 'admin',
      is_active: data.is_active !== false,
      created_at: data.created_at ?? null,
      updated_at: data.updated_at ?? null,
    };
  } catch (error) {
    wrapError('updateUserProfile', error, 'Gagal memperbarui profil pengguna.');
  }
}

export async function createUserProfile(payload: {
  id?: string;
  username?: string | null;
  role: 'user' | 'admin';
  is_active: boolean;
}): Promise<UserProfileRow> {
  try {
    const insertPayload: Record<string, unknown> = {
      username: payload.username ?? null,
      role: payload.role,
      is_active: payload.is_active,
    };
    if (payload.id) {
      insertPayload.id = payload.id;
    }
    const { data, error } = await supabase
      .from('user_profiles')
      .insert(insertPayload)
      .select('id, email, username, role, is_active, created_at, updated_at')
      .single();
    if (error) throw error;
    return {
      id: data.id,
      email: data.email ?? null,
      username: data.username ?? null,
      role: ((data.role as string) === 'admin' ? 'admin' : 'user') as 'user' | 'admin',
      is_active: data.is_active !== false,
      created_at: data.created_at ?? null,
      updated_at: data.updated_at ?? null,
    };
  } catch (error) {
    wrapError('createUserProfile', error, 'Gagal membuat profil pengguna.');
  }
}

export async function getAppDescription(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'app_description')
      .maybeSingle();
    if (error) throw error;
    const raw = data?.value ?? {};
    if (raw && typeof raw === 'object' && 'text' in raw && typeof raw.text === 'string') {
      return raw.text;
    }
    return '';
  } catch (error) {
    wrapError('getAppDescription', error, 'Gagal memuat deskripsi aplikasi.');
  }
}

export async function setAppDescription(text: string) {
  try {
    const payload = { key: 'app_description', value: { text } };
    const { error } = await supabase
      .from('app_settings')
      .upsert(payload, { onConflict: 'key' });
    if (error) throw error;
  } catch (error) {
    wrapError('setAppDescription', error, 'Gagal menyimpan deskripsi aplikasi.');
  }
}

export type {
  RouteRow as AdminRouteAccess,
  UserProfileRow as AdminUserProfile,
  AccessLevel as AdminAccessLevel,
};
