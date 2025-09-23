import type {
  AuthError,
  AuthResponse,
  AuthTokenResponsePasswordless,
  OAuthResponse,
  Session,
} from '@supabase/supabase-js';
import { supabase } from './supabase';

const AUTH_REDIRECT_URL =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : undefined;

const resolveRedirectUrl = () =>
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env.VITE_SUPABASE_REDIRECT_URL as string)) ||
  AUTH_REDIRECT_URL ||
  '';

const NETWORK_ERROR_MESSAGE =
  'Tidak dapat terhubung ke server. Periksa koneksi internet kamu.';

const DEFAULT_ERROR_MESSAGE =
  'Terjadi kesalahan tak terduga. Silakan coba lagi.';

function normaliseMessage(message: string) {
  return message.trim().toLowerCase();
}

function mapAuthError(error: unknown): string {
  if (!error) return DEFAULT_ERROR_MESSAGE;

  if (typeof error === 'string') {
    return translateErrorMessage(error);
  }

  const authError = error as AuthError;
  if (authError?.message) {
    return translateErrorMessage(authError.message, authError.status);
  }

  if (error instanceof Error && error.message) {
    return translateErrorMessage(error.message);
  }

  return DEFAULT_ERROR_MESSAGE;
}

function translateErrorMessage(message: string, status?: number) {
  const text = normaliseMessage(message);

  if (text.includes('invalid login credentials')) {
    return 'Email atau kata sandi salah.';
  }

  if (text.includes('email not confirmed')) {
    return 'Email kamu belum terverifikasi. Silakan cek kotak masuk untuk verifikasi.';
  }

  if (text.includes('user not found')) {
    return 'Akun dengan email tersebut tidak ditemukan.';
  }

  if (text.includes('refresh token not found')) {
    return 'Sesi kamu telah berakhir. Silakan login kembali.';
  }

  if (text.includes('network') || text.includes('fetch failed')) {
    return NETWORK_ERROR_MESSAGE;
  }

  if (status === 429) {
    return 'Terlalu banyak percobaan. Coba lagi beberapa saat nanti.';
  }

  if (status === 422) {
    return 'Permintaan tidak valid. Periksa kembali data yang kamu masukkan.';
  }

  return message || DEFAULT_ERROR_MESSAGE;
}

export async function loginWithPassword(params: {
  email: string;
  password: string;
}): Promise<{ data?: AuthResponse['data']; error?: string }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: params.email,
      password: params.password,
    });

    if (error) {
      throw error;
    }

    return { data };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[HW][auth] loginWithPassword', err);
    }
    return { error: mapAuthError(err) };
  }
}

export async function sendMagicLink(params: {
  email: string;
  redirectTo?: string;
}): Promise<{
  data?: AuthTokenResponsePasswordless['data'];
  error?: string;
}> {
  try {
    const redirectTo = params.redirectTo ?? resolveRedirectUrl();
    const { data, error } = await supabase.auth.signInWithOtp({
      email: params.email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      throw error;
    }

    return { data };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[HW][auth] sendMagicLink', err);
    }
    return { error: mapAuthError(err) };
  }
}

export async function verifyMagicOtp(params: {
  email: string;
  token: string;
  type?: 'magiclink' | 'email';
}): Promise<{ data?: AuthResponse['data']; error?: string }> {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: params.email,
      token: params.token,
      type: params.type ?? 'magiclink',
    });

    if (error) {
      throw error;
    }

    return { data };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[HW][auth] verifyMagicOtp', err);
    }
    return { error: mapAuthError(err) };
  }
}

export async function resetPassword(params: {
  email: string;
  redirectTo?: string;
}): Promise<{ error?: string }> {
  try {
    const redirectTo = params.redirectTo ?? resolveRedirectUrl();
    const { error } = await supabase.auth.resetPasswordForEmail(params.email, {
      redirectTo,
    });

    if (error) {
      throw error;
    }

    return {};
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[HW][auth] resetPassword', err);
    }
    return { error: mapAuthError(err) };
  }
}

export async function signInWithProvider(provider: 'google' | 'github', options?: {
  redirectTo?: string;
}): Promise<{ data?: OAuthResponse['data']; error?: string }> {
  try {
    const redirectTo = options?.redirectTo ?? resolveRedirectUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    });

    if (error) {
      throw error;
    }

    return { data };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[HW][auth] signInWithProvider', err);
    }
    return { error: mapAuthError(err) };
  }
}

export async function getSession(): Promise<{
  session: Session | null;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }

    return { session: data.session ?? null };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[HW][auth] getSession', err);
    }
    return { session: null, error: mapAuthError(err) };
  }
}

export { mapAuthError };
