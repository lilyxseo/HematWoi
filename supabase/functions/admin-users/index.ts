import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4?target=deno';
import type { User, UserIdentity } from 'https://esm.sh/@supabase/supabase-js@2.57.4?target=deno';

type HttpError = {
  status: number;
  body: {
    ok: false;
    error: {
      code: string;
      message: string;
      details?: unknown;
    };
  };
};

type AdminProfileRow = {
  id: string;
  role: 'admin' | 'user';
  is_active: boolean;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  locale?: string | null;
  timezone?: string | null;
  theme?: 'system' | 'light' | 'dark' | null;
};

type AdminUserResponse = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  identities: { provider: string }[];
  profile: AdminProfileRow;
};

type AdminAuditAction = 'create' | 'update' | 'delete' | 'toggle_active' | 'reset_password';

type ListParams = {
  q?: string;
  role?: 'admin' | 'user' | 'all';
  status?: 'active' | 'inactive' | 'all';
  order?: string;
  page?: number;
  limit?: number;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  console.error('Missing Supabase environment variables');
  throw new Error('Missing Supabase environment variables');
}

function jsonResponse<T>(status: number, body: T) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function httpError(status: number, code: string, message: string, details?: unknown): HttpError {
  return {
    status,
    body: { ok: false, error: { code, message, details } },
  };
}

async function getAdminContext(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw httpError(401, 'unauthorized', 'Token otorisasi tidak ditemukan');
  }

  const accessToken = authHeader.replace('Bearer ', '').trim();
  if (!accessToken) {
    throw httpError(401, 'unauthorized', 'Token otorisasi kosong');
  }

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await supabaseClient.auth.getUser(accessToken);
  if (authError || !authData?.user) {
    throw httpError(401, 'unauthorized', 'Session tidak valid', authError ?? undefined);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('id, role, is_active')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error('[admin-users] failed to load admin profile', profileError);
    throw httpError(500, 'profile_error', 'Gagal memuat profil admin');
  }

  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    throw httpError(403, 'forbidden', 'Hanya admin aktif yang dapat mengakses endpoint ini');
  }

  return { user: authData.user, adminClient } as const;
}

function sanitizeProfile(row: Partial<AdminProfileRow> | null | undefined): AdminProfileRow {
  return {
    id: String(row?.id ?? ''),
    role: row?.role === 'admin' ? 'admin' : 'user',
    is_active: Boolean(row?.is_active ?? true),
    full_name: row?.full_name ?? null,
    username: row?.username ?? null,
    avatar_url: row?.avatar_url ?? null,
    locale: row?.locale ?? null,
    timezone: row?.timezone ?? null,
    theme: (row?.theme as AdminProfileRow['theme']) ?? 'system',
  };
}

function serializeUser(user: User, profileRow: Partial<AdminProfileRow> | null | undefined): AdminUserResponse {
  return {
    id: user.id,
    email: user.email ?? '',
    created_at: user.created_at ?? new Date().toISOString(),
    last_sign_in_at: user.last_sign_in_at ?? null,
    identities: Array.isArray(user.identities)
      ? (user.identities as UserIdentity[]).map((identity) => ({ provider: identity?.provider ?? 'email' }))
      : [{ provider: 'email' }],
    profile: sanitizeProfile({ id: user.id, ...profileRow }),
  };
}

function validateEmail(email: unknown) {
  if (typeof email !== 'string' || !email.trim()) {
    throw httpError(400, 'invalid_email', 'Email wajib diisi');
  }
  const trimmed = email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    throw httpError(400, 'invalid_email', 'Format email tidak valid');
  }
  return trimmed.toLowerCase();
}

function validatePassword(password: unknown) {
  if (typeof password !== 'string' || password.length < 8) {
    throw httpError(400, 'invalid_password', 'Password minimal 8 karakter');
  }
  return password;
}

function parseListParams(url: URL): ListParams {
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') ?? '20', 10) || 20, 1), 100);
  const page = Math.max(Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1, 1);
  const order = url.searchParams.get('order') ?? 'created_at.desc';
  const q = url.searchParams.get('q')?.trim();
  const roleParam = url.searchParams.get('role');
  const statusParam = url.searchParams.get('status');

  const role = roleParam === 'admin' || roleParam === 'user' ? roleParam : 'all';
  const status = statusParam === 'active' || statusParam === 'inactive' ? statusParam : 'all';

  return { limit, page, order, q: q || undefined, role, status };
}

async function fetchAllUsers(adminClient: ReturnType<typeof createClient>) {
  let page = 1;
  const users: User[] = [];

  // Fetch all users in batches to support search and filters reliably
  while (true) {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=200&page=${page}`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      console.error('[admin-users] list users error', errorBody);
      throw httpError(500, 'list_failed', 'Gagal mengambil data pengguna');
    }

    const body = await response.json();
    const batch = Array.isArray(body?.users) ? (body.users as User[]) : [];
    users.push(...batch);

    const nextPage = body?.next_page ?? null;
    if (!nextPage || typeof nextPage !== 'number' || nextPage <= page) {
      break;
    }
    page = nextPage;
  }

  const ids = users.map((user) => user.id);
  if (ids.length === 0) {
    return { users, profiles: new Map<string, AdminProfileRow>() };
  }

  const { data: profileRows, error: profileError } = await adminClient
    .from('user_profiles')
    .select('id, role, is_active, full_name, username, avatar_url, locale, timezone, theme')
    .in('id', ids);

  if (profileError) {
    console.error('[admin-users] failed to fetch profiles', profileError);
    throw httpError(500, 'profile_error', 'Gagal memuat profil pengguna');
  }

  const profileMap = new Map<string, AdminProfileRow>();
  for (const row of profileRows ?? []) {
    profileMap.set(String(row.id), sanitizeProfile(row));
  }

  return { users, profiles: profileMap };
}

async function logAdminAction(
  adminClient: ReturnType<typeof createClient>,
  adminId: string,
  action: AdminAuditAction,
  target: string,
  details: Record<string, unknown> = {}
) {
  try {
    const { error } = await adminClient.from('admin_audit_logs').insert({
      admin_id: adminId,
      action,
      target_user_id: target,
      details,
    });
    if (error) {
      console.warn('[admin-users] failed to write audit log', error);
    }
  } catch (err) {
    console.warn('[admin-users] audit insert exception', err);
  }
}

async function handleList(req: Request) {
  const { user: adminUser, adminClient } = await getAdminContext(req);
  const params = parseListParams(new URL(req.url));

  const { users, profiles } = await fetchAllUsers(adminClient);

  const filtered = users
    .filter((entry) => {
      const profile = profiles.get(entry.id) ?? sanitizeProfile({ id: entry.id });
      if (params.role !== 'all' && profile.role !== params.role) {
        return false;
      }
      if (params.status === 'active' && !profile.is_active) {
        return false;
      }
      if (params.status === 'inactive' && profile.is_active) {
        return false;
      }
      if (params.q) {
        const haystacks = [
          entry.email ?? '',
          profile.full_name ?? '',
          profile.username ?? '',
        ]
          .filter(Boolean)
          .map((value) => value.toLowerCase());
        const query = params.q.toLowerCase();
        const matched = haystacks.some((value) => value.includes(query));
        if (!matched) {
          return false;
        }
      }
      return true;
    })
    .map((entry) => serializeUser(entry, profiles.get(entry.id)));

  const [orderField, orderDirection] = (params.order ?? 'created_at.desc').split('.') as [keyof AdminUserResponse | string, string];

  const sorted = filtered.sort((a, b) => {
    const dir = orderDirection === 'asc' ? 1 : -1;
    if (orderField === 'email') {
      return a.email.localeCompare(b.email) * dir;
    }
    if (orderField === 'last_sign_in_at') {
      const aTime = a.last_sign_in_at ? Date.parse(a.last_sign_in_at) : 0;
      const bTime = b.last_sign_in_at ? Date.parse(b.last_sign_in_at) : 0;
      return (aTime - bTime) * dir;
    }
    const aTime = Date.parse(a.created_at);
    const bTime = Date.parse(b.created_at);
    return (aTime - bTime) * dir;
  });

  const offset = (params.page - 1) * params.limit;
  const paginated = sorted.slice(offset, offset + params.limit);
  const hasMore = offset + params.limit < sorted.length;
  const nextCursor = paginated.length ? paginated[paginated.length - 1].id : null;

  await logAdminAction(adminClient, adminUser.id, 'update', adminUser.id, {
    target: 'list_users',
    query: params,
  });

  return jsonResponse(200, {
    ok: true,
    data: {
      items: paginated,
      pagination: {
        total: sorted.length,
        page: params.page,
        limit: params.limit,
        has_more: hasMore,
        next_cursor: nextCursor,
      },
    },
  });
}

async function ensureProfile(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  payload: Partial<AdminProfileRow> | undefined
) {
  const profilePayload = {
    id: userId,
    role: payload?.role ?? 'user',
    is_active: payload?.is_active ?? true,
    full_name: payload?.full_name ?? null,
    username: payload?.username ?? null,
    avatar_url: payload?.avatar_url ?? null,
    locale: payload?.locale ?? null,
    timezone: payload?.timezone ?? null,
    theme: payload?.theme ?? 'system',
  };

  const { error } = await adminClient.from('user_profiles').upsert(profilePayload, { onConflict: 'id' });
  if (error) {
    console.error('[admin-users] failed to upsert profile', error);
    throw httpError(500, 'profile_error', 'Gagal menyimpan profil pengguna');
  }
}

async function handleCreate(req: Request) {
  const { user: adminUser, adminClient } = await getAdminContext(req);
  const body = await req.json().catch(() => null);

  const email = validateEmail(body?.email);
  const sendEmailInvite = Boolean(body?.sendEmailInvite);
  const profilePayload = body?.profile as Partial<AdminProfileRow> | undefined;

  let password: string | undefined;
  if (!sendEmailInvite) {
    password = validatePassword(body?.password);
  }

  const adminAuth = adminClient.auth.admin;

  const { data: created, error: createError } = sendEmailInvite
    ? await adminAuth.inviteUserByEmail(email, {
        data: {
          full_name: profilePayload?.full_name ?? null,
          username: profilePayload?.username ?? null,
        },
      })
    : await adminAuth.createUser({
        email,
        password: password!,
        email_confirm: true,
        user_metadata: {
          full_name: profilePayload?.full_name ?? null,
          username: profilePayload?.username ?? null,
        },
      });

  if (createError || !created?.user) {
    const code = createError?.status === 422 ? 'email_exists' : 'create_failed';
    throw httpError(409, code, createError?.message ?? 'Gagal membuat pengguna', createError ?? undefined);
  }

  await ensureProfile(adminClient, created.user.id, profilePayload);

  const { data: finalUser, error: fetchError } = await adminAuth.getUserById(created.user.id);
  if (fetchError || !finalUser?.user) {
    throw httpError(500, 'fetch_failed', 'Gagal memuat ulang pengguna', fetchError ?? undefined);
  }

  const { data: profileRow } = await adminClient
    .from('user_profiles')
    .select('id, role, is_active, full_name, username, avatar_url, locale, timezone, theme')
    .eq('id', created.user.id)
    .maybeSingle();

  await logAdminAction(adminClient, adminUser.id, 'create', created.user.id, {
    email,
    role: profilePayload?.role ?? 'user',
  });

  return jsonResponse(201, { ok: true, data: serializeUser(finalUser.user, profileRow ?? undefined) });
}

async function handleUpdate(req: Request, userId: string) {
  const { user: adminUser, adminClient } = await getAdminContext(req);
  const body = await req.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    throw httpError(400, 'invalid_payload', 'Payload tidak valid');
  }

  const updatePayload: { email?: string; password?: string } = {};
  if (body.email != null) {
    updatePayload.email = validateEmail(body.email);
  }
  if (body.password) {
    updatePayload.password = validatePassword(body.password);
  }

  const profilePayload = body.profile as Partial<AdminProfileRow> | undefined;

  if (Object.keys(updatePayload).length > 0) {
    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, updatePayload);
    if (updateError) {
      throw httpError(updateError.status ?? 500, 'update_failed', updateError.message ?? 'Gagal memperbarui pengguna', updateError);
    }
    if (updatePayload.password) {
      await logAdminAction(adminClient, adminUser.id, 'reset_password', userId, {});
    }
  }

  if (profilePayload) {
    await ensureProfile(adminClient, userId, profilePayload);
    if (profilePayload.is_active !== undefined) {
      await logAdminAction(adminClient, adminUser.id, 'toggle_active', userId, {
        is_active: profilePayload.is_active,
      });
    } else {
      await logAdminAction(adminClient, adminUser.id, 'update', userId, profilePayload);
    }
  }

  const { data: finalUser, error: fetchError } = await adminClient.auth.admin.getUserById(userId);
  if (fetchError || !finalUser?.user) {
    throw httpError(404, 'not_found', 'Pengguna tidak ditemukan', fetchError ?? undefined);
  }

  const { data: profileRow } = await adminClient
    .from('user_profiles')
    .select('id, role, is_active, full_name, username, avatar_url, locale, timezone, theme')
    .eq('id', userId)
    .maybeSingle();

  return jsonResponse(200, { ok: true, data: serializeUser(finalUser.user, profileRow ?? undefined) });
}

async function handleDelete(req: Request, userId: string) {
  const { user: adminUser, adminClient } = await getAdminContext(req);
  const url = new URL(req.url);
  const modeParam = url.searchParams.get('mode');
  const mode: 'soft' | 'hard' = modeParam === 'soft' ? 'soft' : 'hard';

  if (mode === 'soft') {
    await ensureProfile(adminClient, userId, { is_active: false });
    await logAdminAction(adminClient, adminUser.id, 'toggle_active', userId, { is_active: false, mode: 'soft' });
    return jsonResponse(200, { ok: true, data: null });
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteError) {
    throw httpError(deleteError.status ?? 500, 'delete_failed', deleteError.message ?? 'Gagal menghapus pengguna', deleteError);
  }

  const { error: profileDeleteError } = await adminClient.from('user_profiles').delete().eq('id', userId);
  if (profileDeleteError) {
    console.warn('[admin-users] failed to delete profile row', profileDeleteError);
  }

  await logAdminAction(adminClient, adminUser.id, 'delete', userId, { mode: 'hard' });
  return jsonResponse(200, { ok: true, data: null });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const idMatch = url.pathname.match(/admin-users\/?([^/]*)$/);
    const id = idMatch && idMatch[1] ? decodeURIComponent(idMatch[1]) : null;

    if (req.method === 'GET') {
      return await handleList(req);
    }

    if (req.method === 'POST') {
      return await handleCreate(req);
    }

    if (req.method === 'PATCH' && id) {
      return await handleUpdate(req, id);
    }

    if (req.method === 'DELETE' && id) {
      return await handleDelete(req, id);
    }

    throw httpError(405, 'method_not_allowed', 'Metode tidak diizinkan');
  } catch (error) {
    if ('status' in (error as HttpError)) {
      const httpErr = error as HttpError;
      return jsonResponse(httpErr.status, httpErr.body);
    }

    console.error('[admin-users] unexpected error', error);
    return jsonResponse(500, {
      ok: false,
      error: { code: 'internal_error', message: 'Terjadi kesalahan internal' },
    });
  }
});
