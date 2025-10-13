import { App as CapacitorApp, type AppUrlOpen } from '@capacitor/app';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import type { AuthResponse, SignInWithIdTokenCredentials } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { configureNativeAppearance, isNativePlatform } from './native';

const GOOGLE_WEB_CLIENT_ENV_KEYS = [
  'VITE_GOOGLE_WEB_CLIENT_ID',
  'VITE_GOOGLE_OAUTH_CLIENT_ID',
];

const AUTH_CALLBACK_SCHEME = 'hematwoi:';
const AUTH_CALLBACK_HOST = 'auth';
const AUTH_CALLBACK_PATH = '/callback';

let googleInitPromise: Promise<void> | null = null;

function getEnvValue(key: string): string | undefined {
  const browserEnv =
    typeof import.meta !== 'undefined' && (import.meta as ImportMeta)?.env
      ? ((import.meta as ImportMeta).env as Record<string, string | undefined>)
      : undefined;
  const nodeEnv =
    typeof process !== 'undefined' && process?.env
      ? (process.env as Record<string, string | undefined>)
      : undefined;

  return browserEnv?.[key] ?? nodeEnv?.[key];
}

function resolveGoogleWebClientId(provided?: string): string | undefined {
  if (provided) return provided;
  for (const key of GOOGLE_WEB_CLIENT_ENV_KEYS) {
    const value = getEnvValue(key);
    if (value) return value;
  }
  return undefined;
}

export type GoogleNativeConfig = {
  webClientId?: string;
  scopes?: string[];
  forceCodeForRefreshToken?: boolean;
};

export function configureGoogleNativeAuth(config: GoogleNativeConfig = {}): void {
  if (!isNativePlatform()) return;
  if (googleInitPromise) return;

  const clientId = resolveGoogleWebClientId(config.webClientId);
  if (!clientId) {
    console.warn('[native-auth] Google web client id is missing. Set VITE_GOOGLE_WEB_CLIENT_ID.');
    return;
  }

  googleInitPromise = GoogleAuth.initialize({
    clientId,
    scopes: config.scopes ?? ['profile', 'email'],
    forceCodeForRefreshToken: config.forceCodeForRefreshToken ?? true,
  }).catch((error) => {
    console.error('[native-auth] Failed to initialise GoogleAuth plugin', error);
    googleInitPromise = null;
    throw error;
  });
}

async function ensureGoogleInitialized(): Promise<void> {
  if (!isNativePlatform()) return;
  if (!googleInitPromise) {
    configureGoogleNativeAuth();
  }
  if (googleInitPromise) {
    await googleInitPromise;
  }
}

export type NativeGoogleSignInResult = AuthResponse;

export class NativeGoogleAuthError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'NativeGoogleAuthError';
  }
}

function normaliseGoogleError(error: unknown): NativeGoogleAuthError {
  if (error instanceof NativeGoogleAuthError) {
    return error;
  }

  if (!error) {
    return new NativeGoogleAuthError('UNKNOWN', 'Terjadi kesalahan saat menghubungkan Google.');
  }

  const original = error as { message?: string; error?: string; code?: string; status?: string };
  const code = original.code ?? original.status ?? original.error ?? original.message ?? 'UNKNOWN';

  switch (code) {
    case '12501':
    case 'USER_CANCELLED':
      return new NativeGoogleAuthError('CANCELLED', 'Login Google dibatalkan.');
    case '12500':
    case 'DEVELOPER_ERROR':
      return new NativeGoogleAuthError(
        'DEVELOPER_ERROR',
        'Konfigurasi Google Sign-In belum lengkap. Pastikan SHA-1/SHA-256 dan Client ID sesuai.'
      );
    case 'SIGN_IN_FAILED':
      return new NativeGoogleAuthError('SIGN_IN_FAILED', 'Google tidak dapat menyelesaikan proses login.');
    default:
      return new NativeGoogleAuthError(
        code,
        original.message ?? 'Terjadi kesalahan tidak dikenal saat login dengan Google.'
      );
  }
}

export async function signInWithGoogleNative(): Promise<NativeGoogleSignInResult> {
  if (!isNativePlatform()) {
    throw new NativeGoogleAuthError('UNSUPPORTED', 'Native Google Sign-In hanya tersedia di aplikasi.');
  }

  await ensureGoogleInitialized();

  try {
    const response = await GoogleAuth.signIn();
    const idToken = response?.authentication?.idToken ?? response?.idToken;

    if (!idToken) {
      throw new NativeGoogleAuthError('TOKEN_MISSING', 'Google tidak mengembalikan ID Token.');
    }

    const credentials: SignInWithIdTokenCredentials = {
      provider: 'google',
      token: idToken,
    };

    const result = await supabase.auth.signInWithIdToken(credentials);
    if (result.error) {
      throw result.error;
    }

    return result;
  } catch (error) {
    throw normaliseGoogleError(error);
  }
}

export async function signOutGoogleNative(): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    await ensureGoogleInitialized();
    await GoogleAuth.signOut();
  } catch (error) {
    console.warn('[native-auth] Failed to sign out Google session', error);
  }
}

export type AuthCallbackResult = {
  handled: boolean;
  redirectPath?: string;
  error?: string;
};

function isAuthCallbackUrl(url: URL): boolean {
  if (url.protocol !== AUTH_CALLBACK_SCHEME) return false;
  if (url.host !== AUTH_CALLBACK_HOST) return false;
  return url.pathname === AUTH_CALLBACK_PATH;
}

export async function handleNativeAuthCallback(rawUrl: string): Promise<AuthCallbackResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch (error) {
    console.warn('[native-auth] Invalid callback URL received', rawUrl, error);
    return { handled: false };
  }

  if (!isAuthCallbackUrl(url)) {
    return { handled: false };
  }

  const redirectPath = url.searchParams.get('redirect');

  try {
    const idToken = url.searchParams.get('id_token');
    if (idToken) {
      const result = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (result.error) {
        throw result.error;
      }
      return { handled: true, redirectPath: redirectPath ?? '/' };
    }

    const code = url.searchParams.get('code');
    if (code) {
      const result = await supabase.auth.exchangeCodeForSession(code);
      if (result.error) {
        throw result.error;
      }
      return { handled: true, redirectPath: redirectPath ?? '/' };
    }

    return {
      handled: true,
      error: 'Callback tidak berisi kredensial yang valid.',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memproses callback auth.';
    return { handled: true, error: message };
  }
}

export function registerNativeDeeplinkHandler(
  onResult: (result: AuthCallbackResult & { url: string }) => void
): () => void {
  if (!isNativePlatform()) {
    return () => undefined;
  }

  const listener = CapacitorApp.addListener('appUrlOpen', async (event: AppUrlOpen) => {
    const result = await handleNativeAuthCallback(event.url);
    if (result.handled) {
      onResult({ ...result, url: event.url });
    }
  });

  return () => {
    listener.remove();
  };
}

export async function bootstrapNativeApp(): Promise<void> {
  if (!isNativePlatform()) return;

  configureGoogleNativeAuth();
  await configureNativeAppearance();
}
