import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const PENDING_KEY = 'hw:digest:pending';

type CallbackState =
  | { status: 'idle'; message: string | null }
  | { status: 'loading'; message: string | null }
  | { status: 'error'; message: string };

function setDigestPending() {
  try {
    window.sessionStorage.setItem(PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<CallbackState>({ status: 'idle', message: null });
  const code = searchParams.get('code');
  const authError = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const derivedError = useMemo(() => {
    if (!authError) return null;
    if (authError === 'access_denied') {
      return 'Akses Google dibatalkan. Silakan coba lagi atau masuk dengan metode lain.';
    }
    return errorDescription || 'Login dengan Google gagal. Coba ulang beberapa saat lagi.';
  }, [authError, errorDescription]);

  const exchange = useCallback(async () => {
    if (derivedError) {
      setState({ status: 'error', message: derivedError });
      return;
    }
    if (!code) {
      setState({ status: 'error', message: 'Kode otorisasi tidak ditemukan.' });
      return;
    }
    setState({ status: 'loading', message: null });
    try {
      const { error } = await supabase.auth.exchangeCodeForSession({ code });
      if (error) {
        throw error;
      }
      setDigestPending();
      navigate('/', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menukar kode login. Coba lagi.';
      setState({ status: 'error', message });
    }
  }, [code, derivedError, navigate]);

  useEffect(() => {
    void exchange();
  }, [exchange]);

  const handleRetry = useCallback(() => {
    void exchange();
  }, [exchange]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-alt px-4 py-12 text-text">
      <div className="w-full max-w-md rounded-3xl border border-border-subtle bg-surface p-8 shadow-sm">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border-subtle bg-surface-alt">
            <span className="text-xl">🔄</span>
          </div>
          <h1 className="text-xl font-semibold">Memproses login…</h1>
          {state.status === 'loading' ? (
            <p className="text-sm text-muted">Sedang menukar kode otorisasi menjadi sesi aman.</p>
          ) : null}
          {state.status === 'error' ? (
            <div className="space-y-3 text-left">
              <div className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {state.message}
              </div>
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-brand px-4 text-sm font-semibold text-brand-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
              >
                Coba lagi
              </button>
              <button
                type="button"
                onClick={() => navigate('/auth', { replace: true })}
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-border px-4 text-sm font-semibold text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
              >
                Kembali ke login manual
              </button>
            </div>
          ) : null}
          {state.status === 'loading' ? (
            <div className="mx-auto mt-4 h-10 w-10 animate-spin rounded-full border-4 border-border/60 border-t-brand" aria-hidden />
          ) : null}
        </div>
      </div>
    </main>
  );
}
