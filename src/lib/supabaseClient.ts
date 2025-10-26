import { createClient } from '@supabase/supabase-js';

const browserEnv = typeof import.meta !== 'undefined' ? import.meta.env ?? {} : {};
type GlobalWithProcess = typeof globalThis & { process?: { env?: Record<string, string | undefined> } };

const nodeEnv =
  typeof globalThis !== 'undefined'
    ? ((globalThis as GlobalWithProcess).process?.env ?? {})
    : {};

const SUPABASE_URL =
  (browserEnv.VITE_SUPABASE_URL || nodeEnv.VITE_SUPABASE_URL) ?? undefined;
const SUPABASE_ANON_KEY =
  (browserEnv.VITE_SUPABASE_ANON_KEY || nodeEnv.VITE_SUPABASE_ANON_KEY) ?? undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    'Supabase environment variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for online mode to work.'
  );
}

export const supabase = createClient(SUPABASE_URL ?? '', SUPABASE_ANON_KEY ?? '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'hematwoi-auth',
  },
});

export { SUPABASE_URL, SUPABASE_ANON_KEY };

