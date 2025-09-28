import { createClient } from '@supabase/supabase-js'

const browserEnv = typeof import.meta !== 'undefined' ? import.meta.env ?? {} : {}
const nodeEnv =
  typeof globalThis !== 'undefined' && globalThis.process?.env
    ? globalThis.process.env
    : {}

const supabaseUrl = browserEnv.VITE_SUPABASE_URL ?? nodeEnv.VITE_SUPABASE_URL
const supabaseKey =
  browserEnv.VITE_SUPABASE_PUBLISHABLE_KEY ??
  browserEnv.VITE_SUPABASE_ANON_KEY ??
  nodeEnv.VITE_SUPABASE_PUBLISHABLE_KEY ??
  nodeEnv.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'Supabase environment variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) for online mode to work.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
})
export const SUPABASE_URL = supabaseUrl
export const SUPABASE_ANON_KEY = supabaseKey
