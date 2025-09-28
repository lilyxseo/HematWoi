import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ErrorBoundary from '../components/system/ErrorBoundary';
import { supabase } from '../lib/supabase';
import { syncGuestToCloud } from '../lib/sync';

const DIGEST_TRIGGER_KEY = 'hw:digest:trigger';

type StatusState = 'processing' | 'error';

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusState>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const hashParams = useMemo(
    () => new URLSearchParams(location.hash ? location.hash.replace(/^#/, '') : ''),
    [location.hash]
  );
  const code = searchParams.get('code');
  const authError = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  const hasImplicitSession = Boolean(accessToken && refreshToken);

  useEffect(() => {
    let cancelled = false;

    const markOnlineMode = () => {
      try {
        localStorage.setItem('hw:connectionMode', 'online');
        localStorage.setItem('hw:mode', 'online');
        localStorage.setItem(DIGEST_TRIGGER_KEY, '1');
      } catch {
        /* ignore */
      }
    };

    const syncSession = async (userId: string | null) => {
      if (!userId) return;
      try {
        await syncGuestToCloud(supabase, userId);
      } catch (error) {
        console.error('[AuthCallback] Failed to sync guest data', error);
      }
    };

    const handleSuccess = (userId: string | null) => {
      markOnlineMode();
      void syncSession(userId);
      if (!cancelled) {
        navigate('/', { replace: true });
      }
    };

    const exchange = async (authCode: string) => {
      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);
        if (error) throw error;
        handleSuccess(data.session?.user?.id ?? null);
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : 'Gagal menukarkan kode sesi. Silakan coba lagi.';
        setErrorMessage(message);
        setStatus('error');
      }
    };

    const restore = async (access: string, refresh: string) => {
      try {
        const { data, error } = await supabase.auth.setSession({
          access_token: access,
          refresh_token: refresh,
        });
        if (error) throw error;
        handleSuccess(data.session?.user?.id ?? null);
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : 'Gagal memulihkan sesi. Silakan coba lagi.';
        setErrorMessage(message);
        setStatus('error');
      }
    };

    const ensureExistingSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return data.session?.user?.id ?? null;
      } catch (error) {
        console.error('[AuthCallback] Failed to read existing session', error);
        return null;
      }
    };

    const run = async () => {
      if (authError) {
        const message = errorDescription || 'Login dengan Google dibatalkan. Silakan coba lagi.';
        setErrorMessage(message);
        setStatus('error');
        return;
      }

      if (code) {
        await exchange(code);
        return;
      }

      if (hasImplicitSession && accessToken && refreshToken) {
        await restore(accessToken, refreshToken);
        return;
      }

      const existingUserId = await ensureExistingSession();
      if (cancelled) return;

      if (existingUserId) {
        handleSuccess(existingUserId);
        return;
      }

      setErrorMessage('Kode otorisasi tidak ditemukan. Silakan coba login ulang.');
      setStatus('error');
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    authError,
    code,
    errorDescription,
    hasImplicitSession,
    navigate,
    refreshToken,
  ]);

  const handleRetry = () => {
    navigate('/auth', { replace: true });
  };

  return (
    <ErrorBoundary>
      <main className="flex min-h-screen items-center justify-center bg-surface-alt px-6 py-16 text-text">
        <div className="w-full max-w-md space-y-4 rounded-3xl border border-border-subtle bg-surface p-8 text-center shadow-sm">
          {status === 'processing' ? (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border-subtle">
                <span
                  className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
                  aria-hidden="true"
                />
              </div>
              <div className="space-y-2">
                <h1 className="text-lg font-semibold">Menghubungkan akun…</h1>
                <p className="text-sm text-muted">
                  Kami sedang menuntaskan sesi loginmu. Jangan tutup halaman ini.
                </p>
              </div>
            </>
          ) : null}
          {status === 'error' ? (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-danger/30 bg-danger/10 text-danger">
                !
              </div>
              <div className="space-y-2">
                <h1 className="text-lg font-semibold">Gagal menghubungkan</h1>
                <p className="text-sm text-danger" aria-live="assertive">
                  {errorMessage}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-border-subtle bg-surface-alt px-4 text-sm font-semibold text-text transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                Kembali ke halaman masuk
              </button>
            </>
          ) : null}
        </div>
      </main>
    </ErrorBoundary>
  );
}
