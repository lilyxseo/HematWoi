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
  is_enabled?: boolean;
  icon_name?: string | null;
  position?: number;
};

export type UpdateSidebarItemInput = Partial<
  Pick<
    SidebarItemRecord,
    'title' | 'route' | 'access_level' | 'is_enabled' | 'icon_name' | 'position'
  >
>;

export type UserRole = 'user' | 'admin';

export type UserProfileRecord = {
  id: string;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type ListUsersParams = {
  q?: string;
  role?: 'all' | UserRole;
  active?: 'all' | 'active' | 'inactive';
};

export type AppDescriptionSetting = {
  text: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type BrandingSetting = {
  primary: string;
  secondary: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type AuditLogEntry = {
  id: string;
  type: 'sidebar' | 'user';
  title: string;
  description: string;
  timestamp: string;
  meta?: Record<string, unknown>;
};

const ACCESS_LEVELS: SidebarAccessLevel[] = ['public', 'user', 'admin'];

function sanitizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value == null) return fallback;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === 'true' || value === '1';
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

function sanitizeString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function normalizeRoutePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const collapsed = withLeadingSlash.replace(/\/+/g, '/');
  if (collapsed.length <= 1) {
    return '/';
  }
  return collapsed.endsWith('/') ? collapsed.slice(0, -1) : collapsed;
}

function normalizeIconName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function ensureAccessLevel(level: string): level is SidebarAccessLevel {
  return ACCESS_LEVELS.includes(level as SidebarAccessLevel);
}

function mapSidebarRow(row: any): SidebarItemRecord {
  return {
    id:
      String(
        row?.id ??
          row?.route ??
          globalThis.crypto?.randomUUID?.() ??
          Math.random().toString(36).slice(2)
      ),
    title: String(row?.title ?? ''),
    route: String(row?.route ?? ''),
    access_level: ensureAccessLevel(row?.access_level) ? (row.access_level as SidebarAccessLevel) : 'public',
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
    username: row?.username != null ? String(row.username) : null,
    email: row?.email != null ? String(row.email) : null,
    avatar_url: row?.avatar_url != null ? String(row.avatar_url) : null,
    role: row?.role === 'admin' ? 'admin' : 'user',
    is_active: sanitizeBoolean(row?.is_active, true),
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

async function getNextSidebarPosition(): Promise<number> {
  const { data, error } = await supabase
    .from('app_sidebar_items')
    .select('position')
    .order('position', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message || 'Gagal menghitung urutan sidebar');
  }

  const top = data?.[0]?.position;
  const current = sanitizeNumber(top, 0);
  return current + 1;
}

export async function listSidebarItems(): Promise<SidebarItemRecord[]> {
  const { data, error } = await supabase
    .from('app_sidebar_items')
    .select('id, title, route, access_level, is_enabled, icon_name, position, created_at, updated_at')
    .order('position', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Gagal memuat menu sidebar');
  }

  return (data ?? []).map(mapSidebarRow);
}

export async function createSidebarItem(
  payload: CreateSidebarItemInput
): Promise<SidebarItemRecord> {
  const title = sanitizeString(payload.title);
  const route = normalizeRoutePath(payload.route ?? '');
  const accessLevel = payload.access_level;
  const icon = normalizeIconName(payload.icon_name);

  if (!title) {
    throw new Error('Judul wajib diisi');
  }

  if (!route || !route.startsWith('/')) {
    throw new Error("Route harus diawali '/'");
  }

  if (!ensureAccessLevel(accessLevel)) {
    throw new Error('Level akses tidak valid');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message || 'Gagal memeriksa sesi pengguna');
  }

  if (!user) {
    throw new Error('Harus login sebagai admin');
  }

  const position = payload.position ?? (await getNextSidebarPosition());

  const { data, error } = await supabase
    .from('app_sidebar_items')
    .insert({
      title,
      route,
      access_level: accessLevel,
      is_enabled: payload.is_enabled ?? true,
      icon_name: icon,
      position,
      user_id: user.id,
    })
    .select('id, title, route, access_level, is_enabled, icon_name, position, created_at, updated_at')
    .single();

  if (error) {
    const message = String(error.message || error.details || error.hint || error);
    if (/duplicate|unique/i.test(message)) {
      throw new Error('Route sudah digunakan. Gunakan route lain.');
    }
    if (/policy|permission|rls/i.test(message)) {
      throw new Error('Akses ditolak. Hanya admin yang dapat mengubah menu.');
    }
    throw new Error('Gagal menyimpan menu sidebar: ' + message);
  }

  return mapSidebarRow(data);
}

export async function updateSidebarItem(
  id: string,
  patch: UpdateSidebarItemInput
): Promise<SidebarItemRecord> {
  if (!id) {
    throw new Error('ID menu tidak valid');
  }

  const payload: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(patch, 'title')) {
    const title = sanitizeString(patch.title);
    if (!title) {
      throw new Error('Judul wajib diisi');
    }
    payload.title = title;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'route')) {
    const normalized = normalizeRoutePath(String(patch.route ?? ''));
    if (!normalized || !normalized.startsWith('/')) {
      throw new Error("Route harus diawali '/'");
    }
    payload.route = normalized;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'access_level')) {
    const level = String(patch.access_level ?? '');
    if (!ensureAccessLevel(level)) {
      throw new Error('Level akses tidak valid');
    }
    payload.access_level = level;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'is_enabled')) {
    payload.is_enabled = Boolean(patch.is_enabled);
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'icon_name')) {
    payload.icon_name = normalizeIconName(patch.icon_name);
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'position')) {
    payload.position = sanitizeNumber(patch.position, 0);
  }

  if (Object.keys(payload).length === 0) {
    const { data, error } = await supabase
      .from('app_sidebar_items')
      .select('id, title, route, access_level, is_enabled, icon_name, position, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(error.message || 'Gagal mengambil data menu');
    }

    return mapSidebarRow(data);
  }

  const { data, error } = await supabase
    .from('app_sidebar_items')
    .update(payload)
    .eq('id', id)
    .select('id, title, route, access_level, is_enabled, icon_name, position, created_at, updated_at')
    .single();

  if (error) {
    const message = String(error.message || error.details || error.hint || error);
    if (/duplicate|unique/i.test(message)) {
      throw new Error('Route sudah digunakan. Gunakan route lain.');
    }
    throw new Error('Gagal memperbarui menu sidebar: ' + message);
  }

  return mapSidebarRow(data);
}

export async function deleteSidebarItem(id: string): Promise<void> {
  if (!id) {
    throw new Error('ID menu tidak valid');
  }

  const { error } = await supabase.from('app_sidebar_items').delete().eq('id', id);

  if (error) {
    throw new Error(error.message || 'Gagal menghapus menu sidebar');
  }
}

export async function moveSidebarItem(
  id: string,
  direction: 'up' | 'down'
): Promise<SidebarItemRecord[]> {
  if (!id) {
    throw new Error('ID menu tidak valid');
  }

  const { data: current, error: currentError } = await supabase
    .from('app_sidebar_items')
    .select('id, position')
    .eq('id', id)
    .maybeSingle();

  if (currentError) {
    throw new Error(currentError.message || 'Gagal membaca menu');
  }

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

  if (neighborError) {
    throw new Error(neighborError.message || 'Gagal mengurutkan menu');
  }

  if (!neighbor) {
    return listSidebarItems();
  }

  const firstUpdate = await supabase
    .from('app_sidebar_items')
    .update({ position: neighbor.position })
    .eq('id', current.id);

  if (firstUpdate.error) {
    throw new Error(firstUpdate.error.message || 'Gagal memperbarui urutan menu');
  }

  const secondUpdate = await supabase
    .from('app_sidebar_items')
    .update({ position: current.position })
    .eq('id', neighbor.id);

  if (secondUpdate.error) {
    throw new Error(secondUpdate.error.message || 'Gagal memperbarui urutan menu');
  }

  return listSidebarItems();
}

export async function listUsers(params: ListUsersParams = {}): Promise<UserProfileRecord[]> {
  let query = supabase
    .from('user_profiles')
    .select('id, username, email, avatar_url, role, is_active, created_at, updated_at')
    .order('created_at', { ascending: true });

  if (params.role && params.role !== 'all') {
    query = query.eq('role', params.role);
  }

  if (params.active === 'active') {
    query = query.eq('is_active', true);
  } else if (params.active === 'inactive') {
    query = query.eq('is_active', false);
  }

  if (params.q && params.q.trim()) {
    const term = params.q.trim().replace(/[,%]/g, '');
    const pattern = `%${term.replace(/\s+/g, '%')}%`;
    query = query.or(`username.ilike.${pattern},email.ilike.${pattern}`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'Gagal memuat daftar pengguna');
  }

  return (data ?? []).map(mapUserRow);
}

export type UpdateUserProfileInput = Partial<Pick<UserProfileRecord, 'role' | 'is_active'>>;

export async function updateUserProfile(
  id: string,
  updates: UpdateUserProfileInput
): Promise<UserProfileRecord> {
  if (!id) {
    throw new Error('ID pengguna tidak valid');
  }

  if (updates.role && !['user', 'admin'].includes(updates.role)) {
    throw new Error('Role tidak valid');
  }

  const { data: current, error: currentError } = await supabase
    .from('user_profiles')
    .select('id, role, is_active')
    .eq('id', id)
    .maybeSingle();

  if (currentError) {
    throw new Error(currentError.message || 'Gagal mengambil data pengguna');
  }

  if (!current) {
    throw new Error('Pengguna tidak ditemukan');
  }

  const currentRole: UserRole = current.role === 'admin' ? 'admin' : 'user';
  const currentActive = sanitizeBoolean(current.is_active, true);

  const nextRole: UserRole = updates.role ?? currentRole;
  const nextActive =
    typeof updates.is_active === 'boolean' ? updates.is_active : currentActive;

  if (currentRole === 'admin' && (nextRole !== 'admin' || !nextActive)) {
    const { data: admins, error: adminsError } = await supabase
      .from('user_profiles')
      .select('id, role, is_active')
      .eq('role', 'admin');

    if (adminsError) {
      throw new Error(adminsError.message || 'Gagal memeriksa admin lain');
    }

    const remaining = (admins ?? []).filter((row: any) => {
      if (String(row?.id ?? '') === id) return false;
      return sanitizeBoolean(row?.is_active, true);
    });

    if (remaining.length === 0) {
      throw new Error('Tidak dapat menonaktifkan admin terakhir');
    }
  }

  const payload: Record<string, unknown> = {};

  if (updates.role && updates.role !== currentRole) {
    payload.role = updates.role;
  }

  if (typeof updates.is_active === 'boolean' && updates.is_active !== currentActive) {
    payload.is_active = updates.is_active;
  }

  if (Object.keys(payload).length === 0) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, email, avatar_url, role, is_active, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(error.message || 'Gagal mengambil data pengguna');
    }

    return mapUserRow(data);
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update(payload)
    .eq('id', id)
    .select('id, username, email, avatar_url, role, is_active, created_at, updated_at')
    .single();

  if (error) {
    throw new Error(error.message || 'Gagal memperbarui pengguna');
  }

  return mapUserRow(data);
}

function extractUpdatedBy(row: any): string | null {
  if (!row) return null;
  if (typeof row.updated_by === 'string' && row.updated_by.trim()) {
    return row.updated_by.trim();
  }
  if (typeof row.user_id === 'string' && row.user_id.trim()) {
    return row.user_id.trim();
  }
  return null;
}

export async function getAppDescription(): Promise<AppDescriptionSetting> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value, updated_at, updated_by, user_id')
    .eq('key', 'app_description')
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Gagal memuat deskripsi aplikasi');
  }

  const value = (data?.value ?? {}) as { text?: unknown };

  return {
    text: typeof value.text === 'string' ? value.text : '',
    updatedAt: data?.updated_at ?? null,
    updatedBy: extractUpdatedBy(data),
  };
}

export async function setAppDescription(text: string): Promise<AppDescriptionSetting> {
  const payload = {
    key: 'app_description',
    value: { text },
  };

  const { data, error } = await supabase
    .from('app_settings')
    .upsert(payload, { onConflict: 'key' })
    .select('value, updated_at, updated_by, user_id')
    .single();

  if (error) {
    throw new Error(error.message || 'Gagal menyimpan deskripsi aplikasi');
  }

  const value = (data?.value ?? {}) as { text?: unknown };

  return {
    text: typeof value.text === 'string' ? value.text : text,
    updatedAt: data?.updated_at ?? null,
    updatedBy: extractUpdatedBy(data),
  };
}

function normalizeColor(value: string | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('#')) {
    return `#${trimmed}`;
  }
  return trimmed.slice(0, 7);
}

export async function getBranding(): Promise<BrandingSetting> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value, updated_at, updated_by, user_id')
    .eq('key', 'branding')
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Gagal memuat pengaturan branding');
  }

  const value = (data?.value ?? {}) as { primary?: unknown; secondary?: unknown };

  const primary = typeof value.primary === 'string' ? value.primary : '';
  const secondary = typeof value.secondary === 'string' ? value.secondary : '';

  return {
    primary,
    secondary,
    updatedAt: data?.updated_at ?? null,
    updatedBy: extractUpdatedBy(data),
  };
}

export async function setBranding(
  colors: Partial<Pick<BrandingSetting, 'primary' | 'secondary'>>
): Promise<BrandingSetting> {
  const primary = normalizeColor(colors.primary ?? '');
  const secondary = normalizeColor(colors.secondary ?? '');

  const { data, error } = await supabase
    .from('app_settings')
    .upsert(
      {
        key: 'branding',
        value: {
          primary,
          secondary,
        },
      },
      { onConflict: 'key' }
    )
    .select('value, updated_at, updated_by, user_id')
    .single();

  if (error) {
    throw new Error(error.message || 'Gagal menyimpan branding');
  }

  const value = (data?.value ?? {}) as { primary?: unknown; secondary?: unknown };

  return {
    primary: typeof value.primary === 'string' ? value.primary : primary,
    secondary: typeof value.secondary === 'string' ? value.secondary : secondary,
    updatedAt: data?.updated_at ?? null,
    updatedBy: extractUpdatedBy(data),
  };
}

export async function getAdminAuditLog(limit = 10): Promise<AuditLogEntry[]> {
  const [sidebarRes, userRes] = await Promise.all([
    supabase
      .from('app_sidebar_items')
      .select('id, title, route, access_level, is_enabled, updated_at, created_at')
      .order('updated_at', { ascending: false, nullsLast: false })
      .limit(limit),
    supabase
      .from('user_profiles')
      .select('id, username, email, role, is_active, updated_at, created_at')
      .order('updated_at', { ascending: false, nullsLast: false })
      .limit(limit),
  ]);

  if (sidebarRes.error) {
    throw new Error(sidebarRes.error.message || 'Gagal memuat riwayat sidebar');
  }

  if (userRes.error) {
    throw new Error(userRes.error.message || 'Gagal memuat riwayat pengguna');
  }

  const sidebarEntries = (sidebarRes.data ?? []).map((item: any) => {
    const timestamp = item?.updated_at ?? item?.created_at;
    const createdAt = item?.created_at ?? null;
    const updatedAt = item?.updated_at ?? null;
    const action = updatedAt && createdAt && updatedAt !== createdAt ? 'Diperbarui' : 'Dibuat';
    return {
      id: `sidebar-${item.id ?? item.route}`,
      type: 'sidebar' as const,
      title: item?.title ? String(item.title) : 'Menu tanpa judul',
      description: `${action} • ${String(item?.route ?? '')}`.trim(),
      timestamp: timestamp ?? new Date().toISOString(),
      meta: {
        access_level: item?.access_level ?? null,
        is_enabled: sanitizeBoolean(item?.is_enabled, true),
      },
    } satisfies AuditLogEntry;
  });

  const userEntries = (userRes.data ?? []).map((item: any) => {
    const timestamp = item?.updated_at ?? item?.created_at;
    const createdAt = item?.created_at ?? null;
    const updatedAt = item?.updated_at ?? null;
    const action = updatedAt && createdAt && updatedAt !== createdAt ? 'Perubahan profil' : 'Pengguna baru';
    const name = item?.username || item?.email || 'Pengguna';
    const status = sanitizeBoolean(item?.is_active, true) ? 'Aktif' : 'Nonaktif';
    const role = item?.role === 'admin' ? 'Admin' : 'User';
    return {
      id: `user-${item.id ?? name}`,
      type: 'user' as const,
      title: String(name),
      description: `${action} • Role: ${role} • Status: ${status}`,
      timestamp: timestamp ?? new Date().toISOString(),
      meta: {
        role,
        is_active: status,
      },
    } satisfies AuditLogEntry;
  });

  return [...sidebarEntries, ...userEntries]
    .filter((entry) => Boolean(entry.timestamp))
    .sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return bTime - aTime;
    })
    .slice(0, limit);
}
