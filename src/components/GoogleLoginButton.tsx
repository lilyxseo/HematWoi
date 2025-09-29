import type { ButtonHTMLAttributes, MouseEvent } from 'react';
import { isHematWoiApp } from '../lib/ua';

const httpPattern = /^https?:\/\//i;
const env = typeof import.meta !== 'undefined' ? import.meta.env ?? {} : {};
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

type ResolveOptions = {
  allowCustomScheme?: boolean;
};

function resolveUrl(
  target: string | undefined,
  defaultPath: string,
  fallbackAbsolute: string,
  options: ResolveOptions = {}
) {
  const trimmed = target?.trim();
  if (trimmed) {
    if (httpPattern.test(trimmed)) {
      return trimmed;
    }
    if (baseUrl) {
      try {
        return new URL(trimmed, baseUrl).toString();
      } catch {
        /* ignore */
      }
    }
    if (options.allowCustomScheme) {
      return trimmed;
    }
  }

  if (baseUrl) {
    try {
      return new URL(defaultPath, baseUrl).toString();
    } catch {
      /* ignore */
    }
  }

  return fallbackAbsolute;
}

const envWebLogin =
  typeof env.VITE_GOOGLE_WEB_LOGIN_URL === 'string' ? env.VITE_GOOGLE_WEB_LOGIN_URL : undefined;
const envNativeTrigger =
  typeof env.VITE_NATIVE_GOOGLE_LOGIN_URL === 'string' ? env.VITE_NATIVE_GOOGLE_LOGIN_URL : undefined;

const DEFAULT_GOOGLE_WEB_LOGIN_URL = resolveUrl(
  envWebLogin,
  '/auth/google',
  'https://www.hemat-woi.me/auth/google'
);
export const DEFAULT_NATIVE_TRIGGER_URL = resolveUrl(
  envNativeTrigger,
  '/auth/mobile/google',
  'https://www.hemat-woi.me/auth/mobile/google',
  { allowCustomScheme: true }
);

type GoogleLoginButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type'> & {
  text?: string;
  nativeTriggerUrl?: string;
  webLoginUrl?: string;
  onWebLogin?: (event: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
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

    if (isHematWoiApp()) {
      if (typeof window !== 'undefined') {
        window.location.href = nativeTriggerUrl;
      }
      return;
    }

    if (onWebLogin) {
      void onWebLogin(event);
      return;
    }

    if (typeof window !== 'undefined') {
      window.location.href = webLoginUrl;
    }
  };

  return (
    <button type="button" onClick={handleClick} {...rest}>
      {children ?? text}
    </button>
  );
}
