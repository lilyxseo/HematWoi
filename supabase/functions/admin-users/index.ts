import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  createClient,
  type SupabaseClient,
} from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type UserRole = 'user' | 'admin';

type ListPayload = {
  query?: string;
  role?: UserRole | 'all';
  status?: 'active' | 'inactive' | 'all';
};

type UpdatePayload = {
  id?: string;
  updates?: {
    role?: UserRole;
    is_active?: boolean;
  };
};

type CreatePayload = {
  email?: string;
  password?: string;
  username?: string | null;
  role?: UserRole;
  is_active?: boolean;
};

type DeletePayload = {
  id?: string;
};

type UserRecord = {
  id: string;
  email: string | null;
  username: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

function respond(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    return normalized === 'true' || normalized === '1';
  }
  return fallback;
}

function normalizeRole(value: unknown, fallback: UserRole): UserRole {
  if (value === 'admin') return 'admin';
  if (value === 'user') return 'user';
  return fallback;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
}

function formatUserRecord(row: any, email: string | null): UserRecord {
  return {
    id: String(row?.id ?? ''),
    email,
    username: typeof row?.username === 'string' ? row.username : null,
    role: row?.role === 'admin' ? 'admin' : 'user',
    is_active: normalizeBoolean(row?.is_active, true),
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

async function fetchAllEmails(client: SupabaseClient): Promise<Map<string, string | null>> {
  const emailMap = new Map<string, string | null>();
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw error;
    }

    for (const user of data.users) {
      emailMap.set(user.id, user.email ?? null);
    }

    if (!data.nextPage) {
      break;
    }

    page = data.nextPage;
  }

  return emailMap;
}

async function handleList(
  client: SupabaseClient,
  payload: ListPayload
): Promise<Response> {
  try {
    let query = client
      .from('user_profiles')
      .select('id, username, role, is_active, created_at, updated_at')
      .order('created_at', { ascending: true });

    if (payload.role && payload.role !== 'all') {
      query = query.eq('role', payload.role);
    }

    if (payload.status && payload.status !== 'all') {
      query = query.eq('is_active', payload.status === 'active');
    }

    const { data, error } = await query;

    if (error) {
      console.error('[admin-users] list profiles error', error);
      return respond(500, { error: 'Gagal memuat pengguna' });
    }

    const emailMap = await fetchAllEmails(client);
    const search = typeof payload.query === 'string' ? payload.query.trim().toLowerCase() : '';

    let users = (data ?? []).map((row) => formatUserRecord(row, emailMap.get(String(row.id ?? '')) ?? null));

    if (search) {
      users = users.filter((user) => {
        const username = user.username?.toLowerCase() ?? '';
        const email = user.email?.toLowerCase() ?? '';
        return username.includes(search) || email.includes(search);
      });
    }

    return respond(200, { data: users });
  } catch (error) {
    console.error('[admin-users] list handler error', error);
    return respond(500, { error: 'Gagal memuat pengguna' });
  }
}

async function handleCreate(client: SupabaseClient, payload: CreatePayload): Promise<Response> {
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  const username = normalizeOptionalString(payload.username);
  const role = normalizeRole(payload.role, 'user');
  const isActive = normalizeBoolean(payload.is_active, true);

  if (!email) {
    return respond(400, { error: 'Email wajib diisi' });
  }

  if (!password || password.length < 6) {
    return respond(400, { error: 'Password minimal 6 karakter' });
  }

  try {
    const createResult = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createResult.error) {
      const message = createResult.error.message || 'Gagal membuat pengguna baru';
      return respond(400, { error: message });
    }

    const newUser = createResult.data.user;
    if (!newUser) {
      return respond(500, { error: 'Gagal membuat pengguna baru' });
    }

    const profilePayload: Record<string, unknown> = {
      id: newUser.id,
      role,
      is_active: isActive,
      username,
    };

    const { data, error } = await client
      .from('user_profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select('id, username, role, is_active, created_at, updated_at')
      .single();

    if (error) {
      console.error('[admin-users] create profile error', error);
      await client.auth.admin.deleteUser(newUser.id);
      return respond(500, { error: 'Gagal menyimpan profil pengguna' });
    }

    const record = formatUserRecord(data, newUser.email ?? null);
    return respond(200, { data: record });
  } catch (error) {
    console.error('[admin-users] create handler error', error);
    return respond(500, { error: 'Gagal membuat pengguna baru' });
  }
}

async function handleUpdate(
  client: SupabaseClient,
  payload: UpdatePayload
): Promise<Response> {
  const id = typeof payload.id === 'string' ? payload.id : '';
  if (!id) {
    return respond(400, { error: 'ID pengguna wajib diisi' });
  }

  try {
    const { data: current, error: currentError } = await client
      .from('user_profiles')
      .select('id, username, role, is_active, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (currentError) {
      console.error('[admin-users] update current error', currentError);
      return respond(500, { error: 'Gagal memuat pengguna' });
    }

    if (!current) {
      return respond(404, { error: 'Pengguna tidak ditemukan' });
    }

    const currentRole = current.role === 'admin' ? 'admin' : 'user';
    const currentActive = normalizeBoolean(current.is_active, true);
    const nextRole = normalizeRole(payload.updates?.role, currentRole);
    const nextActive = normalizeBoolean(payload.updates?.is_active, currentActive);

    if (currentRole === 'admin' && currentActive && (!nextActive || nextRole !== 'admin')) {
      const { data: otherAdmins, error: adminError } = await client
        .from('user_profiles')
        .select('id, is_active')
        .eq('role', 'admin')
        .neq('id', id);

      if (adminError) {
        console.error('[admin-users] update admin check error', adminError);
        return respond(500, { error: 'Gagal memeriksa admin lain' });
      }

      const hasOtherActiveAdmin = (otherAdmins ?? []).some((row) => normalizeBoolean(row.is_active, true));
      if (!hasOtherActiveAdmin) {
        return respond(400, { error: 'Tidak dapat menonaktifkan admin terakhir' });
      }
    }

    const updatePayload: Record<string, unknown> = {};
    if (payload.updates?.role === 'admin' || payload.updates?.role === 'user') {
      updatePayload.role = payload.updates.role;
    }
    if (typeof payload.updates?.is_active === 'boolean') {
      updatePayload.is_active = payload.updates.is_active;
    }

    let updatedRow = current;

    if (Object.keys(updatePayload).length > 0) {
      const { data: updated, error: updateError } = await client
        .from('user_profiles')
        .update(updatePayload)
        .eq('id', id)
        .select('id, username, role, is_active, created_at, updated_at')
        .single();

      if (updateError) {
        console.error('[admin-users] update profile error', updateError);
        return respond(500, { error: 'Gagal memperbarui pengguna' });
      }

      updatedRow = updated;
    }

    const { data: userData, error: userError } = await client.auth.admin.getUserById(id);
    if (userError) {
      console.error('[admin-users] update fetch user error', userError);
      return respond(500, { error: 'Gagal mengambil data pengguna' });
    }

    const email = userData.user?.email ?? null;
    return respond(200, { data: formatUserRecord(updatedRow, email) });
  } catch (error) {
    console.error('[admin-users] update handler error', error);
    return respond(500, { error: 'Gagal memperbarui pengguna' });
  }
}

async function handleDelete(
  client: SupabaseClient,
  payload: DeletePayload,
  currentAdminId: string
): Promise<Response> {
  const id = typeof payload.id === 'string' ? payload.id : '';
  if (!id) {
    return respond(400, { error: 'ID pengguna wajib diisi' });
  }

  if (id === currentAdminId) {
    return respond(400, { error: 'Tidak dapat menghapus akun sendiri' });
  }

  try {
    const { data: current, error: currentError } = await client
      .from('user_profiles')
      .select('id, role, is_active')
      .eq('id', id)
      .maybeSingle();

    if (currentError) {
      console.error('[admin-users] delete current error', currentError);
      return respond(500, { error: 'Gagal memuat pengguna' });
    }

    if (!current) {
      return respond(404, { error: 'Pengguna tidak ditemukan' });
    }

    const currentRole = current.role === 'admin' ? 'admin' : 'user';
    const currentActive = normalizeBoolean(current.is_active, true);

    if (currentRole === 'admin' && currentActive) {
      const { data: otherAdmins, error: adminError } = await client
        .from('user_profiles')
        .select('id, is_active')
        .eq('role', 'admin')
        .neq('id', id);

      if (adminError) {
        console.error('[admin-users] delete admin check error', adminError);
        return respond(500, { error: 'Gagal memeriksa admin lain' });
      }

      const hasOtherActiveAdmin = (otherAdmins ?? []).some((row) => normalizeBoolean(row.is_active, true));
      if (!hasOtherActiveAdmin) {
        return respond(400, { error: 'Tidak dapat menghapus admin terakhir' });
      }
    }

    const { error: deleteError } = await client.auth.admin.deleteUser(id);
    if (deleteError) {
      console.error('[admin-users] delete auth error', deleteError);
      const message = deleteError.message || 'Gagal menghapus pengguna';
      return respond(500, { error: message });
    }

    return respond(200, { data: { success: true } });
  } catch (error) {
    console.error('[admin-users] delete handler error', error);
    return respond(500, { error: 'Gagal menghapus pengguna' });
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return respond(400, { error: 'Body permintaan harus berupa JSON' });
  }

  const action = typeof body?.action === 'string' ? body.action : '';
  if (!action) {
    return respond(400, { error: 'Aksi tidak ditemukan' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('[admin-users] missing Supabase configuration');
    return respond(500, { error: 'Konfigurasi Supabase tidak lengkap' });
  }

  const authorization = req.headers.get('Authorization') ?? '';

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return respond(401, { error: 'Harus login sebagai admin' });
  }

  const { data: profile, error: profileError } = await authClient
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('[admin-users] profile lookup error', profileError);
    return respond(500, { error: 'Gagal memeriksa peran pengguna' });
  }

  const isAdmin = profile?.role === 'admin' && normalizeBoolean(profile?.is_active, true);
  if (!isAdmin) {
    return respond(403, { error: 'Akses ditolak. Hanya admin yang dapat mengelola pengguna.' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  switch (action) {
    case 'list':
      return await handleList(adminClient, body?.payload ?? {});
    case 'create':
      return await handleCreate(adminClient, body?.payload ?? {});
    case 'update':
      return await handleUpdate(adminClient, body?.payload ?? {});
    case 'delete':
      return await handleDelete(adminClient, body?.payload ?? {}, user.id);
    default:
      return respond(400, { error: 'Aksi tidak dikenali' });
  }
});
