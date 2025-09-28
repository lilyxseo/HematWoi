import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

describe('supabase client env handling', () => {
  const originalWarn = console.warn

  beforeEach(() => {
    vi.resetModules()
    vi.doUnmock('@supabase/supabase-js')
    console.warn = vi.fn()
    const env = globalThis.process?.env
    if (env) {
      delete env.VITE_SUPABASE_URL
      delete env.VITE_SUPABASE_PUBLISHABLE_KEY
      delete env.VITE_SUPABASE_ANON_KEY
    }
  })

  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('@supabase/supabase-js')
    console.warn = originalWarn
    vi.restoreAllMocks()
  })

  it('falls back to VITE_SUPABASE_ANON_KEY when publishable key is missing', async () => {
    const env = globalThis.process?.env
    if (!env) throw new Error('process.env tidak tersedia dalam lingkungan pengujian')
    env.VITE_SUPABASE_URL = 'http://localhost'
    env.VITE_SUPABASE_ANON_KEY = 'anon-key'

    const createClient = vi.fn(() => ({}))
    vi.doMock('@supabase/supabase-js', () => ({ createClient }))

    await import('./supabase.js')

    expect(createClient).toHaveBeenCalledWith('http://localhost', 'anon-key', {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
    expect(console.warn).not.toHaveBeenCalled()
  })
})
