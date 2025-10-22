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

const journeySteps = [
  {
    label: 'Langkah 1',
    title: 'Mulai catat transaksi',
    status: 'Aktif',
    accent: 'bg-primary/15 text-primary',
    description: 'Tetapkan tujuan dan lihat progres menabungmu setiap hari.',
  },
  {
    label: 'Langkah 2',
    title: 'Sinkron otomatis',
    status: 'Tersambung',
    accent: 'bg-success/15 text-success',
    description: 'Akses data dari berbagai perangkat tanpa kehilangan riwayat.',
  },
  {
    label: 'Langkah 3',
    title: 'Lihat insight pintar',
    status: 'Siap',
    accent: 'bg-info/15 text-info',
    description: 'Dapatkan rekomendasi cerdas agar cash flow lebih terarah.',
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
      <div className="grid w-full animate-pulse gap-10 lg:grid-cols-[1.15fr_1fr]">
        <div className="h-[520px] rounded-[40px] border border-border-subtle/60 bg-surface/70 shadow-xl backdrop-blur">
          <div className="flex h-full flex-col justify-between p-10">
            <div className="space-y-6">
              <div className="h-8 w-40 rounded-full bg-surface-alt/80" />
              <div className="h-10 w-3/4 rounded-full bg-surface-alt/70" />
              <div className="h-4 w-2/3 rounded-full bg-surface-alt/70" />
            </div>
            <div className="space-y-4">
              <div className="h-16 rounded-2xl bg-surface-alt/70" />
              <div className="h-16 rounded-2xl bg-surface-alt/70" />
              <div className="h-16 rounded-2xl bg-surface-alt/70" />
            </div>
            <div className="h-20 rounded-3xl bg-surface-alt/70" />
          </div>
        </div>
        <div className="space-y-4 rounded-[32px] border border-border-subtle/60 bg-surface p-8 shadow-lg">
          <div className="h-5 w-1/2 rounded-full bg-surface-alt" />
          <div className="h-4 w-3/4 rounded-full bg-surface-alt" />
          <div className="space-y-3 pt-4">
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
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-surface via-surface-alt to-surface px-6 py-12 text-text transition-colors sm:py-16">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-1/3 top-[-10%] h-[26rem] w-[26rem] rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute bottom-[-20%] right-[-10%] h-[28rem] w-[28rem] rounded-full bg-success/10 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_60%)]" />
        </div>
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
          <section className="relative overflow-hidden rounded-[40px] border border-border-subtle/60 bg-surface shadow-2xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(76,201,240,0.12),_transparent_65%)]" />
            <div className="relative grid gap-10 px-10 py-12 lg:grid-cols-[1fr_auto]">
              <div className="max-w-xl space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
                  HematWoi
                </div>
                <div className="space-y-4">
                  <h1 className="text-3xl font-semibold leading-snug sm:text-4xl">
                    Automasi kebiasaan finansialmu dalam satu ruang aman.
                  </h1>
                  <p className="text-base text-muted">
                    Sambut kembali dasbor HematWoi dengan alur login yang lebih rapi dan fokus pada perjalanan menabungmu.
                  </p>
                </div>
                <ul className="space-y-4">
                  {journeySteps.map(({ label, title, status, accent, description }) => (
                    <li
                      key={title}
                      className="flex items-start gap-4 rounded-3xl border border-border-subtle/60 bg-surface/90 p-4 shadow-sm backdrop-blur"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-alt text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                        {label}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h2 className="text-sm font-semibold text-text">{title}</h2>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${accent}`}>
                            {status}
                          </span>
                        </div>
                        <p className="text-xs text-muted">{description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative">
                <div className="relative rounded-[28px] border border-border-subtle/60 bg-white/90 p-6 text-center shadow-xl backdrop-blur">
                  <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-full bg-surface/70">
                    <img
                      src={plannerIllustration}
                      alt="Ilustrasi planner HematWoi"
                      className="h-40 w-40 object-contain"
                      loading="lazy"
                    />
                  </div>
                  <p className="mt-6 text-sm font-semibold text-text">Catatan rapi, tujuan tercapai</p>
                  <p className="mt-2 text-xs text-muted">
                    Gunakan avatar favoritmu dan lanjutkan perjalanan finansial dengan rekomendasi personal.
                  </p>
                </div>
              </div>
            </div>
            <div className="relative border-t border-border-subtle/60 bg-surface/95">
              <dl className="grid gap-4 px-10 py-6 text-left md:grid-cols-3">
                {heroTips.map((tip) => (
                  <div key={tip} className="space-y-1">
                    <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-muted">
                      ✓ HematWoi
                    </dt>
                    <dd className="text-sm text-text/80">{tip}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section className="relative w-full max-w-lg">
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
                <div className="space-y-6 rounded-[32px] border border-border-subtle/60 bg-surface/95 p-6 shadow-xl backdrop-blur-sm sm:p-8">
                  <header className="space-y-2 text-center sm:text-left">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Selamat datang kembali</p>
                    <h2 className="text-2xl font-semibold text-text">Masuk untuk melanjutkan kontrol finansialmu</h2>
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
      </main>
    </ErrorBoundary>
  );
}
