import { createClient } from '@supabase/supabase-js';

const browserEnv = typeof import.meta !== 'undefined' ? import.meta.env ?? {} : {};
const nodeEnv =
  typeof globalThis !== 'undefined' &&
  typeof globalThis.process !== 'undefined' &&
  globalThis.process?.env
    ? globalThis.process.env
    : {};

const supabaseUrl =
  (browserEnv?.VITE_SUPABASE_URL as string | undefined) ??
  (nodeEnv?.VITE_SUPABASE_URL as string | undefined) ??
  '';
const supabaseKey =
  (browserEnv?.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  (nodeEnv?.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  '';

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'Supabase environment variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for online mode to work.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'hematwoi-auth',
  },
});

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseKey;
