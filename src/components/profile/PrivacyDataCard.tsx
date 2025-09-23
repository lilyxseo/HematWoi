import { useState } from 'react';
import { AlertTriangle, Download, Loader2, ShieldOff } from 'lucide-react';

type ExportFormat = 'json' | 'csv';

type PrivacyDataCardProps = {
  pendingExport: boolean;
  pendingDelete: boolean;
  disabled?: boolean;
  onExport: (format: ExportFormat) => Promise<void>;
  onDeleteAccount: () => Promise<void>;
};

const inputStyles =
  'h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt px-3 text-sm text-text-primary shadow-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60';

const helperTextStyles = 'text-xs text-text-muted';

export default function PrivacyDataCard({
  pendingExport,
  pendingDelete,
  disabled = false,
  onExport,
  onDeleteAccount,
}: PrivacyDataCardProps) {
  const [confirmation, setConfirmation] = useState('');
  const [trackingAllowed, setTrackingAllowed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    if (disabled || pendingExport) return;
    setError(null);
    setExporting(format);
    try {
      await onExport(format);
    } catch (err) {
      setError((err as Error).message ?? 'Gagal mengekspor data.');
    } finally {
      setExporting(null);
    }
  };

  const handleDelete = async () => {
    if (disabled || pendingDelete) return;
    setDeleteError(null);
    if (confirmation.trim().toUpperCase() !== 'HAPUS') {
      setDeleteError('Ketik "HAPUS" untuk mengonfirmasi.');
      return;
    }
    try {
      await onDeleteAccount();
    } catch (err) {
      setDeleteError((err as Error).message ?? 'Tidak dapat menghapus akun saat ini.');
    }
  };

  return (
    <section aria-labelledby="privacy-settings-heading" className="rounded-3xl border border-border-subtle bg-surface p-4 shadow-sm md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 id="privacy-settings-heading" className="text-lg font-semibold text-text-primary">
            Privasi &amp; Data
          </h2>
          <p className="text-sm text-text-muted">Unduh data kamu dan kelola keputusan privasi.</p>
        </div>
        <ShieldOff className="h-6 w-6 text-primary" aria-hidden="true" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="col-span-1 space-y-3 rounded-2xl border border-border-subtle bg-surface-alt/60 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-text-primary">Ekspor Data</h3>
          <p className={helperTextStyles}>
            Unduh catatan transaksi, kategori, langganan, goals, dan hutang dalam format JSON atau CSV.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleExport('json')}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disabled || pendingExport}
            >
              {exporting === 'json' || pendingExport ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              JSON
            </button>
            <button
              type="button"
              onClick={() => handleExport('csv')}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disabled || pendingExport}
            >
              {exporting === 'csv' || pendingExport ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              CSV
            </button>
          </div>
          {error && (
            <p className="rounded-2xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert" aria-live="polite">
              {error}
            </p>
          )}
        </div>

        <div className="col-span-1 space-y-3 rounded-2xl border border-border-subtle bg-surface-alt/60 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-text-primary">Izin Pelacakan</h3>
          <p className={helperTextStyles}>
            HematWoi hanya mengumpulkan metrik anonim untuk perbaikan aplikasi. Kamu dapat menonaktifkannya kapan saja.
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={trackingAllowed}
            onClick={() => setTrackingAllowed((value) => !value)}
            className={`inline-flex h-11 w-24 items-center rounded-full border px-1 transition focus:outline-none focus:ring-2 focus:ring-ring-primary ${
              trackingAllowed
                ? 'border-primary bg-primary/20 justify-end text-primary'
                : 'border-border-subtle bg-surface text-text-muted justify-start'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            disabled={disabled}
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-sm">
              <span className="sr-only">{trackingAllowed ? 'Pelacakan aktif' : 'Pelacakan nonaktif'}</span>
            </span>
          </button>
          <p className="text-xs text-text-muted">Status saat ini: {trackingAllowed ? 'aktif' : 'nonaktif'}.</p>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-danger/40 bg-danger/5 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-danger">Hapus Akun</h3>
        <p className="mt-2 text-sm text-text-muted">
          Menghapus akun akan menghilangkan semua data finansial kamu secara permanen. Tindakan ini tidak dapat dibatalkan.
        </p>
        <label htmlFor="delete-confirm" className="mt-4 block text-sm font-medium text-text-primary">
          Ketik <strong>HAPUS</strong> untuk melanjutkan
        </label>
        <input
          id="delete-confirm"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className={inputStyles}
          disabled={disabled || pendingDelete}
          aria-describedby="delete-hint"
        />
        <p id="delete-hint" className={helperTextStyles}>
          Kami akan mengonfirmasi lagi melalui email sebelum penghapusan diproses.
        </p>
        {deleteError && (
          <p className="mt-2 rounded-2xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert" aria-live="polite">
            {deleteError}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-danger px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-danger/90 focus:outline-none focus:ring-2 focus:ring-ring-danger disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled || pendingDelete}
          >
            {pendingDelete && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Hapus Akun
          </button>
          <p className="text-xs text-text-muted">
            Jika tombol tidak berfungsi, hubungi support@hematwoi.app untuk bantuan manual.
          </p>
        </div>
      </div>
    </section>
  );
}
