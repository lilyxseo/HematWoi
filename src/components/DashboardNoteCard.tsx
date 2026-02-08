import { useEffect, useMemo, useRef } from "react";
import { useDashboardNote } from "../hooks/useDashboardNote";

const MIN_ROWS = 3;
const MAX_ROWS = 10;

export default function DashboardNoteCard() {
  const { note, setNote, status } = useDashboardNote();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const statusLabel = useMemo(() => {
    switch (status) {
      case "saving":
        return "Menyimpan…";
      case "saved":
        return "Tersimpan";
      case "offline":
        return "Offline — akan disinkron saat online";
      case "error":
        return "Gagal menyimpan";
      default:
        return "";
    }
  }, [status]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const computed = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(computed.lineHeight || "24");
    const minHeight = lineHeight * MIN_ROWS;
    const maxHeight = lineHeight * MAX_ROWS;
    const nextHeight = Math.min(
      Math.max(textarea.scrollHeight, minHeight),
      maxHeight,
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [note]);

  return (
    <div className="rounded-2xl border border-border-subtle bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/60 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text">Catatan</h2>
          <p className="text-xs text-muted sm:text-sm">Tersimpan otomatis</p>
        </div>
        {statusLabel ? (
          <span className="text-xs font-medium text-muted">{statusLabel}</span>
        ) : null}
      </div>
      <textarea
        ref={textareaRef}
        rows={MIN_ROWS}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Tulis catatan singkat untuk dashboard kamu..."
        className="mt-4 w-full resize-none rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-text shadow-inner transition focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ring)]"
      />
    </div>
  );
}
