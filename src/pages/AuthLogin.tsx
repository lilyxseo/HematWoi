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
      <div className="grid w-full animate-pulse gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <div className="h-8 w-32 rounded-full bg-surface" />
          <div className="h-14 w-3/4 rounded-3xl bg-surface" />
          <div className="h-4 w-2/3 rounded-full bg-surface" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-20 rounded-3xl bg-surface" />
            <div className="h-20 rounded-3xl bg-surface" />
            <div className="h-20 rounded-3xl bg-surface" />
            <div className="h-20 rounded-3xl bg-surface" />
          </div>
        </div>
        <div className="rounded-[40px] border border-border-subtle bg-surface/90 p-8 backdrop-blur">
          <div className="space-y-4">
            <div className="h-6 w-1/2 rounded-full bg-surface-alt" />
            <div className="space-y-3 pt-2">
              <div className="h-12 rounded-2xl bg-surface-alt" />
              <div className="h-12 rounded-2xl bg-surface-alt" />
              <div className="h-12 rounded-2xl bg-surface-alt" />
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
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-surface-alt via-surface to-surface px-6 py-12 text-text transition-colors sm:py-16">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-0 left-10 h-60 w-60 rounded-full bg-success/10 blur-3xl" />
          <div className="absolute -bottom-32 right-0 h-72 w-72 rounded-full bg-info/10 blur-3xl" />
        </div>
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-12 lg:flex-row lg:items-stretch">
          <section className="flex flex-1 flex-col justify-between gap-10 rounded-[40px] border border-border-subtle/50 bg-surface/60 p-8 shadow-lg backdrop-blur">
            <div className="space-y-6">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                Mode online yang aman
              </span>
              <div className="space-y-4">
                <h1 className="text-3xl font-semibold sm:text-4xl">
                  Kelola keuanganmu dengan percaya diri
                </h1>
                <p className="text-base text-muted">
                  HematWoi membantu kamu memantau cash flow, menyelaraskan anggaran, dan mengambil keputusan finansial secara cerdas.
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {heroTips.map((tip) => (
                <div
                  key={tip}
                  className="flex h-full flex-col justify-between gap-3 rounded-3xl border border-border-subtle/60 bg-surface p-5 shadow-sm"
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm text-text">{tip}</p>
                </div>
              ))}
              <div className="rounded-3xl border border-border-subtle/60 bg-gradient-to-br from-primary/10 via-surface to-surface-alt p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Privasi terjaga</p>
                <p className="mt-3 text-sm text-muted">
                  Data finansialmu disimpan aman dengan autentikasi multi-lapisan dan enkripsi dari Supabase.
                </p>
              </div>
            </div>
          </section>

          <section className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-2xl space-y-6">
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
                <div className="rounded-[40px] border border-border-subtle/60 bg-surface/80 p-6 shadow-xl backdrop-blur">
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)] xl:grid-cols-[1fr_auto]">
                    <div>
                      <LoginCard
                        defaultIdentifier={prefilledIdentifier}
                        onSuccess={handleSuccess}
                        onPasswordSignInStart={markEmailSignIn}
                        onPasswordSignInError={clearEmailSignInMarker}
                      />
                    </div>
                    <div className="flex flex-col justify-between gap-6 rounded-3xl border border-border-subtle/60 bg-surface-alt/60 p-6 text-center shadow-sm">
                      <div className="space-y-4">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
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
                      <div className="space-y-2">
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
                          Jika pop-up tertutup, cukup tekan tombol lagi atau pilih metode email di samping.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </ErrorBoundary>
  );
}
