import { supabase } from '../supabase';

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
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  identities: { provider: string }[];
  profile: AdminUserProfile & {
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    locale?: string | null;
    timezone?: string | null;
    theme?: 'system' | 'light' | 'dark' | null;
  };
};

export type ListUsersParams = {
  q?: string;
  role?: 'admin' | 'user' | 'all';
  status?: 'active' | 'inactive' | 'all';
  limit?: number;
  cursor?: number | null;
  offset?: number;
  order?: 'created_at.asc' | 'created_at.desc' | 'last_sign_in_at.asc' | 'last_sign_in_at.desc';
};

export type ListUsersResponse = {
  items: AdminUserItem[];
  total: number;
  nextCursor: number | null;
  limit: number;
};

export type CreateUserPayload = {
  email: string;
  password?: string;
  profile?: Partial<AdminUserProfile> & {
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    locale?: string | null;
    timezone?: string | null;
    theme?: 'system' | 'light' | 'dark' | null;
  };
  sendEmailInvite?: boolean;
};

export type UpdateUserPayload = {
  email?: string;
  password?: string;
  profile?: Partial<AdminUserProfile> & {
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    locale?: string | null;
    timezone?: string | null;
    theme?: 'system' | 'light' | 'dark' | null;
  };
};

export type DeleteUserOptions = {
  mode?: 'soft' | 'hard';
};

type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error('Sesi tidak ditemukan. Silakan login ulang.');
  }
  return token;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`/functions/v1/admin-users${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as ApiResponse<T>;

  if (!response.ok || !payload.ok) {
    const message = payload?.error?.message || 'Permintaan admin gagal';
    throw new Error(message);
  }

  return payload.data as T;
}

export async function listUsers(params: ListUsersParams = {}): Promise<ListUsersResponse> {
  const searchParams = new URLSearchParams();

  if (params.q) searchParams.set('q', params.q);
  if (params.role && params.role !== 'all') searchParams.set('role', params.role);
  if (params.status && params.status !== 'all') searchParams.set('status', params.status);
  if (typeof params.limit === 'number') searchParams.set('limit', String(params.limit));

  const offset = params.offset ?? params.cursor ?? 0;
  if (offset) searchParams.set('offset', String(offset));

  if (params.order) searchParams.set('order', params.order);

  const queryString = searchParams.toString();
  const data = await request<ListUsersResponse>(queryString ? `?${queryString}` : '');

  return data;
}

export async function createUser(payload: CreateUserPayload): Promise<AdminUserItem> {
  const body = JSON.stringify(payload);
  return request<AdminUserItem>('', {
    method: 'POST',
    body,
  });
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<AdminUserItem> {
  if (!id) throw new Error('ID pengguna wajib diisi');
  const body = JSON.stringify(payload);
  return request<AdminUserItem>(`/${id}`, {
    method: 'PATCH',
    body,
  });
}

export async function deleteUser(
  id: string,
  options: DeleteUserOptions = {}
): Promise<{ id: string; mode: 'soft' | 'hard' }> {
  if (!id) throw new Error('ID pengguna wajib diisi');
  const searchParams = new URLSearchParams();
  if (options.mode) searchParams.set('mode', options.mode);
  const query = searchParams.toString();
  return request<{ id: string; mode: 'soft' | 'hard' }>(`/${id}${query ? `?${query}` : ''}`, {
    method: 'DELETE',
  });
}
