import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import NativeGoogleSignInButton from '../components/NativeGoogleSignInButton';
import LoginCard from '../components/auth/LoginCard';
import ErrorBoundary from '../components/system/ErrorBoundary';
import { getSession, onAuthStateChange } from '../lib/auth';
import { redirectToNativeGoogleLogin } from '../lib/native-google-login';
import { supabase } from '../lib/supabase';
import { syncGuestToCloud } from '../lib/sync';
import { formatOAuthErrorMessage } from '../lib/oauth-error';
import appMark from '../assets/logo-placeholder.svg';
import expertAvatar from '../assets/avatars/expert.svg';
import plannerAvatar from '../assets/avatars/planner.svg';
import saverAvatar from '../assets/avatars/saver.svg';

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
      <div className="grid w-full animate-pulse overflow-hidden rounded-[40px] border border-border-subtle/80 bg-surface shadow-xl md:grid-cols-[1.15fr_1fr]">
        <div className="relative hidden h-full bg-gradient-to-br from-brand/20 via-info/10 to-brand/10 md:block">
          <div className="absolute inset-8 rounded-[32px] border border-white/20 bg-white/10" />
        </div>
        <div className="space-y-4 p-8 sm:p-10">
          <div className="h-4 w-20 rounded-full bg-surface-alt" />
          <div className="h-6 w-2/3 rounded-full bg-surface-alt" />
          <div className="space-y-3 pt-4">
            <div className="h-12 rounded-2xl bg-surface-alt" />
            <div className="h-12 rounded-2xl bg-surface-alt" />
            <div className="h-12 rounded-2xl bg-surface-alt" />
          </div>
          <div className="h-12 rounded-2xl bg-surface-alt" />
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
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-surface via-surface-alt to-surface px-4 py-12 text-text transition-colors sm:px-8">
        <div className="relative w-full max-w-5xl">
          {checking ? (
            skeleton
          ) : (
            <div className="grid overflow-hidden rounded-[40px] border border-border-subtle/80 bg-surface shadow-2xl shadow-black/5 md:grid-cols-[1.15fr_1fr]">
              <section className="relative hidden flex-col justify-between bg-gradient-to-br from-brand/80 via-brand/60 to-info/70 p-10 text-white md:flex">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.35)_0,rgba(255,255,255,0)_60%)]" aria-hidden="true" />
                <div className="relative z-10 flex flex-col gap-6">
                  <div className="inline-flex w-fit items-center gap-3 rounded-full border border-white/25 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em]">
                    <img src={appMark} alt="Logo HematWoi" className="h-6 w-6 rounded-full bg-white/90 p-1" />
                    HematWoi
                  </div>
                  <div className="space-y-4">
                    <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
                      Semua insight finansial terbaik, hadir setiap kali kamu login.
                    </h1>
                    <p className="text-base text-white/80">
                      Tinjau arus kas, cek progres tujuan, dan lanjutkan kebiasaan menabung dengan pengalaman yang konsisten di semua perangkat.
                    </p>
                  </div>
                  <ul className="space-y-3 text-sm text-white/80">
                    {heroTips.map((tip) => (
                      <li key={tip} className="flex items-start gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white">
                          <Check size={16} aria-hidden="true" />
                        </span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative z-10 mt-8 space-y-4">
                  <div className="flex items-center gap-3 rounded-3xl bg-white/10 px-5 py-4 text-sm font-medium text-white">
                    <img src={appMark} alt="Ikon HematWoi" className="h-10 w-10 rounded-2xl bg-white/90 p-2" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-white/70">Sinkron real-time</p>
                      <p>Data selalu terbarui walau berganti perangkat.</p>
                    </div>
                  </div>
                  <div className="rounded-3xl bg-white/10 p-5 text-sm text-white/80">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">Komunitas hemat</p>
                    <div className="mt-4 flex -space-x-3">
                      {[plannerAvatar, saverAvatar, expertAvatar].map((avatar) => (
                        <img
                          key={avatar}
                          src={avatar}
                          alt="Pengguna HematWoi"
                          className="h-12 w-12 rounded-full border-2 border-white/40 bg-white/80 p-1"
                        />
                      ))}
                    </div>
                    <p className="mt-3 text-sm text-white/85">
                      Ribuan pencatat keuangan mengandalkan HematWoi untuk menjaga cash flow tetap sehat setiap hari.
                    </p>
                  </div>
                </div>
              </section>

              <section className="relative flex flex-col justify-center bg-surface px-6 py-10 sm:px-10">
                <div className="mx-auto w-full max-w-sm space-y-6">
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
                  <header className="space-y-2 text-center sm:text-left">
                    <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted">Selamat datang kembali</p>
                    <h2 className="text-2xl font-semibold text-text">Masuk untuk melanjutkan pengelolaan keuanganmu</h2>
                  </header>
                  <LoginCard
                    defaultIdentifier={prefilledIdentifier}
                    onSuccess={handleSuccess}
                    onPasswordSignInStart={markEmailSignIn}
                    onPasswordSignInError={clearEmailSignInMarker}
                  />
                  <div className="relative">
                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 border-t border-border-subtle/60" aria-hidden="true" />
                    <div className="relative mx-auto w-max bg-surface px-3 text-xs font-semibold uppercase tracking-[0.3em] text-muted">
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
              </section>
            </div>
          )}
        </div>
      </main>
    </ErrorBoundary>
  );
}
