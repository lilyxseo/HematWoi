import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase';

type SupabaseRestHeaders = Record<string, string>;

const isDevelopment = Boolean(
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development')
);

function ensureSupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase environment variables are missing');
  }
}

export function buildSupabaseHeaders(asJson = false): SupabaseRestHeaders {
  ensureSupabaseEnv();
  const headers: SupabaseRestHeaders = {
    apikey: SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  if (asJson) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

export function createRestUrl(path: string, params?: URLSearchParams): string {
  ensureSupabaseEnv();
  const base = SUPABASE_URL!.replace(/\/$/, '');
  if (!params || Array.from(params.keys()).length === 0) {
    return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  }
  return `${base}${path.startsWith('/') ? '' : '/'}${path}?${params.toString()}`;
}

export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, init);
  if (response.status === 204) {
    return undefined as T;
  }
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body?.message) {
        message = body.message;
      }
    } catch (error) {
      if (isDevelopment) {
        console.warn('[HW] Failed to parse error response', error);
      }
    }
    const err = new Error(message);
    throw err;
  }
  try {
    return (await response.json()) as T;
  } catch (error) {
    if (isDevelopment) {
      console.warn('[HW] Failed to parse JSON response', error);
    }
    throw error;
  }
}

