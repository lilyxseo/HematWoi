import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost'
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'public-anon-key'

export const supabase = createClient(supabaseUrl, supabaseKey)
