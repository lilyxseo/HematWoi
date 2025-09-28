import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

type JsonRecord = Record<string, unknown>;

type AdminUserProfile = {
  role: 'admin' | 'user';
  is_active: boolean;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  locale?: string | null;
  timezone?: string | null;
  theme?: string | null;
};

type AdminUserItem = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  identities: { provider: string }[];
  profile: AdminUserProfile;
};

type PaginatedUsers = {
  items: AdminUserItem[];
  limit: number;
  offset: number;
  total: number;
  nextCursor: string | null;
  previousCursor: string | null;
};

type RequestContext = {
  request: Request;
  supabaseClient: SupabaseClient;
  adminClient: SupabaseClient;
  adminUserId: string;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY'.toUpperCase());

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase environment variables for Edge Function');
  throw new Error('Missing Supabase environment configuration');
}

function buildResponse(status: number, payload: JsonRecord) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

function errorResponse(status: number, code: string, message: string, details?: JsonRecord) {
  return buildResponse(status, {
    ok: false,
    error: { code, message, ...(details ? { details } : {}) },
  });
}

function successResponse(data: unknown, status = 200) {
  return buildResponse(status, { ok: true, data });
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  }
  return fallback;
}

function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  // Simple RFC compliant-ish regex
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return EMAIL_REGEX.test(trimmed);
}

function isValidPassword(password: string): boolean {
  if (password.length < 8) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  return hasUpper && hasLower && hasDigit;
}

function normalizeOrder(orderParam: string | null | undefined): {
  field: 'created_at' | 'last_sign_in_at' | 'email';
  direction: 'asc' | 'desc';
} {
  const DEFAULT = { field: 'created_at', direction: 'desc' as const };
  if (!orderParam) return DEFAULT;
  const [fieldRaw, directionRaw] = orderParam.split('.');
  const field = ['created_at', 'last_sign_in_at', 'email'].includes(fieldRaw ?? '')
    ? (fieldRaw as 'created_at' | 'last_sign_in_at' | 'email')
    : DEFAULT.field;
  const direction = directionRaw === 'asc' ? 'asc' : directionRaw === 'desc' ? 'desc' : DEFAULT.direction;
  return { field, direction };
}

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(parsed, 100);
}

function parseOffset(offsetParam: string | null, cursorParam: string | null, limit: number): number {
  if (offsetParam) {
    const parsed = Number.parseInt(offsetParam, 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  if (cursorParam) {
    const direct = Number.parseInt(cursorParam, 10);
    if (Number.isFinite(direct) && direct >= 0) return direct;
    try {
      const decoded = Number.parseInt(atob(cursorParam), 10);
      if (Number.isFinite(decoded) && decoded >= 0) return decoded;
    } catch (_err) {
      // Ignore invalid base64 cursor
    }
  }
  return 0;
}

function normalizeProfilePayload(input: any): Partial<AdminUserProfile> {
  if (!input || typeof input !== 'object') return {};
  const profile: Partial<AdminUserProfile> = {};
  if (input.role === 'admin' || input.role === 'user') {
    profile.role = input.role;
  }
  if (typeof input.is_active === 'boolean') {
    profile.is_active = input.is_active;
  }
  if (typeof input.full_name === 'string') profile.full_name = input.full_name.trim() || null;
  if (typeof input.username === 'string') profile.username = input.username.trim() || null;
  if (typeof input.avatar_url === 'string') profile.avatar_url = input.avatar_url.trim() || null;
  if (typeof input.locale === 'string') profile.locale = input.locale.trim() || null;
  if (typeof input.timezone === 'string') profile.timezone = input.timezone.trim() || null;
  if (typeof input.theme === 'string' && ['system', 'light', 'dark'].includes(input.theme)) {
    profile.theme = input.theme;
  }
  return profile;
}

function mapUser(row: any): AdminUserItem {
  const identitiesData = Array.isArray(row?.identities)
    ? (row.identities as any[])
    : typeof row?.identities === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(row.identities);
            return Array.isArray(parsed) ? parsed : [];
          } catch (_err) {
            return [];
          }
        })()
      : [];
  const identities = identitiesData
    .map((item: any) => ({ provider: String(item?.provider ?? 'unknown') }))
    .filter((item: { provider: string }) => Boolean(item.provider));

  const profile: AdminUserProfile = {
    role: row?.profile_role === 'admin' ? 'admin' : 'user',
    is_active: parseBoolean(row?.profile_is_active, true),
    full_name: row?.profile_full_name ?? null,
    username: row?.profile_username ?? null,
    avatar_url: row?.profile_avatar_url ?? null,
    locale: row?.profile_locale ?? null,
    timezone: row?.profile_timezone ?? null,
    theme: row?.profile_theme ?? null,
  };

  return {
    id: String(row?.id ?? ''),
    email: String(row?.email ?? ''),
    created_at: new Date(row?.created_at ?? Date.now()).toISOString(),
    last_sign_in_at: row?.last_sign_in_at ? new Date(row.last_sign_in_at).toISOString() : null,
    identities,
    profile,
  };
}

async function fetchUserById(adminClient: SupabaseClient, userId: string): Promise<AdminUserItem | null> {
  const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(userId);
  if (userError) {
    console.error('[admin-users] failed to fetch auth user', userError);
    return null;
  }
  const authUser = userData?.user;
  if (!authUser) {
    return null;
  }

  const { data: profileData, error: profileError } = await adminClient
    .from('user_profiles')
    .select('role, is_active, full_name, username, avatar_url, locale, timezone, theme')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    console.error('[admin-users] failed to fetch profile', profileError);
  }

  const profile: AdminUserProfile = {
    role: profileData?.role === 'admin' ? 'admin' : 'user',
    is_active: parseBoolean(profileData?.is_active, true),
    full_name: profileData?.full_name ?? null,
    username: profileData?.username ?? null,
    avatar_url: profileData?.avatar_url ?? null,
    locale: profileData?.locale ?? null,
    timezone: profileData?.timezone ?? null,
    theme: profileData?.theme ?? null,
  };

  const identities = Array.isArray(authUser.identities)
    ? authUser.identities.map((item: any) => ({ provider: String(item?.provider ?? 'unknown') }))
    : [];

  return {
    id: authUser.id,
    email: authUser.email ?? '',
    created_at: authUser.created_at ?? new Date().toISOString(),
    last_sign_in_at: authUser.last_sign_in_at ?? null,
    identities,
    profile,
  };
}

async function logAdminAction(
  adminClient: SupabaseClient,
  adminId: string,
  action: string,
  targetUserId: string,
  details: JsonRecord = {}
) {
  const payload = {
    admin_id: adminId,
    action,
    target_user_id: targetUserId,
    details,
  };
  const { error } = await adminClient.from('admin_audit_logs').insert(payload);
  if (error) {
    console.error('[admin-users] failed to log audit entry', error);
  }
}

async function ensureProfile(adminClient: SupabaseClient, userId: string, profile: Partial<AdminUserProfile>) {
  const defaultProfile: Partial<AdminUserProfile> = {
    role: profile.role ?? 'user',
    is_active: profile.is_active ?? true,
    full_name: profile.full_name ?? null,
    username: profile.username ?? null,
    avatar_url: profile.avatar_url ?? null,
    locale: profile.locale ?? 'id-ID',
    timezone: profile.timezone ?? 'Asia/Jakarta',
    theme: profile.theme ?? 'system',
  };

  const { error } = await adminClient
    .from('user_profiles')
    .upsert(
      { id: userId, ...defaultProfile },
      { onConflict: 'id' }
    );

  if (error) {
    console.error('[admin-users] failed to upsert profile', error);
    throw error;
  }
}

async function authenticate(request: Request): Promise<RequestContext> {
  if (!SUPABASE_ANON_KEY) {
    throw new Error('Missing anon key');
  }
  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    throw new Error('MissingAuthorization');
  }

  const supabaseClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const adminClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabaseClient.auth.getUser();
  if (error || !data?.user) {
    throw new Error('Unauthorized');
  }
  const authUser = data.user;

  const { data: profile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', authUser.id)
    .maybeSingle();

  if (profileError) {
    console.error('[admin-users] failed to load admin profile', profileError);
    throw new Error('Unauthorized');
  }

  const isAdmin = profile?.role === 'admin' && parseBoolean(profile?.is_active, true);
  if (!isAdmin) {
    throw new Error('Forbidden');
  }

  return { request, supabaseClient, adminClient, adminUserId: authUser.id };
}

async function handleListUsers(context: RequestContext) {
  const { request, adminClient } = context;
  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? url.searchParams.get('query');
  const roleParam = url.searchParams.get('role');
  const statusParam = url.searchParams.get('status');
  const limit = parseLimit(url.searchParams.get('limit'));
  const { field, direction } = normalizeOrder(url.searchParams.get('order'));
  const offset = parseOffset(url.searchParams.get('offset'), url.searchParams.get('cursor'), limit);

  const normalizedRole = roleParam === 'admin' || roleParam === 'user' ? roleParam : null;
  const normalizedStatus = statusParam === 'active' || statusParam === 'inactive' ? statusParam : null;

  const { data, error } = await adminClient.rpc('admin_list_users', {
    search: q && q.trim() ? q.trim() : null,
    role: normalizedRole,
    status: normalizedStatus,
    limit_count: limit,
    offset_count: offset,
    order_field: field,
    order_direction: direction,
  });

  if (error) {
    console.error('[admin-users] list users failed', error);
    return errorResponse(500, 'LIST_USERS_FAILED', 'Gagal memuat daftar pengguna');
  }

  const items = Array.isArray(data) ? data.map(mapUser) : [];
  const total = Array.isArray(data) && data.length > 0 && typeof data[0]?.total_count === 'number'
    ? Number(data[0].total_count)
    : items.length;

  const nextOffset = offset + items.length;
  const hasNext = nextOffset < total;
  const previousOffset = Math.max(offset - limit, 0);
  const pagination: PaginatedUsers = {
    items,
    limit,
    offset,
    total,
    nextCursor: hasNext ? String(nextOffset) : null,
    previousCursor: offset > 0 ? String(previousOffset) : null,
  };

  return successResponse(pagination);
}

async function handleCreateUser(context: RequestContext) {
  const { request, adminClient, adminUserId } = context;
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return errorResponse(400, 'INVALID_BODY', 'Payload tidak valid');
  }

  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  const sendEmailInvite = parseBoolean(payload.sendEmailInvite, false);
  const profilePayload = normalizeProfilePayload((payload as any).profile ?? {});

  if (!isValidEmail(email)) {
    return errorResponse(400, 'INVALID_EMAIL', 'Email tidak valid');
  }

  if (!sendEmailInvite && !isValidPassword(password)) {
    return errorResponse(400, 'INVALID_PASSWORD', 'Password harus minimal 8 karakter dan mengandung huruf besar, huruf kecil, serta angka');
  }

  try {
    let userId: string | null = null;
    if (sendEmailInvite) {
      const response = await adminClient.auth.admin.inviteUserByEmail({ email });
      if (response.error) {
        const code = response.error.status === 409 ? 'EMAIL_CONFLICT' : 'INVITE_FAILED';
        return errorResponse(response.error.status ?? 500, code, response.error.message ?? 'Gagal mengundang pengguna');
      }
      userId = response.data?.user?.id ?? null;
    } else {
      const response = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (response.error) {
        const code = response.error.status === 409 ? 'EMAIL_CONFLICT' : 'CREATE_FAILED';
        return errorResponse(response.error.status ?? 500, code, response.error.message ?? 'Gagal membuat pengguna');
      }
      userId = response.data?.user?.id ?? null;
    }

    if (!userId) {
      return errorResponse(500, 'CREATE_FAILED', 'Tidak dapat menentukan ID pengguna baru');
    }

    await ensureProfile(adminClient, userId, profilePayload);
    await logAdminAction(adminClient, adminUserId, 'create', userId, {
      email,
      sendEmailInvite,
      profile: profilePayload,
    });

    const user = await fetchUserById(adminClient, userId);
    if (!user) {
      return errorResponse(500, 'FETCH_FAILED', 'Pengguna berhasil dibuat tetapi gagal dimuat ulang');
    }

    return successResponse(user, 201);
  } catch (error) {
    console.error('[admin-users] create user unexpected error', error);
    return errorResponse(500, 'CREATE_FAILED', 'Terjadi kesalahan saat membuat pengguna');
  }
}

async function validateAdminTransition(
  adminClient: SupabaseClient,
  targetUserId: string,
  updates: Partial<AdminUserProfile>
) {
  if (!updates) return;
  const willDemote = typeof updates.role === 'string' && updates.role !== 'admin';
  const willDeactivate = typeof updates.is_active === 'boolean' && !updates.is_active;
  if (!willDemote && !willDeactivate) {
    return;
  }

  const { data: current, error } = await adminClient
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', targetUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const currentRole = current?.role === 'admin' ? 'admin' : 'user';
  const currentActive = parseBoolean(current?.is_active, true);

  const nextRole = updates.role ?? currentRole;
  const nextActive = typeof updates.is_active === 'boolean' ? updates.is_active : currentActive;

  if (currentRole === 'admin' && (!nextActive || nextRole !== 'admin')) {
    const { data: admins, error: adminsError } = await adminClient
      .from('user_profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('is_active', true)
      .neq('id', targetUserId);

    if (adminsError) throw adminsError;
    if (!admins || admins.length === 0) {
      throw new Error('Tidak dapat menonaktifkan atau menurunkan admin terakhir');
    }
  }
}

async function handleUpdateUser(context: RequestContext, userId: string) {
  const { request, adminClient, adminUserId } = context;
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return errorResponse(400, 'INVALID_BODY', 'Payload tidak valid');
  }

  const authUpdate: { email?: string; password?: string } = {};
  if (typeof payload.email === 'string') {
    const email = payload.email.trim();
    if (!isValidEmail(email)) {
      return errorResponse(400, 'INVALID_EMAIL', 'Email tidak valid');
    }
    authUpdate.email = email;
  }
  if (typeof payload.password === 'string' && payload.password.trim()) {
    if (!isValidPassword(payload.password)) {
      return errorResponse(400, 'INVALID_PASSWORD', 'Password harus minimal 8 karakter dan mengandung huruf besar, huruf kecil, serta angka');
    }
    authUpdate.password = payload.password;
  }

  const profileUpdates = normalizeProfilePayload((payload as any).profile ?? {});

  try {
    if (Object.keys(authUpdate).length > 0) {
      const response = await adminClient.auth.admin.updateUserById(userId, authUpdate);
      if (response.error) {
        return errorResponse(
          response.error.status ?? 500,
          'UPDATE_FAILED',
          response.error.message ?? 'Gagal memperbarui pengguna'
        );
      }
    }

    if (Object.keys(profileUpdates).length > 0) {
      await validateAdminTransition(adminClient, userId, profileUpdates);
      const updatePayload: Record<string, unknown> = {};
      if (profileUpdates.role) {
        updatePayload.role = profileUpdates.role;
      }
      if (typeof profileUpdates.is_active === 'boolean') {
        updatePayload.is_active = profileUpdates.is_active;
      }
      if (profileUpdates.full_name !== undefined) updatePayload.full_name = profileUpdates.full_name;
      if (profileUpdates.username !== undefined) updatePayload.username = profileUpdates.username;
      if (profileUpdates.avatar_url !== undefined) updatePayload.avatar_url = profileUpdates.avatar_url;
      if (profileUpdates.locale !== undefined) updatePayload.locale = profileUpdates.locale ?? 'id-ID';
      if (profileUpdates.timezone !== undefined) updatePayload.timezone = profileUpdates.timezone ?? 'Asia/Jakarta';
      if (profileUpdates.theme !== undefined) updatePayload.theme = profileUpdates.theme ?? 'system';

      const { error } = await adminClient
        .from('user_profiles')
        .update(updatePayload)
        .eq('id', userId);

      if (error) {
        return errorResponse(500, 'UPDATE_PROFILE_FAILED', 'Gagal memperbarui profil pengguna');
      }
    }

    if (Object.keys(authUpdate).length === 0 && Object.keys(profileUpdates).length === 0) {
      return errorResponse(400, 'NO_CHANGES', 'Tidak ada perubahan yang diberikan');
    }

    await logAdminAction(adminClient, adminUserId, 'update', userId, {
      auth: authUpdate,
      profile: profileUpdates,
    });

    const user = await fetchUserById(adminClient, userId);
    if (!user) {
      return errorResponse(404, 'NOT_FOUND', 'Pengguna tidak ditemukan setelah diperbarui');
    }

    return successResponse(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat memperbarui pengguna';
    return errorResponse(500, 'UPDATE_FAILED', message);
  }
}

async function handleDeleteUser(context: RequestContext, userId: string) {
  const { request, adminClient, adminUserId } = context;
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') === 'soft' ? 'soft' : 'hard';

  try {
    if (mode === 'soft') {
      const { error } = await adminClient
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', userId);
      if (error) {
        return errorResponse(500, 'DEACTIVATE_FAILED', 'Gagal menonaktifkan pengguna');
      }
      await logAdminAction(adminClient, adminUserId, 'toggle_active', userId, { is_active: false });
      const user = await fetchUserById(adminClient, userId);
      return successResponse({ mode: 'soft', user });
    }

    const response = await adminClient.auth.admin.deleteUser(userId);
    if (response.error) {
      return errorResponse(
        response.error.status ?? 500,
        'DELETE_FAILED',
        response.error.message ?? 'Gagal menghapus pengguna'
      );
    }

    const { error } = await adminClient.from('user_profiles').delete().eq('id', userId);
    if (error) {
      console.error('[admin-users] failed to delete profile after auth deletion', error);
    }

    await logAdminAction(adminClient, adminUserId, 'delete', userId, { mode: 'hard' });
    return successResponse({ mode: 'hard' });
  } catch (error) {
    console.error('[admin-users] delete user unexpected error', error);
    return errorResponse(500, 'DELETE_FAILED', 'Terjadi kesalahan saat menghapus pengguna');
  }
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let context: RequestContext;
  try {
    context = await authenticate(request);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'MissingAuthorization') {
        return errorResponse(401, 'MISSING_AUTHORIZATION', 'Header Authorization diperlukan');
      }
      if (error.message === 'Unauthorized') {
        return errorResponse(401, 'UNAUTHORIZED', 'Sesi tidak valid atau kedaluwarsa');
      }
      if (error.message === 'Forbidden') {
        return errorResponse(403, 'FORBIDDEN', 'Hanya admin aktif yang dapat mengakses fitur ini');
      }
    }
    console.error('[admin-users] authentication error', error);
    return errorResponse(401, 'UNAUTHORIZED', 'Autentikasi gagal');
  }

  const url = new URL(request.url);
  const idMatch = url.pathname.match(/admin-users\/?([^/?]*)?$/);
  const userId = idMatch && idMatch[1] ? idMatch[1] : null;

  switch (request.method.toUpperCase()) {
    case 'GET':
      return await handleListUsers(context);
    case 'POST':
      return await handleCreateUser(context);
    case 'PATCH':
      if (!userId) {
        return errorResponse(400, 'MISSING_ID', 'ID pengguna harus disediakan pada path');
      }
      return await handleUpdateUser(context, userId);
    case 'DELETE':
      if (!userId) {
        return errorResponse(400, 'MISSING_ID', 'ID pengguna harus disediakan pada path');
      }
      return await handleDeleteUser(context, userId);
    default:
      return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Metode tidak diizinkan');
  }
});
