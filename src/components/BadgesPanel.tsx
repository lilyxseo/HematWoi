import { useMemo, useState } from 'react';
import Badge from './Badge';
import type { BadgeRecord } from '../lib/achievements';
import { BADGE_DEFINITIONS } from '../lib/achievements';

const MAX_PREVIEW = 4;

interface BadgesPanelProps {
  badges: BadgeRecord[];
  className?: string;
  id?: string;
}

export default function BadgesPanel({ badges, className, id }: BadgesPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(
    () =>
      [...badges].sort(
        (a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime(),
      ),
    [badges],
  );
  const visible = expanded ? sorted : sorted.slice(0, MAX_PREVIEW);
  const total = BADGE_DEFINITIONS.length;

  return (
    <section
      id={id}
      className={`rounded-xl border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur ${className ?? ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text">Pencapaian</h2>
          <p className="mt-1 text-sm text-muted/80">
            Raih badge dari aktivitas keuangan sehari-hari.
          </p>
        </div>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted/80">
          {badges.length}/{total}
        </span>
      </div>

      {sorted.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visible.map((badge) => (
            <Badge key={`${badge.code}-${badge.earned_at}`} badge={badge} />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-border/70 bg-surface-1/80 px-4 py-6 text-sm text-muted">
          Belum ada badge yang didapatkan. Catat transaksi secara rutin, jaga anggaran,
          dan coba impor data untuk mulai mengumpulkan pencapaian.
        </div>
      )}

      <div className="mt-4 text-right">
        <a
          href={id ? `#${id}` : '#'}
          className="inline-flex items-center text-sm font-semibold text-brand hover:underline"
          onClick={(event) => {
            if (!id) {
              event.preventDefault();
            }
            if (sorted.length > MAX_PREVIEW) {
              event.preventDefault();
              setExpanded((prev) => !prev);
            }
          }}
        >
          {expanded && sorted.length > MAX_PREVIEW ? 'Tutup' : 'Lihat Pencapaian'}
        </a>
      </div>
    </section>
  );
}
