import { useEffect, useState } from 'react';

const buttonBase =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60';

function DeleteAccountDialog({
  open,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setValue('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (value.trim().toUpperCase() !== 'HAPUS') {
      setError('Ketik HAPUS untuk melanjutkan.');
      return;
    }
    await onConfirm();
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-3xl border border-border-subtle bg-surface shadow-lg">
        <header className="sticky top-0 z-10 border-b border-border-subtle bg-surface px-6 py-4">
          <h3 className="text-lg font-semibold text-danger">Konfirmasi hapus akun</h3>
        </header>
        <form className="flex max-h-[90vh] flex-col" onSubmit={handleSubmit}>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4 text-sm text-text">
            <p>
              Menghapus akun akan menghapus seluruh data transaksi, anggaran, hutang, langganan, dan goals secara permanen.
              Tindakan ini tidak dapat dibatalkan.
            </p>
            <p>
              Ketik <strong>HAPUS</strong> di bawah ini untuk mengonfirmasi.
            </p>
            <input
              type="text"
              className="h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="HAPUS"
              autoFocus
            />
            {error ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
            <p className="rounded-2xl border border-border-subtle bg-surface-alt/60 p-3 text-xs text-muted">
              Jika kamu mengalami kendala, hubungi support@hematwoi.app dengan subjek "Hapus akun" dan lampirkan email terdaftar.
            </p>
          </div>
          <footer className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-border-subtle bg-surface px-6 py-4">
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-border-subtle bg-surface-alt px-4 text-sm font-semibold text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-danger/60 bg-danger/90 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Menghapus...' : 'Saya mengerti, hapus akun'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

type PrivacyDataCardProps = {
  exporting: boolean;
  deleting: boolean;
  disabled: boolean;
  onExport: (format: 'json' | 'csv') => Promise<string>;
  onDelete: () => Promise<string>;
};

export default function PrivacyDataCard({ exporting, deleting, disabled, onExport, onDelete }: PrivacyDataCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleExport = async (format: 'json' | 'csv') => {
    if (disabled || exporting) return;
    setMessage(null);
    try {
      const feedback = await onExport(format);
      setMessage(feedback);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal mengekspor data.');
    }
  };

  const handleDelete = async () => {
    try {
      const feedback = await onDelete();
      setDialogOpen(false);
      setMessage(feedback);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menghapus akun.');
    }
  };

  return (
    <section className="rounded-3xl border border-border-subtle bg-surface shadow-sm" aria-labelledby="profile-privacy">
      <div className="p-4 md:p-6">
        <header className="mb-6 flex flex-col gap-1">
          <h2 id="profile-privacy" className="text-lg font-semibold text-primary">
            Privasi & Data
          </h2>
          <p className="text-sm text-muted">Unduh data kamu atau hapus akun jika diperlukan.</p>
        </header>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-primary">Ekspor data</h3>
            <p className="text-sm text-muted">
              Unduh salinan transaksi, kategori, goals, hutang, dan langganan dalam format JSON atau CSV.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={`${buttonBase} border-border-subtle bg-surface-alt text-text`}
                onClick={() => handleExport('json')}
                disabled={disabled || exporting}
              >
                {exporting ? 'Menyiapkan...' : 'Ekspor JSON'}
              </button>
              <button
                type="button"
                className={`${buttonBase} border-border-subtle bg-surface-alt text-text`}
                onClick={() => handleExport('csv')}
                disabled={disabled || exporting}
              >
                {exporting ? 'Menyiapkan...' : 'Ekspor CSV'}
              </button>
            </div>
            <p className="text-xs text-muted">
              File akan diunduh langsung ke perangkatmu. Simpan di lokasi aman untuk backup pribadi.
            </p>
          </div>
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-danger">Hapus akun</h3>
            <p className="text-sm text-muted">
              Menghapus akun akan membersihkan seluruh data. Setelah dikonfirmasi, proses membutuhkan waktu hingga 30 hari.
            </p>
            <button
              type="button"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-danger/60 bg-danger/90 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setDialogOpen(true)}
              disabled={disabled || deleting}
            >
              {deleting ? 'Memproses...' : 'Hapus akun'}
            </button>
            <p className="text-xs text-muted">
              Kamu juga dapat menghubungi support@hematwoi.app jika membutuhkan bantuan tambahan.
            </p>
          </div>
        </div>
        {message ? (
          <p className="mt-6 rounded-2xl border border-border-subtle bg-surface-alt/60 p-3 text-sm text-muted" aria-live="polite">
            {message}
          </p>
        ) : null}
      </div>
      <DeleteAccountDialog
        open={dialogOpen}
        loading={deleting}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
