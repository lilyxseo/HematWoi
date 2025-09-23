import { useState } from 'react';
import { Github, Link2Off, LucideIcon, Shield, SignalHigh } from 'lucide-react';

interface Integration {
  provider: 'google' | 'github';
  connected: boolean;
  email?: string | null;
}

interface IntegrationsCardProps {
  providers: Integration[];
  offline?: boolean;
  onDisconnect: (provider: 'google' | 'github') => Promise<void>;
}

const PROVIDER_META: Record<'google' | 'github', { label: string; icon: LucideIcon }> = {
  google: { label: 'Google', icon: SignalHigh },
  github: { label: 'GitHub', icon: Github },
};

export default function IntegrationsCard({ providers, offline = false, onDisconnect }: IntegrationsCardProps) {
  const [busyProvider, setBusyProvider] = useState<'google' | 'github' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDisconnect = async (provider: 'google' | 'github') => {
    setError(null);
    setBusyProvider(provider);
    try {
      await onDisconnect(provider);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Tidak bisa memutuskan sambungan penyedia. Coba lagi.';
      setError(message);
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <section className="rounded-3xl border border-border-subtle bg-surface shadow-sm">
      <div className="grid gap-6 p-4 md:p-6">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-text">Integrasi</h2>
          <p className="text-sm text-muted">Kelola akun sosial yang terhubung ke HematWoi.</p>
        </header>

        <div className="grid gap-4">
          {providers.map((integration) => {
            const meta = PROVIDER_META[integration.provider];
            const connected = integration.connected;
            return (
              <article
                key={integration.provider}
                className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-alt p-4 shadow-sm transition hover:border-border-strong"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <meta.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-text">{meta.label}</p>
                      <p className="text-xs text-muted">
                        {connected
                          ? integration.email || 'Terhubung untuk login cepat.'
                          : 'Belum tersambung. Sambungkan melalui menu login sosial.'}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      connected
                        ? 'border border-success/50 bg-success/10 text-success'
                        : 'border border-border-subtle bg-surface text-muted'
                    }`}
                  >
                    {connected ? 'Terhubung' : 'Tidak aktif'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleDisconnect(integration.provider)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-border-subtle px-3 py-1 text-xs font-medium text-text transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!connected || offline || busyProvider !== null}
                  >
                    {busyProvider === integration.provider ? (
                      <Shield className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Link2Off className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Putuskan sambungan
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <footer className="space-y-2 text-xs text-muted">
          {error ? (
            <p className="text-danger" aria-live="assertive">
              {error}
            </p>
          ) : null}
          <p>
            Tidak menemukan provider lain? Integrasi tambahan dapat diaktifkan melalui tim dukungan. Saat ini HematWoi mendukung login Google dan GitHub.
          </p>
        </footer>
      </div>
    </section>
  );
}
