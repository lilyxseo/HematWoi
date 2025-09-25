import { useEffect, useState } from 'react';
import { Icon } from '../../components/icons';
import { listAuditLog, type AuditEntry } from '../../lib/adminApi';

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

type TimelineState = {
  loading: boolean;
  error: string | null;
  entries: AuditEntry[];
};

const SOURCE_ICON: Record<AuditEntry['source'], string> = {
  sidebar: 'list',
  user: 'user',
};

export default function AdminAuditTab() {
  const [{ loading, error, entries }, setState] = useState<TimelineState>({
    loading: true,
    error: null,
    entries: [],
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const data = await listAuditLog(10);
        if (mounted) {
          setState({ loading: false, error: null, entries: data });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal memuat log perubahan';
        if (mounted) {
          setState({ loading: false, error: message, entries: [] });
        }
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const renderSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex gap-4">
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted/40" />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-40 animate-pulse rounded-full bg-muted/30" />
            <div className="h-3 w-56 animate-pulse rounded-full bg-muted/30" />
          </div>
        </div>
      ))}
    </div>
  );

  if (error) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Audit Log</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pantau perubahan terbaru pada menu dan pengguna.
          </p>
        </div>
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Audit Log</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pantau perubahan terbaru pada menu dan pengguna.
          </p>
        </div>
        {renderSkeleton()}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Audit Log</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pantau perubahan terbaru pada menu dan pengguna.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 p-10 text-center">
          <Icon name="shield" className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            Belum ada aktivitas terbaru.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Audit Log</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pantau perubahan terbaru pada menu dan pengguna.
        </p>
      </div>
      <div className="relative pl-6">
        <div className="absolute left-[14px] top-2 bottom-2 w-[2px] bg-border/60" aria-hidden />
        <ul className="space-y-6">
          {entries.map((entry) => (
            <li key={entry.id} className="relative flex gap-4">
              <div className="absolute -left-[26px] top-1 flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background shadow-sm">
                <Icon name={SOURCE_ICON[entry.source]} className="h-4 w-4" />
              </div>
              <div className="ml-2 flex-1 rounded-2xl border border-border/60 bg-background p-4 shadow-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">{entry.title}</span>
                  <span className="text-xs text-muted-foreground">{entry.description}</span>
                  <span className="text-xs font-medium text-muted-foreground opacity-80">
                    {entry.timestamp ? dateFormatter.format(new Date(entry.timestamp)) : '—'}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
