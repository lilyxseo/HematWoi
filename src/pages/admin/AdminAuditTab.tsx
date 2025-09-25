import { useEffect, useState } from 'react';
import { Clock3, ShieldCheck, Waypoints } from 'lucide-react';
import { listAuditEntries, type AuditEntry } from '../../lib/adminApi';
import { useToast } from '../../context/ToastContext.jsx';

function SourceIcon({ source }: { source: AuditEntry['source'] }) {
  const className = 'h-4 w-4 text-primary';
  if (source === 'sidebar') {
    return <Waypoints className={className} />;
  }
  return <ShieldCheck className={className} />;
}

export default function AdminAuditTab() {
  const { addToast } = useToast();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listAuditEntries(10);
      setEntries(data);
    } catch (err) {
      console.error('[AdminAuditTab] gagal memuat audit', err);
      setError('Gagal memuat audit log');
      addToast('Gagal memuat audit log', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="rounded-2xl border border-border/60 bg-background/60 p-6 shadow-sm">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Audit Log</h2>
          <p className="text-sm text-muted-foreground">Catatan perubahan terbaru dari menu sidebar dan pengguna.</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border/70 px-3 text-sm font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        >
          <Clock3 className="h-4 w-4" /> Segarkan
        </button>
      </header>

      {loading ? (
        <div className="mt-6 space-y-4">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-16 animate-pulse rounded-2xl bg-border/40" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      ) : entries.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/40 p-12 text-center">
          <span className="text-4xl" role="img" aria-hidden>
            📜
          </span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Belum ada aktivitas</p>
            <p className="text-sm text-muted-foreground">Perubahan terbaru akan tampil di sini secara kronologis.</p>
          </div>
        </div>
      ) : (
        <ol className="mt-6 space-y-6">
          {entries.map((entry) => (
            <li key={entry.id} className="relative pl-8">
              <span className="absolute left-0 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
                <SourceIcon source={entry.source} />
              </span>
              <div className="rounded-2xl border border-border/60 bg-background px-4 py-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{entry.title}</p>
                    <p className="text-xs text-muted-foreground">{entry.description}</p>
                  </div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {entry.action === 'created' ? 'DIBUAT' : 'DIPERBARUI'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
