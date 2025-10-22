import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import heroLogo from '../assets/logo-placeholder.svg';
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
      <div className="space-y-6 rounded-[32px] border border-border-subtle/60 bg-surface/80 p-8 shadow-lg">
        <div className="space-y-2">
          <div className="h-4 w-24 rounded-full bg-surface-alt" />
          <div className="h-7 w-3/4 rounded-full bg-surface-alt/80" />
        </div>
        <div className="space-y-3 pt-2">
          <div className="h-12 rounded-2xl bg-surface-alt" />
          <div className="h-12 rounded-2xl bg-surface-alt" />
          <div className="h-12 rounded-2xl bg-surface-alt" />
        </div>
        <div className="space-y-3 pt-2">
          <div className="h-3 w-1/2 rounded-full bg-surface-alt/80" />
          <div className="h-3 w-2/3 rounded-full bg-surface-alt/80" />
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
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4 py-12 text-text sm:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-32 top-32 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute right-10 top-10 h-72 w-72 rounded-full bg-info/10 blur-3xl" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-surface" />
        </div>

        <div className="relative w-full max-w-6xl rounded-[40px] border border-border-subtle/60 bg-surface/80 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.35)] backdrop-blur-sm">
          <div className="grid gap-6 p-6 sm:p-10 lg:grid-cols-[1.05fr_0.95fr] lg:p-12">
            <section className="relative hidden overflow-hidden rounded-[32px] border border-white/20 bg-gradient-to-br from-primary/90 via-primary/80 to-primary/70 p-10 text-white shadow-inner lg:flex lg:flex-col">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
                <div className="absolute right-0 bottom-0 h-56 w-56 rounded-full bg-info/40 blur-3xl" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18)_0,_transparent_65%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.08)_10%,transparent_40%,rgba(255,255,255,0.12)_75%)]" />
              </div>

              <div className="relative flex flex-1 flex-col justify-between gap-12">
                <div className="space-y-8">
                  <span className="inline-flex w-max items-center gap-2 rounded-full bg-white/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
                    HematWoi • Dashboard
                  </span>
                  <div className="space-y-4">
                    <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">
                      Automasi finansialmu dimulai dari sini.
                    </h1>
                    <p className="max-w-lg text-sm text-white/80">
                      Kelola cash flow, catat transaksi harian, dan raih tujuan menabung dengan insight yang selalu relevan setiap kali kamu login.
                    </p>
                  </div>
                  <ul className="space-y-3">
                    {heroTips.map((tip, index) => (
                      <li
                        key={tip}
                        className="flex items-start gap-4 rounded-2xl bg-white/12 p-4 shadow-[0_18px_40px_-25px_rgba(15,23,42,0.75)] backdrop-blur"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/90 text-sm font-semibold text-primary">
                          {index + 1}
                        </span>
                        <p className="text-sm text-white/90">{tip}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="relative flex items-end justify-between gap-6">
                  <div className="rounded-[28px] bg-white/12 p-5 text-left shadow-lg backdrop-blur">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">Rekap cepat</p>
                    <p className="mt-2 text-3xl font-semibold text-white">98%</p>
                    <p className="text-xs text-white/70">Pengguna merasa lebih teratur setelah 2 minggu</p>
                  </div>
                  <div className="relative h-24 w-24 shrink-0 rounded-3xl bg-white/10 p-4 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.65)]">
                    <img src={heroLogo} alt="Logo HematWoi" className="h-full w-full object-contain drop-shadow-[0_12px_35px_rgba(8,47,73,0.25)]" />
                  </div>
                </div>
              </div>
            </section>

            <section className="flex w-full flex-col justify-center">
              <div className="space-y-5">
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
                  <div className="space-y-8 rounded-[32px] border border-border-subtle/60 bg-surface/95 p-6 shadow-xl backdrop-blur-sm sm:p-8">
                    <header className="space-y-3 text-center sm:text-left">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Selamat datang kembali</p>
                      <h2 className="text-2xl font-semibold text-text">Masuk untuk melanjutkan perjalanan finansialmu</h2>
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
