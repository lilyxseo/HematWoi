import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const originalProcessEnv = globalThis.process?.env

describe('supabase client env handling', () => {
  const originalWarn = console.warn

  beforeEach(() => {
    vi.resetModules()
    vi.doUnmock('@supabase/supabase-js')
    console.warn = vi.fn()
    if (originalProcessEnv) {
      originalProcessEnv.VITE_SUPABASE_URL = undefined
      originalProcessEnv.VITE_SUPABASE_ANON_KEY = undefined
    }
  })

  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('@supabase/supabase-js')
    console.warn = originalWarn
    vi.restoreAllMocks()
  })

  it('initializes client with pkce flow and persistence', async () => {
    if (!originalProcessEnv) {
      throw new Error('process.env tidak tersedia dalam lingkungan pengujian')
    }
    originalProcessEnv.VITE_SUPABASE_URL = 'http://localhost'
    originalProcessEnv.VITE_SUPABASE_ANON_KEY = 'anon-key'

    const createClient = vi.fn(() => ({}))
    vi.doMock('@supabase/supabase-js', () => ({ createClient }))

    await import('./supabaseClient')

    expect(createClient).toHaveBeenCalledWith('http://localhost', 'anon-key', {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'hematwoi-auth',
      },
    })
    expect(console.warn).not.toHaveBeenCalled()
  })
})
