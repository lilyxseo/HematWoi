import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
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

const heroIllustration = new URL('../../docs/reports.png', import.meta.url).href;

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
      <div className="animate-pulse">
        <div className="space-y-6 rounded-[32px] border border-border-subtle/60 bg-surface/95 p-6 shadow-xl sm:p-8">
          <div className="space-y-3">
            <div className="h-3 w-20 rounded-full bg-surface-alt" />
            <div className="h-7 w-1/2 rounded-full bg-surface-alt/80" />
            <div className="h-4 w-3/4 rounded-full bg-surface-alt/60" />
          </div>
          <div className="h-10 w-full rounded-2xl bg-surface-alt/70" />
          <div className="space-y-3">
            <div className="h-11 rounded-2xl bg-surface-alt/80" />
            <div className="h-11 rounded-2xl bg-surface-alt/80" />
          </div>
          <div className="h-10 w-full rounded-2xl bg-surface-alt/70" />
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
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-surface via-surface-alt to-surface px-6 py-12 text-text transition-colors sm:py-16">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-1/4 top-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-5%] h-[28rem] w-[28rem] rounded-full bg-info/10 blur-3xl" />
          <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-surface" />
        </div>
        <div className="relative mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col-reverse gap-12 lg:min-h-[80vh] lg:flex-row lg:items-center lg:justify-between">
          <section className="w-full max-w-xl space-y-8 rounded-[36px] border border-border-subtle/60 bg-surface/95 p-6 shadow-2xl backdrop-blur sm:p-10">
            <div className="flex items-center gap-3">
              <Logo className="h-12 w-12" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Selamat datang kembali</p>
                <h1 className="text-2xl font-semibold text-text sm:text-3xl">Masuk untuk lanjutkan rencana finansialmu</h1>
              </div>
            </div>
            <p className="text-sm text-muted">
              Kelola anggaran, sinkronkan perangkat, dan lihat insight terbaru yang dirangkum khusus untuk kebiasaan finansialmu.
            </p>
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
              <div className="space-y-6">
                <LoginCard
                  defaultIdentifier={prefilledIdentifier}
                  onSuccess={handleSuccess}
                  onPasswordSignInStart={markEmailSignIn}
                  onPasswordSignInError={clearEmailSignInMarker}
                />
                <div className="relative">
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-border-subtle/60" aria-hidden="true" />
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
                    className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_60px_-20px_rgba(15,23,42,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
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
          </section>

          <section className="w-full max-w-2xl">
            <div className="relative overflow-hidden rounded-[48px] bg-gradient-to-br from-primary/95 via-primary to-info/90 p-8 text-white shadow-[0_50px_140px_-20px_rgba(79,70,229,0.55)] sm:p-12">
              <div className="absolute -left-16 top-14 h-48 w-48 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
              <div className="absolute right-10 top-10 h-16 w-16 rounded-3xl border border-white/30 bg-white/10 backdrop-blur" aria-hidden="true" />
              <div className="absolute -bottom-12 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-info/20 blur-3xl" aria-hidden="true" />
              <div className="relative z-10 space-y-6 max-w-sm">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em]">
                  <span className="h-2 w-2 rounded-full bg-white/80" />
                  Insight HematWoi
                </div>
                <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">Kelola laporan dan cash flow lebih percaya diri</h2>
                <p className="text-sm text-white/80">
                  Lihat tren pengeluaran, analisis kategori, dan dapatkan ringkasan otomatis setiap kali kamu membuka dashboard HematWoi.
                </p>
                <ul className="space-y-3 text-sm text-white/80">
                  {heroTips.map((tip) => (
                    <li key={tip} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-sm font-semibold">✓</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative z-10 mt-10 flex justify-center lg:mt-12">
                <div className="relative w-full max-w-md">
                  <div className="absolute -left-6 -top-8 h-20 w-20 rounded-3xl bg-white/15 blur-lg" aria-hidden="true" />
                  <div className="absolute -bottom-8 right-2 h-16 w-16 rounded-full bg-white/10 blur-lg" aria-hidden="true" />
                  <div className="overflow-hidden rounded-[32px] border border-white/20 bg-white/90 shadow-2xl backdrop-blur">
                    <img src={heroIllustration} alt="Pratinjau laporan HematWoi" className="w-full object-cover" loading="lazy" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </ErrorBoundary>
  );
}
