import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginCard from '../components/auth/LoginCard';
import ErrorBoundary from '../components/system/ErrorBoundary';
import { getSession } from '../lib/auth';
import { supabase } from '../lib/supabase';

function setConnectionModeOnline() {
  try {
    localStorage.setItem('hw:connectionMode', 'online');
    localStorage.setItem('hw:mode', 'online');
  } catch {
    /* ignore */
  }
}

function AuthLoginContent() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [initialEmail, setInitialEmail] = useState('');

  const tips = useMemo(
    () => [
      'Sinkron otomatis dengan akun bank dan dompet digital yang kamu percayai.',
      'Pantau anggaran dan goals tabungan dengan visual yang mudah dipahami.',
      'Dapatkan insight pintar setiap minggu agar keuanganmu makin sehat.',
    ],
    []
  );

  useEffect(() => {
    let mounted = true;
    async function checkSession() {
      try {
        const { session, error } = await getSession();
        if (!mounted) return;

        if (session) {
          setConnectionModeOnline();
          navigate('/', { replace: true });
          return;
        }

        if (error) {
          setSessionError(error);
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('[HW][auth] checkSession', err);
        }
        if (mounted) {
          setSessionError('Tidak dapat memeriksa sesi login. Coba lagi.');
        }
      } finally {
        if (mounted) {
          setCheckingSession(false);
        }
      }
    }

    checkSession();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_IN' && session) {
        setConnectionModeOnline();
        navigate('/', { replace: true });
      }
    });

    return () => {
      mounted = false;
      sub.subscription?.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    try {
      const shouldPrefill = localStorage.getItem('hw:rememberMe') === 'true';
      if (!shouldPrefill) return;
      const savedEmail = localStorage.getItem('hw:lastEmail');
      if (savedEmail) {
        setInitialEmail(savedEmail);
      }
    } catch {
      setInitialEmail('');
    }
  }, []);

  const handleSuccess = () => {
    setConnectionModeOnline();
    navigate('/', { replace: true });
  };

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Masuk | HematWoi';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <main className="min-h-screen bg-surface-alt text-text">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <section className="flex flex-1 items-center justify-center bg-gradient-to-br from-surface-alt via-surface-alt to-surface px-6 py-12">
          <div className="max-w-xl space-y-6 text-center lg:text-left">
            <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              HematWoi
            </span>
            <h1 className="text-3xl font-semibold sm:text-4xl">Selamat datang kembali 👋</h1>
            <p className="text-sm leading-relaxed text-muted">
              Masuk untuk melanjutkan perjalanan finansialmu. Data kamu aman, dan kami akan
              menyesuaikan pengalaman sesuai gaya hidup hematmu.
            </p>
            <ul className="mx-auto flex max-w-md flex-col gap-3 text-left text-sm text-text lg:mx-0">
              {tips.map((tip) => (
                <li key={tip} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    ✓
                  </span>
                  <span className="leading-relaxed">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="flex flex-1 items-center justify-center bg-surface px-6 py-12">
          <div className="w-full max-w-md space-y-4">
            {sessionError ? (
              <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning" role="alert" aria-live="polite">
                {sessionError}
              </div>
            ) : null}
            {checkingSession ? (
              <div className="w-full max-w-md animate-pulse rounded-3xl border border-border-subtle/70 bg-surface-alt/70 p-6 shadow-sm sm:p-8">
                <div className="h-6 w-2/3 rounded-lg bg-border-subtle/80" />
                <div className="mt-4 h-4 w-full rounded-lg bg-border-subtle/60" />
                <div className="mt-6 space-y-3">
                  <div className="h-11 w-full rounded-2xl bg-border-subtle/50" />
                  <div className="h-11 w-full rounded-2xl bg-border-subtle/40" />
                  <div className="h-11 w-full rounded-2xl bg-border-subtle/30" />
                  <div className="h-11 w-full rounded-2xl bg-border-subtle/40" />
                </div>
              </div>
            ) : (
              <LoginCard onSuccess={handleSuccess} initialEmail={initialEmail} />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function AuthLogin() {
  return (
    <ErrorBoundary>
      <AuthLoginContent />
    </ErrorBoundary>
  );
}
