import { useEffect, useState } from 'react';
import ErrorBoundary from '../components/system/ErrorBoundary';
import { isHematWoiApp } from '../lib/ua';

export default function NativeGoogleLogin() {
  const [inApp, setInApp] = useState(false);
  const [manualNotice, setManualNotice] = useState(false);

  useEffect(() => {
    setInApp(isHematWoiApp());
  }, []);

  const handleContinue = () => {
    try {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch {
      /* ignore */
    }
    setManualNotice(true);
  };

  return (
    <ErrorBoundary>
      <main className="flex min-h-screen items-center justify-center bg-surface-alt px-6 py-16 text-text">
        <div className="w-full max-w-md space-y-6 rounded-3xl border border-border-subtle bg-surface p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-success/40 bg-success/10 text-success">
            ✓
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-semibold">Login berhasil</h1>
            <p className="text-sm text-muted">
              {inApp
                ? 'Kamu sudah berhasil login di HematWoi App. Tutup jendela ini atau pilih tombol di bawah untuk melanjutkan.'
                : 'Kamu sudah masuk ke HematWoi. Pilih tombol di bawah untuk menuju dashboard.'}
            </p>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleContinue}
              className="w-full rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              {inApp ? 'Kembali ke aplikasi' : 'Masuk ke dashboard'}
            </button>
            {inApp && manualNotice ? (
              <p className="text-xs text-muted">
                Jika aplikasi belum berubah, tutup jendela ini secara manual lalu kembali ke HematWoi.
              </p>
            ) : null}
          </div>
        </div>
      </main>
    </ErrorBoundary>
  );
}
