import { supabase, SUPABASE_URL } from '../supabase';

export type AdminUserProfile = {
  role: 'admin' | 'user';
  is_active: boolean;
  full_name?: string;
  username?: string;
  avatar_url?: string;
  locale?: string;
  timezone?: string;
  theme?: 'system' | 'light' | 'dark' | string;
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
  limit?: number;
  cursor?: string | null;
  offset?: number;
  order?: string;
};

export type AdminUsersPagination = {
  page: number;
  perPage: number;
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
};

export type ListUsersResult = {
  items: AdminUserItem[];
  pagination: AdminUsersPagination;
};

type ApiError = {
  code: string;
  message: string;
  details?: string;
};

type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: ApiError;
};

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message ?? 'Gagal mengambil sesi Supabase');
  }
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Sesi Supabase tidak tersedia');
  }
  return token;
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | null | undefined>) {
  if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL belum dikonfigurasi');
  }
  const url = new URL(`/functions/v1/admin-users${path}`, SUPABASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function request<T>(path: string, init?: RequestInit & { query?: Record<string, any> }) {
  const token = await getAccessToken();
  const { query, headers, ...rest } = init ?? {};
  const url = buildUrl(path, query ?? undefined);
  const response = await fetch(url.toString(), {
    method: rest.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(headers as Record<string, string> | undefined),
    },
    body: rest.body,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload: ApiResponse<T> | undefined = isJson ? await response.json() : undefined;

  if (!response.ok || !payload) {
    const message = payload?.error?.message ?? `Request gagal dengan status ${response.status}`;
    throw new Error(message);
  }

  if (!payload.ok) {
    throw new Error(payload.error?.message ?? 'Permintaan gagal');
  }

  if (!('data' in payload)) {
    throw new Error('Respons tidak valid dari server admin-users');
  }

  return payload.data as T;
}

export async function listUsers(params: ListUsersParams = {}): Promise<ListUsersResult> {
  const query: Record<string, string> = {};
  if (params.q) query.q = params.q;
  if (params.role && params.role !== 'all') query.role = params.role;
  if (params.status && params.status !== 'all') query.status = params.status;
  if (params.limit) query.limit = String(params.limit);
  if (params.cursor) query.cursor = String(params.cursor);
  if (typeof params.offset === 'number') query.offset = String(params.offset);
  if (params.order) query.order = params.order;

  return request<ListUsersResult>('/', { query });
}

export type CreateUserPayload = {
  email: string;
  password?: string;
  profile?: Partial<AdminUserProfile>;
  sendEmailInvite?: boolean;
};

export async function createUser(payload: CreateUserPayload): Promise<AdminUserItem> {
  const body = JSON.stringify(payload);
  return request<AdminUserItem>('/', {
    method: 'POST',
    body,
  });
}

export type UpdateUserPayload = {
  email?: string;
  password?: string;
  profile?: Partial<AdminUserProfile>;
};

export async function updateUser(userId: string, payload: UpdateUserPayload): Promise<AdminUserItem> {
  const body = JSON.stringify(payload);
  return request<AdminUserItem>(`/${userId}`, {
    method: 'PATCH',
    body,
  });
}

export async function deleteUser(userId: string, options?: { mode?: 'soft' | 'hard' }) {
  const query: Record<string, string> = {};
  if (options?.mode) {
    query.mode = options.mode;
  }
  await request<unknown>(`/${userId}`, {
    method: 'DELETE',
    query,
  });
}
