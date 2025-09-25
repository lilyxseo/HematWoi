import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type SidebarAccessLevel = 'public' | 'user' | 'admin';

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

export type CreateSidebarItemInput = {
  title: string;
  route: string;
  access_level: SidebarAccessLevel;
  icon_name?: string | null;
  is_enabled?: boolean;
  position?: number;
};

export type UpdateSidebarItemInput = Partial<
  Pick<SidebarItemRecord, 'title' | 'route' | 'access_level' | 'is_enabled' | 'icon_name' | 'position'>
>;

export type UserRole = 'user' | 'admin';

export type UserProfileRecord = {
  id: string;
  email: string | null;
  username: string | null;
  role: UserRole;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ListUsersFilter = {
  q?: string;
  role?: 'all' | UserRole;
  active?: 'all' | 'active' | 'inactive';
};

export type UpdateUserProfileInput = Partial<Pick<UserProfileRecord, 'role' | 'is_active'>>;

export type AppDescriptionSetting = {
  text: string;
  logoUrl: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type BrandingSetting = {
  primary: string | null;
  secondary: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type AuditEntry = {
  id: string;
  source: 'sidebar' | 'user';
  title: string;
  description: string;
  action: 'created' | 'updated';
  timestamp: string;
};

const SIDEBAR_SELECT =
  'id, title, route, access_level, is_enabled, icon_name, position, created_at, updated_at';

const USER_SELECT =
  'id, email, username, role, is_active, avatar_url, created_at, updated_at';

function handlePostgrestError(error: PostgrestError | null, context: string): void {
  if (!error) return;
  // Log detailed error for developers while returning friendly message via thrown Error
  // eslint-disable-next-line no-console
  console.error(`[adminApi] ${context}`, error);
  throw new Error(error.message || error.hint || `Gagal ${context}`);
}

function sanitizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === 'true' || value === '1';
  return fallback;
}

function sanitizeNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function normalizeRoutePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const ensured = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const withoutDoubleSlash = ensured.replace(/\/+/g, '/');

  if (withoutDoubleSlash.length > 1 && withoutDoubleSlash.endsWith('/')) {
    return withoutDoubleSlash.replace(/\/+$, '');
  }

  return withoutDoubleSlash;
}

function normalizeIconName(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function mapSidebarRow(row: any): SidebarItemRecord {
  return {
    id:
      String(row?.id ?? row?.route ?? globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
    title: String(row?.title ?? ''),
    route: String(row?.route ?? ''),
    access_level: row?.access_level === 'admin' ? 'admin' : row?.access_level === 'user' ? 'user' : 'public',
    is_enabled: sanitizeBoolean(row?.is_enabled, true),
    icon_name: normalizeIconName(row?.icon_name),
    position: sanitizeNumber(row?.position, 0),
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

function mapUserRow(row: any): UserProfileRecord {
  return {
    id: String(row?.id ?? ''),
    email: row?.email ?? null,
    username: row?.username ?? null,
    role: row?.role === 'admin' ? 'admin' : 'user',
    is_active: sanitizeBoolean(row?.is_active, true),
    avatar_url: row?.avatar_url ?? null,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

export async function listSidebarItems(): Promise<SidebarItemRecord[]> {
  const { data, error } = await supabase
    .from('app_sidebar_items')
    .select(SIDEBAR_SELECT)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  handlePostgrestError(error, 'memuat item sidebar');
  return (data ?? []).map(mapSidebarRow);
}

export async function createSidebarItem(payload: CreateSidebarItemInput): Promise<SidebarItemRecord> {
  const normalizedRoute = normalizeRoutePath(payload.route);
  if (!payload.title.trim()) {
    throw new Error('Judul wajib diisi');
  }
  if (!normalizedRoute) {
    throw new Error("Route wajib diawali '/' dan tidak boleh kosong");
  }
  if (!['public', 'user', 'admin'].includes(payload.access_level)) {
    throw new Error('access_level tidak valid');
  }

  const client: SupabaseClient = supabase;
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new Error('Harus login sebagai admin untuk menyimpan');
  }

  const body = {
    title: payload.title.trim(),
    route: normalizedRoute,
    access_level: payload.access_level,
    is_enabled: payload.is_enabled ?? true,
    icon_name: normalizeIconName(payload.icon_name),
    position: sanitizeNumber(payload.position, Date.now()),
    user_id: user.id,
  };

  const { data, error } = await client
    .from('app_sidebar_items')
    .insert([body])
    .select(SIDEBAR_SELECT)
    .single();

  if (error) {
    const message = error.message || error.hint || '';
    if (/duplicate|uniq/i.test(message)) {
      throw new Error('Route sudah digunakan. Pilih jalur lain.');
    }
    if (/policy|permission/i.test(message)) {
      throw new Error('Akses ditolak. Hanya admin yang dapat mengubah sidebar.');
    }
    handlePostgrestError(error, 'menyimpan item sidebar');
  }

  return mapSidebarRow(data);
}

export async function updateSidebarItem(
  id: string,
  patch: UpdateSidebarItemInput
): Promise<SidebarItemRecord> {
  const updates: Record<string, unknown> = {};

  if (patch.title !== undefined) {
    const trimmed = patch.title.trim();
    if (!trimmed) {
      throw new Error('Judul wajib diisi');
    }
    updates.title = trimmed;
  }
  if (patch.route !== undefined) {
    const normalized = normalizeRoutePath(patch.route);
    if (!normalized) {
      throw new Error("Route wajib diawali '/' dan tidak boleh kosong");
    }
    updates.route = normalized;
  }
  if (patch.access_level !== undefined) {
    if (!['public', 'user', 'admin'].includes(patch.access_level)) {
      throw new Error('access_level tidak valid');
    }
    updates.access_level = patch.access_level;
  }
  if (patch.is_enabled !== undefined) {
    updates.is_enabled = patch.is_enabled;
  }
  if (patch.icon_name !== undefined) {
    updates.icon_name = normalizeIconName(patch.icon_name);
  }
  if (patch.position !== undefined) {
    updates.position = sanitizeNumber(patch.position, 0);
  }

  const { data, error } = await supabase
    .from('app_sidebar_items')
    .update(updates)
    .eq('id', id)
    .select(SIDEBAR_SELECT)
    .single();

  handlePostgrestError(error, 'memperbarui item sidebar');
  return mapSidebarRow(data);
}

export async function deleteSidebarItem(id: string): Promise<void> {
  const { error } = await supabase.from('app_sidebar_items').delete().eq('id', id);
  handlePostgrestError(error, 'menghapus item sidebar');
}

export async function moveSidebarItem(
  id: string,
  direction: 'up' | 'down'
): Promise<{ current: SidebarItemRecord; target: SidebarItemRecord } | null> {
  const items = await listSidebarItems();
  const sorted = [...items].sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
  const index = sorted.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= sorted.length) {
    return null;
  }

  const current = sorted[index];
  const target = sorted[targetIndex];

  const firstUpdate = await supabase
    .from('app_sidebar_items')
    .update({ position: target.position })
    .eq('id', current.id);
  handlePostgrestError(firstUpdate.error, 'mengatur urutan sidebar');

  const secondUpdate = await supabase
    .from('app_sidebar_items')
    .update({ position: current.position })
    .eq('id', target.id);
  handlePostgrestError(secondUpdate.error, 'mengatur urutan sidebar');

  return {
    current: { ...current, position: target.position },
    target: { ...target, position: current.position },
  };
}

export async function listUsers(filters: ListUsersFilter = {}): Promise<UserProfileRecord[]> {
  const query = supabase
    .from('user_profiles')
    .select(USER_SELECT)
    .order('created_at', { ascending: true });

  if (filters.role && filters.role !== 'all') {
    query.eq('role', filters.role);
  }

  if (filters.active && filters.active !== 'all') {
    query.eq('is_active', filters.active === 'active');
  }

  if (filters.q && filters.q.trim()) {
    const term = filters.q.trim();
    query.or(`username.ilike.%${term}%,email.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error && error.code === '42703') {
    const fallback = supabase
      .from('user_profiles')
      .select('id, username, role, is_active, created_at, updated_at')
      .order('created_at', { ascending: true });

    if (filters.role && filters.role !== 'all') {
      fallback.eq('role', filters.role);
    }

    if (filters.active && filters.active !== 'all') {
      fallback.eq('is_active', filters.active === 'active');
    }

    if (filters.q && filters.q.trim()) {
      const term = filters.q.trim();
      fallback.or(`username.ilike.%${term}%`);
    }

    const fallbackResult = await fallback;
    handlePostgrestError(fallbackResult.error, 'memuat pengguna');
    return (fallbackResult.data ?? []).map(mapUserRow);
  }

  handlePostgrestError(error, 'memuat pengguna');
  return (data ?? []).map(mapUserRow);
}

async function ensureNotLastAdmin(
  id: string,
  patch: UpdateUserProfileInput
): Promise<void> {
  if (patch.role === 'admin' && patch.is_active !== false) {
    return;
  }

  const shouldValidateDemote =
    patch.role !== undefined || (patch.is_active !== undefined && patch.is_active === false);
  if (!shouldValidateDemote) {
    return;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, is_active')
    .eq('role', 'admin');
  handlePostgrestError(error, 'memeriksa admin aktif');

  const admins = data ?? [];
  const activeAdmins = admins.filter((row) => sanitizeBoolean(row?.is_active, true));
  const isTargetAdmin = admins.some((row) => String(row?.id ?? '') === id);

  if (!isTargetAdmin) {
    return;
  }

  if (activeAdmins.length <= 1) {
    throw new Error('Tidak dapat mengubah admin terakhir.');
  }
}

export async function updateUserProfile(
  id: string,
  patch: UpdateUserProfileInput
): Promise<UserProfileRecord> {
  await ensureNotLastAdmin(id, patch);

  const updates: Record<string, unknown> = {};
  if (patch.role) {
    updates.role = patch.role;
  }
  if (patch.is_active !== undefined) {
    updates.is_active = patch.is_active;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', id)
    .select(USER_SELECT)
    .single();

  handlePostgrestError(error, 'memperbarui profil pengguna');
  return mapUserRow(data);
}

export async function getAppDescription(): Promise<AppDescriptionSetting> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value, updated_at, updated_by')
    .eq('key', 'app_description')
    .maybeSingle();

  handlePostgrestError(error, 'memuat deskripsi aplikasi');

  const value = (data?.value as Record<string, any>) ?? {};
  return {
    text: typeof value.text === 'string' ? value.text : '',
    logoUrl:
      typeof value.logoUrl === 'string'
        ? value.logoUrl
        : typeof value.logo_url === 'string'
          ? value.logo_url
          : null,
    updatedAt: data?.updated_at ?? null,
    updatedBy: data?.updated_by ?? null,
  };
}

export async function setAppDescription(
  text: string,
  logoUrl: string | null
): Promise<AppDescriptionSetting> {
  const cleanedLogo = logoUrl?.trim() ? logoUrl.trim() : null;
  const payload = {
    value: { text, logoUrl: cleanedLogo },
  };

  const { data, error } = await supabase
    .from('app_settings')
    .upsert({ key: 'app_description', ...payload }, { onConflict: 'key' })
    .select('value, updated_at, updated_by')
    .single();

  handlePostgrestError(error, 'menyimpan deskripsi aplikasi');

  const value = (data?.value as Record<string, any>) ?? {};
  return {
    text: typeof value.text === 'string' ? value.text : '',
    logoUrl:
      typeof value.logoUrl === 'string'
        ? value.logoUrl
        : typeof value.logo_url === 'string'
          ? value.logo_url
          : null,
    updatedAt: data?.updated_at ?? null,
    updatedBy: data?.updated_by ?? null,
  };
}

function normalizeColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^#?[0-9a-fA-F]{3,8}$/.test(trimmed)) {
    throw new Error('Gunakan format warna hex, contoh #AABBCC');
  }
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

export async function getBranding(): Promise<BrandingSetting> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value, updated_at, updated_by')
    .eq('key', 'branding')
    .maybeSingle();

  handlePostgrestError(error, 'memuat branding');
  const value = (data?.value as Record<string, any>) ?? {};
  const primary = typeof value.primary === 'string' ? value.primary : null;
  const secondary = typeof value.secondary === 'string' ? value.secondary : null;

  return {
    primary,
    secondary,
    updatedAt: data?.updated_at ?? null,
    updatedBy: data?.updated_by ?? null,
  };
}

export async function setBranding(
  primary: string | null,
  secondary: string | null
): Promise<BrandingSetting> {
  const normalizedPrimary = primary ? normalizeColor(primary) : null;
  const normalizedSecondary = secondary ? normalizeColor(secondary) : null;

  const { data, error } = await supabase
    .from('app_settings')
    .upsert(
      {
        key: 'branding',
        value: { primary: normalizedPrimary, secondary: normalizedSecondary },
      },
      { onConflict: 'key' }
    )
    .select('value, updated_at, updated_by')
    .single();

  handlePostgrestError(error, 'menyimpan branding');

  const value = (data?.value as Record<string, any>) ?? {};
  return {
    primary: typeof value.primary === 'string' ? value.primary : null,
    secondary: typeof value.secondary === 'string' ? value.secondary : null,
    updatedAt: data?.updated_at ?? null,
    updatedBy: data?.updated_by ?? null,
  };
}

export async function listAuditEntries(limit = 10): Promise<AuditEntry[]> {
  const [sidebarRes, userRes] = await Promise.all([
    supabase
      .from('app_sidebar_items')
      .select('id, title, route, created_at, updated_at')
      .order('updated_at', { ascending: false, nullsLast: false })
      .limit(limit),
    supabase
      .from('user_profiles')
      .select('id, username, email, role, is_active, created_at, updated_at')
      .order('updated_at', { ascending: false, nullsLast: false })
      .limit(limit),
  ]);

  handlePostgrestError(sidebarRes.error, 'memuat audit sidebar');
  handlePostgrestError(userRes.error, 'memuat audit pengguna');

  const sidebarEntries: AuditEntry[] = (sidebarRes.data ?? []).map((item: any) => {
    const createdAt = item?.created_at ?? null;
    const updatedAt = item?.updated_at ?? createdAt;
    const action = !createdAt || createdAt === updatedAt ? 'created' : 'updated';
    const timestamp = updatedAt ?? createdAt ?? new Date().toISOString();
    return {
      id: `sidebar-${item?.id ?? globalThis.crypto?.randomUUID?.() ?? Math.random()}`,
      source: 'sidebar',
      title: item?.title ? String(item.title) : 'Item Sidebar',
      description: `Route ${item?.route ? String(item.route) : '-'} ${action === 'created' ? 'dibuat' : 'diperbarui'}.`,
      action,
      timestamp,
    };
  });

  const userEntries: AuditEntry[] = (userRes.data ?? []).map((item: any) => {
    const createdAt = item?.created_at ?? null;
    const updatedAt = item?.updated_at ?? createdAt;
    const action = !createdAt || createdAt === updatedAt ? 'created' : 'updated';
    const timestamp = updatedAt ?? createdAt ?? new Date().toISOString();
    const name = item?.username || item?.email || 'Pengguna';
    const status = sanitizeBoolean(item?.is_active, true) ? 'aktif' : 'nonaktif';
    return {
      id: `user-${item?.id ?? globalThis.crypto?.randomUUID?.() ?? Math.random()}`,
      source: 'user',
      title: String(name),
      description: `Peran: ${item?.role ?? 'user'} · Status: ${status}.`,
      action,
      timestamp,
    };
  });

  return [...sidebarEntries, ...userEntries]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}
