import { useCallback, useState } from 'react';
import { Github, Globe, Loader2, ShieldAlert } from 'lucide-react';

interface ProviderInfo {
  id: string | null;
  provider: 'google' | 'github';
  email?: string | null;
  last_sign_in_at?: string | null;
}

interface IntegrationsCardProps {
  providers: ProviderInfo[];
  offline: boolean;
  onDisconnect: (provider: 'google' | 'github') => Promise<void>;
}

function providerLabel(provider: 'google' | 'github') {
  switch (provider) {
    case 'google':
      return 'Google';
    case 'github':
      return 'GitHub';
    default:
      return provider;
  }
}

function providerIcon(provider: 'google' | 'github') {
  switch (provider) {
    case 'github':
      return <Github className="h-5 w-5" aria-hidden="true" />;
    case 'google':
    default:
      return <Globe className="h-5 w-5" aria-hidden="true" />;
  }
}

export default function IntegrationsCard({ providers, offline, onDisconnect }: IntegrationsCardProps) {
  const [busyProvider, setBusyProvider] = useState<null | 'google' | 'github'>(null);
  const [error, setError] = useState('');

  const handleDisconnect = useCallback(
    async (provider: 'google' | 'github') => {
      setError('');
      setBusyProvider(provider);
      try {
        await onDisconnect(provider);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : 'Tidak bisa memutuskan sambungan saat ini.',
        );
      } finally {
        setBusyProvider(null);
      }
    },
    [onDisconnect],
  );

  return (
    <section
      aria-labelledby="profile-integrations-heading"
      className="rounded-3xl border border-border-subtle bg-surface p-4 shadow-sm md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="profile-integrations-heading" className="text-lg font-semibold text-foreground">
          Integrasi
        </h2>
        <p className="text-sm text-muted">
          Kelola akun sosial yang terhubung ke HematWoi.
        </p>
      </div>
      <ul className="mt-6 space-y-4">
        {providers.map((provider) => {
          const connected = Boolean(provider.id);
          return (
            <li
              key={provider.provider}
              className="flex flex-col gap-3 rounded-3xl border border-border-subtle bg-surface-alt/60 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-foreground">
                  {providerIcon(provider.provider)}
                </div>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-foreground">{providerLabel(provider.provider)}</p>
                  <p className="text-xs text-muted">
                    {connected
                      ? provider.email || 'Terhubung'
                      : 'Belum terhubung. Masuk via penyedia ini untuk menghubungkan.'}
                  </p>
                  {connected && provider.last_sign_in_at ? (
                    <p className="text-xs text-muted">
                      Terakhir digunakan:{' '}
                      {new Date(provider.last_sign_in_at).toLocaleString()}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {connected ? (
                  <button
                    type="button"
                    onClick={() => void handleDisconnect(provider.provider)}
                    disabled={offline || busyProvider === provider.provider}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border-subtle bg-surface px-4 text-xs font-semibold text-foreground shadow-sm transition hover:border-danger/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyProvider === provider.provider ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-danger" aria-hidden="true" />
                    )}
                    Putuskan sambungan
                  </button>
                ) : (
                  <span className="text-xs text-muted">
                    Hubungkan dengan login menggunakan {providerLabel(provider.provider)}.
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-danger" aria-live="assertive">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </section>
  );
}
