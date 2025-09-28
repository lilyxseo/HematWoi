import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

type Json = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

type AdminUserProfile = {
  id: string;
  role: 'admin' | 'user';
  is_active: boolean;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  locale?: string | null;
  timezone?: string | null;
  theme?: 'system' | 'light' | 'dark' | null;
  created_at?: string | null;
  updated_at?: string | null;
  email?: string | null;
};

type AdminUserItem = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  identities: { provider: string }[];
  profile: AdminUserProfile;
};

type ListUsersParams = {
  q?: string;
  role?: 'admin' | 'user';
  status?: 'active' | 'inactive';
  limit?: number;
  offset?: number;
  order?: 'created_at.asc' | 'created_at.desc' | 'last_sign_in_at.asc' | 'last_sign_in_at.desc';
};

type JsonResponse = {
  ok: boolean;
  data?: Json;
  error?: { code: string; message: string; details?: Json };
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

function jsonResponse(status: number, body: JsonResponse): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  });
}

function isAuthError(error: unknown): error is { status?: number; message?: string } {
  return Boolean(error) && typeof error === 'object' && 'message' in error;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true' || value === '1';
  if (typeof value === 'number') return value !== 0;
  return false;
}

function validateEmail(email: unknown): string {
  if (typeof email !== 'string' || !email.trim()) {
    throw new Error('Email wajib diisi');
  }
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    throw new Error('Format email tidak valid');
  }
  return trimmed;
}

function validatePassword(password: unknown, { required = false } = {}): string | undefined {
  if (!password) {
    if (required) throw new Error('Password wajib diisi');
    return undefined;
  }
  if (typeof password !== 'string') {
    throw new Error('Password tidak valid');
  }
  const trimmed = password.trim();
  if (!trimmed) {
    if (required) throw new Error('Password wajib diisi');
    return undefined;
  }
  if (trimmed.length < 8) {
    throw new Error('Password minimal 8 karakter');
  }
  if (!/[a-z]/.test(trimmed) || !/[A-Z]/.test(trimmed) || !/[0-9]/.test(trimmed)) {
    throw new Error('Password harus mengandung huruf besar, huruf kecil, dan angka');
  }
  return trimmed;
}

async function authenticateRequest(request: Request): Promise<{
  authUser: User;
  authedClient: SupabaseClient;
  adminClient: SupabaseClient;
}> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    throw new Response(JSON.stringify({ ok: false, error: { code: 'unauthorized', message: 'Authorization header missing' } }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const {
    data: { user },
    error,
  } = await authedClient.auth.getUser();

  if (error || !user) {
    throw new Response(
      JSON.stringify({ ok: false, error: { code: 'unauthorized', message: 'Session tidak valid' } }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const { data: profile, error: profileError } = await authedClient
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new Response(
      JSON.stringify({ ok: false, error: { code: 'forbidden', message: 'Gagal memverifikasi peran admin' } }),
      { status: 403, headers: CORS_HEADERS }
    );
  }

  if (!profile || profile.role !== 'admin' || !normalizeBoolean(profile.is_active)) {
    throw new Response(
      JSON.stringify({ ok: false, error: { code: 'forbidden', message: 'Hanya admin aktif yang dapat mengakses' } }),
      { status: 403, headers: CORS_HEADERS }
    );
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  return { authUser: user, authedClient, adminClient };
}

function parseListParams(url: URL): ListUsersParams {
  const search = url.searchParams.get('q') ?? undefined;
  const role = url.searchParams.get('role');
  const status = url.searchParams.get('status');
  const limitParam = url.searchParams.get('limit');
  const offsetParam = url.searchParams.get('offset') ?? url.searchParams.get('cursor');
  const orderParam = url.searchParams.get('order');

  let parsedRole: 'admin' | 'user' | undefined;
  if (role === 'admin' || role === 'user') {
    parsedRole = role;
  }

  let parsedStatus: 'active' | 'inactive' | undefined;
  if (status === 'active' || status === 'inactive') {
    parsedStatus = status;
  }

  let limit: number | undefined;
  if (limitParam) {
    const value = Number.parseInt(limitParam, 10);
    if (Number.isFinite(value) && value > 0) {
      limit = Math.min(value, 100);
    }
  }

  let offset: number | undefined;
  if (offsetParam) {
    const value = Number.parseInt(offsetParam, 10);
    if (Number.isFinite(value) && value >= 0) {
      offset = value;
    }
  }

  let order: ListUsersParams['order'];
  switch (orderParam) {
    case 'created_at.asc':
    case 'created_at.desc':
    case 'last_sign_in_at.asc':
    case 'last_sign_in_at.desc':
      order = orderParam;
      break;
    default:
      order = 'created_at.desc';
  }

  return {
    q: search,
    role: parsedRole,
    status: parsedStatus,
    limit: limit ?? 20,
    offset: offset ?? 0,
    order,
  };
}

function mapAuthUser(user: User | null, profile: AdminUserProfile): AdminUserItem {
  return {
    id: profile.id,
    email: user?.email ?? null,
    created_at: user?.created_at ?? null,
    last_sign_in_at: user?.last_sign_in_at ?? null,
    identities: Array.isArray(user?.identities)
      ? user!.identities!.map((identity) => ({ provider: identity?.provider ?? 'email' }))
      : [],
    profile,
  };
}

async function fetchProfileRows(
  client: SupabaseClient,
  params: ListUsersParams,
  { withSearchLimit }: { withSearchLimit: boolean }
): Promise<{ rows: AdminUserProfile[]; count: number }> {
  const columns =
    'id, role, is_active, full_name, username, avatar_url, locale, timezone, theme, created_at, updated_at, email';
  const fallbackColumns =
    'id, role, is_active, full_name, username, avatar_url, locale, timezone, theme, created_at, updated_at';

  const buildQuery = (selectColumns: string) => {
    let query = client
      .from('user_profiles')
      .select(selectColumns, { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true });

    if (params.role) {
      query = query.eq('role', params.role);
    }

    if (params.status) {
      query = query.eq('is_active', params.status === 'active');
    }

    if (params.q && params.q.trim()) {
      const keyword = `%${params.q.trim()}%`;
      query = query.or(`username.ilike.${keyword},full_name.ilike.${keyword}`);
    }

    if (withSearchLimit) {
      const max = Math.min(500, Math.max(params.limit ?? 20, 20) * 5);
      query = query.range(0, max - 1);
    } else {
      const offset = params.offset ?? 0;
      const to = offset + (params.limit ?? 20) - 1;
      query = query.range(offset, to);
    }

    return query;
  };

  let { data, error, count } = await buildQuery(columns);
  if (error && error.code === '42703') {
    ({ data, error, count } = await buildQuery(fallbackColumns));
  }

  if (error) {
    throw error;
  }

  const rows = (data ?? []).map((row: any) => ({
    id: String(row.id ?? ''),
    role: row.role === 'admin' ? 'admin' : 'user',
    is_active: normalizeBoolean(row.is_active),
    full_name: row.full_name ?? null,
    username: row.username ?? null,
    avatar_url: row.avatar_url ?? null,
    locale: row.locale ?? null,
    timezone: row.timezone ?? null,
    theme: row.theme ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    email: row.email ?? null,
  }));

  return { rows, count: count ?? rows.length };
}

async function buildListResponse(
  adminClient: SupabaseClient,
  params: ListUsersParams
): Promise<{ items: AdminUserItem[]; total: number; nextCursor: number | null }> {
  const useSearchLimit = Boolean(params.q && params.q.trim());
  const { rows, count } = await fetchProfileRows(adminClient, params, {
    withSearchLimit: useSearchLimit,
  });

  const authUsers = await Promise.all(
    rows.map(async (profile) => {
      const { data, error } = await adminClient.auth.admin.getUserById(profile.id);
      if (error) {
        console.error('[admin-users] getUserById failed', error);
        return null;
      }
      return data.user ?? null;
    })
  );

  const mapped = rows.map((profile, index) => mapAuthUser(authUsers[index], profile));

  let combined = mapped;

  if (params.q && params.q.trim()) {
    const keyword = params.q.trim().toLowerCase();
    combined = mapped.filter((item) => {
      const email = item.email?.toLowerCase() ?? '';
      const username = item.profile.username?.toLowerCase() ?? '';
      const fullName = item.profile.full_name?.toLowerCase() ?? '';
      return email.includes(keyword) || username.includes(keyword) || fullName.includes(keyword);
    });

    if (combined.length < (params.limit ?? 20)) {
      const { data: userList, error } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 100,
        email: params.q.trim(),
      });
      if (!error && userList?.users?.length) {
        const missing = await Promise.all(
          userList.users.map(async (user) => {
            const existing = combined.find((item) => item.id === user.id);
            if (existing) return existing;
            const { data: profileRow, error: profileError } = await adminClient
              .from('user_profiles')
              .select(
                'id, role, is_active, full_name, username, avatar_url, locale, timezone, theme, created_at, updated_at'
              )
              .eq('id', user.id)
              .maybeSingle();
            if (profileError || !profileRow) return null;
            const profile: AdminUserProfile = {
              id: user.id,
              role: profileRow.role === 'admin' ? 'admin' : 'user',
              is_active: normalizeBoolean(profileRow.is_active),
              full_name: profileRow.full_name ?? null,
              username: profileRow.username ?? null,
              avatar_url: profileRow.avatar_url ?? null,
              locale: profileRow.locale ?? null,
              timezone: profileRow.timezone ?? null,
              theme: profileRow.theme ?? null,
              created_at: profileRow.created_at ?? null,
              updated_at: profileRow.updated_at ?? null,
            };
            return mapAuthUser(user as User, profile);
          })
        );
        combined = [...combined, ...missing.filter(Boolean) as AdminUserItem[]];
      }
    }
  }

  const uniqueMap = new Map<string, AdminUserItem>();
  for (const item of combined) {
    uniqueMap.set(item.id, item);
  }

  const uniqueItems = Array.from(uniqueMap.values());

  const sorted = uniqueItems.sort((a, b) => {
    const order = params.order ?? 'created_at.desc';
    const [column, direction] = order.split('.') as ['created_at' | 'last_sign_in_at', 'asc' | 'desc'];
    const aValue = column === 'created_at' ? a.created_at : a.last_sign_in_at;
    const bValue = column === 'created_at' ? b.created_at : b.last_sign_in_at;

    const aTime = aValue ? Date.parse(aValue) : 0;
    const bTime = bValue ? Date.parse(bValue) : 0;

    if (direction === 'asc') {
      return aTime - bTime;
    }
    return bTime - aTime;
  });

  const offset = params.offset ?? 0;
  const limit = params.limit ?? 20;
  const paged = sorted.slice(offset, offset + limit);
  const nextCursor = offset + limit < sorted.length ? offset + limit : null;

  return {
    items: paged,
    total: params.q ? sorted.length : count,
    nextCursor,
  };
}

async function logAdminAction(
  client: SupabaseClient,
  payload: { adminId: string; action: string; targetUserId: string; details?: Json }
): Promise<void> {
  try {
    await client.from('admin_audit_logs').insert({
      admin_id: payload.adminId,
      action: payload.action,
      target_user_id: payload.targetUserId,
      details: payload.details ?? {},
    });
  } catch (error) {
    console.warn('[admin-users] audit log insert failed', error);
  }
}

async function isLastActiveAdmin(client: SupabaseClient, targetId: string): Promise<boolean> {
  const { data: current, error } = await client
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', targetId)
    .maybeSingle();

  if (error) throw error;
  if (!current) return false;

  const role = current.role === 'admin' ? 'admin' : 'user';
  const active = normalizeBoolean(current.is_active);

  if (role !== 'admin' || !active) {
    return false;
  }

  const { data: others, error: othersError } = await client
    .from('user_profiles')
    .select('id')
    .eq('role', 'admin')
    .eq('is_active', true)
    .neq('id', targetId);

  if (othersError) throw othersError;

  return !others || others.length === 0;
}

async function handleList(request: Request, adminClient: SupabaseClient): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = parseListParams(url);
    const { items, total, nextCursor } = await buildListResponse(adminClient, params);
    return jsonResponse(200, {
      ok: true,
      data: {
        items,
        total,
        nextCursor,
        limit: params.limit ?? 20,
      },
    });
  } catch (error) {
    console.error('[admin-users] list failed', error);
    const message = isAuthError(error) && error.message ? error.message : 'Gagal memuat pengguna';
    return jsonResponse(500, {
      ok: false,
      error: { code: 'internal_error', message },
    });
  }
}

async function handleCreate(
  request: Request,
  adminClient: SupabaseClient,
  adminId: string
): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const email = validateEmail(body.email);
    const password = validatePassword(body.password, { required: !body.sendEmailInvite });
    const profileInput = (body.profile ?? {}) as Record<string, unknown>;
    const role = profileInput.role === 'admin' ? 'admin' : 'user';
    const isActive = profileInput.is_active === undefined ? true : normalizeBoolean(profileInput.is_active);
    const sendEmailInvite = Boolean(body.sendEmailInvite);

    let user: User | null = null;

    if (sendEmailInvite) {
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: body?.redirectTo && typeof body.redirectTo === 'string' ? body.redirectTo : undefined,
      });
      if (error) {
        const status = error.status ?? 400;
        return jsonResponse(status, {
          ok: false,
          error: { code: 'auth_error', message: error.message },
        });
      }
      user = data.user ?? null;
    } else {
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password: password!,
        email_confirm: true,
      });
      if (error) {
        const status = error.status ?? 400;
        return jsonResponse(status, {
          ok: false,
          error: { code: 'auth_error', message: error.message },
        });
      }
      user = data.user ?? null;
    }

    if (!user) {
      throw new Error('Gagal membuat user baru');
    }

    const profilePayload: Record<string, unknown> = {
      id: user.id,
      role,
      is_active: isActive,
      email,
    };

    const profileFields: (keyof typeof profileInput)[] = [
      'full_name',
      'username',
      'avatar_url',
      'locale',
      'timezone',
      'theme',
    ];

    for (const key of profileFields) {
      if (profileInput[key] !== undefined) {
        profilePayload[key] = profileInput[key];
      }
    }

    let { data: upsertedProfile, error: profileError } = await adminClient
      .from('user_profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select(
        'id, role, is_active, full_name, username, avatar_url, locale, timezone, theme, created_at, updated_at'
      )
      .single();

    if (profileError && profileError.code === '42703') {
      delete profilePayload.email;
      ({ data: upsertedProfile, error: profileError } = await adminClient
        .from('user_profiles')
        .upsert(profilePayload, { onConflict: 'id' })
        .select(
          'id, role, is_active, full_name, username, avatar_url, locale, timezone, theme, created_at, updated_at'
        )
        .single());
    }

    if (profileError) {
      return jsonResponse(400, {
        ok: false,
        error: { code: 'profile_error', message: profileError.message },
      });
    }

    const item: AdminUserItem = mapAuthUser(user, {
      id: user.id,
      role: upsertedProfile.role === 'admin' ? 'admin' : 'user',
      is_active: normalizeBoolean(upsertedProfile.is_active),
      full_name: upsertedProfile.full_name ?? null,
      username: upsertedProfile.username ?? null,
      avatar_url: upsertedProfile.avatar_url ?? null,
      locale: upsertedProfile.locale ?? null,
      timezone: upsertedProfile.timezone ?? null,
      theme: upsertedProfile.theme ?? null,
      created_at: upsertedProfile.created_at ?? null,
      updated_at: upsertedProfile.updated_at ?? null,
    });

    await logAdminAction(adminClient, {
      adminId,
      action: 'create',
      targetUserId: user.id,
      details: { email, role, is_active: isActive },
    });

    return jsonResponse(201, { ok: true, data: item });
  } catch (error) {
    console.error('[admin-users] create failed', error);
    const message = error instanceof Error ? error.message : 'Gagal membuat pengguna';
    const status = error instanceof Response ? error.status : 400;
    if (error instanceof Response) {
      return error;
    }
    return jsonResponse(status, {
      ok: false,
      error: { code: 'bad_request', message },
    });
  }
}

async function handleUpdate(
  request: Request,
  adminClient: SupabaseClient,
  adminId: string,
  targetId: string
): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const payload: { email?: string; password?: string } = {};
    if (body.email !== undefined) {
      payload.email = validateEmail(body.email);
    }
    if (body.password !== undefined) {
      const newPassword = validatePassword(body.password, { required: true });
      if (newPassword) {
        payload.password = newPassword;
      }
    }

    if (payload.email || payload.password) {
      const { error } = await adminClient.auth.admin.updateUserById(targetId, payload);
      if (error) {
        return jsonResponse(error.status ?? 400, {
          ok: false,
          error: { code: 'auth_error', message: error.message },
        });
      }
    }

    if (body.profile) {
      const profileUpdates = body.profile as Record<string, unknown>;
      const touchesRole = profileUpdates.role !== undefined;
      const touchesActive = profileUpdates.is_active !== undefined;

      if (touchesRole || touchesActive) {
        const { data: currentState, error: currentError } = await adminClient
          .from('user_profiles')
          .select('role, is_active')
          .eq('id', targetId)
          .maybeSingle();

        if (currentError) {
          return jsonResponse(404, {
            ok: false,
            error: { code: 'not_found', message: 'Profil pengguna tidak ditemukan' },
          });
        }

        if (!currentState) {
          return jsonResponse(404, {
            ok: false,
            error: { code: 'not_found', message: 'Profil pengguna tidak ditemukan' },
          });
        }

        const currentRole = currentState.role === 'admin' ? 'admin' : 'user';
        const currentActive = normalizeBoolean(currentState.is_active);

        const nextRole = touchesRole
          ? profileUpdates.role === 'admin'
            ? 'admin'
            : 'user'
          : currentRole;
        const nextActive = touchesActive ? normalizeBoolean(profileUpdates.is_active) : currentActive;

        if (currentRole === 'admin' && currentActive && (nextRole !== 'admin' || !nextActive)) {
          const { data: otherAdmins, error: otherError } = await adminClient
            .from('user_profiles')
            .select('id')
            .eq('role', 'admin')
            .eq('is_active', true)
            .neq('id', targetId);

          if (otherError) {
            console.error('[admin-users] last admin check failed', otherError);
            return jsonResponse(400, {
              ok: false,
              error: { code: 'profile_error', message: 'Gagal memverifikasi admin' },
            });
          }

          if (!otherAdmins || otherAdmins.length === 0) {
            return jsonResponse(400, {
              ok: false,
              error: { code: 'bad_request', message: 'Tidak dapat menonaktifkan admin terakhir' },
            });
          }
        }
      }

      const updatePayload: Record<string, unknown> = {};
      const allowedKeys = [
        'role',
        'is_active',
        'full_name',
        'username',
        'avatar_url',
        'locale',
        'timezone',
        'theme',
      ];
      for (const key of allowedKeys) {
        if (profileUpdates[key] !== undefined) {
          if (key === 'role') {
            updatePayload[key] = profileUpdates[key] === 'admin' ? 'admin' : 'user';
          } else if (key === 'is_active') {
            updatePayload[key] = normalizeBoolean(profileUpdates[key]);
          } else {
            updatePayload[key] = profileUpdates[key];
          }
        }
      }
      if (Object.keys(updatePayload).length > 0) {
        const { error: updateError } = await adminClient
          .from('user_profiles')
          .update(updatePayload)
          .eq('id', targetId);
        if (updateError) {
          return jsonResponse(400, {
            ok: false,
            error: { code: 'profile_error', message: updateError.message },
          });
        }
      }
    }

    const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(targetId);
    if (userError) {
      return jsonResponse(404, {
        ok: false,
        error: { code: 'not_found', message: 'Pengguna tidak ditemukan' },
      });
    }

    const { data: profileRow, error: profileError } = await adminClient
      .from('user_profiles')
      .select('id, role, is_active, full_name, username, avatar_url, locale, timezone, theme, created_at, updated_at')
      .eq('id', targetId)
      .maybeSingle();

    if (profileError || !profileRow) {
      return jsonResponse(404, {
        ok: false,
        error: { code: 'not_found', message: 'Profil pengguna tidak ditemukan' },
      });
    }

    const item: AdminUserItem = mapAuthUser(userData.user ?? null, {
      id: targetId,
      role: profileRow.role === 'admin' ? 'admin' : 'user',
      is_active: normalizeBoolean(profileRow.is_active),
      full_name: profileRow.full_name ?? null,
      username: profileRow.username ?? null,
      avatar_url: profileRow.avatar_url ?? null,
      locale: profileRow.locale ?? null,
      timezone: profileRow.timezone ?? null,
      theme: profileRow.theme ?? null,
      created_at: profileRow.created_at ?? null,
      updated_at: profileRow.updated_at ?? null,
    });

    await logAdminAction(adminClient, {
      adminId,
      action: body.password ? 'reset_password' : 'update',
      targetUserId: targetId,
      details: body,
    });

    return jsonResponse(200, { ok: true, data: item });
  } catch (error) {
    console.error('[admin-users] update failed', error);
    if (error instanceof Response) {
      return error;
    }
    const message = error instanceof Error ? error.message : 'Gagal memperbarui pengguna';
    return jsonResponse(400, {
      ok: false,
      error: { code: 'bad_request', message },
    });
  }
}

async function handleDelete(
  request: Request,
  adminClient: SupabaseClient,
  adminId: string,
  targetId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') === 'soft' ? 'soft' : 'hard';

    if (mode === 'soft') {
      try {
        const lastAdmin = await isLastActiveAdmin(adminClient, targetId);
        if (lastAdmin) {
          return jsonResponse(400, {
            ok: false,
            error: { code: 'bad_request', message: 'Tidak dapat menonaktifkan admin terakhir' },
          });
        }
      } catch (guardError) {
        console.error('[admin-users] soft delete guard failed', guardError);
        return jsonResponse(400, {
          ok: false,
          error: { code: 'profile_error', message: 'Gagal memverifikasi admin' },
        });
      }

      const { error } = await adminClient
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', targetId);
      if (error) {
        return jsonResponse(400, {
          ok: false,
          error: { code: 'profile_error', message: error.message },
        });
      }
      await logAdminAction(adminClient, {
        adminId,
        action: 'toggle_active',
        targetUserId: targetId,
        details: { is_active: false },
      });
      return jsonResponse(200, { ok: true, data: { id: targetId, mode: 'soft' } });
    }

    try {
      const lastAdmin = await isLastActiveAdmin(adminClient, targetId);
      if (lastAdmin) {
        return jsonResponse(400, {
          ok: false,
          error: { code: 'bad_request', message: 'Tidak dapat menghapus admin terakhir' },
        });
      }
    } catch (guardError) {
      console.error('[admin-users] hard delete guard failed', guardError);
      return jsonResponse(400, {
        ok: false,
        error: { code: 'profile_error', message: 'Gagal memverifikasi admin' },
      });
    }

    const { error } = await adminClient.auth.admin.deleteUser(targetId);
    if (error) {
      return jsonResponse(error.status ?? 400, {
        ok: false,
        error: { code: 'auth_error', message: error.message },
      });
    }

    await adminClient.from('user_profiles').delete().eq('id', targetId);

    await logAdminAction(adminClient, {
      adminId,
      action: 'delete',
      targetUserId: targetId,
    });

    return jsonResponse(200, { ok: true, data: { id: targetId, mode: 'hard' } });
  } catch (error) {
    console.error('[admin-users] delete failed', error);
    if (error instanceof Response) {
      return error;
    }
    const message = error instanceof Error ? error.message : 'Gagal menghapus pengguna';
    return jsonResponse(400, {
      ok: false,
      error: { code: 'bad_request', message },
    });
  }
}

serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS });
  }

  let authUser: User;
  let adminClient: SupabaseClient;

  try {
    const authContext = await authenticateRequest(request);
    authUser = authContext.authUser;
    adminClient = authContext.adminClient;
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error('[admin-users] auth error', error);
    return jsonResponse(401, {
      ok: false,
      error: { code: 'unauthorized', message: 'Unauthorized' },
    });
  }

  const url = new URL(request.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const baseIndex = segments.findIndex((segment) => segment === 'admin-users');
  const maybeId = baseIndex >= 0 && segments.length > baseIndex + 1 ? segments[baseIndex + 1] : null;

  switch (request.method) {
    case 'GET':
      return handleList(request, adminClient);
    case 'POST':
      return handleCreate(request, adminClient, authUser.id);
    case 'PATCH':
      if (!maybeId) {
        return jsonResponse(400, {
          ok: false,
          error: { code: 'bad_request', message: 'User id wajib disertakan' },
        });
      }
      return handleUpdate(request, adminClient, authUser.id, maybeId);
    case 'DELETE':
      if (!maybeId) {
        return jsonResponse(400, {
          ok: false,
          error: { code: 'bad_request', message: 'User id wajib disertakan' },
        });
      }
      return handleDelete(request, adminClient, authUser.id, maybeId);
    default:
      return jsonResponse(405, {
        ok: false,
        error: { code: 'method_not_allowed', message: 'Metode tidak didukung' },
      });
  }
});
