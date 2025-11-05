import type {
  AuthChangeEvent,
  OAuthResponse,
  Session,
  SignInWithPasswordCredentials,
  User,
} from '@supabase/supabase-js';
import { supabase } from './supabase';

type Provider = 'google' | 'github';

type VerifyOtpPayload = {
  email: string;
  token: string;
  type?: 'magiclink' | 'email' | 'signup' | 'recovery';
};

type AuthErrorLike = {
  code?: string | null;
  message?: string | null;
  status?: number | null;
};

const env = typeof import.meta !== 'undefined' ? import.meta.env ?? {} : {};
const baseRedirect =
  (typeof env.VITE_SUPABASE_REDIRECT_URL === 'string' && env.VITE_SUPABASE_REDIRECT_URL) ||
  (typeof env.VITE_APP_URL === 'string' && env.VITE_APP_URL) ||
  (typeof env.VITE_PUBLIC_SITE_URL === 'string' && env.VITE_PUBLIC_SITE_URL) ||
  (typeof window !== 'undefined' ? window.location.origin : '');

const resetRedirect =
  (typeof env.VITE_SUPABASE_RESET_REDIRECT === 'string' && env.VITE_SUPABASE_RESET_REDIRECT) ||
  '';

const DEFAULT_ERROR = 'Terjadi kesalahan. Silakan coba lagi.';

function resolveRedirect(path = '/'): string | undefined {
  if (!baseRedirect && !path) return undefined;
  try {
    if (path?.startsWith('http')) return path;
    if (!baseRedirect) return path;
    const url = new URL(path ?? '/', baseRedirect);
    return url.toString();
  } catch {
    return baseRedirect || path;
  }
}

const ERROR_CODE_MAP: Record<string, string> = {
  invalid_credentials: 'Email/username atau kata sandi salah.',
  invalid_grant: 'Email/username atau kata sandi salah.',
  invalid_login_credentials: 'Email/username atau kata sandi salah.',
  email_not_confirmed: 'Email belum terverifikasi. Periksa kotak masuk kamu.',
  user_not_found: 'Akun dengan email tersebut tidak ditemukan.',
  provider_disabled: 'Metode masuk ini sedang tidak tersedia.',
  otp_expired: 'Kode OTP sudah kedaluwarsa. Kirim ulang tautan.',
  otp_incorrect: 'Kode OTP tidak valid. Coba lagi.',
  over_request_rate_limit: 'Terlalu banyak percobaan. Coba lagi beberapa saat.',
  rate_limit_exceeded: 'Terlalu banyak percobaan. Coba lagi beberapa saat.',
  session_not_found: 'Sesi tidak ditemukan. Silakan kirim ulang tautan.',
};

function translateMessage(code?: string | null, raw?: string | null): string | null {
  if (code) {
    const normalized = code.toLowerCase();
    if (ERROR_CODE_MAP[normalized]) {
      return ERROR_CODE_MAP[normalized];
    }
  }
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  if (normalized.includes('invalid login')) return 'Email/username atau kata sandi salah.';
  if (normalized.includes('password') && normalized.includes('6'))
    return 'Kata sandi minimal 6 karakter.';
  if (normalized.includes('network') || normalized.includes('fetch') || normalized.includes('connection'))
    return 'Periksa koneksi internet.';
  if (normalized.includes('otp') && normalized.includes('expired'))
    return 'Kode OTP sudah kedaluwarsa. Kirim ulang tautan.';
  if (normalized.includes('otp') && normalized.includes('invalid'))
    return 'Kode OTP tidak valid. Coba lagi.';
  if (normalized.includes('email not found') || normalized.includes('user not found'))
    return 'Akun dengan email tersebut tidak ditemukan.';
  if (normalized.includes('already registered'))
    return 'Email ini sudah terdaftar. Silakan masuk.';
  if (normalized.includes('too many requests'))
    return 'Terlalu banyak percobaan. Coba lagi beberapa saat.';
  return null;
}

type NormalizedError = Error & { code?: string };

function normalizeAuthError(error: unknown, fallback = DEFAULT_ERROR): NormalizedError {
  if (import.meta.env.DEV) {
    console.error('[HW][auth]', error);
  }
  let code: string | undefined;
  let message = fallback;

  if (typeof error === 'string') {
    message = translateMessage(undefined, error) ?? error ?? fallback;
  } else if (error && typeof error === 'object') {
    const err = error as AuthErrorLike;
    code = err.code ?? undefined;
    const translated = translateMessage(err.code ?? undefined, err.message ?? undefined);
    message = translated ?? err.message ?? fallback;
  }

  const normalizedError = new Error(message ?? fallback) as NormalizedError;
  if (code) {
    normalizedError.code = code;
  }
  return normalizedError;
}

function isNetworkError(error: unknown): boolean {
  const message =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
        ? String((error as { message?: string }).message)
        : '';
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes('network') ||
    normalized.includes('fetch') ||
    normalized.includes('connection') ||
    normalized.includes('timeout')
  );
}

type FunctionsErrorLike = {
  message?: unknown;
  context?: {
    body?: unknown;
  };
};

function extractFunctionErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === 'string') {
    return error.trim() || null;
  }
  if (typeof error !== 'object') return null;
  const err = error as FunctionsErrorLike;
  if (err.context?.body) {
    const body = err.context.body;
    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body) as { error?: unknown; message?: unknown };
        if (typeof parsed.error === 'string' && parsed.error.trim()) {
          return parsed.error;
        }
        if (typeof parsed.message === 'string' && parsed.message.trim()) {
          return parsed.message;
        }
      } catch {
        if (body.trim()) {
          return body.trim();
        }
      }
    } else if (typeof body === 'object' && body) {
      const maybeError = body as { error?: unknown; message?: unknown };
      if (typeof maybeError.error === 'string' && maybeError.error.trim()) {
        return maybeError.error;
      }
      if (typeof maybeError.message === 'string' && maybeError.message.trim()) {
        return maybeError.message;
      }
    }
  }
  if (typeof err.message === 'string' && err.message.trim()) {
    return err.message.trim();
  }
  return null;
}

export async function resolveEmailByUsername(username: string): Promise<string | null> {
  const trimmed = username.trim();
  if (!trimmed) return null;

  try {
    const { data, error } = await supabase.rpc('resolve_email_by_username', {
      username_input: trimmed,
    });
    if (error) throw error;
    if (!data) return null;
    if (typeof data === 'string') {
      return data.trim().toLowerCase() || null;
    }
    return null;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[HW][auth-login]', error);
    }
    if (isNetworkError(error)) {
      throw new Error('Periksa koneksi internet.');
    }
    throw new Error('Username atau email tidak ditemukan.');
  }
}

export async function getSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  } catch (error) {
    throw normalizeAuthError(error, 'Tidak dapat memeriksa sesi. Coba lagi.');
  }
}

export async function signInWithPassword(credentials: SignInWithPasswordCredentials) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    if (error) throw error;
    return data;
  } catch (error) {
    throw normalizeAuthError(error, 'Email/username atau kata sandi salah.');
  }
}

export async function signInWithMagicLink(email: string) {
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: resolveRedirect('/') },
    });
    if (error) throw error;
    return data;
  } catch (error) {
    throw normalizeAuthError(error, 'Gagal mengirim tautan magic link.');
  }
}

export async function resetPassword(email: string) {
  try {
    const redirectTo = resetRedirect || resolveRedirect('/auth/update-password') || undefined;
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw error;
    return data;
  } catch (error) {
    throw normalizeAuthError(error, 'Gagal mengirim tautan reset kata sandi.');
  }
}

type RegisterWithoutConfirmationPayload = {
  email: string;
  password: string;
  fullName: string;
};

type RegisterWithoutConfirmationResult = {
  user: User;
};

export async function registerWithoutConfirmation({
  email,
  password,
  fullName,
}: RegisterWithoutConfirmationPayload): Promise<RegisterWithoutConfirmationResult> {
  try {
    const { data, error } = await supabase.functions.invoke('signup-no-confirm', {
      body: {
        email,
        password,
        full_name: fullName,
      },
    });

    if (error) {
      const message = extractFunctionErrorMessage(error) ?? 'Gagal membuat akun.';
      throw new Error(message);
    }

    const user = (data as { user?: User | null } | null)?.user ?? null;
    if (!user) {
      throw new Error('Gagal membuat akun.');
    }

    return { user };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[HW][auth-register]', error);
    }
    if (isNetworkError(error)) {
      throw new Error('Periksa koneksi internet.');
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Gagal membuat akun.');
  }
}

export async function verifyOtp({ email, token, type }: VerifyOtpPayload) {
  const attempts = type ? [type] : (['magiclink', 'email'] as VerifyOtpPayload['type'][]);
  let lastError: unknown;
  for (let index = 0; index < attempts.length; index += 1) {
    const attemptType = attempts[index] ?? 'magiclink';
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: attemptType,
      });
      if (error) throw error;
      return data;
    } catch (error) {
      lastError = error;
      if (!type && index < attempts.length - 1) {
        const rawMessage =
          typeof error === 'object' && error && 'message' in error && typeof (error as AuthErrorLike).message === 'string'
            ? (error as AuthErrorLike).message?.toLowerCase() ?? ''
            : '';
        const shouldRetry = rawMessage.includes('email otp type') || rawMessage.includes('should be email');
        if (shouldRetry) {
          continue;
        }
      }
      throw normalizeAuthError(error, 'Kode OTP tidak valid atau sudah kedaluwarsa.');
    }
  }
  throw normalizeAuthError(lastError, 'Kode OTP tidak valid atau sudah kedaluwarsa.');
}

export async function signInWithProvider(provider: Provider): Promise<OAuthResponse['data']> {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: resolveRedirect('/'), flowType: 'pkce' },
    });
    if (error) throw error;
    return data;
  } catch (error) {
    throw normalizeAuthError(error, 'Gagal masuk dengan penyedia sosial.');
  }
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}

export function getAvailableSocialProviders() {
  const googleRaw = env?.VITE_SUPABASE_GOOGLE;
  const githubRaw = env?.VITE_SUPABASE_GITHUB;
  const normalize = (value: unknown) => {
    if (typeof value !== 'string') return false;
    const normalized = value.toLowerCase().trim();
    if (!normalized) return false;
    return !['false', '0', 'off', 'disabled', 'no'].includes(normalized);
  };
  return {
    google: normalize(googleRaw),
    github: normalize(githubRaw),
  };
}
