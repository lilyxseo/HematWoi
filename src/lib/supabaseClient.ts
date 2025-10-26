import { createClient } from '@supabase/supabase-js';

type EnvSource = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

function resolveEnv(): EnvSource {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env as EnvSource;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env as EnvSource;
  }
  return {};
}

const env = resolveEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for online mode to work.'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
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
