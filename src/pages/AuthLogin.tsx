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
      <div className="flex w-full animate-pulse flex-col gap-4 lg:grid lg:grid-cols-5">
        <div className="rounded-3xl border border-border-subtle bg-surface p-6 shadow-sm lg:col-span-3">
          <div className="space-y-5">
            <div className="h-6 w-1/3 rounded-full bg-surface-alt" />
            <div className="space-y-3">
              <div className="h-11 rounded-2xl bg-surface-alt" />
              <div className="h-11 rounded-2xl bg-surface-alt" />
              <div className="h-11 rounded-2xl bg-surface-alt" />
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-border-subtle bg-surface p-6 shadow-sm lg:col-span-2">
          <div className="space-y-4 text-center lg:text-left">
            <div className="mx-auto h-10 w-10 rounded-full bg-surface-alt lg:mx-0" />
            <div className="h-4 w-1/2 rounded-full bg-surface-alt" />
            <div className="h-8 rounded-2xl bg-surface-alt" />
            <div className="h-3 w-3/4 rounded-full bg-surface-alt" />
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
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-surface via-surface-alt to-surface px-6 py-12 text-text transition-colors sm:px-10 lg:px-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_55%)]"
        />
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
          <section className="w-full space-y-8 lg:max-w-xl">
            <div className="overflow-hidden rounded-[2.25rem] border border-border-subtle/60 bg-gradient-to-br from-primary/20 via-surface to-surface-alt p-8 shadow-lg">
              <div className="inline-flex items-center rounded-full bg-surface/70 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                Aman & tersinkronisasi
              </div>
              <div className="mt-6 space-y-4 text-center lg:text-left">
                <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Kelola keuanganmu dengan percaya diri</h1>
                <p className="text-base text-muted">
                  Masuk untuk menyatukan transaksi dari semua perangkat, menjaga anggaran tetap teratur, dan memantau progres finansialmu kapan pun.
                </p>
              </div>
            </div>
            <ul className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:pb-0">
              {heroTips.map((tip) => (
                <li
                  key={tip}
                  className="min-w-[230px] snap-start rounded-3xl border border-border-subtle/60 bg-surface px-5 py-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    </span>
                    <span className="text-sm font-medium text-text/90">{tip}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="w-full lg:max-w-xl xl:max-w-2xl">
            <div className="relative overflow-hidden rounded-[2.25rem] border border-border-subtle/60 bg-surface shadow-xl">
              <div
                aria-hidden="true"
                className="absolute -top-24 right-0 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
              />
              <div className="relative space-y-6 p-6 sm:p-8">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-text">Masuk ke HematWoi</h2>
                  <p className="text-sm text-muted">Gunakan email atau akun Google untuk melanjutkan pengalaman hematmu.</p>
                </div>
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
                  <div className="flex flex-col gap-4 lg:grid lg:grid-cols-5">
                    <div className="lg:col-span-3">
                      <LoginCard
                        defaultIdentifier={prefilledIdentifier}
                        onSuccess={handleSuccess}
                        onPasswordSignInStart={markEmailSignIn}
                        onPasswordSignInError={clearEmailSignInMarker}
                      />
                    </div>
                    <div className="flex flex-col justify-between rounded-3xl border border-border-subtle bg-surface-alt/60 p-6 text-center shadow-sm transition lg:col-span-2 lg:text-left">
                      <div className="space-y-4">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary lg:mx-0">
                          <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              fill="currentColor"
                              d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm1 17.93V19h-2v.93A8.012 8.012 0 0 1 4.07 13H5v-2h-.93A8.012 8.012 0 0 1 11 4.07V5h2v-.93A8.012 8.012 0 0 1 19.93 11H19v2h.93A8.012 8.012 0 0 1 13 19.93ZM15 11h-2V7h-2v6h4Z"
                            />
                          </svg>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-base font-semibold text-text">Masuk instan</h3>
                          <p className="text-sm text-muted">Login sekali, tetap sinkron, dan nikmati backup otomatis di semua perangkat.</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <GoogleLoginButton
                          onWebLogin={handleGoogleWebSignIn}
                          disabled={googleLoading}
                          className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-2xl border border-border-subtle bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-70"
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
                          Jika pop-up tertutup, tekan tombol lagi atau pilih metode email di samping.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </ErrorBoundary>
  );
}
