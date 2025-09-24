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

const missingConfigMessage =
  'Supabase environment variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) for online mode to work.'

function createQueryStub() {
  const error = new Error('Supabase belum dikonfigurasi')
  const resolve = () => ({ data: null, error })
  const builder = {
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolve()).then(onFulfilled, onRejected)
    },
    catch(onRejected) {
      return Promise.resolve(resolve()).catch(onRejected)
    },
    finally(onFinally) {
      return Promise.resolve(resolve()).finally(onFinally)
    },
  }
  const chainable = [
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'neq',
    'gte',
    'gt',
    'lte',
    'lt',
    'like',
    'ilike',
    'contains',
    'overlaps',
    'order',
    'limit',
    'range',
    'single',
    'maybeSingle',
    'returns',
    'is',
    'or',
    'in',
    'filter',
    'match',
    'textSearch',
  ]
  chainable.forEach((method) => {
    builder[method] = () => builder
  })
  return builder
}

function createSupabaseStub() {
  console.warn(missingConfigMessage)
  const error = new Error('Supabase belum dikonfigurasi')
  const resolve = (data = null) => ({ data, error })

  const auth = {
    async getSession() {
      return { data: { session: null }, error }
    },
    async getUser() {
      return { data: { user: null }, error }
    },
    onAuthStateChange() {
      return { data: { subscription: { unsubscribe() {} } } }
    },
    async signOut() {
      return { error }
    },
    async signInWithPassword() {
      return resolve()
    },
    async signInWithOtp() {
      return resolve()
    },
    async signUp() {
      return resolve()
    },
    async resetPasswordForEmail() {
      return resolve()
    },
    async verifyOtp() {
      return resolve()
    },
    async signInWithOAuth() {
      return resolve()
    },
    async updateUser() {
      return resolve()
    },
    async unlinkIdentity() {
      return resolve()
    },
  }

  const storage = {
    from() {
      return {
        async upload() {
          return resolve()
        },
        async remove() {
          return resolve()
        },
        async download() {
          return resolve()
        },
        async list() {
          return resolve([])
        },
        getPublicUrl() {
          return { data: { publicUrl: '' }, error }
        },
      }
    },
  }

  return {
    from() {
      return createQueryStub()
    },
    rpc() {
      return createQueryStub()
    },
    auth,
    storage,
    functions: {
      async invoke() {
        return resolve()
      },
    },
    channel() {
      return {
        on() {
          return this
        },
        subscribe() {
          return { unsubscribe() {} }
        },
      }
    },
    removeChannel() {},
    getChannels() {
      return []
    },
  }
}

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : createSupabaseStub()
