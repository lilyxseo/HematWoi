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

function hasValidConfiguration() {
  if (!supabaseUrl || !supabaseKey || /[<>]|\.\.\./.test(supabaseUrl + supabaseKey)) return false
  try {
    const url = new URL(supabaseUrl)
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname)
  } catch {
    return false
  }
}

export const isSupabaseConfigured = hasValidConfiguration()

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase configuration is missing or invalid. Local Mode is available. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) for online mode to work.'
  )
}

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'http://127.0.0.1:54321',
  isSupabaseConfigured ? supabaseKey : 'local-development-only',
  {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
})
export const SUPABASE_URL = isSupabaseConfigured ? supabaseUrl : undefined
export const SUPABASE_ANON_KEY = isSupabaseConfigured ? supabaseKey : undefined
