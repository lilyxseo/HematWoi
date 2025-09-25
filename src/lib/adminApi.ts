import type { PostgrestError, PostgrestSingleResponse } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type SidebarAccessLevel = 'public' | 'user' | 'admin';
export type UserRole = 'user' | 'admin';

export type SidebarItemRecord = {
  id: string;
  title: string;
  route: string;
  access_level: SidebarAccessLevel;
  is_enabled: boolean;
  icon_name: string | null;
  position: number;
  created_at: string | null;
  updated_at: string | null;
};

export type SidebarItemPayload = {
  title: string;
  route: string;
  access_level: SidebarAccessLevel;
  is_enabled?: boolean;
  icon_name?: string | null;
  position?: number;
};

export type SidebarItemUpdate = Partial<SidebarItemPayload>;

export type UserProfileRecord = {
  id: string;
  email: string | null;
  username: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type ListUsersOptions = {
  q?: string;
  role?: UserRole | 'all';
  active?: 'active' | 'inactive' | 'all';
};

export type UpdateUserProfilePayload = Partial<Pick<UserProfileRecord, 'role' | 'is_active'>>;

export type AppDescriptionSetting = {
  text: string;
  updated_at: string | null;
  updated_by: string | null;
};

export type BrandingSetting = {
  primary: string;
  secondary: string;
  updated_at: string | null;
  updated_by: string | null;
};

export type AuditLogEntry = {
  id: string;
  type: 'sidebar' | 'user';
  title: string;
  description: string;
  timestamp: string | null;
  icon: string;
};

type MaybeWithEmail<T> = T & { email?: string | null };

type Nullable<T> = T | null | undefined;

function logError(context: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.error(`[adminApi] ${context}`, error);
}

function ensureResponse<T>(response: PostgrestSingleResponse<T>): T {
  if (response.error) {
    throw response.error;
  }
  return response.data as T;
}

function sanitizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value == null) return fallback;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  }
  return fallback;
}

function sanitizeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function normalizeRoutePath(value: string): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  let result = '';
  let lastChar: string | null = null;

  for (const char of withSlash) {
    if (char === '/' && lastChar === '/') continue;
    result += char;
    lastChar = char;
  }

  while (result.length > 1 && result.endsWith('/')) {
    result = result.slice(0, -1);
  }

  return result;
}

function ensureAccessLevel(value: Nullable<string>): SidebarAccessLevel {
  if (value === 'admin' || value === 'user' || value === 'public') {
    return value;
  }
  return 'public';
}

function mapSidebarItem(row: any): SidebarItemRecord {
  return {
    id:
      String(row?.id ?? row?.route ?? globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
    title: String(row?.title ?? ''),
    route: normalizeRoutePath(String(row?.route ?? '')),
    access_level: ensureAccessLevel(row?.access_level),
    is_enabled: sanitizeBoolean(row?.is_enabled, true),
    icon_name: typeof row?.icon_name === 'string' ? row.icon_name : null,
    position: sanitizeNumber(row?.position, 0),
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

function mapUserProfile(row: MaybeWithEmail<any>): UserProfileRecord {
  return {
    id: String(row?.id ?? ''),
    email: typeof row?.email === 'string' ? row.email : null,
    username: typeof row?.username === 'string' ? row.username : null,
    role: row?.role === 'admin' ? 'admin' : 'user',
    is_active: sanitizeBoolean(row?.is_active, true),
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

function isUnknownColumnError(error: PostgrestError | null): boolean {
  if (!error) return false;
  if (error.code === '42703') return true;
  const message = (error.message ?? '').toLowerCase();
  return message.includes('column') && message.includes('email');
}

function extractSettingValue<T>(value: unknown, fallback: T): T {
  if (value && typeof value === 'object') {
    return value as T;
  }
  return fallback;
}

function parseTimestamp(value: Nullable<string>): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function buildFriendlyError(defaultMessage: string, error: unknown): Error {
  const message =
    error instanceof Error && error.message ? error.message : defaultMessage;
  return new Error(message);
}

export async function listSidebarItems(): Promise<SidebarItemRecord[]> {
  try {
    const { data, error } = await supabase
      .from('app_sidebar_items')
      .select('id, title, route, access_level, is_enabled, icon_name, position, created_at, updated_at')
      .order('position', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row) => mapSidebarItem(row));
  } catch (error) {
    logError('listSidebarItems', error);
    throw buildFriendlyError('Gagal memuat menu sidebar', error);
  }
}

export async function createSidebarItem(payload: SidebarItemPayload): Promise<SidebarItemRecord> {
  try {
    const title = (payload.title ?? '').trim();
    if (!title) {
      throw new Error('Judul wajib diisi.');
    }

    const route = normalizeRoutePath(payload.route);
    if (!route) {
      throw new Error('Route wajib diawali dengan "/"');
    }

    const { data: existing } = await supabase
      .from('app_sidebar_items')
      .select('id')
      .eq('route', route)
      .maybeSingle();

    if (existing) {
      throw new Error('Route sudah digunakan. Gunakan path lain.');
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) {
      throw new Error('Harus login sebagai admin.');
    }

    const { data: maxPositionRow, error: positionError } = await supabase
      .from('app_sidebar_items')
      .select('position')
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (positionError) throw positionError;

    const nextPosition =
      typeof payload.position === 'number'
        ? payload.position
        : sanitizeNumber(maxPositionRow?.position, -1) + 1;

    const response = await supabase
      .from('app_sidebar_items')
      .insert({
        title,
        route,
        access_level: ensureAccessLevel(payload.access_level),
        is_enabled: sanitizeBoolean(payload.is_enabled, true),
        icon_name: payload.icon_name ? payload.icon_name.trim().toLowerCase() : null,
        position: nextPosition,
        user_id: user.id,
      })
      .select(
        'id, title, route, access_level, is_enabled, icon_name, position, created_at, updated_at'
      )
      .single();

    const data = ensureResponse(response);
    return mapSidebarItem(data);
  } catch (error) {
    logError('createSidebarItem', error);
    throw buildFriendlyError('Gagal menambahkan menu sidebar', error);
  }
}

export async function updateSidebarItem(
  id: string,
  patch: SidebarItemUpdate
): Promise<SidebarItemRecord> {
  try {
    const updates: Record<string, unknown> = {};

    if (Object.prototype.hasOwnProperty.call(patch, 'title')) {
      const title = String(patch.title ?? '').trim();
      if (!title) {
        throw new Error('Judul tidak boleh kosong');
      }
      updates.title = title;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'route')) {
      const route = normalizeRoutePath(String(patch.route ?? ''));
      if (!route) throw new Error('Route tidak boleh kosong');

      const { data: existing } = await supabase
        .from('app_sidebar_items')
        .select('id')
        .eq('route', route)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        throw new Error('Route sudah digunakan.');
      }

      updates.route = route;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'access_level')) {
      updates.access_level = ensureAccessLevel(patch.access_level as Nullable<string>);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'is_enabled')) {
      updates.is_enabled = sanitizeBoolean(patch.is_enabled, true);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'icon_name')) {
      updates.icon_name = patch.icon_name ? patch.icon_name.trim().toLowerCase() : null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'position')) {
      updates.position = sanitizeNumber(patch.position, 0);
    }

    const response = await supabase
      .from('app_sidebar_items')
      .update(updates)
      .eq('id', id)
      .select(
        'id, title, route, access_level, is_enabled, icon_name, position, created_at, updated_at'
      )
      .single();

    const data = ensureResponse(response);
    return mapSidebarItem(data);
  } catch (error) {
    logError('updateSidebarItem', error);
    throw buildFriendlyError('Gagal memperbarui menu sidebar', error);
  }
}

export async function deleteSidebarItem(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('app_sidebar_items').delete().eq('id', id);
    if (error) throw error;
  } catch (error) {
    logError('deleteSidebarItem', error);
    throw buildFriendlyError('Gagal menghapus menu sidebar', error);
  }
}

export async function moveSidebarItem(
  id: string,
  direction: 'up' | 'down'
): Promise<SidebarItemRecord[]> {
  try {
    const { data: current, error: currentError } = await supabase
      .from('app_sidebar_items')
      .select('id, position')
      .eq('id', id)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!current) {
      return listSidebarItems();
    }

    let neighborQuery = supabase
      .from('app_sidebar_items')
      .select('id, position')
      .limit(1);

    neighborQuery =
      direction === 'up'
        ? neighborQuery.lt('position', current.position).order('position', { ascending: false })
        : neighborQuery.gt('position', current.position).order('position', { ascending: true });

    const { data: neighbor, error: neighborError } = await neighborQuery.maybeSingle();
    if (neighborError) throw neighborError;
    if (!neighbor) {
      return listSidebarItems();
    }

    const firstUpdate = await supabase
      .from('app_sidebar_items')
      .update({ position: neighbor.position })
      .eq('id', current.id);

    if (firstUpdate.error) throw firstUpdate.error;

    const secondUpdate = await supabase
      .from('app_sidebar_items')
      .update({ position: current.position })
      .eq('id', neighbor.id);

    if (secondUpdate.error) throw secondUpdate.error;

    return listSidebarItems();
  } catch (error) {
    logError('moveSidebarItem', error);
    throw buildFriendlyError('Gagal mengubah urutan menu', error);
  }
}

export async function listUsers(options: ListUsersOptions = {}): Promise<UserProfileRecord[]> {
  try {
    const columnsWithEmail = 'id, email, username, role, is_active, created_at, updated_at';
    const columnsFallback = 'id, username, role, is_active, created_at, updated_at';

    const applyFilters = (query: any, includeEmail: boolean) => {
      if (options.role && options.role !== 'all') {
        query = query.eq('role', options.role);
      }
      if (options.active && options.active !== 'all') {
        query = query.eq('is_active', options.active === 'active');
      }
      if (options.q) {
        const term = options.q.trim();
        if (term) {
          const safeTerm = term.replace(/%/g, '\\%').replace(/,/g, ' ');
          const filters = includeEmail
            ? `username.ilike.%${safeTerm}%,email.ilike.%${safeTerm}%`
            : `username.ilike.%${safeTerm}%`;
          query = query.or(filters);
        }
      }
      return query;
    };

    let query = supabase
      .from('user_profiles')
      .select(columnsWithEmail)
      .order('created_at', { ascending: true });

    query = applyFilters(query, true);

    let { data, error } = await query;

    if (error && isUnknownColumnError(error)) {
      query = applyFilters(
        supabase
          .from('user_profiles')
          .select(columnsFallback)
          .order('created_at', { ascending: true }),
        false
      );
      ({ data, error } = await query);
    }

    if (error) throw error;

    return (data ?? []).map((row) => mapUserProfile(row));
  } catch (error) {
    logError('listUsers', error);
    throw buildFriendlyError('Gagal memuat data pengguna', error);
  }
}

async function ensureNotLastAdmin(
  id: string,
  updates: UpdateUserProfilePayload
): Promise<{ currentRole: UserRole; currentActive: boolean }> {
  const { data: currentRow, error: currentError } = await supabase
    .from('user_profiles')
    .select('id, role, is_active')
    .eq('id', id)
    .maybeSingle();

  if (currentError) throw currentError;
  if (!currentRow) {
    throw new Error('Pengguna tidak ditemukan');
  }

  const currentRole: UserRole = currentRow.role === 'admin' ? 'admin' : 'user';
  const currentActive = sanitizeBoolean(currentRow.is_active, true);

  const nextRole = updates.role ?? currentRole;
  const nextActive =
    Object.prototype.hasOwnProperty.call(updates, 'is_active')
      ? sanitizeBoolean(updates.is_active, true)
      : currentActive;

  if (currentRole !== 'admin') {
    return { currentRole, currentActive };
  }

  const willRemainAdmin = nextRole === 'admin' && nextActive;
  if (willRemainAdmin) {
    return { currentRole, currentActive };
  }

  const { data: adminRows, error: adminError } = await supabase
    .from('user_profiles')
    .select('id, role, is_active')
    .eq('role', 'admin');

  if (adminError) throw adminError;

  const activeAdmins = (adminRows ?? []).filter((row) => sanitizeBoolean(row?.is_active, true));
  const remaining = activeAdmins.filter((row) => row?.id !== id);

  if (remaining.length === 0) {
    throw new Error('Tidak boleh menonaktifkan admin terakhir.');
  }

  return { currentRole, currentActive };
}

export async function updateUserProfile(
  id: string,
  updates: UpdateUserProfilePayload
): Promise<UserProfileRecord> {
  try {
    const payload: Record<string, unknown> = {};

    if (Object.prototype.hasOwnProperty.call(updates, 'role')) {
      payload.role = updates.role;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'is_active')) {
      payload.is_active = updates.is_active;
    }

    const { currentRole, currentActive } = await ensureNotLastAdmin(id, updates);

    if (Object.keys(payload).length === 0) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, username, role, is_active, created_at, updated_at')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return {
          id,
          email: null,
          username: null,
          role: currentRole,
          is_active: currentActive,
          created_at: null,
          updated_at: null,
        };
      }

      return mapUserProfile(data);
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
    return mapUserProfile(data);
  } catch (error) {
    logError('updateUserProfile', error);
    throw buildFriendlyError('Gagal memperbarui pengguna', error);
  }
}

async function fetchSettingRow(columns: string) {
  return supabase
    .from('app_settings')
    .select(columns)
    .eq('key', 'app_description')
    .maybeSingle();
}

export async function getAppDescription(): Promise<AppDescriptionSetting> {
  try {
    let { data, error } = await fetchSettingRow('value, updated_at, updated_by');

    if (error && error.code === '42703') {
      ({ data, error } = await fetchSettingRow('value, updated_at'));
    }

    if (error) throw error;

    const value = extractSettingValue<{ text?: string }>(data?.value, { text: '' });

    return {
      text: String(value.text ?? ''),
      updated_at: parseTimestamp(data?.updated_at ?? null),
      updated_by: typeof data?.updated_by === 'string' ? data.updated_by : null,
    };
  } catch (error) {
    logError('getAppDescription', error);
    throw buildFriendlyError('Gagal memuat deskripsi aplikasi', error);
  }
}

export async function setAppDescription(text: string): Promise<AppDescriptionSetting> {
  try {
    const response = await supabase
      .from('app_settings')
      .upsert({ key: 'app_description', value: { text } }, { onConflict: 'key' })
      .select('value, updated_at, updated_by')
      .single();

    const data = ensureResponse(response);
    const value = extractSettingValue<{ text?: string }>(data.value, { text });

    return {
      text: String(value.text ?? text ?? ''),
      updated_at: parseTimestamp(data.updated_at ?? null),
      updated_by: typeof data.updated_by === 'string' ? data.updated_by : null,
    };
  } catch (error) {
    logError('setAppDescription', error);
    throw buildFriendlyError('Gagal menyimpan deskripsi aplikasi', error);
  }
}

async function fetchBrandingRow(columns: string) {
  return supabase
    .from('app_settings')
    .select(columns)
    .eq('key', 'branding')
    .maybeSingle();
}

export async function getBranding(): Promise<BrandingSetting> {
  try {
    let { data, error } = await fetchBrandingRow('value, updated_at, updated_by');

    if (error && error.code === '42703') {
      ({ data, error } = await fetchBrandingRow('value, updated_at'));
    }

    if (error) throw error;

    const value = extractSettingValue<{ primary?: string; secondary?: string }>(data?.value, {
      primary: '#6366f1',
      secondary: '#22d3ee',
    });

    return {
      primary: value.primary ?? '#6366f1',
      secondary: value.secondary ?? '#22d3ee',
      updated_at: parseTimestamp(data?.updated_at ?? null),
      updated_by: typeof data?.updated_by === 'string' ? data.updated_by : null,
    };
  } catch (error) {
    logError('getBranding', error);
    throw buildFriendlyError('Gagal memuat pengaturan branding', error);
  }
}

export async function setBranding(
  branding: Pick<BrandingSetting, 'primary' | 'secondary'>
): Promise<BrandingSetting> {
  try {
    const response = await supabase
      .from('app_settings')
      .upsert({ key: 'branding', value: branding }, { onConflict: 'key' })
      .select('value, updated_at, updated_by')
      .single();

    const data = ensureResponse(response);
    const value = extractSettingValue<{ primary?: string; secondary?: string }>(data.value, branding);

    return {
      primary: value.primary ?? branding.primary,
      secondary: value.secondary ?? branding.secondary,
      updated_at: parseTimestamp(data.updated_at ?? null),
      updated_by: typeof data.updated_by === 'string' ? data.updated_by : null,
    };
  } catch (error) {
    logError('setBranding', error);
    throw buildFriendlyError('Gagal menyimpan pengaturan branding', error);
  }
}

export async function listAuditLog(): Promise<AuditLogEntry[]> {
  try {
    const [sidebarRes, userRes] = await Promise.all([
      supabase
        .from('app_sidebar_items')
        .select('id, title, route, access_level, is_enabled, updated_at, created_at')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(10),
      supabase
        .from('user_profiles')
        .select('id, username, email, role, is_active, updated_at, created_at')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(10),
    ]);

    if (sidebarRes.error) throw sidebarRes.error;
    if (userRes.error) throw userRes.error;

    const sidebarEntries: AuditLogEntry[] = (sidebarRes.data ?? []).map((row) => {
      const timestamp = parseTimestamp(row?.updated_at ?? row?.created_at ?? null);
      const action = row?.created_at && row?.updated_at && row.created_at !== row.updated_at ? 'Diubah' : 'Dibuat';
      const enabled = sanitizeBoolean(row?.is_enabled, true) ? 'Aktif' : 'Nonaktif';
      return {
        id: `sidebar-${row?.id ?? row?.route}`,
        type: 'sidebar',
        title: row?.title ? String(row.title) : 'Menu Tanpa Judul',
        description: `${action} • ${normalizeRoutePath(String(row?.route ?? ''))} • ${
          row?.access_level ?? 'public'
        } • ${enabled}`,
        timestamp,
        icon: 'list',
      };
    });

    const userEntries: AuditLogEntry[] = (userRes.data ?? []).map((row) => {
      const timestamp = parseTimestamp(row?.updated_at ?? row?.created_at ?? null);
      const name = row?.username || row?.email || 'Pengguna';
      const status = sanitizeBoolean(row?.is_active, true) ? 'Aktif' : 'Nonaktif';
      return {
        id: `user-${row?.id}`,
        type: 'user',
        title: String(name),
        description: `Role: ${row?.role ?? 'user'} • Status: ${status}`,
        timestamp,
        icon: 'users',
      };
    });

    return [...sidebarEntries, ...userEntries]
      .sort((a, b) => {
        const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 10);
  } catch (error) {
    logError('listAuditLog', error);
    throw buildFriendlyError('Gagal memuat audit log', error);
  }
}
