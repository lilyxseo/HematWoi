import { useState } from 'react';
import type { FormEvent } from 'react';
import { Download, FileJson, ShieldOff, Trash2 } from 'lucide-react';

interface PrivacyDataCardProps {
  offline?: boolean;
  exporting?: { json?: boolean; csv?: boolean };
  deleting?: boolean;
  onExportJson: () => Promise<void>;
  onExportCsv: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
}

export default function PrivacyDataCard({
  offline = false,
  exporting = {},
  deleting = false,
  onExportJson,
  onExportCsv,
  onDeleteAccount,
}: PrivacyDataCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteInfo, setDeleteInfo] = useState<string | null>(null);

  const handleExportJson = async () => {
    try {
      await onExportJson();
    } catch (error) {
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
        console.error('[HW][profile-ui] export json', error);
      }
    }
  };

  const handleExportCsv = async () => {
    try {
      await onExportCsv();
    } catch (error) {
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
        console.error('[HW][profile-ui] export csv', error);
      }
    }
  };

  const openConfirm = () => {
    setConfirmInput('');
    setDeleteError(null);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (deleting) return;
    setConfirmOpen(false);
  };

  const handleDelete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (confirmInput.trim().toUpperCase() !== 'HAPUS') {
      setDeleteError('Ketik HAPUS untuk mengonfirmasi.');
      return;
    }
    setDeleteError(null);
    try {
      await onDeleteAccount();
      setDeleteInfo('Permintaan penghapusan diproses. Jika tidak ada endpoint otomatis, hubungi dukungan HematWoi untuk tindak lanjut.');
      setConfirmOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tidak bisa menghapus akun. Coba lagi.';
      setDeleteError(message);
    }
  };

  return (
    <section className="rounded-3xl border border-border-subtle bg-surface shadow-sm">
      <div className="grid gap-6 p-4 md:p-6">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-text">Privasi & Data</h2>
          <p className="text-sm text-muted">
            Ekspor data finansial kamu dan kelola permintaan penghapusan akun sesuai regulasi.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border-subtle bg-surface-alt p-4 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
              <FileJson className="h-4 w-4" aria-hidden="true" /> Ekspor JSON
            </h3>
            <p className="mt-1 text-xs text-muted">
              Termasuk transaksi, kategori, goal, langganan, dan hutang/piutang dalam satu arsip JSON.
            </p>
            <button
              type="button"
              onClick={handleExportJson}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border-subtle px-4 py-2 text-sm font-medium text-text transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={Boolean(exporting.json)}
            >
              {exporting.json ? 'Menyiapkan…' : 'Unduh JSON'}
            </button>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-surface-alt p-4 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
              <Download className="h-4 w-4" aria-hidden="true" /> Ekspor CSV
            </h3>
            <p className="mt-1 text-xs text-muted">
              Cocok untuk spreadsheet — transaksi diurutkan berdasarkan tanggal terbaru.
            </p>
            <button
              type="button"
              onClick={handleExportCsv}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border-subtle px-4 py-2 text-sm font-medium text-text transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={Boolean(exporting.csv)}
            >
              {exporting.csv ? 'Menyiapkan…' : 'Unduh CSV'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-danger">
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Hapus akun permanen
          </h3>
          <p className="mt-1 text-xs text-danger">
            Tindakan ini tidak bisa dibatalkan dan akan menghapus seluruh data di cloud. Data lokal harus dihapus manual dari perangkat.
          </p>
          <button
            type="button"
            onClick={openConfirm}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-2xl border border-danger/40 bg-danger/20 px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:cursor-not-allowed disabled:opacity-60"
            disabled={offline}
          >
            <ShieldOff className="h-4 w-4" aria-hidden="true" /> Ajukan penghapusan
          </button>
          {offline ? (
            <p className="mt-2 text-xs text-muted" aria-live="polite">
              Kamu sedang offline. Penghapusan akun membutuhkan koneksi internet.
            </p>
          ) : null}
          {deleteInfo ? (
            <p className="mt-2 text-xs text-success" aria-live="polite">
              {deleteInfo}
            </p>
          ) : null}
        </div>
      </div>

      {confirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-3xl border border-border-subtle bg-surface p-6 shadow-lg">
            <form className="grid gap-4" onSubmit={handleDelete}>
              <div className="space-y-1">
                <h4 id="delete-account-title" className="text-lg font-semibold text-text">
                  Konfirmasi hapus akun
                </h4>
                <p className="text-sm text-muted">
                  Ketik <strong>HAPUS</strong> untuk menghapus akun dan seluruh data terkait. Pastikan kamu sudah mengekspor data terlebih dahulu.
                </p>
              </div>
              <input
                type="text"
                value={confirmInput}
                onChange={(event) => setConfirmInput(event.target.value)}
                placeholder="HAPUS"
                autoFocus
                aria-invalid={Boolean(deleteError)}
              />
              {deleteError ? (
                <p className="text-sm text-danger" aria-live="assertive">
                  {deleteError}
                </p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeConfirm}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border-subtle px-4 py-2 text-sm font-medium text-text transition hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={deleting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-danger px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-danger/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={deleting}
                >
                  {deleting ? 'Menghapus…' : 'Hapus sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
