import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LoginCard from '../components/auth/LoginCard';
import ErrorBoundary from '../components/system/ErrorBoundary';
import { getSession, onAuthStateChange } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { syncGuestToCloud } from '../lib/sync';

const heroTips = [
  'Pantau cash flow harian tanpa ribet.',
  'Sinkronkan data lintas perangkat secara otomatis.',
  'Dapatkan insight pintar untuk capai tujuan finansial.',
];

export default function AuthLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [prefilledIdentifier] = useState(() => {
    try {
      return localStorage.getItem('hw:lastEmail') ?? '';
    } catch {
      return '';
    }
  });
  const syncGuestData = useCallback(async (userId?: string | null) => {
    if (!userId) return;
    try {
      await syncGuestToCloud(supabase, userId);
    } catch (error) {
      console.error('[AuthLogin] Gagal memindahkan data tamu ke cloud', error);
    }
  }, []);
  const handleContinueAsGuest = useCallback(() => {
    try {
      localStorage.setItem('hw:connectionMode', 'local');
      localStorage.setItem('hw:mode', 'local');
    } catch {
      /* ignore */
    }
    navigate('/', { replace: true });
  }, [navigate]);

  useEffect(() => {
    let isMounted = true;
    const checkSession = async () => {
      try {
        const session = await getSession();
        if (!isMounted) return;
        if (session) {
          navigate('/', { replace: true });
          return;
        }
        setChecking(false);
      } catch (error) {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : 'Tidak dapat memuat sesi.';
        setSessionError(message);
        setChecking(false);
      }
    };
    checkSession();

    const { data: listener } = onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        try {
          localStorage.setItem('hw:connectionMode', 'online');
          localStorage.setItem('hw:mode', 'online');
        } catch {
          /* ignore */
        }
        void syncGuestData(session.user?.id ?? null);
        if (location.pathname === '/auth') {
          navigate('/', { replace: true });
        }
      }
    });

    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [location.pathname, navigate, syncGuestData]);

  const skeleton = useMemo(
    () => (
      <div className="w-full max-w-md animate-pulse rounded-3xl border border-border-subtle bg-surface p-8 shadow-sm">
        <div className="space-y-4">
          <div className="h-6 w-3/4 rounded-full bg-surface-alt" />
          <div className="h-4 w-1/2 rounded-full bg-surface-alt" />
          <div className="space-y-3 pt-2">
            <div className="h-11 rounded-2xl bg-surface-alt" />
            <div className="h-11 rounded-2xl bg-surface-alt" />
            <div className="h-11 rounded-2xl bg-surface-alt" />
          </div>
        </div>
      </div>
    ),
    []
  );

  const handleSuccess = useCallback(async () => {
    try {
      localStorage.setItem('hw:connectionMode', 'online');
      localStorage.setItem('hw:mode', 'online');
    } catch {
      /* ignore */
    }
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id ?? null;
      if (uid) {
        void syncGuestData(uid);
      }
    } catch (error) {
      console.error('[AuthLogin] Gagal membaca sesi setelah login', error);
    }
    navigate('/', { replace: true });
  }, [navigate, syncGuestData]);

  return (
    <ErrorBoundary>
      <main className="min-h-screen bg-surface-alt px-6 py-12 text-text transition-colors sm:py-16">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
          <section className="flex flex-1 flex-col items-center gap-6 text-center lg:items-start lg:text-left">
            <div className="inline-flex items-center rounded-full border border-border-subtle bg-surface px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Mode Online
            </div>
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-text sm:text-4xl">
                Selamat datang kembali di HematWoi
              </h1>
              <p className="max-w-lg text-base text-muted">
                Masuk untuk menyinkronkan transaksi, meninjau anggaran, dan tetap on-track dengan tujuan finansialmu.
              </p>
            </div>
            <ul className="hidden w-full max-w-lg space-y-3 text-left text-sm text-text md:block">
              {heroTips.map((tip) => (
                <li key={tip} className="flex items-start gap-3 rounded-2xl border border-border-subtle/60 bg-surface px-4 py-3 shadow-sm">
                  <span className="mt-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    ✓
                  </span>
                  <span className="text-sm text-text">{tip}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-md space-y-4">
              {sessionError ? (
                <div className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger" aria-live="polite">
                  {sessionError}
                </div>
              ) : null}
              {checking ? (
                skeleton
              ) : (
                <LoginCard defaultIdentifier={prefilledIdentifier} onSuccess={handleSuccess} />
              )}
              <div className="rounded-3xl border border-border-subtle bg-surface px-5 py-4 shadow-sm">
                <div className="space-y-3 text-center">
                  <div>
                    <p className="text-sm font-semibold text-text">Gunakan tanpa akun</p>
                    <p className="mt-1 text-xs text-muted">
                      Data kamu akan disimpan di perangkat ini dan otomatis dipindah ke cloud saat kamu masuk nanti.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleContinueAsGuest}
                    className="btn btn-secondary w-full"
                  >
                    Lanjut sebagai tamu
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </ErrorBoundary>
  );
}
