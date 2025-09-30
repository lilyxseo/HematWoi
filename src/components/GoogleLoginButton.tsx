import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'

import { isHematWoiApp } from '../lib/ua'

const DEFAULT_DOMAIN = 'https://www.hemat-woi.me'
const DEFAULT_WEB_LOGIN_PATH = '/auth/google'
const DEFAULT_WEB_LOGIN_ABSOLUTE = `${DEFAULT_DOMAIN}${DEFAULT_WEB_LOGIN_PATH}`
const DEFAULT_NATIVE_LOGIN_PATH = '/native-google-login'
const DEFAULT_NATIVE_LOGIN_ABSOLUTE = `${DEFAULT_DOMAIN}${DEFAULT_NATIVE_LOGIN_PATH}`

export const DEFAULT_GOOGLE_WEB_LOGIN_URL = DEFAULT_WEB_LOGIN_ABSOLUTE
export const DEFAULT_NATIVE_TRIGGER_URL = DEFAULT_NATIVE_LOGIN_ABSOLUTE

type Environment = Record<string, string | undefined>

type GoogleLoginButtonProps = {
  text?: string
  nativeTriggerUrl?: string
  webLoginUrl?: string
  onWebLogin?: (event: MouseEvent<HTMLButtonElement>) => void | Promise<void>
  children?: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick'>

const browserEnv: Environment =
  typeof import.meta !== 'undefined' && (import.meta as ImportMeta).env
    ? ((import.meta as ImportMeta).env as Environment)
    : {}
const nodeEnv: Environment =
  typeof process !== 'undefined' && process?.env ? (process.env as Environment) : {}

function getEnvValue(key: string): string | undefined {
  return browserEnv?.[key] ?? nodeEnv?.[key]
}

function getBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  return DEFAULT_DOMAIN
}

function makeAbsoluteUrl(url: string | undefined, fallbackAbsolute: string): string {
  const value = url?.trim()
  if (!value) {
    return fallbackAbsolute
  }

  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)
  if (hasScheme) {
    return value
  }

  try {
    const base = getBaseUrl()
    return new URL(value, base).toString()
  } catch (error) {
    console.warn('Failed to construct URL for', value, 'falling back to', fallbackAbsolute, error)
    return fallbackAbsolute
  }
}

function resolveUrl(
  overrideValue: string | undefined,
  envKey: string,
  fallbackRelative: string,
  fallbackAbsolute: string
): string {
  const envValue = getEnvValue(envKey)
  const selected = overrideValue ?? envValue ?? fallbackRelative

  return makeAbsoluteUrl(selected, fallbackAbsolute)
}

export default function GoogleLoginButton({
  text = 'Login dengan Google',
  nativeTriggerUrl,
  webLoginUrl,
  onWebLogin,
  children,
  ...rest
}: GoogleLoginButtonProps) {
  const computedNativeUrl = resolveUrl(
    nativeTriggerUrl,
    'VITE_NATIVE_GOOGLE_LOGIN_URL',
    DEFAULT_NATIVE_LOGIN_PATH,
    DEFAULT_NATIVE_LOGIN_ABSOLUTE
  )

  const computedWebLoginUrl = resolveUrl(
    webLoginUrl,
    'VITE_GOOGLE_WEB_LOGIN_URL',
    DEFAULT_WEB_LOGIN_PATH,
    DEFAULT_WEB_LOGIN_ABSOLUTE
  )

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    if (isHematWoiApp()) {
      if (typeof window !== 'undefined') {
        window.location.href = computedNativeUrl
      }

      return
    }

    if (onWebLogin) {
      await onWebLogin(event)
      return
    }

    if (typeof window !== 'undefined') {
      window.location.href = computedWebLoginUrl
    }
  }

  return (
    <button type="button" {...rest} onClick={handleClick}>
      {children ?? text}
    </button>
  )
}
