import type { MouseEvent } from 'react';
import { getAvailableSocialProviders } from '../../lib/auth';

type Provider = 'google' | 'github';

type Availability = {
  google?: boolean;
  github?: boolean;
};

type SocialButtonsProps = {
  onProviderClick: (provider: Provider) => void;
  loadingProvider?: Provider | null;
  disabled?: boolean;
  availability?: Availability;
};

const providerConfigs: Record<Provider, { label: string; icon: JSX.Element }> = {
  google: {
    label: 'Google',
    icon: (
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="#EA4335"
          d="M12 10.2v3.6h5.1c-.2 1.2-.8 2.3-1.8 3.1l2.9 2.3c1.7-1.6 2.7-3.9 2.7-6.7 0-.6-.1-1.2-.2-1.8z"
        />
        <path
          fill="#34A853"
          d="M6.6 13.8l-.9.7-2.3 1.8C4.7 19.8 8.1 22 12 22c2.4 0 4.5-.8 6-2.1l-2.9-2.3c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8z"
        />
        <path
          fill="#4A90E2"
          d="M3.4 7.7 1.1 5.9C.4 7.2 0 8.6 0 10c0 1.4.4 2.8 1.1 4l3.4-2.7c-.2-.6-.3-1.3-.3-2 0-.7.1-1.4.3-2.1z"
        />
        <path
          fill="#FBBC05"
          d="M12 4.8c1.3 0 2.5.5 3.4 1.4l2.5-2.5C16.5 1.6 14.4.7 12 .7 8.1.7 4.7 2.9 3.1 6.2l3.4 2.7c.7-2.2 2.7-4.1 5.5-4.1z"
        />
      </svg>
    ),
  },
  github: {
    label: 'GitHub',
    icon: (
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M12 1.5C6.2 1.5 1.5 6.2 1.5 12c0 4.7 3.1 8.7 7.3 10.1.5.1.7-.2.7-.5v-2c-3 .7-3.6-1.3-3.6-1.3-.4-1-1-1.3-1-1.3-.8-.6.1-.6.1-.6.9.1 1.4 1 1.4 1 .8 1.4 2.2 1 2.7.8.1-.6.3-1 .6-1.3-2.4-.3-5-1.2-5-5.4 0-1.2.4-2.1 1-2.9-.1-.3-.4-1.4.1-2.8 0 0 .8-.2 2.9 1 .7-.2 1.5-.3 2.2-.3s1.5.1 2.2.3c2.1-1.2 2.9-1 2.9-1 .6 1.4.2 2.5.1 2.8.6.8 1 1.7 1 2.9 0 4.2-2.6 5.1-5 5.4.3.3.6.8.6 1.7v2.6c0 .3.2.6.7.5 4.2-1.4 7.3-5.4 7.3-10.1 0-5.8-4.7-10.5-10.5-10.5z"
        />
      </svg>
    ),
  },
};

export default function SocialButtons({
  onProviderClick,
  loadingProvider,
  disabled,
  availability,
}: SocialButtonsProps) {
  const resolvedAvailability = availability ?? getAvailableSocialProviders();
  const visibleProviders = (Object.keys(providerConfigs) as Provider[]).filter(
    (key) => resolvedAvailability[key]
  );

  if (visibleProviders.length === 0) {
    return null;
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>, provider: Provider) => {
    event.preventDefault();
    if (disabled || loadingProvider) return;
    onProviderClick(provider);
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {visibleProviders.map((provider) => {
        const { label, icon } = providerConfigs[provider];
        const isLoading = loadingProvider === provider;
        return (
          <button
            key={provider}
            type="button"
            onClick={(event) => handleClick(event, provider)}
            disabled={disabled || isLoading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface-alt px-4 text-sm font-semibold text-text transition hover:bg-surface-alt/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-border-subtle border-t-transparent"
                aria-hidden="true"
              />
            ) : (
              icon
            )}
            <span>{isLoading ? 'Menghubungkan…' : label}</span>
          </button>
        );
      })}
    </div>
  );
}
