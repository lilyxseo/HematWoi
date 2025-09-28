import { SUPABASE_URL, supabase } from '../supabase.js';

export type AdminUserProfile = {
  role: 'admin' | 'user';
  is_active: boolean;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  locale?: string | null;
  timezone?: string | null;
  theme?: 'system' | 'light' | 'dark' | null;
};

export type AdminUserItem = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  identities: { provider: string }[];
  profile: AdminUserProfile;
};

export type ListUsersParams = {
  q?: string;
  role?: 'admin' | 'user' | 'all';
  status?: 'active' | 'inactive' | 'all';
  order?: string;
  page?: number;
  limit?: number;
};

export type PaginatedUsers = {
  items: AdminUserItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    has_more: boolean;
    next_cursor: string | null;
  };
};

export type CreateUserPayload = {
  email: string;
  password: string;
  profile?: Partial<AdminUserProfile>;
  sendEmailInvite?: boolean;
};

export type UpdateUserPayload = {
  email?: string;
  password?: string;
  profile?: Partial<AdminUserProfile>;
};

export async function listAdminUsers(params: ListUsersParams = {}): Promise<PaginatedUsers> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error('Session tidak ditemukan. Harap login ulang.');
  }

  const url = new URL(`${SUPABASE_URL}/functions/v1/admin-users`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error?.message ?? 'Gagal memuat daftar pengguna';
    throw new Error(message);
  }

  const fallback: PaginatedUsers = {
    items: [],
    pagination: {
      total: 0,
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      has_more: false,
      next_cursor: null,
    },
  };

  if (!body?.data) {
    return fallback;
  }

  return body.data as PaginatedUsers;
}

async function mutateUser<TPayload>(
  method: 'POST' | 'PATCH' | 'DELETE',
  payload?: TPayload,
  id?: string,
  options?: { query?: Record<string, string | number | boolean | undefined | null> }
) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error('Session tidak ditemukan. Harap login ulang.');
  }

  const path = id ? `${SUPABASE_URL}/functions/v1/admin-users/${id}` : `${SUPABASE_URL}/functions/v1/admin-users`;
  const url = new URL(path);
  if (options?.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error?.message ?? 'Operasi admin gagal';
    throw new Error(message);
  }

  return body?.data as AdminUserItem;
}

export async function createAdminUser(payload: CreateUserPayload) {
  return mutateUser('POST', payload);
}

export async function updateAdminUser(id: string, payload: UpdateUserPayload) {
  return mutateUser('PATCH', payload, id);
}

export async function deleteAdminUser(id: string, mode: 'soft' | 'hard' = 'hard') {
  await mutateUser('DELETE', undefined, id, { query: { mode } });
}
