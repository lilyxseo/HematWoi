import clsx from 'clsx';
import type { MouseEventHandler, ReactNode } from 'react';

type Provider = 'google' | 'github';

type SocialButtonsProps = {
  disabled?: boolean;
  loadingProvider?: Provider | null;
  onSelect?: (provider: Provider) => void;
};

type ProviderConfig = {
  label: string;
  provider: Provider;
  icon: ReactNode;
};

const providerConfigs: ProviderConfig[] = [
  {
    label: 'Google',
    provider: 'google',
    icon: (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-5 w-5"
        focusable="false"
      >
        <path
          fill="#EA4335"
          d="M12 10.2v3.8h5.3c-.2 1.4-.9 2.6-2 3.4l3.3 2.6c1.9-1.8 3-4.4 3-7.5 0-.7-.1-1.4-.2-2H12z"
        />
        <path
          fill="#34A853"
          d="M5.3 14.3l-.9.7-2.6 2c1.8 3.5 5.3 5.9 9.2 5.9 2.8 0 5.1-.9 6.8-2.4l-3.3-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.2z"
        />
        <path
          fill="#4A90E2"
          d="M2.7 7.7C2 9.1 1.6 10.5 1.6 12c0 1.5.4 2.9 1.1 4.3l3.9-3c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9z"
        />
        <path
          fill="#FBBC05"
          d="M11 4.6c1.5 0 2.8.5 3.8 1.4l2.8-2.8C15.9 1.1 13.6 0 11 0 7.1 0 3.6 2.4 1.8 5.9l3.9 3c.8-2.4 3.1-4.3 5.3-4.3z"
        />
      </svg>
    ),
  },
  {
    label: 'GitHub',
    provider: 'github',
    icon: (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-5 w-5"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.4.7-4.2-1.7-4.2-1.7-.6-1.4-1.4-1.7-1.4-1.7-1.2-.8.1-.8.1-.8 1.3.1 2 1.3 2 1.3 1.2 2 3.2 1.5 4 .9.1-.9.4-1.5.7-1.9-2.7-.3-5.5-1.4-5.5-6.1 0-1.4.5-2.5 1.3-3.4-.1-.3-.6-1.7.1-3.5 0 0 1-.3 3.4 1.3a11.5 11.5 0 0 1 6.2 0c2.4-1.6 3.4-1.3 3.4-1.3.7 1.8.2 3.2.1 3.5.9.9 1.3 2 1.3 3.4 0 4.7-2.8 5.8-5.5 6.1.5.4.8 1.2.8 2.4v3.6c0 .3.2.7.8.6A12 12 0 0 0 12 .5z"
        />
      </svg>
    ),
  },
];

function isProviderEnabled(provider: Provider) {
  const env =
    (typeof import.meta !== 'undefined' && import.meta.env) ||
    (typeof process !== 'undefined' ? (process.env as Record<string, string>) : {});

  const flagKeys: Record<Provider, string[]> = {
    google: [
      'VITE_SUPABASE_GOOGLE',
      'VITE_SUPABASE_OAUTH_GOOGLE',
      'VITE_SUPABASE_GOOGLE_ENABLED',
      'VITE_SUPABASE_GOOGLE_CLIENT_ID',
    ],
    github: [
      'VITE_SUPABASE_GITHUB',
      'VITE_SUPABASE_OAUTH_GITHUB',
      'VITE_SUPABASE_GITHUB_ENABLED',
    ],
  };

  return flagKeys[provider].some((key) => {
    const value = env?.[key];
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value.length > 0;
    }
    return Boolean(value);
  });
}

export default function SocialButtons({
  disabled,
  loadingProvider,
  onSelect,
}: SocialButtonsProps) {
  const activeProviders = getAvailableSocialProviders();

  if (activeProviders.length === 0) {
    return null;
  }

  const handleClick = (provider: Provider): MouseEventHandler<HTMLButtonElement> =>
    (event) => {
      event.preventDefault();
      if (disabled || loadingProvider) {
        return;
      }
      onSelect?.(provider);
    };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {activeProviders.map(({ provider, label, icon }) => {
        const isLoading = loadingProvider === provider;
        return (
          <button
            key={provider}
            type="button"
            onClick={handleClick(provider)}
            disabled={disabled || isLoading}
            className={clsx(
              'btn w-full border border-border-subtle bg-surface-alt text-sm font-semibold text-text transition focus-visible:ring-2 focus-visible:ring-primary/45 sm:flex-1',
              'hover:bg-surface-alt/70'
            )}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-border-subtle border-t-transparent" />
                <span>Menghubungkan…</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2 text-sm">
                <span aria-hidden className="text-lg text-text">
                  {icon}
                </span>
                <span>Lanjut dengan {label}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function getAvailableSocialProviders(): Provider[] {
  return providerConfigs
    .filter((config) => isProviderEnabled(config.provider))
    .map((config) => config.provider);
}
