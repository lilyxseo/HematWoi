import { useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, WifiOff } from 'lucide-react';
import useDashboardNote from '../../hooks/useDashboardNote';

const statusStyles = {
  saved: 'border-emerald-400/20 text-emerald-200 bg-emerald-500/10',
  saving: 'border-sky-400/20 text-sky-200 bg-sky-500/10 animate-pulse',
  offline: 'border-amber-400/20 text-amber-200 bg-amber-500/10',
  error: 'border-rose-400/20 text-rose-200 bg-rose-500/10',
};

const statusContent = {
  saved: {
    label: 'Tersimpan',
    Icon: CheckCircle2,
  },
  saving: {
    label: 'Menyimpan…',
    Icon: Loader2,
  },
  offline: {
    label: 'Offline — akan disinkron',
    Icon: WifiOff,
  },
  error: {
    label: 'Gagal',
    Icon: AlertTriangle,
  },
};

const formatRelativeTime = (timestamp: number) => {
  const diff = Date.now() - timestamp;
  if (diff < 0) return 'baru saja';
  const seconds = Math.round(diff / 1000);
  if (seconds < 60) return `${seconds}s lalu`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}j lalu`;
  const days = Math.round(hours / 24);
  return `${days} hari lalu`;
};

export default function DashboardNoteCard() {
  const { note, setNote, status, lastSavedAt, isLoading } = useDashboardNote();
  const { label, Icon } = statusContent[status];
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resizeTextarea = useCallback(() => {
    const element = textareaRef.current;
    if (!element) return;

    element.style.height = 'auto';

    const computed = window.getComputedStyle(element);
    const lineHeight = Number.parseFloat(computed.lineHeight) || 20;
    const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(computed.paddingBottom) || 0;
    const maxHeight = lineHeight * 10 + paddingTop + paddingBottom;

    const nextHeight = Math.min(element.scrollHeight, maxHeight);
    element.style.height = `${nextHeight}px`;
    element.style.overflowY = element.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [note, resizeTextarea]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 shadow-sm backdrop-blur lg:sticky lg:top-24">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">Catatan</h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
            statusStyles[status]
          }`}
        >
          <Icon className="h-3 w-3" aria-hidden="true" />
          <span>{label}</span>
        </span>
      </div>
      <textarea
        ref={textareaRef}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        onInput={resizeTextarea}
        rows={4}
        placeholder="Tulis catatan singkat untuk dirimu hari ini…"
        className="mt-3 w-full resize-none overflow-y-auto rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm leading-relaxed outline-none placeholder:text-white/35 focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
        aria-label="Catatan dashboard"
      />
      <div className="mt-3 flex items-center justify-between text-xs text-white/50">
        <span>{isLoading ? 'Memuat catatan…' : 'Tersimpan otomatis'}</span>
        {lastSavedAt ? (
          <span>Terakhir disimpan {formatRelativeTime(lastSavedAt)}</span>
        ) : (
          <span>Belum tersimpan</span>
        )}
      </div>
    </div>
  );
}
