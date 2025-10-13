import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { supabase } from './supabase';
import { saveLastUserId } from './native';

const FALLBACK_ERROR_MESSAGE =
  'Login Google native tidak dapat dilanjutkan. Pastikan aplikasi sudah dikonfigurasi dengan benar.';

const GOOGLE_CLIENT_ID =
  (typeof import.meta !== 'undefined' && (import.meta as ImportMeta)?.env?.VITE_GOOGLE_WEB_CLIENT_ID) ||
  (typeof import.meta !== 'undefined' && (import.meta as ImportMeta)?.env?.VITE_GOOGLE_CLIENT_ID) ||
  (typeof process !== 'undefined' ? process.env.GOOGLE_WEB_CLIENT_ID : undefined) ||
  (typeof process !== 'undefined' ? process.env.VITE_GOOGLE_WEB_CLIENT_ID : undefined) ||
  '';

let initialized = false;

const isPluginAvailable = () => Capacitor.isPluginAvailable('GoogleAuth');

export function isGoogleNativeAvailable(): boolean {
  return Capacitor.isNativePlatform() && isPluginAvailable();
}

export async function initializeGoogleNative(force = false): Promise<void> {
  if (!isGoogleNativeAvailable()) return;
  if (initialized && !force) return;
  if (!GOOGLE_CLIENT_ID) {
    throw new Error(
      'GOOGLE_WEB_CLIENT_ID belum disediakan. Tambahkan ke variabel lingkungan sebelum build native.'
    );
  }
  try {
    await GoogleAuth.initialize({
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['profile', 'email'],
      grantOfflineAccess: true,
      forceCodeForRefreshToken: true,
    });
    initialized = true;
  } catch (error) {
    initialized = false;
    throw normalizeGoogleError(error);
  }
}

export interface NativeGoogleSessionResult {
  user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'];
}

export async function signInWithGoogleNative(): Promise<NativeGoogleSessionResult> {
  if (!isGoogleNativeAvailable()) {
    throw new Error('Google Sign-In native tidak tersedia pada platform ini.');
  }
  await initializeGoogleNative();
  try {
    const response = await GoogleAuth.signIn();
    const idToken = response?.authentication?.idToken;
    if (!idToken) {
      throw new Error('Plugin GoogleAuth tidak mengembalikan idToken.');
    }
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) {
      throw normalizeGoogleError(error);
    }
    const user = data.user ?? null;
    if (!user) {
      throw new Error('Supabase tidak mengembalikan sesi pengguna yang valid.');
    }
    await saveLastUserId(user.id);
    return { user };
  } catch (error) {
    throw normalizeGoogleError(error);
  }
}

export async function signOutGoogleNative(): Promise<void> {
  if (!isGoogleNativeAvailable()) return;
  try {
    await GoogleAuth.signOut();
  } catch (error) {
    console.warn('[native-auth] gagal signOut dari plugin GoogleAuth', error);
  }
}

function normalizeGoogleError(error: unknown): Error {
  if (error instanceof Error) {
    return enhanceError(error);
  }
  if (typeof error === 'string') {
    return enhanceError(new Error(error));
  }
  try {
    return enhanceError(new Error(JSON.stringify(error)));
  } catch {
    return enhanceError(new Error(FALLBACK_ERROR_MESSAGE));
  }
}

function enhanceError(error: Error): Error {
  const message = error.message ?? '';
  if (/DEVELOPER_ERROR/i.test(message)) {
    return new Error(
      'GoogleAuth DEVELOPER_ERROR: pastikan SHA-1/SHA-256 debug dan release sudah terdaftar pada OAuth Client Android.'
    );
  }
  if (/12501|SIGN_IN_CANCELLED|user cancelled/i.test(message)) {
    return new Error('Login Google dibatalkan.');
  }
  if (/sign in failed/i.test(message)) {
    return new Error('GoogleAuth gagal mengautentikasi pengguna. Cek konfigurasi OAuth dan bundle id.');
  }
  if (/network error/i.test(message)) {
    return new Error('Koneksi internet bermasalah. Mohon coba lagi.');
  }
  if (/invalid_grant|token/i.test(message)) {
    return new Error('Token Google tidak valid atau sudah kedaluwarsa. Silakan login ulang.');
  }
  if (!message) {
    return new Error(FALLBACK_ERROR_MESSAGE);
  }
  return error;
}
