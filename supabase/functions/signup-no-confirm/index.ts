import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function jsonResponse(body: Record<string, unknown>, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, ...(init.headers ?? {}) },
    ...init,
  });
}

type SignupPayload = {
  email?: string;
  password?: string;
  full_name?: string;
};

function validatePayload(payload: SignupPayload) {
  if (!payload) {
    throw new Error('Payload tidak ditemukan.');
  }
  const email = payload.email?.trim();
  const password = payload.password ?? '';
  const fullName = payload.full_name?.trim();

  if (!email) {
    throw new Error('Email wajib diisi.');
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    throw new Error('Gunakan format email yang valid.');
  }
  if (password.length < 6) {
    throw new Error('Kata sandi minimal 6 karakter.');
  }
  if (!fullName) {
    throw new Error('Nama lengkap wajib diisi.');
  }

  return { email, password, fullName };
}

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('[signup-no-confirm] Missing environment variables');
}

const adminClient =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metode tidak diizinkan.' }, { status: 405 });
  }

  if (!adminClient) {
    return jsonResponse({ error: 'Konfigurasi server tidak lengkap.' }, { status: 500 });
  }

  try {
    const payload = (await req.json()) as SignupPayload;
    const { email, password, fullName } = validatePayload(payload);

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error('User tidak dapat dibuat.');
    }

    return jsonResponse({ user: data.user }, { status: 200 });
  } catch (error) {
    console.error('[signup-no-confirm] error', error);
    let message = 'Gagal membuat akun.';

    if (error && typeof error === 'object') {
      const err = error as { message?: unknown };
      if (typeof err.message === 'string' && err.message.trim()) {
        message = err.message;
      }
    } else if (typeof error === 'string' && error.trim()) {
      message = error;
    }

    return jsonResponse({ error: message }, { status: 400 });
  }
});
