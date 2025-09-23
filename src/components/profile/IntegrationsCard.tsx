import clsx from 'clsx';

const providerMeta: Record<string, { name: string; description: string; icon: string }> = {
  google: {
    name: 'Google',
    description: 'Masuk menggunakan akun Google untuk sinkronisasi cepat.',
    icon: '🔗',
  },
  github: {
    name: 'GitHub',
    description: 'Hubungkan akun GitHub untuk developer perks dan akses awal.',
    icon: '🐙',
  },
};

type Integration = {
  id: 'google' | 'github';
  connected: boolean;
  email?: string | null;
};

type IntegrationsCardProps = {
  providers: Integration[];
  disabled: boolean;
  loadingProvider?: string | null;
  onDisconnect: (provider: 'google' | 'github') => Promise<void>;
};

export default function IntegrationsCard({ providers, disabled, loadingProvider, onDisconnect }: IntegrationsCardProps) {
  return (
    <section className="rounded-3xl border border-border-subtle bg-surface shadow-sm" aria-labelledby="profile-integrations">
      <div className="p-4 md:p-6">
        <header className="mb-6 flex flex-col gap-1">
          <h2 id="profile-integrations" className="text-lg font-semibold text-primary">
            Integrasi
          </h2>
          <p className="text-sm text-muted">Kelola akun sosial yang terhubung.</p>
        </header>
        <div className="space-y-4">
          {providers.map((provider) => {
            const meta = providerMeta[provider.id];
            return (
              <article
                key={provider.id}
                className={clsx(
                  'flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-alt/60 p-4 text-sm text-text shadow-sm md:flex-row md:items-center md:justify-between',
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-lg">
                    {meta?.icon ?? '🔗'}
                  </span>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-primary">{meta?.name ?? provider.id}</span>
                      <span
                        className={clsx(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          provider.connected
                            ? 'bg-success/15 text-success'
                            : 'bg-border-subtle text-muted',
                        )}
                      >
                        {provider.connected ? 'Terhubung' : 'Tidak terhubung'}
                      </span>
                    </div>
                    <p className="text-xs text-muted">{meta?.description}</p>
                    {provider.email ? (
                      <p className="text-xs text-muted">Email: {provider.email}</p>
                    ) : null}
                  </div>
                </div>
                {provider.connected ? (
                  <button
                    type="button"
                    className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface px-4 text-xs font-semibold text-text transition hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => onDisconnect(provider.id)}
                    disabled={disabled || loadingProvider === provider.id}
                  >
                    {loadingProvider === provider.id ? 'Memutus...' : 'Putuskan sambungan'}
                  </button>
                ) : (
                  <p className="text-xs text-muted">Sambungkan akun dari menu login untuk mengaktifkan.</p>
                )}
              </article>
            );
          })}
          {providers.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border-subtle/70 bg-surface-alt/60 p-6 text-center text-sm text-muted">
              Tidak ada integrasi yang tersedia saat ini.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
