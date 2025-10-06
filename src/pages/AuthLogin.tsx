import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GoogleLoginButton from '../components/GoogleLoginButton';
import LoginCard from '../components/auth/LoginCard';
import ErrorBoundary from '../components/system/ErrorBoundary';
import { getSession, onAuthStateChange } from '../lib/auth';
import { redirectToNativeGoogleLogin } from '../lib/native-google-login';
import { supabase } from '../lib/supabase';
import { syncGuestToCloud } from '../lib/sync';
import { formatOAuthErrorMessage } from '../lib/oauth-error';

const heroTips = [
  'Pantau cash flow harian tanpa ribet.',
  'Sinkronkan data lintas perangkat secara otomatis.',
  'Dapatkan insight pintar untuk capai tujuan finansial.',
];

const heroHighlights = [
  { value: '15K+', label: 'Pengguna aktif', description: 'yang konsisten mengelola finansial' },
  { value: '98%', label: 'Tingkat kepuasan', description: 'berdasarkan survei internal 2024' },
];

export default function AuthLogin() {
  const location = useLocation();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const lastSignInMethodRef = useRef<'google' | 'email' | null>(null);
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

  const markEmailSignIn = useCallback(() => {
    lastSignInMethodRef.current = 'email';
  }, []);

  const clearEmailSignInMarker = useCallback(() => {
    if (lastSignInMethodRef.current === 'email') {
      lastSignInMethodRef.current = null;
    }
  }, []);

  const handleGoogleWebSignIn = useCallback(async () => {
    if (googleLoading) return;
    setGoogleError(null);
    setGoogleLoading(true);
    lastSignInMethodRef.current = 'google';

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: googleRedirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) throw error;
    } catch (error) {
      lastSignInMethodRef.current = null;
      const message = formatOAuthErrorMessage(
        error,
        'Gagal memulai proses login Google. Silakan coba lagi.'
      );
      setGoogleError(message);
      setGoogleLoading(false);
    }
  }, [googleLoading, googleRedirectTo]);

  const handlePostLoginNavigation = useCallback(
    (provider?: string | null) => {
      const method = lastSignInMethodRef.current ?? provider ?? null;

      if (method === 'google') {
        lastSignInMethodRef.current = null;
        redirectToNativeGoogleLogin();
        return;
      }

      if (method === 'email') {
        if (typeof window !== 'undefined') {
          window.setTimeout(() => {
            if (lastSignInMethodRef.current === 'email') {
              lastSignInMethodRef.current = null;
            }
          }, 1000);
        } else {
          lastSignInMethodRef.current = null;
        }
      } else {
        lastSignInMethodRef.current = null;
      }
      navigate('/', { replace: true });
    },
    [navigate]
  );

  useEffect(() => {
    let isMounted = true;
    const checkSession = async () => {
      try {
        const session = await getSession();
        if (!isMounted) return;
        if (session) {
          handlePostLoginNavigation(session.user?.app_metadata?.provider ?? null);
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
          handlePostLoginNavigation(session.user?.app_metadata?.provider ?? null);
        }
      }
    });

    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [handlePostLoginNavigation, location.pathname, syncGuestData]);

  const skeleton = useMemo(
    () => (
      <div className="grid w-full animate-pulse gap-8 lg:grid-cols-[1.05fr_minmax(0,0.95fr)]">
        <div className="space-y-6">
          <div className="rounded-[2.5rem] border border-border-subtle bg-surface p-6 shadow-sm">
            <div className="space-y-4">
              <div className="h-6 w-24 rounded-full bg-surface-alt" />
              <div className="h-10 w-3/4 rounded-full bg-surface-alt" />
              <div className="h-4 w-full rounded-full bg-surface-alt" />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="h-16 rounded-3xl bg-surface-alt" />
              <div className="h-16 rounded-3xl bg-surface-alt" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-20 rounded-3xl border border-border-subtle bg-surface" />
            <div className="h-20 rounded-3xl border border-border-subtle bg-surface" />
          </div>
        </div>
        <div className="rounded-[2.5rem] border border-border-subtle bg-surface p-6 shadow-sm">
          <div className="space-y-4">
            <div className="h-6 w-1/3 rounded-full bg-surface-alt" />
            <div className="h-4 w-2/3 rounded-full bg-surface-alt" />
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
    lastSignInMethodRef.current = 'email';
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
      handlePostLoginNavigation('email');
      return;
    } catch (error) {
      console.error('[AuthLogin] Gagal membaca sesi setelah login', error);
    }
    handlePostLoginNavigation('email');
  }, [handlePostLoginNavigation, syncGuestData]);

  return (
    <ErrorBoundary>
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-surface via-surface to-surface-alt text-text">
        <div className="pointer-events-none absolute inset-x-0 -top-40 h-72 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent blur-3xl" aria-hidden="true" />
        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-12 sm:px-8 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[1.05fr_minmax(0,0.95fr)] lg:items-stretch">
            <section className="flex flex-col gap-8">
              <div className="rounded-[2.5rem] border border-border-subtle/60 bg-gradient-to-br from-primary/15 via-surface to-surface-alt p-6 shadow-lg sm:p-8">
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                  Mode online yang aman
                </div>
                <div className="mt-6 space-y-4">
                  <h1 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
                    Kendalikan finansialmu dengan pengalaman login terbaru
                  </h1>
                  <p className="text-base text-muted sm:text-lg">
                    Kelola anggaran, pantau pengeluaran, dan lanjutkan perjalanan finansialmu kapan pun diakses lewat perangkat favoritmu.
                  </p>
                </div>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {heroHighlights.map((item) => (
                    <div key={item.label} className="rounded-3xl border border-primary/20 bg-surface/90 p-4 backdrop-blur">
                      <div className="text-2xl font-semibold text-primary">{item.value}</div>
                      <div className="text-sm font-medium text-text">{item.label}</div>
                      <p className="mt-1 text-xs text-muted">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {heroTips.map((tip) => (
                  <li
                    key={tip}
                    className="flex items-start gap-3 rounded-3xl border border-border-subtle/60 bg-surface/95 px-4 py-4 shadow-sm backdrop-blur"
                  >
                    <span className="mt-1 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      ✓
                    </span>
                    <span className="text-sm text-text/90">{tip}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col justify-center">
              <div className="w-full space-y-6 rounded-[2.5rem] border border-border-subtle/80 bg-surface/95 p-6 shadow-xl backdrop-blur-sm sm:p-8">
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
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
                    <div className="flex-1">
                      <LoginCard
                        defaultIdentifier={prefilledIdentifier}
                        onSuccess={handleSuccess}
                        onPasswordSignInStart={markEmailSignIn}
                        onPasswordSignInError={clearEmailSignInMarker}
                      />
                    </div>
                    <div className="flex flex-1 flex-col justify-between rounded-3xl border border-border-subtle bg-surface px-5 py-6 text-center shadow-sm">
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
                          className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-2xl border border-border-subtle bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-70"
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
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </ErrorBoundary>
  );
}
