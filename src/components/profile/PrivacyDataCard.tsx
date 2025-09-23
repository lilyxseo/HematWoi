import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Archive, FileJson, FileSpreadsheet, Loader2, ShieldOff, Trash2 } from 'lucide-react';

interface PrivacyDataCardProps {
  offline: boolean;
  exporting: boolean;
  onExport: (format: 'json' | 'csv') => Promise<void>;
  onDeleteAccount: () => Promise<{ status: 'success' | 'unavailable'; message: string }>;
}

function TrackingToggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`inline-flex h-10 w-18 items-center rounded-full border px-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary ${
        value ? 'border-primary bg-primary' : 'border-border-subtle bg-surface'
      }`}
    >
      <span className="sr-only">Izinkan pelacakan sederhana</span>
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-semibold shadow-sm transition-transform ${
          value ? 'translate-x-8 text-primary' : 'translate-x-0 text-muted'
        }`}
      >
        {value ? 'On' : 'Off'}
      </span>
    </button>
  );
}

function DeleteDialog({
  open,
  value,
  onChange,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  value: string;
  busy: boolean;
  error: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true">
      <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-3xl border border-border-subtle bg-surface shadow-xl">
        <div className="sticky top-0 flex items-center justify-between gap-4 border-b border-border-subtle bg-surface px-5 py-4">
          <h3 className="text-lg font-semibold text-foreground">Konfirmasi hapus akun</h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-muted transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
          >
            Batal
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 text-sm text-foreground">
          <p className="text-muted">
            Tindakan ini akan menghapus seluruh data finansial kamu secara permanen. Ketik{' '}
            <span className="font-semibold text-danger">HAPUS</span> untuk melanjutkan.
          </p>
          <label className="mt-4 flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Ketik "HAPUS"</span>
            <input
              type="text"
              value={value}
              onChange={(event) => onChange(event.target.value.toUpperCase())}
              className="h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt/70 px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring-primary"
              autoFocus
            />
          </label>
          {error ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-danger" aria-live="assertive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              {error}
            </p>
          ) : null}
        </div>
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-border-subtle bg-surface px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center justify-center rounded-full border border-border-subtle bg-surface px-4 text-sm font-semibold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={value !== 'HAPUS' || busy}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-danger/70 bg-danger px-5 text-sm font-semibold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
            Hapus akun
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function PrivacyDataCard({ offline, exporting, onExport, onDeleteAccount }: PrivacyDataCardProps) {
  const [tracking, setTracking] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteValue, setDeleteValue] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('hematwoi:tracking-consent');
      if (stored) {
        setTracking(stored === '1');
      }
    } catch {
      setTracking(false);
    }
  }, []);

  const trackingText = useMemo(() =>
    tracking
      ? 'Pelacakan ringan diaktifkan untuk meningkatkan rekomendasi.'
      : 'Pelacakan dimatikan. Kami hanya menyimpan data yang penting.',
  [tracking]);

  const handleTrackingChange = useCallback(
    (value: boolean) => {
      setTracking(value);
      try {
        localStorage.setItem('hematwoi:tracking-consent', value ? '1' : '0');
      } catch {
        // ignore storage error
      }
    },
    [],
  );

  const handleExport = useCallback(
    async (format: 'json' | 'csv') => {
      setStatusMessage('');
      setErrorMessage('');
      try {
        await onExport(format);
        setStatusMessage(`Ekspor ${format.toUpperCase()} siap diunduh.`);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Tidak bisa mengekspor data saat ini.',
        );
      }
    },
    [onExport],
  );

  const openDeleteModal = useCallback(() => {
    setDeleteValue('');
    setDeleteError('');
    setModalOpen(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (deleteValue !== 'HAPUS') {
      setDeleteError('Ketik HAPUS untuk melanjutkan.');
      return;
    }
    setDeleteBusy(true);
    setDeleteError('');
    setStatusMessage('');
    setErrorMessage('');
    try {
      const result = await onDeleteAccount();
      if (result.status === 'success') {
        setStatusMessage(result.message);
        setModalOpen(false);
      } else {
        setErrorMessage(result.message);
      }
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : 'Tidak bisa memproses penghapusan akun.',
      );
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteValue, onDeleteAccount]);

  return (
    <section
      aria-labelledby="profile-privacy-heading"
      className="rounded-3xl border border-border-subtle bg-surface p-4 shadow-sm md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="profile-privacy-heading" className="text-lg font-semibold text-foreground">
          Privasi &amp; Data
        </h2>
        <p className="text-sm text-muted">Kelola ekspor data, penghapusan akun, dan perizinan.</p>
      </div>
      <div className="mt-6 space-y-6">
        <div className="rounded-3xl border border-border-subtle bg-surface-alt/60 p-4">
          <h3 className="text-sm font-semibold text-foreground">Ekspor data</h3>
          <p className="mt-2 text-xs text-muted">
            Unduh salinan transaksi, kategori, goals, utang, dan langganan dalam format JSON atau CSV.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void handleExport('json')}
              disabled={offline || exporting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface px-4 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileJson className="h-4 w-4" aria-hidden="true" />}
              Ekspor JSON
            </button>
            <button
              type="button"
              onClick={() => void handleExport('csv')}
              disabled={offline || exporting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface px-4 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
              Ekspor CSV
            </button>
          </div>
        </div>
        <div className="rounded-3xl border border-border-subtle bg-surface-alt/60 p-4">
          <h3 className="text-sm font-semibold text-foreground">Izin pelacakan sederhana</h3>
          <p className="mt-2 text-xs text-muted" aria-live="polite">
            {trackingText}
          </p>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted">
              <ShieldOff className="h-4 w-4" aria-hidden="true" />
              Data anonim untuk insight umum saja.
            </div>
            <TrackingToggle value={tracking} onChange={handleTrackingChange} />
          </div>
        </div>
        <div className="rounded-3xl border border-danger/40 bg-danger/10 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-danger">
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Hapus akun
          </h3>
          <p className="mt-2 text-xs text-danger/80">
            Setelah dikonfirmasi, seluruh data akan hilang dan tidak dapat dikembalikan.
          </p>
          <button
            type="button"
            onClick={openDeleteModal}
            disabled={offline}
            className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-danger/60 bg-danger px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Mulai proses hapus akun
          </button>
        </div>
        <div className="rounded-3xl border border-border-subtle bg-surface-alt/60 p-4 text-sm text-muted">
          <div className="flex items-center gap-2 text-foreground">
            <Archive className="h-4 w-4" aria-hidden="true" /> Riwayat permintaan
          </div>
          <p className="mt-2 text-xs" aria-live="polite">
            {statusMessage || 'Belum ada permintaan terbaru.'}
          </p>
          {errorMessage ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-danger" aria-live="assertive">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {errorMessage}
            </p>
          ) : null}
        </div>
      </div>
      <DeleteDialog
        open={modalOpen}
        value={deleteValue}
        onChange={setDeleteValue}
        busy={deleteBusy}
        error={deleteError}
        onConfirm={() => void handleDelete()}
        onCancel={() => setModalOpen(false)}
      />
    </section>
  );
}
