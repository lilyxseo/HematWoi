import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './supabase';

type EnvRecord = Record<string, string | undefined>;

function readEnv(): EnvRecord {
  const metaEnv = typeof import.meta !== 'undefined' ? ((import.meta as any).env ?? {}) : {};
  const nodeEnv = typeof process !== 'undefined' ? process.env ?? {} : {};
  return { ...nodeEnv, ...metaEnv } as EnvRecord;
}

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const env = readEnv();
  const serviceKey =
    env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    env.VITE_SUPABASE_SERVICE_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !serviceKey) {
    throw new Error(
      'Konfigurasi Supabase admin belum tersedia. Set VITE_SUPABASE_SERVICE_ROLE_KEY atau SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  adminClient = createClient(SUPABASE_URL, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return adminClient;
}
