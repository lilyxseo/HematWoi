import type { PostgrestSingleResponse } from '@supabase/supabase-js';
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
  category: string | null;
};

export type CreateSidebarItemInput = {
  title: string;
  route: string;
  access_level: SidebarAccessLevel;
  is_enabled?: boolean;
  icon_name?: string | null;
  category?: string | null;
};

export type UpdateSidebarItemInput = Partial<
  Pick<SidebarItemRecord, 'title' | 'route' | 'access_level' | 'is_enabled' | 'icon_name' | 'category'>
>;

export type UserRole = 'user' | 'admin';

export type UserProfileRecord = {
  id: string;
  email: string | null;
  username: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type ListUsersParams = {
  query?: string;
  role?: UserRole | 'all';
  status?: 'active' | 'inactive' | 'all';
};

export type UpdateUserProfileInput = Partial<Pick<UserProfileRecord, 'role' | 'is_active'>>;

export type AppDescriptionSetting = {
  text: string;
  updated_at: string | null;
};

export type BrandingSetting = {
  primary: string;
  secondary: string;
  updated_at: string | null;
};

export type AdminDashboardContentSetting = {
  breadcrumb: string;
  title: string;
  subtitle: string;
  badge: string;
  description: string;
  updated_at: string | null;
};

export type AuditEntry = {
  id: string;
  source: 'sidebar' | 'user';
  title: string;
  description: string;
  timestamp: string | null;
};

const VALID_ACCESS_LEVELS: SidebarAccessLevel[] = ['public', 'user', 'admin'];

function ensureResponse<T>(response: PostgrestSingleResponse<T>): T {
  if (response.error) {
    throw response.error;
  }
  return response.data as T;
}

function sanitizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === 'true' || value === '1';
  return fallback;
}

function sanitizeNumber(value: unknown, fallback = 0): number {
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

function normalizeIcon(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeCategory(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  const converted = String(value ?? '').trim();
  return converted ? converted : null;
}

function normalizeRoute(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const parts = withSlash.split('/').filter(Boolean);
  if (parts.length === 0) return '/';
  return `/${parts.join('/')}`;
}

function mapSidebarRow(row: any): SidebarItemRecord {
  return {
    id:
      String(row?.id ?? row?.route ?? globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
    title: String(row?.title ?? ''),
    route: String(row?.route ?? ''),
    access_level: VALID_ACCESS_LEVELS.includes(row?.access_level)
      ? (row.access_level as SidebarAccessLevel)
      : 'public',
    is_enabled: sanitizeBoolean(row?.is_enabled, true),
    icon_name: normalizeIcon(row?.icon_name),
    position: sanitizeNumber(row?.position, 0),
    category: normalizeCategory(row?.category),
  };
}

function mapUserRow(row: any): UserProfileRecord {
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

export async function listSidebarItems(): Promise<SidebarItemRecord[]> {
  try {
    const { data, error } = await supabase
      .from('app_sidebar_items')
      .select('id, title, route, access_level, is_enabled, icon_name, position, category')
      .order('position', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((item) => mapSidebarRow(item));
  } catch (error) {
    console.error('[adminApi] listSidebarItems failed', error);
    throw new Error('Gagal memuat menu sidebar');
  }
}

export async function createSidebarItem(payload: CreateSidebarItemInput): Promise<SidebarItemRecord> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      throw new Error('Harus login untuk membuat menu');
    }

    const normalizedRoute = normalizeRoute(payload.route);
    if (!normalizedRoute.startsWith('/')) {
      throw new Error("Route harus diawali '/' ");
    }

    if (!payload.title.trim()) {
      throw new Error('Judul tidak boleh kosong');
    }

    if (!VALID_ACCESS_LEVELS.includes(payload.access_level)) {
      throw new Error('Level akses tidak valid');
    }

    const { data: maxPositionData, error: positionError } = await supabase
      .from('app_sidebar_items')
      .select('position')
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (positionError) throw positionError;

    const nextPosition = maxPositionData ? sanitizeNumber(maxPositionData.position, 0) + 1 : 1;

    const insertPayload = {
      title: payload.title.trim(),
      route: normalizedRoute,
      access_level: payload.access_level,
      is_enabled: payload.is_enabled ?? true,
      icon_name: normalizeIcon(payload.icon_name),
      position: nextPosition,
      category: normalizeCategory(payload.category),
      user_id: auth.user.id,
    };

    const response = await supabase
      .from('app_sidebar_items')
      .insert(insertPayload)
      .select('id, title, route, access_level, is_enabled, icon_name, position, category')
      .single();

    const data = ensureResponse(response);
    return mapSidebarRow(data);
  } catch (error) {
    console.error('[adminApi] createSidebarItem failed', error);
    const message = error instanceof Error ? error.message : 'Gagal menyimpan menu sidebar';
    if (/duplicate|uniq/i.test(message)) {
      throw new Error('Route sudah digunakan. Gunakan path lain.');
    }
    if (/admin|access|policy|permission/i.test(message)) {
      throw new Error('Akses ditolak. Hanya admin yang dapat mengubah menu.');
    }
    throw new Error(message || 'Gagal menyimpan menu sidebar');
  }
}

export async function updateSidebarItem(
  id: string,
  patch: UpdateSidebarItemInput
): Promise<SidebarItemRecord> {
  try {
    const payload: Record<string, unknown> = {};

    if (typeof patch.title === 'string') {
      payload.title = patch.title.trim();
    }

    if (typeof patch.route === 'string') {
      const normalized = normalizeRoute(patch.route);
      if (!normalized.startsWith('/')) {
        throw new Error("Route harus diawali '/'");
      }
      payload.route = normalized;
    }

    if (patch.access_level && VALID_ACCESS_LEVELS.includes(patch.access_level)) {
      payload.access_level = patch.access_level;
    }

    if (typeof patch.is_enabled === 'boolean') {
      payload.is_enabled = patch.is_enabled;
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'icon_name')) {
      payload.icon_name = normalizeIcon(patch.icon_name ?? null);
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'category')) {
      payload.category = normalizeCategory(patch.category ?? null);
    }

    const response = await supabase
      .from('app_sidebar_items')
      .update(payload)
      .eq('id', id)
      .select('id, title, route, access_level, is_enabled, icon_name, position, category')
      .single();

    const data = ensureResponse(response);
    return mapSidebarRow(data);
  } catch (error) {
    console.error('[adminApi] updateSidebarItem failed', error);
    const message = error instanceof Error ? error.message : 'Gagal memperbarui menu sidebar';
    if (/duplicate|uniq/i.test(message)) {
      throw new Error('Route sudah digunakan. Gunakan path lain.');
    }
    throw new Error(message || 'Gagal memperbarui menu sidebar');
  }
}

export async function deleteSidebarItem(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('app_sidebar_items').delete().eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('[adminApi] deleteSidebarItem failed', error);
    throw new Error('Gagal menghapus menu sidebar');
  }
}

export async function moveSidebarItem(
  id: string,
  direction: 'up' | 'down'
): Promise<SidebarItemRecord[]> {
  try {
    const items = await listSidebarItems();
    const currentIndex = items.findIndex((item) => item.id === id);
    if (currentIndex === -1) return items;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= items.length) {
      return items;
    }

    const current = items[currentIndex];
    const target = items[swapIndex];

    const firstUpdate = await supabase
      .from('app_sidebar_items')
      .update({ position: target.position })
      .eq('id', current.id);

    if (firstUpdate.error) throw firstUpdate.error;

    const secondUpdate = await supabase
      .from('app_sidebar_items')
      .update({ position: current.position })
      .eq('id', target.id);

    if (secondUpdate.error) throw secondUpdate.error;

    return listSidebarItems();
  } catch (error) {
    console.error('[adminApi] moveSidebarItem failed', error);
    throw new Error('Gagal mengubah urutan menu');
  }
}

function isUnknownColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: string }).code) : '';
  if (code === '42703') return true;
  const message = 'message' in error ? String((error as { message?: string }).message ?? '').toLowerCase() : '';
  return message.includes('column') && message.includes('email');
}

export async function listUsers(params: ListUsersParams = {}): Promise<UserProfileRecord[]> {
  try {
    const columns = 'id, email, username, role, is_active, created_at, updated_at';
    const fallbackColumns = 'id, username, role, is_active, created_at, updated_at';

    const buildQuery = (cols: string) => {
      let query = supabase
        .from('user_profiles')
        .select(cols)
        .order('created_at', { ascending: true });

      const { query: search, role, status } = params;

      if (search?.trim()) {
        const keyword = `%${search.trim()}%`;
        query = query.or(`username.ilike.${keyword},email.ilike.${keyword}`);
      }

      if (role && role !== 'all') {
        query = query.eq('role', role);
      }

      if (status && status !== 'all') {
        query = query.eq('is_active', status === 'active');
      }

      return query;
    };

    let { data, error } = await buildQuery(columns);

    if (error && isUnknownColumnError(error)) {
      ({ data, error } = await buildQuery(fallbackColumns));
    }

    if (error) throw error;

    return (data ?? []).map((item) => mapUserRow(item));
  } catch (error) {
    console.error('[adminApi] listUsers failed', error);
    throw new Error('Gagal memuat daftar pengguna');
  }
}

export async function updateUserProfile(
  id: string,
  updates: UpdateUserProfileInput
): Promise<UserProfileRecord> {
  try {
    const currentResponse = await supabase
      .from('user_profiles')
      .select('id, role, is_active')
      .eq('id', id)
      .maybeSingle();

    if (currentResponse.error) throw currentResponse.error;

    const current = currentResponse.data;
    if (!current) {
      throw new Error('Pengguna tidak ditemukan');
    }

    const currentRole: UserRole = current.role === 'admin' ? 'admin' : 'user';
    const currentActive = sanitizeBoolean(current.is_active, true);

    const nextRole = updates.role ?? currentRole;
    const nextActive =
      typeof updates.is_active === 'boolean' ? updates.is_active : currentActive;

    if (currentRole === 'admin' && (!nextActive || nextRole !== 'admin')) {
      const { data: adminData, error: adminError } = await supabase
        .from('user_profiles')
        .select('id, role, is_active')
        .eq('role', 'admin')
        .neq('id', id);

      if (adminError) throw adminError;

      const activeAdmins = (adminData ?? []).filter((item) => sanitizeBoolean(item.is_active, true));

      if (activeAdmins.length === 0) {
        throw new Error('Tidak dapat menonaktifkan admin terakhir');
      }
    }

    const payload: Record<string, unknown> = {};

    if (updates.role === 'admin' || updates.role === 'user') {
      payload.role = updates.role;
    }

    if (typeof updates.is_active === 'boolean') {
      payload.is_active = updates.is_active;
    }

    const response = await supabase
      .from('user_profiles')
      .update(payload)
      .eq('id', id)
      .select('id, email, username, role, is_active, created_at, updated_at')
      .single();

    const data = ensureResponse(response);
    return mapUserRow(data);
  } catch (error) {
    console.error('[adminApi] updateUserProfile failed', error);
    const message = error instanceof Error ? error.message : 'Gagal memperbarui pengguna';
    throw new Error(message || 'Gagal memperbarui pengguna');
  }
}

function parseDescriptionValue(value: any): string {
  if (value && typeof value === 'object' && 'text' in value) {
    const text = (value as { text?: unknown }).text;
    if (typeof text === 'string') return text;
  }
  if (typeof value === 'string') return value;
  return '';
}

export async function getAppDescription(): Promise<AppDescriptionSetting> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value, updated_at')
      .eq('key', 'app_description')
      .maybeSingle();

    if (error) throw error;

    return {
      text: parseDescriptionValue(data?.value),
      updated_at: data?.updated_at ?? null,
    };
  } catch (error) {
    console.error('[adminApi] getAppDescription failed', error);
    throw new Error('Gagal memuat deskripsi aplikasi');
  }
}

export async function setAppDescription(text: string): Promise<AppDescriptionSetting> {
  try {
    const response = await supabase
      .from('app_settings')
      .upsert(
        {
          key: 'app_description',
          value: { text },
        },
        { onConflict: 'key' }
      )
      .select('value, updated_at')
      .single();

    const data = ensureResponse(response);
    return {
      text: parseDescriptionValue(data.value),
      updated_at: data.updated_at ?? null,
    };
  } catch (error) {
    console.error('[adminApi] setAppDescription failed', error);
    throw new Error('Gagal menyimpan deskripsi aplikasi');
  }
}

function parseBrandingValue(value: any): { primary: string; secondary: string } {
  if (value && typeof value === 'object') {
    const primary = typeof value.primary === 'string' ? value.primary : '#1e40af';
    const secondary = typeof value.secondary === 'string' ? value.secondary : '#0ea5e9';
    return { primary, secondary };
  }
  return { primary: '#1e40af', secondary: '#0ea5e9' };
}

const DEFAULT_ADMIN_DASHBOARD_CONTENT = {
  breadcrumb: 'Dashboard / Admin',
  title: 'Admin Panel',
  subtitle: '',
  badge: 'Admin',
  description: 'Kelola menu, pengguna, dan pengaturan aplikasi di satu tempat.',
};

function parseAdminDashboardContentValue(value: any): Omit<AdminDashboardContentSetting, 'updated_at'> {
  if (value && typeof value === 'object') {
    const breadcrumb = typeof value.breadcrumb === 'string' ? value.breadcrumb : DEFAULT_ADMIN_DASHBOARD_CONTENT.breadcrumb;
    const title = typeof value.title === 'string' ? value.title : DEFAULT_ADMIN_DASHBOARD_CONTENT.title;
    const subtitle = typeof value.subtitle === 'string' ? value.subtitle : DEFAULT_ADMIN_DASHBOARD_CONTENT.subtitle;
    const badge = typeof value.badge === 'string' ? value.badge : DEFAULT_ADMIN_DASHBOARD_CONTENT.badge;
    const description =
      typeof value.description === 'string' ? value.description : DEFAULT_ADMIN_DASHBOARD_CONTENT.description;
    return { breadcrumb, title, subtitle, badge, description };
  }
  return { ...DEFAULT_ADMIN_DASHBOARD_CONTENT };
}

export async function getBranding(): Promise<BrandingSetting> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value, updated_at')
      .eq('key', 'branding')
      .maybeSingle();

    if (error) throw error;

    const branding = parseBrandingValue(data?.value);
    return { ...branding, updated_at: data?.updated_at ?? null };
  } catch (error) {
    console.error('[adminApi] getBranding failed', error);
    throw new Error('Gagal memuat pengaturan branding');
  }
}

export async function setBranding(branding: {
  primary: string;
  secondary: string;
}): Promise<BrandingSetting> {
  try {
    const response = await supabase
      .from('app_settings')
      .upsert(
        {
          key: 'branding',
          value: branding,
        },
        { onConflict: 'key' }
      )
      .select('value, updated_at')
      .single();

    const data = ensureResponse(response);
    const parsed = parseBrandingValue(data.value);
    return { ...parsed, updated_at: data.updated_at ?? null };
  } catch (error) {
    console.error('[adminApi] setBranding failed', error);
    throw new Error('Gagal menyimpan pengaturan branding');
  }
}

export async function getAdminDashboardContent(): Promise<AdminDashboardContentSetting> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value, updated_at')
      .eq('key', 'admin_dashboard_content')
      .maybeSingle();

    if (error) throw error;

    const parsed = parseAdminDashboardContentValue(data?.value);
    return { ...parsed, updated_at: data?.updated_at ?? null };
  } catch (error) {
    console.error('[adminApi] getAdminDashboardContent failed', error);
    throw new Error('Gagal memuat konten dashboard admin');
  }
}

export type UpdateAdminDashboardContentInput = {
  breadcrumb: string;
  title: string;
  subtitle: string;
  badge: string;
  description: string;
};

export async function setAdminDashboardContent(
  content: UpdateAdminDashboardContentInput
): Promise<AdminDashboardContentSetting> {
  try {
    const normalized: UpdateAdminDashboardContentInput = {
      breadcrumb: typeof content.breadcrumb === 'string' ? content.breadcrumb : DEFAULT_ADMIN_DASHBOARD_CONTENT.breadcrumb,
      title: typeof content.title === 'string' ? content.title : DEFAULT_ADMIN_DASHBOARD_CONTENT.title,
      subtitle: typeof content.subtitle === 'string' ? content.subtitle : DEFAULT_ADMIN_DASHBOARD_CONTENT.subtitle,
      badge: typeof content.badge === 'string' ? content.badge : DEFAULT_ADMIN_DASHBOARD_CONTENT.badge,
      description:
        typeof content.description === 'string' ? content.description : DEFAULT_ADMIN_DASHBOARD_CONTENT.description,
    };

    const response = await supabase
      .from('app_settings')
      .upsert(
        {
          key: 'admin_dashboard_content',
          value: normalized,
        },
        { onConflict: 'key' }
      )
      .select('value, updated_at')
      .single();

    const data = ensureResponse(response);
    const parsed = parseAdminDashboardContentValue(data.value);
    return { ...parsed, updated_at: data.updated_at ?? null };
  } catch (error) {
    console.error('[adminApi] setAdminDashboardContent failed', error);
    throw new Error('Gagal menyimpan konten dashboard admin');
  }
}

export async function listAuditLog(limit = 10): Promise<AuditEntry[]> {
  try {
    const [sidebarRes, usersRes] = await Promise.all([
      supabase
        .from('app_sidebar_items')
        .select('id, title, route, updated_at, created_at')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(limit),
      supabase
        .from('user_profiles')
        .select('id, email, username, role, is_active, updated_at, created_at')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(limit),
    ]);

    if (sidebarRes.error) throw sidebarRes.error;
    if (usersRes.error) throw usersRes.error;

    const sidebarEntries: AuditEntry[] = (sidebarRes.data ?? []).map((item) => {
      const updatedAt = item.updated_at ?? item.created_at ?? null;
      const createdAt = item.created_at ?? null;
      const action = createdAt && updatedAt && createdAt === updatedAt ? 'Dibuat' : 'Diperbarui';
      return {
        id: `sidebar-${item.id ?? item.route ?? Math.random().toString(36).slice(2)}`,
        source: 'sidebar',
        title: item.title ? String(item.title) : 'Menu Sidebar',
        description: `${action} • ${String(item.route ?? '')}`.trim(),
        timestamp: updatedAt,
      };
    });

    const userEntries: AuditEntry[] = (usersRes.data ?? []).map((item) => {
      const updatedAt = item.updated_at ?? item.created_at ?? null;
      const createdAt = item.created_at ?? null;
      const action = createdAt && updatedAt && createdAt === updatedAt ? 'Pengguna baru' : 'Perubahan profil';
      const identity = item.username || item.email || item.id;
      const status = `${item.role === 'admin' ? 'Admin' : 'User'} • ${
        sanitizeBoolean(item.is_active, true) ? 'Aktif' : 'Nonaktif'
      }`;
      return {
        id: `user-${item.id ?? Math.random().toString(36).slice(2)}`,
        source: 'user',
        title: identity ? String(identity) : 'Pengguna',
        description: `${action} • ${status}`,
        timestamp: updatedAt,
      };
    });

    const combined = [...sidebarEntries, ...userEntries].sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });

    return combined.slice(0, limit);
  } catch (error) {
    console.error('[adminApi] listAuditLog failed', error);
    throw new Error('Gagal memuat log perubahan');
  }
}
