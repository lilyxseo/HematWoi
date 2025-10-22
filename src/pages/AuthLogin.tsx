import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import NativeGoogleSignInButton from '../components/NativeGoogleSignInButton';
import LoginCard from '../components/auth/LoginCard';
import ErrorBoundary from '../components/system/ErrorBoundary';
import { getSession, onAuthStateChange } from '../lib/auth';
import { redirectToNativeGoogleLogin } from '../lib/native-google-login';
import { supabase } from '../lib/supabase';
import { syncGuestToCloud } from '../lib/sync';
import { formatOAuthErrorMessage } from '../lib/oauth-error';
import plannerIllustration from '../assets/avatars/planner.svg';

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
      <div className="grid min-h-[28rem] w-full animate-pulse gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="relative overflow-hidden rounded-[28px] border border-border-subtle/50 bg-primary/5 p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.35),transparent_65%)]" aria-hidden="true" />
          <div className="relative space-y-5">
            <div className="h-4 w-28 rounded-full bg-white/70" />
            <div className="h-8 w-3/4 rounded-full bg-white/80" />
            <div className="h-4 w-2/3 rounded-full bg-white/60" />
            <div className="space-y-3 pt-6">
              <div className="h-14 rounded-2xl bg-white/60" />
              <div className="h-14 rounded-2xl bg-white/50" />
              <div className="h-14 rounded-2xl bg-white/40" />
            </div>
          </div>
        </div>
        <div className="space-y-5 rounded-[28px] border border-border-subtle/60 bg-white/80 p-8 shadow-lg">
          <div className="h-5 w-1/3 rounded-full bg-surface-alt" />
          <div className="h-8 w-2/3 rounded-full bg-surface-alt/80" />
          <div className="h-4 w-1/2 rounded-full bg-surface-alt/70" />
          <div className="space-y-3 pt-6">
            <div className="h-12 rounded-2xl bg-surface-alt" />
            <div className="h-12 rounded-2xl bg-surface-alt" />
            <div className="h-12 rounded-2xl bg-surface-alt" />
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
      <main className="relative min-h-screen overflow-hidden bg-[#f5f7fb] text-text">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_55%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-12 sm:px-8 lg:px-12">
          <div className="grid gap-10 rounded-[36px] border border-border-subtle/60 bg-white/70 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-md lg:grid-cols-[1.15fr_1fr] lg:p-10">
            <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-primary/25 via-primary/10 to-primary/5 px-8 py-12 text-slate-900">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.45),transparent_60%)]"
                aria-hidden="true"
              />
              <div className="relative flex h-full flex-col justify-between gap-10">
                <div className="space-y-4">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/60 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                    HematWoi Login
                  </span>
                  <div className="space-y-3">
                    <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Otomatiskan arus kasmu setiap hari.</h1>
                    <p className="text-base text-slate-700">
                      Sinkronkan catatan keuangan dari mana saja dan temukan insight yang bikin misi hematmu makin mudah.
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute left-6 top-6 bottom-6 w-px bg-white/70" aria-hidden="true" />
                  <dl className="relative space-y-4">
                    {heroTips.map((tip, index) => (
                      <div
                        key={tip}
                        className="relative flex items-start gap-3 rounded-2xl border border-white/50 bg-white/80 p-4 shadow-sm backdrop-blur"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                          {index + 1}
                        </span>
                        <div className="space-y-1">
                          <dt className="text-sm font-semibold text-slate-900">HematWoi</dt>
                          <dd className="text-sm text-slate-600">{tip}</dd>
                        </div>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
              <figure className="pointer-events-none absolute -bottom-8 right-6 hidden w-40 rotate-3 md:block lg:w-44">
                <div className="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-lg backdrop-blur">
                  <img src={plannerIllustration} alt="Ilustrasi karakter HematWoi" className="w-full" loading="lazy" />
                </div>
              </figure>
            </section>

            <section className="flex w-full max-w-xl flex-col justify-center">
              <div className="space-y-4">
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
                  <div className="space-y-8 rounded-[32px] border border-border-subtle/70 bg-white/90 px-6 py-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:px-8 lg:px-10">
                    <header className="space-y-2 text-center sm:text-left">
                      <span className="inline-flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-muted">
                        Selamat datang kembali
                      </span>
                      <h2 className="text-2xl font-semibold text-text">Masuk untuk lanjutkan perjalanan hematmu</h2>
                    </header>
                    <LoginCard
                      defaultIdentifier={prefilledIdentifier}
                      onSuccess={handleSuccess}
                      onPasswordSignInStart={markEmailSignIn}
                      onPasswordSignInError={clearEmailSignInMarker}
                    />
                    <div className="relative text-center text-xs font-semibold uppercase tracking-[0.3em] text-muted">
                      <span className="relative inline-flex items-center px-3">
                        <span className="absolute inset-x-[-100vw] top-1/2 h-px -translate-y-1/2 bg-border-subtle/70" aria-hidden="true" />
                        <span className="relative bg-white/90 px-3">atau</span>
                      </span>
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
                        className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-border-subtle/80 bg-white px-4 text-sm font-semibold text-slate-900 shadow-md transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
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
