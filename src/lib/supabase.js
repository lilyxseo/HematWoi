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

const FALLBACK_MESSAGE =
  'Supabase belum dikonfigurasi. Set VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY agar mode online berfungsi.'
const FALLBACK_ERROR = new Error(FALLBACK_MESSAGE)

function createStubQuery() {
  const result = { data: null, error: FALLBACK_ERROR }
  const basePromise = Promise.resolve(result)
  let proxy
  proxy = new Proxy(basePromise, {
    get(target, prop) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return target[prop].bind(target)
      }
      if (prop === Symbol.toStringTag) {
        return target[Symbol.toStringTag]
      }
      return () => proxy
    },
  })
  return proxy
}

function createStubClient() {
  const createSubscription = () => ({ unsubscribe() {} })
  const createChannel = () => ({
    on() {
      return this
    },
    subscribe() {
      return this
    },
    unsubscribe() {},
  })
  return {
    from() {
      return createStubQuery()
    },
    rpc() {
      return createStubQuery()
    },
    channel() {
      return createChannel()
    },
    removeChannel: async () => ({ error: FALLBACK_ERROR }),
    removeAllChannels: async () => ({ error: FALLBACK_ERROR }),
    auth: {
      getUser: async () => ({ data: { user: null }, error: FALLBACK_ERROR }),
      getSession: async () => ({ data: { session: null }, error: FALLBACK_ERROR }),
      onAuthStateChange: () => ({
        data: { subscription: createSubscription() },
        error: FALLBACK_ERROR,
      }),
      signOut: async () => ({ error: FALLBACK_ERROR }),
      signInWithPassword: async () => ({ data: null, error: FALLBACK_ERROR }),
      signInWithOtp: async () => ({ data: null, error: FALLBACK_ERROR }),
      resetPasswordForEmail: async () => ({ data: null, error: FALLBACK_ERROR }),
      verifyOtp: async () => ({ data: null, error: FALLBACK_ERROR }),
      signInWithOAuth: async () => ({ data: null, error: FALLBACK_ERROR }),
      updateUser: async () => ({ data: null, error: FALLBACK_ERROR }),
      unlinkIdentity: async () => ({ data: null, error: FALLBACK_ERROR }),
      signUp: async () => ({ data: null, error: FALLBACK_ERROR }),
    },
    functions: {
      invoke: async () => ({ data: null, error: FALLBACK_ERROR }),
    },
    storage: {
      from() {
        return {
          upload: async () => ({ data: null, error: FALLBACK_ERROR }),
          remove: async () => ({ data: null, error: FALLBACK_ERROR }),
          download: async () => ({ data: null, error: FALLBACK_ERROR }),
          list: async () => ({ data: null, error: FALLBACK_ERROR }),
          createSignedUrl: async () => ({ data: null, error: FALLBACK_ERROR }),
          getPublicUrl: () => ({ data: { publicUrl: '' }, error: FALLBACK_ERROR }),
        }
      },
    },
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'Supabase environment variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) for online mode to work.'
  )
}

export const supabase =
  !supabaseUrl || !supabaseKey
    ? createStubClient()
    : createClient(supabaseUrl, supabaseKey)
