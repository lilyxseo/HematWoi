import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../components/icons';
import { useToast } from '../../context/ToastContext.jsx';
import { getAdminAuditLog, type AuditLogEntry } from '../../lib/adminApi';
import { cardClass, primaryButton, subtleButton } from './adminShared';

function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch (error) {
    console.error(error);
    return value;
  }
}

function SkeletonItem() {
  return (
    <div className="relative pl-8">
      <span className="absolute left-[3px] top-2 block h-3 w-3 rounded-full bg-muted" />
      <div className="ml-2 rounded-2xl border border-border/40 bg-muted/30 p-4">
        <div className="mb-2 h-4 w-40 animate-pulse rounded-lg bg-border/60" />
        <div className="h-3 w-56 animate-pulse rounded-lg bg-border/40" />
      </div>
    </div>
  );
}

const iconByType: Record<AuditLogEntry['type'], string> = {
  sidebar: 'list',
  user: 'user',
};

export default function AdminAuditTab() {
  const { addToast } = useToast();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminAuditLog(10);
      setEntries(data);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
      setError(message);
      addToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void fetchAudit();
  }, [fetchAudit]);

  return (
    <section className={cardClass}>
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Audit Log</h2>
          <p className="text-sm text-muted-foreground">
            Catatan singkat perubahan terbaru pada menu dan profil pengguna.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={subtleButton} onClick={() => void fetchAudit()}>
            Segarkan
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonItem key={index} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
          {error}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/50 bg-muted/20 p-10 text-center text-sm text-muted-foreground">
          <div className="text-3xl">🗒️</div>
          <p>Belum ada aktivitas terbaru.</p>
        </div>
      ) : (
        <div className="relative pl-6">
          <span className="absolute left-3 top-2 bottom-4 w-px bg-border/60" aria-hidden />
          <div className="space-y-4">
            {entries.map((entry) => (
              <div key={entry.id} className="relative pl-5">
                <span className="absolute left-[-11px] top-3 flex h-6 w-6 items-center justify-center rounded-full border border-primary/40 bg-background text-primary shadow-sm">
                  <Icon name={iconByType[entry.type]} className="h-4 w-4" />
                </span>
                <div className="rounded-2xl border border-border/40 bg-background/80 p-4 shadow-sm">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{entry.title}</h3>
                      <p className="text-sm text-muted-foreground">{entry.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(entry.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button type="button" className={primaryButton} onClick={() => void fetchAudit()}>
          Refresh
        </button>
      </div>
    </section>
  );
}
