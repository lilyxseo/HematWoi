import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import heroIllustration from '../assets/hero-reports.png';
import NativeGoogleSignInButton from '../components/NativeGoogleSignInButton';
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
      <div className="animate-pulse space-y-6">
        <div className="space-y-3">
          <div className="h-5 w-24 rounded-full bg-surface-alt/80" />
          <div className="h-8 w-2/3 rounded-full bg-surface-alt/80" />
          <div className="h-4 w-3/4 rounded-full bg-surface-alt/60" />
        </div>
        <div className="space-y-3">
          <div className="h-12 rounded-2xl bg-surface-alt/70" />
          <div className="h-12 rounded-2xl bg-surface-alt/60" />
          <div className="h-12 rounded-2xl bg-surface-alt/50" />
        </div>
        <div className="h-10 rounded-full bg-surface-alt/70" />
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
      <main className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-surface via-surface-alt to-surface text-text transition-colors lg:flex-row">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-1/3 top-20 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-15%] h-[32rem] w-[32rem] rounded-full bg-info/10 blur-3xl" />
        </div>

        <section className="flex w-full flex-1 items-center justify-center px-6 py-14 sm:px-10 lg:w-1/2 lg:py-16">
          <div className="w-full max-w-lg space-y-10">
            <div className="space-y-3 text-center lg:text-left">
              <span className="inline-flex items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                Selamat datang kembali
              </span>
              <h1 className="text-3xl font-semibold leading-tight text-text sm:text-4xl">
                Atur keuangan dengan percaya diri setiap hari.
              </h1>
              <p className="text-base text-muted">
                Masuk untuk mengakses ringkasan cash flow, laporan pintar, dan tools hemat andalanmu di HematWoi.
              </p>
            </div>
            <div className="space-y-4 rounded-[32px] border border-border-subtle/60 bg-surface/95 p-6 shadow-xl backdrop-blur-sm sm:p-8">
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
                <>
                  <header className="space-y-2 text-center sm:text-left">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Masuk ke akunmu</p>
                    <h2 className="text-2xl font-semibold text-text">Lanjutkan perjalanan finansialmu bersama HematWoi</h2>
                  </header>
                  <LoginCard
                    defaultIdentifier={prefilledIdentifier}
                    onSuccess={handleSuccess}
                    onPasswordSignInStart={markEmailSignIn}
                    onPasswordSignInError={clearEmailSignInMarker}
                  />
                  <div className="relative">
                    <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 border-t border-border-subtle/60" aria-hidden="true" />
                    <div className="relative mx-auto w-max bg-surface px-4 text-xs font-semibold uppercase tracking-[0.3em] text-muted">
                      atau
                    </div>
                  </div>
                  <div className="space-y-3">
                    <NativeGoogleSignInButton
                      onWebLogin={handleGoogleWebSignIn}
                      disabled={googleLoading}
                      onNativeSuccess={(response) => {
                        setGoogleError(null);
                        setGoogleLoading(false);
                        void syncGuestData(response?.user?.id ?? response?.session?.user?.id ?? null);
                      }}
                      onNativeError={(message) => {
                        setGoogleLoading(false);
                        setGoogleError(message);
                      }}
                      className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-border-subtle bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
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
                    </NativeGoogleSignInButton>
                    <p className="text-xs text-muted">
                      Jika pop-up tertutup, tekan tombol lagi atau lanjutkan dengan email yang kamu gunakan sehari-hari.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="relative hidden w-full flex-1 overflow-hidden bg-gradient-to-br from-primary to-primary/70 text-white lg:flex">
          <div className="absolute inset-0">
            <div className="absolute -left-32 top-28 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-[-6rem] right-[-3rem] h-[26rem] w-[26rem] rounded-full bg-info/20 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.2),transparent_55%)]" />
          </div>
          <div className="relative z-10 flex w-full flex-col justify-between gap-12 px-12 py-16">
            <div className="space-y-4">
              <p className="inline-flex items-center rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
                HematWoi Dashboard
              </p>
              <h2 className="text-3xl font-semibold leading-tight lg:text-4xl">
                Kelola tim keuanganmu dan pantau performa secara realtime.
              </h2>
              <p className="text-sm text-white/80">
                Ringkasan saldo, laporan otomatis, dan insight cerdas membantu kamu mengambil keputusan lebih cepat.
              </p>
            </div>
            <div className="relative mx-auto w-full max-w-md">
              <div className="absolute inset-0 rounded-[36px] bg-white/20 blur-2xl" aria-hidden="true" />
              <img
                src={heroIllustration}
                alt="Pratinjau dashboard HematWoi"
                className="relative rounded-[28px] border border-white/30 shadow-2xl"
              />
            </div>
            <dl className="grid gap-4 sm:grid-cols-3">
              {heroTips.map((tip) => (
                <div key={tip} className="rounded-3xl border border-white/20 bg-white/10 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-widest text-white/70">Insight</dt>
                  <dd className="mt-2 text-sm text-white">{tip}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
    </ErrorBoundary>
  );
}
