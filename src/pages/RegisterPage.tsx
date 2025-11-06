import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconBrandGoogle } from '@tabler/icons-react';
import { CheckCircle2, Circle, Eye, EyeOff } from 'lucide-react';
import ErrorBoundary from '../components/system/ErrorBoundary';
import Logo from '../components/Logo';
import { resolveAuthRedirect, signInWithPassword, signUpWithoutEmailConfirmation } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getPasswordStrength, isPasswordValid, validatePassword } from '../lib/password';
import { useToast } from '../context/ToastContext';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormState = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
};

type FormErrors = Partial<Record<'email' | 'password' | 'confirmPassword' | 'terms', string>>;

type StatusState = { type: 'success' | 'error' | 'info'; message: string } | null;

function getAppUrl(path: string) {
  const url = resolveAuthRedirect(path);
  if (!url && typeof window !== 'undefined') {
    return new URL(path, window.location.origin).toString();
  }
  return url ?? path;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const addToast = toast?.addToast;
  const [form, setForm] = useState<FormState>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptedTerms: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<StatusState>(null);
  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;
        const user = data.session?.user;
        if (user) {
          navigate('/', { replace: true });
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('[register] gagal memeriksa sesi', error);
        }
      }
    };

    void checkSession();

    return () => {
      active = false;
    };
  }, [navigate]);

  const passwordValidation = useMemo(() => validatePassword(form.password), [form.password]);
  const passwordStrength = useMemo(() => getPasswordStrength(passwordValidation), [passwordValidation]);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const handleFieldChange = useCallback(
    (field: keyof FormState) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const value = field === 'acceptedTerms' ? event.target.checked : event.target.value;
        setForm((prev) => ({ ...prev, [field]: value }));
        if (field === 'email' || field === 'password' || field === 'confirmPassword') {
          setErrors((prev) => ({ ...prev, [field]: undefined }));
        }
        if (field === 'acceptedTerms') {
          setErrors((prev) => ({ ...prev, terms: undefined }));
        }
        setStatus(null);
      },
    []
  );

  const passwordInputType = useMemo(() => (showPassword ? 'text' : 'password'), [showPassword]);

  const isFormValid = useMemo(() => {
    const trimmedEmail = form.email.trim();
    const hasValidEmail = EMAIL_PATTERN.test(trimmedEmail);
    const passwordsMatch = form.password && form.password === form.confirmPassword;
    return hasValidEmail && isPasswordValid(passwordValidation) && passwordsMatch && form.acceptedTerms;
  }, [form.confirmPassword, form.email, form.password, form.acceptedTerms, passwordValidation]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (loading) return;

      const trimmedEmail = form.email.trim().toLowerCase();
      const trimmedFullName = form.fullName.trim();

      const nextErrors: FormErrors = {};

      if (!trimmedEmail) {
        nextErrors.email = 'Email wajib diisi.';
      } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
        nextErrors.email = 'Gunakan format email yang valid.';
      }

      if (!form.password) {
        nextErrors.password = 'Password wajib diisi.';
      } else if (!isPasswordValid(passwordValidation)) {
        nextErrors.password = 'Password belum memenuhi kriteria.';
      }

      if (!form.confirmPassword) {
        nextErrors.confirmPassword = 'Konfirmasi password wajib diisi.';
      } else if (form.confirmPassword !== form.password) {
        nextErrors.confirmPassword = 'Konfirmasi password harus sama.';
      }

      if (!form.acceptedTerms) {
        nextErrors.terms = 'Setujui Syarat & Kebijakan untuk melanjutkan.';
      }

      setErrors(nextErrors);

      if (Object.keys(nextErrors).length > 0) {
        return;
      }

      setLoading(true);
      setStatus(null);

      try {
        await signUpWithoutEmailConfirmation({
          email: trimmedEmail,
          password: form.password,
          fullName: trimmedFullName || undefined,
        });

        await signInWithPassword({
          email: trimmedEmail,
          password: form.password,
        });

        setStatus({ type: 'success', message: 'Akun berhasil dibuat. Mengarahkan ke dashboard…' });

        if (addToast) {
          addToast(`Akun berhasil dibuat. Selamat datang, ${trimmedFullName || trimmedEmail}!`, 'success');
        }

        navigate('/dashboard', { replace: true });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Gagal membuat akun. Silakan coba lagi nanti.';
        setStatus({ type: 'error', message });
        const normalized = message.toLowerCase();
        if (normalized.includes('email')) {
          setErrors((prev) => ({ ...prev, email: message }));
        }
        if (normalized.includes('password') || normalized.includes('kata sandi')) {
          setErrors((prev) => ({ ...prev, password: message }));
        }
      } finally {
        setLoading(false);
      }
    },
    [addToast, form.confirmPassword, form.email, form.fullName, form.password, form.acceptedTerms, loading, navigate, passwordValidation]
  );

  const handleGoogleSignIn = useCallback(async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setStatus({ type: 'info', message: 'Mengalihkan ke Google…' });
    try {
      const redirectTo = getAppUrl('/auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, flowType: 'pkce' },
      });
      if (error) throw error;
      const url = data?.url;
      if (url) {
        window.location.assign(url);
        return;
      }
      throw new Error('Tautan login Google tidak ditemukan.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal memulai login dengan Google.';
      setStatus({ type: 'error', message });
    } finally {
      setGoogleLoading(false);
    }
  }, [googleLoading]);

  return (
    <ErrorBoundary>
      <main className="min-h-screen w-full bg-surface text-text">
        <div className="grid min-h-screen grid-cols-1 gap-y-10 lg:grid-cols-[0.56fr_0.44fr]">
          <aside className="hidden flex-col justify-center px-6 pb-16 pt-0 sm:px-12 sm:pb-20 lg:order-1 lg:flex lg:px-16 lg:py-12">
            <div className="flex w-full grow items-center justify-center">
              <div
                className="h-full w-full min-h-[320px] rounded-3xl border border-border-subtle bg-surface-alt"
                aria-hidden="true"
              />
            </div>
          </aside>

          <section className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:order-2 lg:px-16">
            <div className="mx-auto flex w-full max-w-md flex-col gap-10">
              <header className="space-y-3">
                <div className="flex items-center gap-3">
                  <Logo className="h-10 w-10" />
                  <div className="space-y-1">
                    <p className="text-lg font-semibold">HematWoi</p>
                    <p className="text-sm text-muted">Mulai perjalanan finansialmu sekarang</p>
                  </div>
                </div>
              </header>

              <div className="space-y-8">
                  <div className="grid gap-3 sm:grid-cols-1">
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={googleLoading}
                    >
                      {googleLoading ? (
                        <span
                          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                          aria-hidden="true"
                        />
                      ) : (
                        <IconBrandGoogle className="h-5 w-5" aria-hidden="true" />
                      )}
                      <span>{googleLoading ? 'Menghubungkan…' : 'Lanjutkan dengan Google'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
                    <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">atau</span>
                    <div className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
                  </div>

                  {status ? (
                    <div
                      role="status"
                      aria-live="polite"
                      className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                        status.type === 'success'
                          ? 'border-success/40 bg-success/10 text-success'
                          : status.type === 'error'
                            ? 'border-danger/40 bg-danger/10 text-danger'
                            : 'border-primary/40 bg-primary/10 text-primary'
                      }`}
                    >
                      {status.message}
                    </div>
                  ) : null}

                  <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                    <div className="space-y-1.5">
                      <label htmlFor="fullName" className="text-sm font-medium text-text">
                        Nama Tampilan <span className="text-xs text-muted">(opsional)</span>
                      </label>
                      <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        autoComplete="name"
                        value={form.fullName}
                        onChange={handleFieldChange('fullName')}
                        className="min-h-[44px] w-full rounded-2xl border border-border-subtle bg-surface px-3 py-3 text-sm text-text transition placeholder:text-muted focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                        placeholder="Nama panggilan"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="email" className="text-sm font-medium text-text">
                        Email
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={form.email}
                        onChange={handleFieldChange('email')}
                        className="min-h-[44px] w-full rounded-2xl border border-border-subtle bg-surface px-3 py-3 text-sm text-text transition placeholder:text-muted focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                        placeholder="nama@email.com"
                        aria-invalid={Boolean(errors.email)}
                      />
                      {errors.email ? (
                        <p className="text-xs text-danger" role="alert" aria-live="polite">
                          {errors.email}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="password" className="text-sm font-medium text-text">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="password"
                          name="password"
                          type={passwordInputType}
                          autoComplete="new-password"
                          required
                          value={form.password}
                          onChange={handleFieldChange('password')}
                          className="min-h-[44px] w-full rounded-2xl border border-border-subtle bg-surface px-3 py-3 pr-12 text-sm text-text transition placeholder:text-muted focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                          placeholder="Minimal 8 karakter"
                          aria-invalid={Boolean(errors.password)}
                        />
                        <button
                          type="button"
                          onClick={togglePasswordVisibility}
                          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                          aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                        </button>
                      </div>
                      {errors.password ? (
                        <p className="text-xs text-danger" role="alert" aria-live="polite">
                          {errors.password}
                        </p>
                      ) : null}

                      <ul className="mt-3 space-y-1 text-xs text-muted">
                        <li className="flex items-center gap-2">
                          {(passwordValidation.length ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4" />)}
                          <span>Minimal 8 karakter</span>
                        </li>
                        <li className="flex items-center gap-2">
                          {(passwordValidation.letter ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4" />)}
                          <span>Ada huruf (a-z)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          {(passwordValidation.number ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4" />)}
                          <span>Ada angka (0-9)</span>
                        </li>
                      </ul>
                      <p className="text-xs font-medium text-muted">
                        Kekuatan password: <span className={passwordStrength === 'strong' ? 'text-success' : passwordStrength === 'good' ? 'text-warning' : 'text-danger'}>{passwordStrength === 'strong' ? 'kuat' : passwordStrength === 'good' ? 'baik' : 'lemah'}</span>
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="confirmPassword" className="text-sm font-medium text-text">
                        Konfirmasi Password
                      </label>
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={passwordInputType}
                        autoComplete="new-password"
                        required
                        value={form.confirmPassword}
                        onChange={handleFieldChange('confirmPassword')}
                        className="min-h-[44px] w-full rounded-2xl border border-border-subtle bg-surface px-3 py-3 text-sm text-text transition placeholder:text-muted focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                        placeholder="Ulangi password"
                        aria-invalid={Boolean(errors.confirmPassword)}
                      />
                      {errors.confirmPassword ? (
                        <p className="text-xs text-danger" role="alert" aria-live="polite">
                          {errors.confirmPassword}
                        </p>
                      ) : null}
                    </div>

                    <label className="flex cursor-pointer items-start gap-3 text-sm text-text">
                      <input
                        id="terms"
                        name="terms"
                        type="checkbox"
                        checked={form.acceptedTerms}
                        onChange={handleFieldChange('acceptedTerms')}
                        className="mt-1 h-4 w-4 rounded border-border-subtle text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                      />
                      <span>
                        Saya menyetujui <span className="font-semibold">Syarat & Kebijakan</span> HematWoi.
                        {errors.terms ? (
                          <span className="block text-xs text-danger" role="alert" aria-live="polite">
                            {errors.terms}
                          </span>
                        ) : null}
                      </span>
                    </label>

                    <button
                      type="submit"
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!isFormValid || loading}
                    >
                      {loading ? (
                        <span
                          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span>{loading ? 'Memproses…' : 'Buat Akun'}</span>
                    </button>
                  </form>

                  <p className="text-sm text-muted">
                    Sudah punya akun?{' '}
                    <Link
                      to="/login"
                      className="font-semibold text-primary transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                    >
                      Masuk
                    </Link>
                  </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </ErrorBoundary>
  );
}
