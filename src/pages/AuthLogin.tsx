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

const heroIllustration = new URL('../assets/login-hero.png', import.meta.url).href;

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
      <div className="grid animate-pulse gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-6 rounded-[32px] border border-border-subtle/60 bg-surface p-8 shadow-lg">
          <div className="space-y-4">
            <div className="h-6 w-24 rounded-full bg-surface-alt" />
            <div className="h-8 w-2/3 rounded-full bg-surface-alt" />
            <div className="h-4 w-full rounded-full bg-surface-alt" />
          </div>
          <div className="h-12 rounded-2xl bg-surface-alt/80" />
          <div className="h-12 rounded-2xl bg-surface-alt/80" />
          <div className="h-12 rounded-2xl bg-surface-alt/80" />
        </div>
        <div className="rounded-[40px] border border-primary/30 bg-primary/20 p-8">
          <div className="h-full rounded-3xl bg-primary/30" />
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
      <main className="relative min-h-screen bg-surface px-6 py-12 text-text transition-colors sm:py-16">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,theme(colors.primary/10),transparent_55%)]" aria-hidden="true" />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:min-h-[70vh] lg:grid-cols-[minmax(0,420px)_1fr]">
          <section className="order-2 flex flex-col justify-center gap-6 rounded-[36px] bg-surface-alt/60 p-6 shadow-lg backdrop-blur lg:order-1 lg:p-12">
            <header className="space-y-3 text-center lg:text-left">
              <div className="inline-flex items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                HematWoi
              </div>
              <h1 className="text-3xl font-semibold leading-tight text-text sm:text-4xl">
                Selamat datang kembali 👋
              </h1>
              <p className="text-sm text-muted sm:text-base">
                Masuk untuk melanjutkan pencatatan finansialmu dan kelola pengeluaran harian dengan bantuan dashboard HematWoi.
              </p>
            </header>

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
            </div>

            {checking ? (
              skeleton
            ) : (
              <div className="space-y-6">
                <div className="space-y-4 rounded-[28px] border border-border-subtle/70 bg-surface p-6 shadow-xl sm:p-8">
                  <header className="space-y-1 text-center sm:text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.36em] text-muted">Masuk</p>
                    <h2 className="text-2xl font-semibold text-text">Gunakan email atau Google untuk melanjutkan</h2>
                  </header>
                  <LoginCard
                    defaultIdentifier={prefilledIdentifier}
                    onSuccess={handleSuccess}
                    onPasswordSignInStart={markEmailSignIn}
                    onPasswordSignInError={clearEmailSignInMarker}
                  />
                  <div className="relative">
                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 border-t border-border-subtle/60" aria-hidden="true" />
                    <div className="relative mx-auto w-max bg-surface px-3 text-[11px] font-semibold uppercase tracking-[0.36em] text-muted">
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
                </div>
                <dl className="grid gap-3 text-left sm:grid-cols-3">
                  {heroTips.map((tip) => (
                    <div key={tip} className="rounded-2xl border border-border-subtle/60 bg-surface-alt/70 p-4">
                      <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Insight Hemat</dt>
                      <dd className="mt-2 text-sm text-text">{tip}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </section>

          <section className="order-1 flex h-full items-stretch justify-center lg:order-2">
            <div className="relative w-full overflow-hidden rounded-[44px] bg-gradient-to-br from-primary via-primary/95 to-indigo-600 p-10 text-white shadow-[0_40px_120px_-40px_rgba(44,82,130,0.6)]">
              <div className="flex h-full flex-col justify-between gap-8">
                <header className="space-y-4">
                  <span className="inline-flex items-center rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
                    Dashboard Pintar
                  </span>
                  <div className="space-y-3">
                    <h2 className="text-3xl font-semibold leading-tight">Kelola keuangan tim & usahamu tanpa ribet</h2>
                    <p className="text-sm text-white/80 sm:text-base">
                      Pantau arus kas, target tabungan, dan performa pengeluaran kapan pun dengan visual yang jelas.
                    </p>
                  </div>
                </header>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-0 rounded-[36px] bg-white/10 blur-2xl" aria-hidden="true" />
                  <img
                    src={heroIllustration}
                    alt="Ilustrasi dashboard HematWoi"
                    className="relative z-[1] w-full max-w-[480px] rounded-[32px] border border-white/20 bg-white/5 shadow-2xl"
                    loading="lazy"
                  />
                </div>
              </div>
              <div className="pointer-events-none absolute -right-24 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
              <div className="pointer-events-none absolute -bottom-20 -left-16 h-72 w-72 rounded-full bg-indigo-400/30 blur-3xl" aria-hidden="true" />
            </div>
          </section>
        </div>
      </main>
    </ErrorBoundary>
  );
}
