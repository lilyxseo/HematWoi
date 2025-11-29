import { createClient } from '@supabase/supabase-js';

const browserEnv = typeof import.meta !== 'undefined' ? import.meta.env ?? {} : {};
const nodeEnv =
  typeof process !== 'undefined' && process?.env
    ? (process.env as Record<string, string | undefined>)
    : {};

const supabaseUrl = browserEnv.VITE_SUPABASE_URL ?? nodeEnv.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey =
  browserEnv.VITE_SUPABASE_ANON_KEY ??
  browserEnv.VITE_SUPABASE_PUBLISHABLE_KEY ??
  nodeEnv.VITE_SUPABASE_ANON_KEY ??
  nodeEnv.VITE_SUPABASE_PUBLISHABLE_KEY ??
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Missing environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable online mode.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'hematwoi-auth',
  },
});

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;
