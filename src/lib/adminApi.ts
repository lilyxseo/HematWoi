import type { PostgrestSingleResponse } from '@supabase/supabase-js';
import { supabase } from './supabase';

type AccessLevel = 'public' | 'user' | 'admin';

export type RouteAccessRecord = {
  id: string;
  route: string;
  access_level: AccessLevel;
  is_enabled: boolean;
  updated_at: string | null;
  created_at?: string | null;
};

export type UpsertRouteInput = {
  id?: string;
  route: string;
  access_level: AccessLevel;
  is_enabled: boolean;
};

type UserRole = 'user' | 'admin';

export type UserProfileRecord = {
  id: string;
  email?: string | null;
  username?: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string | null;
  updated_at?: string | null;
};

export type CreateUserProfileInput = {
  id?: string;
  username?: string;
  email?: string;
  role: UserRole;
  is_active: boolean;
};

export type UpdateUserProfileInput = Partial<Pick<UserProfileRecord, 'role' | 'is_active'>>;

type Nullable<T> = T | null;

function ensureResponse<T>(response: PostgrestSingleResponse<T>): T {
  if (response.error) {
    throw response.error;
  }
  return response.data as T;
}

function isUnknownColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: string }).code) : '';
  if (code === '42703') return true;
  const message = 'message' in error ? String((error as { message?: string }).message).toLowerCase() : '';
  return message.includes('column') && message.includes('email');
}

function sanitizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value == null) return fallback;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === 'true' || value === '1';
  return fallback;
}

function mapUserProfileRow(row: any): UserProfileRecord {
  return {
    id: String(row?.id ?? ''),
    email: 'email' in (row ?? {}) ? row.email ?? null : null,
    username: row?.username ?? null,
    role: (row?.role as UserRole) === 'admin' ? 'admin' : 'user',
    is_active: sanitizeBoolean(row?.is_active, true),
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

export async function listRoutes(): Promise<RouteAccessRecord[]> {
  const { data, error } = await supabase
    .from('app_routes_access')
    .select('id, route, access_level, is_enabled, updated_at, created_at')
    .order('route', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => ({
    id: String(
      item.id ??
        item.route ??
        globalThis.crypto?.randomUUID?.() ??
        Math.random().toString(36).slice(2)
    ),
    route: String(item.route ?? ''),
    access_level: (item.access_level as AccessLevel) ?? 'public',
    is_enabled: sanitizeBoolean(item.is_enabled, true),
    updated_at: item.updated_at ?? null,
    created_at: item.created_at ?? null,
  }));
}

export async function upsertRoute(input: UpsertRouteInput): Promise<RouteAccessRecord> {
  const payload: Record<string, unknown> = {
    route: input.route,
    access_level: input.access_level,
    is_enabled: input.is_enabled,
  };

  if (input.id) {
    payload.id = input.id;
  }

  const response = await supabase
    .from('app_routes_access')
    .upsert(payload, { onConflict: 'route' })
    .select('id, route, access_level, is_enabled, updated_at, created_at')
    .single();

  const data = ensureResponse(response);

  return {
    id: String(
      data.id ??
        input.id ??
        data.route ??
        globalThis.crypto?.randomUUID?.() ??
        Math.random().toString(36).slice(2)
    ),
    route: String(data.route ?? input.route),
    access_level: (data.access_level as AccessLevel) ?? input.access_level,
    is_enabled: sanitizeBoolean(data.is_enabled, input.is_enabled),
    updated_at: data.updated_at ?? null,
    created_at: data.created_at ?? null,
  };
}

export async function deleteRoute(id: string): Promise<void> {
  const { error } = await supabase.from('app_routes_access').delete().eq('id', id);
  if (error) {
    throw error;
  }
}

export async function listUsers(): Promise<UserProfileRecord[]> {
  const columnsWithEmail = 'id, email, username, role, is_active, created_at, updated_at';
  const columnsFallback = 'id, username, role, is_active, created_at, updated_at';

  let { data, error } = await supabase
    .from('user_profiles')
    .select(columnsWithEmail)
    .order('created_at', { ascending: true });

  if (error && isUnknownColumnError(error)) {
    ({ data, error } = await supabase
      .from('user_profiles')
      .select(columnsFallback)
      .order('created_at', { ascending: true }));
  }

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => mapUserProfileRow(item));
}

export async function updateUserProfile(
  id: string,
  updates: UpdateUserProfileInput
): Promise<UserProfileRecord> {
  const payload: Record<string, unknown> = {};
  if (updates.role) {
    payload.role = updates.role;
  }
  if (typeof updates.is_active === 'boolean') {
    payload.is_active = updates.is_active;
  }

  let response = await supabase
    .from('user_profiles')
    .update(payload)
    .eq('id', id)
    .select('id, email, username, role, is_active, created_at, updated_at')
    .single();

  if (response.error && isUnknownColumnError(response.error)) {
    response = await supabase
      .from('user_profiles')
      .update(payload)
      .eq('id', id)
      .select('id, username, role, is_active, created_at, updated_at')
      .single();
  }

  const data = ensureResponse(response);

  return mapUserProfileRow(data);
}

export async function createUserProfile(
  input: CreateUserProfileInput
): Promise<UserProfileRecord> {
  const payload: Record<string, unknown> = {
    role: input.role,
    is_active: input.is_active,
  };

  if (input.id) payload.id = input.id;
  if (input.username) payload.username = input.username;
  if (input.email) payload.email = input.email;

  let response = await supabase
    .from('user_profiles')
    .insert(payload)
    .select('id, email, username, role, is_active, created_at, updated_at')
    .single();

  if (response.error && isUnknownColumnError(response.error)) {
    delete payload.email;
    response = await supabase
      .from('user_profiles')
      .insert(payload)
      .select('id, username, role, is_active, created_at, updated_at')
      .single();
  }

  const data = ensureResponse(response);

  return mapUserProfileRow(data);
}

export async function getAppDescription(): Promise<string> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'app_description')
    .maybeSingle();

  if (error) {
    throw error;
  }

  const text =
    typeof data?.value === 'object' && data?.value !== null && 'text' in data.value
      ? (data.value.text as Nullable<string>)
      : null;

  return text ?? '';
}

export async function setAppDescription(text: string): Promise<string> {
  const { error } = await supabase
    .from('app_settings')
    .upsert(
      {
        key: 'app_description',
        value: { text },
      },
      { onConflict: 'key' }
    );

  if (error) {
    throw error;
  }

  return text;
}
