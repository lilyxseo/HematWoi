type Environment = Record<string, string | undefined>;

const DEFAULT_DOMAIN = 'https://www.hemat-woi.me';
const DEFAULT_NATIVE_LOGIN_PATH = '/native-google-login';
const DEFAULT_NATIVE_LOGIN_ABSOLUTE = `${DEFAULT_DOMAIN}${DEFAULT_NATIVE_LOGIN_PATH}`;

const browserEnv: Environment =
  typeof import.meta !== 'undefined' && (import.meta as ImportMeta).env
    ? ((import.meta as ImportMeta).env as Environment)
    : {};
const nodeEnv: Environment =
  typeof process !== 'undefined' && process?.env ? (process.env as Environment) : {};

function getEnvValue(key: string): string | undefined {
  return browserEnv?.[key] ?? nodeEnv?.[key];
}

function getBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return DEFAULT_DOMAIN;
}

function makeAbsoluteUrl(url: string | undefined, fallbackAbsolute: string): string {
  const value = url?.trim();
  if (!value) {
    return fallbackAbsolute;
  }

  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
  if (hasScheme) {
    return value;
  }

  try {
    const base = getBaseUrl();
    return new URL(value, base).toString();
  } catch (error) {
    console.warn(
      'Failed to construct native Google login URL for',
      value,
      'falling back to',
      fallbackAbsolute,
      error
    );
    return fallbackAbsolute;
  }
}

export function getNativeGoogleLoginUrl(overrideUrl?: string): string {
  const envValue = getEnvValue('VITE_NATIVE_GOOGLE_LOGIN_URL');
  const selected = overrideUrl ?? envValue ?? DEFAULT_NATIVE_LOGIN_PATH;

  return makeAbsoluteUrl(selected, DEFAULT_NATIVE_LOGIN_ABSOLUTE);
}

export const NATIVE_GOOGLE_LOGIN_URL = getNativeGoogleLoginUrl();

export function redirectToNativeGoogleLogin(overrideUrl?: string) {
  if (typeof window === 'undefined') return;
  const target = getNativeGoogleLoginUrl(overrideUrl);

  try {
    window.location.replace(target);
  } catch {
    window.location.href = target;
  }
}
