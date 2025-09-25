import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { useToast } from '../../context/ToastContext.jsx';
import { AuditLogEntry, listAuditLog } from '../../lib/adminApi';
import { Icon } from '../../components/icons';

function formatTimestamp(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function SkeletonItem() {
  return (
    <li className="flex gap-4">
      <div className="flex flex-col items-center">
        <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-2xl bg-border/60" />
        <span className="mt-2 h-full w-px bg-border/40" />
      </div>
      <div className="flex-1 space-y-2 rounded-2xl border border-border/60 bg-muted/30 p-4">
        <div className="h-5 w-32 animate-pulse rounded-xl bg-border/60" />
        <div className="h-4 w-48 animate-pulse rounded-xl bg-border/60" />
        <div className="h-4 w-24 animate-pulse rounded-xl bg-border/60" />
      </div>
    </li>
  );
}

export default function AdminAuditTab() {
  const { addToast } = useToast();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadAudit = useCallback(
    async (withToast = false) => {
      setError('');
      withToast ? setRefreshing(true) : setLoading(true);
      try {
        const data = await listAuditLog();
        setEntries(data);
        if (withToast) {
          addToast('Audit log diperbarui', 'success');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal memuat audit log';
        setError(message);
        addToast('Gagal memuat audit log', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Audit Log</h2>
          <p className="text-sm text-muted-foreground">
            Riwayat singkat perubahan menu sidebar dan profil pengguna.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadAudit(true)}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border/60 px-4 text-sm font-medium text-foreground transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <RefreshCw
            className={clsx('h-4 w-4', (loading || refreshing) && 'animate-spin')}
            aria-hidden="true"
          />
          Refresh
        </button>
      </div>
      {error ? (
        <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <ul className="mt-6 space-y-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <SkeletonItem key={index} />)
        ) : entries.length === 0 ? (
          <li className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
            <Icon name="list" className="h-10 w-10 text-muted-foreground/60" />
            <span>Belum ada aktivitas terbaru.</span>
          </li>
        ) : (
          entries.map((entry, index) => (
            <li key={entry.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon name={entry.icon} className="h-5 w-5" />
                </span>
                {index < entries.length - 1 ? (
                  <span className="mt-2 h-full w-px bg-border/60" aria-hidden="true" />
                ) : null}
              </div>
              <div className="flex-1 rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{entry.title}</p>
                  <span className="text-xs text-muted-foreground/80">{entry.type.toUpperCase()}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>
                <p className="mt-3 text-xs text-muted-foreground/70">{formatTimestamp(entry.timestamp)}</p>
              </div>
            </li>
          ))
        )}
      </ul>
      {refreshing ? (
        <div className="mt-6 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Memuat ulang…
        </div>
      ) : null}
    </section>
  );
}
