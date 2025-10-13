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
  {
    title: 'Pantau cash flow real-time',
    description: 'Lihat arus kas kamu kapan saja dan dapatkan insight yang relevan untuk keputusan cepat.',
  },
  {
    title: 'Sinkron antar perangkat',
    description: 'Data kamu langsung tersimpan ke cloud dan siap dibuka di perangkat apa pun.',
  },
  {
    title: 'Rencana finansial yang adaptif',
    description: 'Atur anggaran, target tabungan, dan langganan dengan saran otomatis yang personal.',
  },
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
      <div className="grid w-full animate-pulse gap-6 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-border-subtle/60 bg-surface/80 p-8 shadow-lg">
          <div className="space-y-5 text-center lg:text-left">
            <div className="mx-auto h-6 w-32 rounded-full bg-surface-alt lg:mx-0" />
            <div className="mx-auto h-9 w-3/4 rounded-full bg-surface-alt lg:mx-0" />
            <div className="mx-auto h-4 w-full rounded-full bg-surface-alt lg:mx-0" />
            <div className="grid gap-4 pt-2 sm:grid-cols-2">
              <div className="h-24 rounded-3xl bg-surface-alt/80" />
              <div className="h-24 rounded-3xl bg-surface-alt/80" />
            </div>
          </div>
        </div>
        <div className="rounded-[2.5rem] border border-border-subtle/60 bg-surface p-8 shadow-lg">
          <div className="space-y-4">
            <div className="h-8 w-1/2 rounded-full bg-surface-alt" />
            <div className="space-y-3">
              <div className="h-11 rounded-2xl bg-surface-alt" />
              <div className="h-11 rounded-2xl bg-surface-alt" />
              <div className="h-11 rounded-2xl bg-surface-alt" />
            </div>
            <div className="h-4 w-2/3 rounded-full bg-surface-alt" />
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
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#1f2937] px-6 py-12 text-text sm:py-16">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center">
          <div className="h-[40rem] w-[40rem] rounded-full bg-primary/20 blur-[120px]" />
        </div>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
          <section className="relative flex flex-1 flex-col gap-8 text-white">
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 p-8 shadow-[0_40px_80px_-40px_rgba(15,23,42,0.4)] backdrop-blur">
              <div className="absolute -top-20 -left-16 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
              <div className="absolute -bottom-12 -right-10 h-32 w-32 rounded-full bg-[#22d3ee]/20 blur-3xl" />
              <div className="relative inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white">
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                Mode online aman
              </div>
              <div className="relative mt-8 space-y-4">
                <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">
                  Kelola keuanganmu dengan pengalaman login yang baru
                </h1>
                <p className="text-base text-slate-200 sm:text-lg">
                  Nikmati dashboard yang lebih intuitif, analitik otomatis, dan sinkronisasi tanpa hambatan begitu kamu masuk.
                </p>
              </div>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {heroTips.map((tip) => (
                <li
                  key={tip.title}
                  className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 text-left shadow-[0_24px_48px_-36px_rgba(15,23,42,1)] transition hover:border-white/40 hover:bg-white/10"
                >
                  <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-primary/10 blur-3xl transition group-hover:bg-primary/20" />
                  <div className="relative space-y-2">
                    <h3 className="text-base font-semibold text-white">{tip.title}</h3>
                    <p className="text-sm text-slate-200">{tip.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="relative flex flex-1 items-center justify-center">
            <div className="relative w-full max-w-xl">
              <div className="absolute -top-10 -left-16 h-24 w-24 rounded-full bg-primary/30 blur-3xl" />
              <div className="absolute -bottom-10 -right-16 h-28 w-28 rounded-full bg-[#22d3ee]/30 blur-3xl" />
              <div className="relative space-y-6 rounded-[2.5rem] border border-white/10 bg-white p-8 text-slate-900 shadow-[0_24px_48px_-24px_rgba(15,23,42,0.45)]">
                {sessionError ? (
                  <div className="rounded-2xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger" aria-live="polite">
                    {sessionError}
                  </div>
                ) : null}
                {googleError ? (
                  <div className="rounded-2xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger" aria-live="assertive">
                    {googleError}
                  </div>
                ) : null}
                {checking ? (
                  skeleton
                ) : (
                  <>
                    <div className="space-y-2 text-center">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                        Selamat datang kembali
                      </p>
                      <h2 className="text-2xl font-semibold text-slate-900">Masuk untuk melanjutkan</h2>
                      <p className="text-sm text-slate-500">
                        Gunakan email atau akun Google untuk membuka semua fitur premium HematWoi.
                      </p>
                    </div>
                    <LoginCard
                      defaultIdentifier={prefilledIdentifier}
                      onSuccess={handleSuccess}
                      onPasswordSignInStart={markEmailSignIn}
                      onPasswordSignInError={clearEmailSignInMarker}
                    />
                    <div className="space-y-3 rounded-3xl border border-slate-200/80 bg-slate-50 p-4">
                      <div className="flex items-center gap-3 text-left">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-inner">
                          <svg
                            className="h-5 w-5 text-primary"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden="true"
                          >
                            <path
                              d="M12 5.5c1.932 0 3.5 1.568 3.5 3.5S13.932 12.5 12 12.5 8.5 10.932 8.5 9 10.068 5.5 12 5.5Z"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                            <path
                              d="M18.5 18.75c0-2.347-2.905-4.25-6.5-4.25s-6.5 1.903-6.5 4.25"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Masuk lebih cepat</p>
                          <p className="text-xs text-slate-500">Login instan tanpa perlu mengetik ulang kata sandi.</p>
                        </div>
                      </div>
                      <GoogleLoginButton
                        onWebLogin={handleGoogleWebSignIn}
                        disabled={googleLoading}
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
                        <span>{googleLoading ? 'Menghubungkan…' : 'Masuk dengan Google'}</span>
                      </GoogleLoginButton>
                      <p className="text-xs text-slate-500">
                        Jika pop-up tertutup, tekan tombol lagi atau pilih metode email di atas.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </ErrorBoundary>
  );
}
