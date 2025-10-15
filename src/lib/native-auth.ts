import { GoogleAuth, type User as GoogleUser } from '@codetrix-studio/capacitor-google-auth';
import type { AuthResponse } from '@supabase/supabase-js';

import { supabase } from './supabase';
import {
  getInitialDeepLink,
  isAndroid,
  isIos,
  isNativePlatform,
  registerNativeDeepLinkHandler,
  setNativeLastUserPreference,
} from './native';

const browserEnv = typeof import.meta !== 'undefined' ? (import.meta as ImportMeta).env ?? {} : {};
const nodeEnv = typeof process !== 'undefined' ? process.env ?? {} : {};

const GOOGLE_WEB_CLIENT_ID =
  (browserEnv.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) ??
  (browserEnv.VITE_GOOGLE_CLIENT_ID as string | undefined) ??
  (nodeEnv.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) ??
  (nodeEnv.VITE_GOOGLE_CLIENT_ID as string | undefined) ??
  '';

const GOOGLE_IOS_CLIENT_ID =
  (browserEnv.VITE_GOOGLE_IOS_CLIENT_ID as string | undefined) ??
  (nodeEnv.VITE_GOOGLE_IOS_CLIENT_ID as string | undefined);

const GOOGLE_ANDROID_CLIENT_ID =
  (browserEnv.VITE_GOOGLE_ANDROID_CLIENT_ID as string | undefined) ??
  (nodeEnv.VITE_GOOGLE_ANDROID_CLIENT_ID as string | undefined);

const AUTH_SCHEME = 'hematwoi:';
const AUTH_HOST = 'auth';
const AUTH_PATH = '/callback';

let initialized = false;
let initializing: Promise<void> | null = null;

type NativeGoogleClientIds = {
  web?: string;
  ios?: string;
  android?: string;
};

export type NativeAuthResult = {
  handled: boolean;
  success?: boolean;
  redirectPath?: string;
  errorMessage?: string;
  response?: AuthResponse;
};

export async function ensureNativeGoogleAuth(): Promise<void> {
  if (!isNativePlatform()) return;
  if (initialized) return;
  if (initializing) {
    await initializing;
    return;
  }

  initializing = (async () => {
    const clientId = selectClientId();
    try {
      const options: Parameters<typeof GoogleAuth.initialize>[0] = {
        scopes: ['profile', 'email', 'openid'],
        grantOfflineAccess: true,
      };
      if (clientId) {
        options.clientId = clientId;
      } else {
        console.warn(
          'Google client ID belum ditemukan di variabel lingkungan. Mengandalkan konfigurasi native Capacitor.'
        );
      }
      GoogleAuth.initialize(options);
      initialized = true;
    } catch (error) {
      console.error('Gagal menginisialisasi GoogleAuth native', error);
      throw error;
    }
  })();

  try {
    await initializing;
  } finally {
    initializing = null;
  }
}

function selectClientId(): string | undefined {
  const globalIds = readGlobalGoogleClientIds();
  if (isIos()) {
    return firstNonEmpty(
      globalIds?.ios,
      globalIds?.web,
      GOOGLE_IOS_CLIENT_ID,
      GOOGLE_WEB_CLIENT_ID
    );
  }
  if (isAndroid()) {
    return firstNonEmpty(
      globalIds?.android,
      globalIds?.web,
      GOOGLE_ANDROID_CLIENT_ID,
      GOOGLE_WEB_CLIENT_ID
    );
  }
  return firstNonEmpty(globalIds?.web, GOOGLE_WEB_CLIENT_ID);
}

function readGlobalGoogleClientIds(): NativeGoogleClientIds | undefined {
  if (typeof globalThis === 'undefined') return undefined;
  const candidates = [
    (globalThis as Record<string, unknown>).__HW_GOOGLE_CLIENT_IDS__,
    (globalThis as Record<string, unknown>).HW_GOOGLE_CLIENT_IDS,
    (globalThis as Record<string, unknown>).hematwoiGoogleClientIds,
  ];
  for (const value of candidates) {
    if (!value || typeof value !== 'object') continue;
    const { web, ios, android } = value as NativeGoogleClientIds;
    if (web || ios || android) {
      return {
        web: normalizeClientId(web),
        ios: normalizeClientId(ios),
        android: normalizeClientId(android),
      };
    }
  }
  return undefined;
}

function normalizeClientId(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

export async function signInWithGoogleNative(): Promise<AuthResponse> {
  if (!isNativePlatform()) {
    throw new Error('Login Google native hanya tersedia di aplikasi mobile.');
  }
  await ensureNativeGoogleAuth();
  let googleUser: GoogleUser | null = null;
  try {
    googleUser = await GoogleAuth.signIn();
  } catch (error) {
    throw new Error(describeGoogleError(error));
  }
  const idToken =
    googleUser?.authentication?.idToken ??
    googleUser?.authentication?.accessToken ??
    googleUser?.serverAuthCode;
  if (!idToken) {
    throw new Error('Google tidak mengembalikan id_token. Pastikan konfigurasi SHA-1 dan OAuth benar.');
  }
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) {
    throw new Error(`Supabase menolak sesi Google: ${error.message}`);
  }
  if (data?.user?.id) {
    await setNativeLastUserPreference(data.user.id);
  }
  return data;
}

export function registerNativeAuthDeeplinkHandler(
  onResult?: (result: NativeAuthResult) => void
): () => void {
  const handler = async (url: string) => {
    const result = await handleNativeAuthCallback(url);
    if (!result.handled) return false;
    onResult?.(result);
    return true;
  };

  void getInitialDeepLink().then((url) => {
    if (url) {
      void handleNativeAuthCallback(url).then((result) => {
        if (result.handled) {
          onResult?.(result);
        }
      });
    }
  });

  return registerNativeDeepLinkHandler(handler);
}

export async function handleNativeAuthCallback(url: string): Promise<NativeAuthResult> {
  if (!url) return { handled: false };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (error) {
    return { handled: false };
  }
  if (parsed.protocol !== AUTH_SCHEME) return { handled: false };
  if (parsed.hostname !== AUTH_HOST) return { handled: false };
  if (parsed.pathname !== AUTH_PATH) return { handled: false };

  const params = parsed.searchParams;
  const incomingError = params.get('error');
  if (incomingError) {
    return {
      handled: true,
      success: false,
      errorMessage: decodeURIComponent(incomingError),
      redirectPath: params.get('redirect') ?? '/',
    };
  }

  const idToken = params.get('id_token');
  if (idToken) {
    try {
      const response = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (response.error) {
        return {
          handled: true,
          success: false,
          errorMessage: response.error.message,
        };
      }
      if (response.data?.user?.id) {
        await setNativeLastUserPreference(response.data.user.id);
      }
      return {
        handled: true,
        success: true,
        response: response.data,
        redirectPath: params.get('redirect') ?? '/',
      };
    } catch (error) {
      return {
        handled: true,
        success: false,
        errorMessage: `Gagal memvalidasi id_token: ${(error as Error)?.message ?? error}`,
      };
    }
  }

  const code = params.get('code');
  const verifier = params.get('code_verifier');
  if (code) {
    try {
      const response = await supabase.auth.exchangeCodeForSession({
        code,
        codeVerifier: verifier ?? undefined,
      });
      if (response.error) {
        return {
          handled: true,
          success: false,
          errorMessage: response.error.message,
        };
      }
      if (response.data?.user?.id) {
        await setNativeLastUserPreference(response.data.user.id);
      }
      return {
        handled: true,
        success: true,
        response: response.data,
        redirectPath: params.get('redirect') ?? '/',
      };
    } catch (error) {
      return {
        handled: true,
        success: false,
        errorMessage: `Pertukaran kode Supabase gagal: ${(error as Error)?.message ?? error}`,
      };
    }
  }

  return {
    handled: true,
    success: false,
    errorMessage: 'Callback tidak memiliki kode ataupun id_token.',
  };
}

function describeGoogleError(error: unknown): string {
  if (!error) return 'Proses login Google dibatalkan.';
  if (typeof error === 'string') {
    return humanizeKnownError(error);
  }
  if (error instanceof Error) {
    return humanizeKnownError(error.message);
  }
  return 'Terjadi kesalahan saat menghubungkan ke Google.';
}

function humanizeKnownError(message: string): string {
  if (/12501/.test(message) || /canceled/i.test(message)) {
    return 'Login Google dibatalkan oleh pengguna.';
  }
  if (/DEVELOPER_ERROR/.test(message)) {
    return 'Konfigurasi Google Sign-In belum benar. Pastikan SHA-1/SHA-256 dan OAuth Client ID sudah cocok.';
  }
  if (/SIGN_IN_FAILED/.test(message)) {
    return 'Google Sign-In gagal. Periksa koneksi internet dan kredensial OAuth.';
  }
  return message;
}
