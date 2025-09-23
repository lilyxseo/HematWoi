import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Github, Loader2, Mail, Unlink } from 'lucide-react';
import type { LinkedProvider } from '../../lib/api-profile';

type IntegrationDescriptor = {
  provider: 'google' | 'github';
  name: string;
  description: string;
  icon: LucideIcon;
};

type IntegrationsCardProps = {
  providers: LinkedProvider[];
  pending?: boolean;
  disabled?: boolean;
  onDisconnect: (identityId: string) => Promise<void>;
};

const BASE_PROVIDERS: IntegrationDescriptor[] = [
  {
    provider: 'google',
    name: 'Google',
    description: 'Gunakan akun Google untuk masuk lebih cepat.',
    icon: Mail,
  },
  {
    provider: 'github',
    name: 'GitHub',
    description: 'Terhubung dengan akun GitHub untuk developer.',
    icon: Github,
  },
];

function formatTimestamp(value?: string | null): string | null {
  if (!value) return null;
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return value;
  }
}

export default function IntegrationsCard({ providers, pending = false, disabled = false, onDisconnect }: IntegrationsCardProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(() => {
    return BASE_PROVIDERS.map((descriptor) => {
      const connected = providers.find((provider) => provider.provider === descriptor.provider);
      return {
        descriptor,
        connected,
      };
    });
  }, [providers]);

  const handleDisconnect = async (identityId: string | null | undefined) => {
    if (!identityId || disabled || pending) return;
    setError(null);
    setBusyId(identityId);
    try {
      await onDisconnect(identityId);
    } catch (err) {
      setError((err as Error).message ?? 'Tidak dapat memutuskan sambungan.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-labelledby="integrations-settings-heading" className="rounded-3xl border border-border-subtle bg-surface p-4 shadow-sm md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 id="integrations-settings-heading" className="text-lg font-semibold text-text-primary">
            Integrasi Sosial
          </h2>
          <p className="text-sm text-text-muted">Kelola akun sosial yang terhubung ke HematWoi.</p>
        </div>
      </div>

      <ul className="mt-6 space-y-3" role="list">
        {items.map(({ descriptor, connected }) => {
          const Icon = descriptor.icon;
          const identityId = connected?.id ?? null;
          const lastUsed = formatTimestamp(connected?.last_sign_in_at ?? null);
          const email = connected?.email ?? null;
          return (
            <li
              key={descriptor.provider}
              className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-alt/60 p-4 shadow-sm md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{descriptor.name}</p>
                  <p className="text-xs text-text-muted">{descriptor.description}</p>
                  {email && <p className="mt-1 text-xs text-text-muted">Email: {email}</p>}
                  {lastUsed && <p className="text-xs text-text-muted">Terakhir digunakan: {lastUsed}</p>}
                  {!connected && <p className="mt-1 text-xs text-text-muted">Belum terhubung.</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {connected ? (
                  <button
                    type="button"
                    onClick={() => handleDisconnect(identityId)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-border-subtle px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={disabled || pending || busyId === identityId}
                  >
                    {busyId === identityId ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Unlink className="h-4 w-4" aria-hidden="true" />
                    )}
                    Putuskan
                  </button>
                ) : (
                  <span className="text-xs text-text-muted">Hubungkan via halaman masuk.</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mt-4 rounded-2xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </section>
  );
}
