import { supabase, SUPABASE_URL } from '../supabase.js';

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
  role?: 'all' | 'admin' | 'user';
  status?: 'all' | 'active' | 'inactive';
  limit?: number;
  offset?: number;
  order?: `${'created_at' | 'last_sign_in_at' | 'email'}.${'asc' | 'desc'}`;
};

export type AdminUsersListResponse = {
  items: AdminUserItem[];
  limit: number;
  offset: number;
  total: number;
  nextCursor: string | null;
  previousCursor: string | null;
};

export type AdminUserProfileInput = Partial<{
  role: 'admin' | 'user';
  is_active: boolean;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  locale: string | null;
  timezone: string | null;
  theme: 'system' | 'light' | 'dark' | null;
}>;

export type CreateAdminUserPayload = {
  email: string;
  password?: string;
  profile?: AdminUserProfileInput;
  sendEmailInvite?: boolean;
};

export type UpdateAdminUserPayload = {
  email?: string;
  password?: string;
  profile?: AdminUserProfileInput;
};

export type DeleteAdminUserOptions = {
  mode?: 'soft' | 'hard';
};

type ApiErrorResponse = {
  ok: false;
  error: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

type ApiSuccessResponse<T> = {
  ok: true;
  data: T;
};

export class AdminUsersApiError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code = 'UNKNOWN', details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

const BASE_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/admin-users` : '/functions/v1/admin-users';

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new AdminUsersApiError(error.message ?? 'Gagal mendapatkan sesi', 'SESSION_ERROR');
  }
  const token = data.session?.access_token;
  if (!token) {
    throw new AdminUsersApiError('Harus login sebagai admin untuk mengakses fitur ini', 'NO_SESSION');
  }
  return token;
}

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; query?: URLSearchParams } = {}
): Promise<T> {
  const token = await getAccessToken();
  const baseOrigin = BASE_URL.startsWith('http')
    ? undefined
    : typeof window !== 'undefined'
      ? window.location.origin
      : SUPABASE_URL ?? 'http://localhost';
  const url = new URL(BASE_URL + path, baseOrigin);
  if (options.query) {
    options.query.forEach((value, key) => {
      if (value != null) {
        url.searchParams.set(key, value);
      }
    });
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let payload: ApiErrorResponse | ApiSuccessResponse<T> | null = null;
  try {
    payload = (await response.json()) as typeof payload;
  } catch (_error) {
    payload = null;
  }

  if (!response.ok || !payload || !('ok' in payload)) {
    throw new AdminUsersApiError('Permintaan ke server gagal', String(response.status));
  }

  if (!payload.ok) {
    const code = payload.error?.code ?? String(response.status);
    const message = payload.error?.message ?? 'Permintaan ke server gagal';
    throw new AdminUsersApiError(message, code, payload.error?.details);
  }

  return payload.data as T;
}

function buildQuery(params: ListUsersParams | undefined): URLSearchParams {
  const query = new URLSearchParams();
  if (!params) return query;
  if (params.q) query.set('q', params.q);
  if (params.role && params.role !== 'all') query.set('role', params.role);
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (typeof params.limit === 'number') query.set('limit', String(params.limit));
  if (typeof params.offset === 'number') query.set('offset', String(params.offset));
  if (params.order) query.set('order', params.order);
  return query;
}

export async function listAdminUsers(params?: ListUsersParams): Promise<AdminUsersListResponse> {
  const query = buildQuery(params);
  return await request<AdminUsersListResponse>('GET', '', { query });
}

export async function createAdminUser(payload: CreateAdminUserPayload): Promise<AdminUserItem> {
  return await request<AdminUserItem>('POST', '', { body: payload });
}

export async function updateAdminUser(id: string, payload: UpdateAdminUserPayload): Promise<AdminUserItem> {
  return await request<AdminUserItem>('PATCH', `/${encodeURIComponent(id)}`, { body: payload });
}

export async function deleteAdminUser(
  id: string,
  options: DeleteAdminUserOptions = {}
): Promise<{ mode: 'soft' | 'hard'; user?: AdminUserItem }> {
  const query = new URLSearchParams();
  if (options.mode) {
    query.set('mode', options.mode);
  }
  return await request<{ mode: 'soft' | 'hard'; user?: AdminUserItem }>(
    'DELETE',
    `/${encodeURIComponent(id)}`,
    { query }
  );
}
