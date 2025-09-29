import type { ButtonHTMLAttributes, MouseEvent } from 'react';
import { isHematWoiApp } from '../lib/ua';

const httpPattern = /^https?:\/\//i;
const env = typeof import.meta !== 'undefined' ? import.meta.env ?? {} : {};

// kandidat base URL dari ENV
const baseCandidates = [
  typeof env.VITE_SUPABASE_REDIRECT_URL === 'string' ? env.VITE_SUPABASE_REDIRECT_URL.trim() : undefined,
  typeof env.VITE_APP_URL === 'string' ? env.VITE_APP_URL.trim() : undefined,
  typeof env.VITE_PUBLIC_SITE_URL === 'string' ? env.VITE_PUBLIC_SITE_URL.trim() : undefined,
];

const fallbackOrigin =
  typeof window !== 'undefined' && httpPattern.test(window.location.origin)
    ? window.location.origin
    : undefined;

const baseUrl =
  baseCandidates.find((value): value is string => typeof value === 'string' && httpPattern.test(value)) ??
  fallbackOrigin;

type ResolveOptions = { allowCustomScheme?: boolean };

function resolveUrl(
  target: string | undefined,
  defaultPath: string,
  fallbackAbsolute: string,
  options: ResolveOptions = {}
) {
  const trimmed = target?.trim();
  if (trimmed) {
    if (httpPattern.test(trimmed)) return trimmed; // absolute http(s)
    if (baseUrl) {
      try {
        return new URL(trimmed, baseUrl).toString(); // relative to base
      } catch { /* ignore */ }
    }
    if (options.allowCustomScheme) return trimmed; // e.g. hematwoi://native-google-login
  }

  if (baseUrl) {
    try {
      return new URL(defaultPath, baseUrl).toString();
    } catch { /* ignore */ }
  }
  return fallbackAbsolute;
}

// ENV overrides (opsional)
const envWebLogin =
  typeof env.VITE_GOOGLE_WEB_LOGIN_URL === 'string' ? env.VITE_GOOGLE_WEB_LOGIN_URL : undefined;
const envNativeTrigger =
  typeof env.VITE_NATIVE_GOOGLE_LOGIN_URL === 'string' ? env.VITE_NATIVE_GOOGLE_LOGIN_URL : undefined;

// Web OAuth (flow browser biasa)
export const DEFAULT_GOOGLE_WEB_LOGIN_URL = resolveUrl(
  envWebLogin,
  '/auth/google',
  'https://www.hemat-woi.me/auth/google'
);

// Trigger untuk WebView Android → native Google Sign-In (chooser)
export const DEFAULT_NATIVE_TRIGGER_URL = resolveUrl(
  envNativeTrigger,
  '/native-google-login',
  'https://www.hemat-woi.me/native-google-login',
  { allowCustomScheme: true }
);

type GoogleLoginButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type'> & {
  text?: string;
  nativeTriggerUrl?: string; // override jika perlu
  webLoginUrl?: string;      // override jika perlu
  onWebLogin?: (event: MouseEvent<HTMLButtonElement>) => void | Promise<void>; // custom web flow
};

export default function GoogleLoginButton({
  text = 'Login dengan Google',
  nativeTriggerUrl = DEFAULT_NATIVE_TRIGGER_URL,
  webLoginUrl = DEFAULT_GOOGLE_WEB_LOGIN_URL,
  onWebLogin,
  children,
  ...rest
}: GoogleLoginButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    const insideApp = isHematWoiApp();
    const normalizedNativeTrigger =
      typeof nativeTriggerUrl === 'string' ? nativeTriggerUrl.trim() : undefined;
    const canUseNativeTrigger =
      insideApp && typeof normalizedNativeTrigger === 'string' && normalizedNativeTrigger.length > 0 &&
      !httpPattern.test(normalizedNativeTrigger);

    if (canUseNativeTrigger) {
      // Di dalam app (WebView) → arahkan ke /native-google-login (atau custom scheme jika diset di ENV)
      if (typeof window !== 'undefined') window.location.href = normalizedNativeTrigger;
      return;
    }

    // Di browser biasa (atau fallback ketika native trigger belum tersedia)
    if (onWebLogin) {
      void onWebLogin(event);
      return;
    }
    if (typeof window !== 'undefined') window.location.href = webLoginUrl;
  };

  return (
    <button type="button" onClick={handleClick} {...rest}>
      {children ?? text}
    </button>
  );
}
