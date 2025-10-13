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
    title: 'Catat transaksi sekali sentuh',
    description: 'Input cepat yang terhubung ke semua perangkatmu secara real time.',
  },
  {
    title: 'Analisis pintar tiap akhir bulan',
    description: 'Dapatkan ringkasan otomatis untuk bantu kamu mengambil keputusan.',
  },
  {
    title: 'Anggaran fleksibel',
    description: 'Atur kategori sesuai kebutuhan dan pantau batasnya secara visual.',
  },
  {
    title: 'Keamanan kelas bank',
    description: 'Data terenkripsi dan hanya kamu yang punya akses penuh.',
  },
];

const highlightStats = [
  { label: 'Pengguna aktif', value: '45K+' },
  { label: 'Anggaran tersusun', value: '210K+' },
  { label: 'Rating kepuasan', value: '4.9/5' },
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
      <div className="grid w-full animate-pulse gap-6 lg:grid-cols-[1.1fr_minmax(0,_1fr)]">
        <div className="relative overflow-hidden rounded-[2rem] border border-border-subtle/70 bg-surface/80 p-6 shadow-md backdrop-blur">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-success/5" aria-hidden="true" />
          <div className="relative space-y-6">
            <div className="h-9 w-32 rounded-full bg-surface-alt/80" />
            <div className="space-y-3">
              <div className="h-10 w-3/4 rounded-2xl bg-surface-alt/80" />
              <div className="h-4 w-full max-w-sm rounded-full bg-surface-alt/70" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-24 rounded-3xl bg-surface-alt/70" />
              <div className="h-24 rounded-3xl bg-surface-alt/70" />
            </div>
          </div>
        </div>
        <div className="rounded-[2rem] border border-border-subtle/70 bg-surface/80 p-6 shadow-md backdrop-blur">
          <div className="space-y-4">
            <div className="h-8 w-48 rounded-2xl bg-surface-alt/80" />
            <div className="space-y-3">
              <div className="h-11 rounded-2xl bg-surface-alt/80" />
              <div className="h-11 rounded-2xl bg-surface-alt/80" />
              <div className="h-11 rounded-2xl bg-surface-alt/80" />
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
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-surface via-surface-alt to-surface px-6 py-12 text-text transition-colors sm:py-16">
        <div className="pointer-events-none absolute inset-0 opacity-70 mix-blend-screen">
          <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
          <div className="absolute bottom-0 right-0 h-96 w-96 translate-x-1/3 translate-y-1/3 rounded-full bg-success/10 blur-3xl" aria-hidden="true" />
        </div>
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-12">
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border-subtle/60 bg-surface/70 px-6 py-5 shadow-lg backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-lg font-semibold text-primary">
                HW
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">HematWoi Finance</p>
                <p className="text-base font-medium text-text">Kelola uang jadi mudah &amp; penuh kendali</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-xs sm:text-sm text-muted">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
                Data realtime tersinkron
              </span>
              <span className="hidden items-center gap-2 sm:inline-flex">
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                Support tim 24/7
              </span>
            </div>
          </header>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,_1.1fr)_minmax(0,_1fr)]">
            <section className="relative flex flex-col gap-8">
              <div className="relative overflow-hidden rounded-[2.5rem] border border-border-subtle/60 bg-surface/80 p-8 shadow-xl backdrop-blur">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-success/10" aria-hidden="true" />
                <div className="relative space-y-6">
                  <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                    Masuk &amp; sinkronisasi aman
                  </span>
                  <div className="space-y-4">
                    <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">Bangun kebiasaan finansial sehat mulai hari ini</h1>
                    <p className="max-w-xl text-base text-muted">
                      HematWoi membantu kamu mencatat transaksi, mengontrol anggaran, dan memonitor tujuan keuangan dalam satu dashboard yang intuitif.
                    </p>
                  </div>
                  <dl className="grid gap-4 sm:grid-cols-3">
                    {highlightStats.map(({ label, value }) => (
                      <div key={label} className="rounded-3xl border border-border-subtle/60 bg-surface/70 p-4 text-center shadow-sm">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
                        <dd className="mt-2 text-2xl font-semibold text-text">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2">
                {heroTips.map((tip) => (
                  <li
                    key={tip.title}
                    className="group relative overflow-hidden rounded-3xl border border-border-subtle/60 bg-surface/80 p-5 shadow-md transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-transparent to-success/10 opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
                    <div className="relative space-y-2">
                      <h2 className="text-base font-semibold text-text">{tip.title}</h2>
                      <p className="text-sm text-muted">{tip.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="relative flex items-center justify-center">
              <div className="w-full max-w-xl space-y-6 rounded-[2.5rem] border border-border-subtle/60 bg-surface/90 p-6 shadow-2xl backdrop-blur-lg">
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
                  <div className="grid gap-6 lg:grid-cols-5">
                    <div className="lg:col-span-3">
                      <LoginCard
                        defaultIdentifier={prefilledIdentifier}
                        onSuccess={handleSuccess}
                        onPasswordSignInStart={markEmailSignIn}
                        onPasswordSignInError={clearEmailSignInMarker}
                      />
                    </div>
                    <div className="flex flex-col justify-between rounded-3xl border border-border-subtle/70 bg-surface-alt/60 p-6 text-center shadow-sm lg:col-span-2">
                      <div className="space-y-4">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
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
                      <div className="space-y-3">
                        <GoogleLoginButton
                          onWebLogin={handleGoogleWebSignIn}
                          disabled={googleLoading}
                          className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-2xl border border-border-subtle bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-70"
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
                          Jika pop-up tertutup, tekan tombol lagi atau lanjutkan dengan email di samping.
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
