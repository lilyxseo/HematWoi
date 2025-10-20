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
import brandLogo from '../assets/logo-placeholder.svg';
import heroIllustration from '../assets/aAXTdp01.svg';

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
      <div className="space-y-6 rounded-3xl border border-white/50 bg-white/80 p-8 shadow-2xl backdrop-blur">
        <div className="space-y-3">
          <div className="h-4 w-24 rounded-full bg-slate-200/80" />
          <div className="h-8 w-48 rounded-full bg-slate-200/90" />
          <div className="h-4 w-full rounded-full bg-slate-200/70" />
        </div>
        <div className="space-y-3">
          <div className="h-12 rounded-2xl bg-slate-200/60" />
          <div className="h-12 rounded-2xl bg-slate-200/60" />
          <div className="h-12 rounded-2xl bg-slate-200/60" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-12 rounded-full bg-slate-200/60" />
          <div className="h-3 w-32 rounded-full bg-slate-200/60" />
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
      <main className="relative isolate min-h-screen overflow-hidden bg-[#f4f6ff] px-6 py-10 text-text transition-colors sm:px-10 sm:py-16">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-1/3 top-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-[-20%] right-[-10%] h-96 w-96 rounded-full bg-info/20 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.6),_transparent_60%)]" />
        </div>
        <div className="relative mx-auto grid min-h-[70vh] w-full max-w-6xl grid-cols-1 items-stretch gap-10 lg:grid-cols-[1.05fr_1fr]">
          <section className="flex w-full items-center justify-center">
            <div className="w-full max-w-md space-y-8">
              <div className="flex items-center gap-3">
                <img src={brandLogo} alt="Logo HematWoi" className="h-11 w-11" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.45em] text-primary">HematWoi</p>
                  <p className="text-sm text-muted">Kelola finansialmu dengan percaya diri</p>
                </div>
              </div>
              <div className="space-y-4">
                <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">Selamat datang kembali 👋</h1>
                <p className="text-base text-slate-600">
                  Masuk untuk melanjutkan sinkronisasi transaksi, cek progres tabungan, dan kunci kebiasaan finansial yang lebih sehat.
                </p>
              </div>
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
                  <div className="space-y-6 rounded-3xl border border-white/60 bg-white/90 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
                    <header className="space-y-1 text-center sm:text-left">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Masuk</p>
                      <h2 className="text-2xl font-semibold text-slate-900">Gunakan akun yang kamu percayai</h2>
                    </header>
                    <LoginCard
                      defaultIdentifier={prefilledIdentifier}
                      onSuccess={handleSuccess}
                      onPasswordSignInStart={markEmailSignIn}
                      onPasswordSignInError={clearEmailSignInMarker}
                    />
                    <div className="relative">
                      <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 border-t border-slate-200/70" aria-hidden="true" />
                      <div className="relative mx-auto w-max bg-white px-4 text-xs font-semibold uppercase tracking-[0.3em] text-muted">
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
                        className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
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
                      <p className="text-xs text-slate-500">
                        Jika pop-up tertutup, tekan tombol lagi atau lanjutkan dengan email yang kamu gunakan sehari-hari.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="relative hidden overflow-hidden rounded-[40px] bg-gradient-to-br from-[#4338CA] via-[#3730A3] to-[#312E81] p-8 text-white shadow-2xl lg:flex lg:flex-col">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-10 top-0 h-48 w-48 rounded-full bg-white/20 blur-2xl" />
              <div className="absolute bottom-10 left-[-5%] h-52 w-52 rounded-full bg-primary/40 blur-3xl" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.12),_transparent_65%)]" />
            </div>
            <div className="relative flex flex-1 flex-col justify-between gap-8">
              <header className="space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.4em] text-white/70">HematWoi Dashboard</p>
                <h2 className="text-3xl font-semibold leading-snug sm:text-4xl">
                  Kelola tim finansialmu secara efisien dan penuh kendali.
                </h2>
                <p className="max-w-md text-sm text-white/80">
                  Login untuk melihat cash flow real time, insight otomatis, dan rekomendasi aksi agar tujuan keuanganmu makin dekat.
                </p>
              </header>
              <div className="relative mx-auto w-full max-w-sm">
                <div className="absolute inset-x-4 top-10 h-64 rounded-3xl bg-white/10 blur-3xl" aria-hidden="true" />
                <div className="relative overflow-hidden rounded-3xl bg-white/95 p-6 text-left shadow-2xl">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Ringkasan Bulanan</span>
                    <span>April 2024</span>
                  </div>
                  <img src={heroIllustration} alt="Ilustrasi analitik HematWoi" className="mt-4 w-full object-contain" />
                </div>
              </div>
              <dl className="relative grid gap-3 text-sm text-white/80 sm:grid-cols-3">
                {heroTips.map((tip) => (
                  <div key={tip} className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                    <dt className="font-semibold text-white">HematWoi</dt>
                    <dd className="mt-1 text-white/80">{tip}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </div>
      </main>
    </ErrorBoundary>
  );
}
