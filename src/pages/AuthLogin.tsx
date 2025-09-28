import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GoogleLoginButton from '../components/GoogleLoginButton';
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const googleRedirectTo = useMemo(() => {
    const env = typeof import.meta !== 'undefined' ? import.meta.env ?? {} : {};
    const configuredBase =
      (typeof env.VITE_SUPABASE_REDIRECT_URL === 'string' && env.VITE_SUPABASE_REDIRECT_URL) ||
      (typeof env.VITE_APP_URL === 'string' && env.VITE_APP_URL) ||
      (typeof env.VITE_PUBLIC_SITE_URL === 'string' && env.VITE_PUBLIC_SITE_URL) ||
      undefined;
    const fallbackOrigin =
      typeof window !== 'undefined' && /^https?:\/\//.test(window.location.origin)
        ? window.location.origin
        : undefined;
    const base = configuredBase ?? fallbackOrigin;
    if (!base) return undefined;
    try {
      return new URL('/auth/callback', base).toString();
    } catch {
      return base;
    }
  }, []);
  const syncGuestData = useCallback(async (userId?: string | null) => {
    if (!userId) return;
    try {
      await syncGuestToCloud(supabase, userId);
    } catch (error) {
      console.error('[AuthLogin] Gagal memindahkan data tamu ke cloud', error);
    }
  }, []);

  const handleGoogleWebSignIn = useCallback(async () => {
    if (googleLoading) return;
    setGoogleError(null);
    setGoogleLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: googleRedirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          flowType: 'pkce',
        },
      });
      if (error) throw error;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal memulai proses login Google. Silakan coba lagi.';
      setGoogleError(message);
      setGoogleLoading(false);
    }
  }, [googleLoading, googleRedirectTo]);

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
      <div className="grid w-full animate-pulse gap-4 md:grid-cols-5">
        <div className="rounded-3xl border border-border-subtle bg-surface p-6 shadow-sm md:col-span-2">
          <div className="space-y-4 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-surface-alt" />
            <div className="mx-auto h-4 w-24 rounded-full bg-surface-alt" />
            <div className="mx-auto h-3 w-3/4 rounded-full bg-surface-alt" />
            <div className="mx-auto h-10 w-full rounded-2xl bg-surface-alt" />
          </div>
        </div>
        <div className="rounded-3xl border border-border-subtle bg-surface p-6 shadow-sm md:col-span-3">
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
      <main className="min-h-screen bg-gradient-to-b from-surface-alt via-surface-alt to-surface px-6 py-12 text-text transition-colors sm:py-16">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
          <section className="flex flex-1 flex-col gap-6">
            <div className="rounded-3xl border border-border-subtle/60 bg-gradient-to-br from-primary/10 via-surface to-surface-alt p-6 shadow-sm">
              <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                Mode online yang aman
              </div>
              <div className="mt-6 space-y-3 text-center sm:text-left">
                <h1 className="text-3xl font-semibold sm:text-4xl">Selamat datang kembali di HematWoi</h1>
                <p className="text-base text-muted">
                  Sinkronkan transaksi, kelola anggaran, dan capai tujuan finansialmu dengan pengalaman login yang lebih mulus.
                </p>
              </div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {heroTips.map((tip) => (
                <li
                  key={tip}
                  className="flex items-start gap-3 rounded-3xl border border-border-subtle/60 bg-surface px-4 py-3 shadow-sm"
                >
                  <span className="mt-1 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    ✓
                  </span>
                  <span className="text-sm text-text">{tip}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-2xl space-y-6">
              {sessionError ? (
                <div className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger" aria-live="polite">
                  {sessionError}
                </div>
              ) : null}
              {googleError ? (
                <div className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger" aria-live="assertive">
                  {googleError}
                </div>
              ) : null}
              {checking ? (
                skeleton
              ) : (
                <div className="grid gap-4 md:grid-cols-5">
                  <div className="flex flex-col justify-between rounded-3xl border border-border-subtle bg-surface p-6 text-center shadow-sm md:col-span-2">
                    <div className="space-y-4">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="currentColor"
                            d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm1 17.93V19h-2v.93A8.012 8.012 0 0 1 4.07 13H5v-2h-.93A8.012 8.012 0 0 1 11 4.07V5h2v-.93A8.012 8.012 0 0 1 19.93 11H19v2h.93A8.012 8.012 0 0 1 13 19.93ZM15 11h-2V7h-2v6h4Z"
                          />
                        </svg>
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-lg font-semibold text-text">Masuk instan</h2>
                        <p className="text-sm text-muted">
                          Gunakan akun Google kamu untuk terhubung lebih cepat dan aman.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <GoogleLoginButton
                        onWebLogin={handleGoogleWebSignIn}
                        disabled={googleLoading}
                        className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-2xl border border-border-subtle bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {googleLoading ? (
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" aria-hidden="true" />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-base font-semibold text-[#4285F4]"
                          >
                            G
                          </span>
                        )}
                        <span>{googleLoading ? 'Menghubungkan…' : 'Lanjutkan dengan Google'}</span>
                      </GoogleLoginButton>
                      <p className="text-xs text-muted">
                        Jika pop-up tertutup, cukup tekan tombol lagi atau pilih metode email di samping.
                      </p>
                    </div>
                  </div>
                  <div className="md:col-span-3">
                    <LoginCard defaultIdentifier={prefilledIdentifier} onSuccess={handleSuccess} />
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </ErrorBoundary>
  );
}
