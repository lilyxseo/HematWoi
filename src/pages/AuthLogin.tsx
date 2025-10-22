import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { IconBrandApple, IconBrandGoogle } from '@tabler/icons-react';
import { Eye, EyeOff } from 'lucide-react';
import ErrorBoundary from '../components/system/ErrorBoundary';
import Logo from '../components/Logo';
import { resolveEmailByUsername, signInWithPassword, signInWithProvider } from '../lib/auth';

type FormState = {
  identifier: string;
  password: string;
  remember: boolean;
};

type CredentialsState = Pick<FormState, 'identifier' | 'password'>;

type FormErrors = Partial<Record<keyof CredentialsState, string>>;

const STORAGE_KEY = 'hw:lastIdentifier';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,}$/;

export default function AuthLogin() {
  const [form, setForm] = useState<FormState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return { identifier: stored, password: '', remember: true };
        }
      } catch {
        // ignore read errors
      }
    }

    return { identifier: '', password: '', remember: false };
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validate = useCallback((state: CredentialsState): FormErrors => {
    const nextErrors: FormErrors = {};

    const trimmedIdentifier = state.identifier.trim();

    if (!trimmedIdentifier) {
      nextErrors.identifier = 'Email atau username wajib diisi.';
    } else if (trimmedIdentifier.includes('@')) {
      if (!EMAIL_PATTERN.test(trimmedIdentifier)) {
        nextErrors.identifier = 'Gunakan format email yang valid.';
      }
    } else if (!USERNAME_PATTERN.test(trimmedIdentifier)) {
      nextErrors.identifier = 'Gunakan username minimal 3 karakter.';
    }

    if (!state.password.trim()) {
      nextErrors.password = 'Password wajib diisi.';
    }

    return nextErrors;
  }, []);

  const handleFieldChange = useCallback(
    (field: keyof CredentialsState) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setForm((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: undefined }));
        setSubmitError(null);
      },
    []
  );

  const handleRememberChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    setForm((prev) => ({ ...prev, remember: checked }));
  }, []);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((previous) => !previous);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const trimmedIdentifier = form.identifier.trim();
      if (form.remember && trimmedIdentifier) {
        window.localStorage.setItem(STORAGE_KEY, trimmedIdentifier);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore persistence errors
    }
  }, [form.identifier, form.remember]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (loading) return;

      const credentials: CredentialsState = {
        identifier: form.identifier,
        password: form.password,
      };
      const nextErrors = validate(credentials);
      setErrors(nextErrors);
      setSubmitError(null);
      if (Object.keys(nextErrors).length > 0) {
        return;
      }

      setLoading(true);

      try {
        const trimmedIdentifier = credentials.identifier.trim();
        const looksLikeEmail = trimmedIdentifier.includes('@');
        let emailForSignIn = trimmedIdentifier.toLowerCase();

        if (!looksLikeEmail) {
          try {
            const resolved = await resolveEmailByUsername(trimmedIdentifier);
            if (!resolved) {
              throw new Error('Username atau email tidak ditemukan.');
            }
            emailForSignIn = resolved.trim().toLowerCase();
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Username atau email tidak ditemukan.';
            setErrors((prev) => ({ ...prev, identifier: message }));
            throw error instanceof Error ? error : new Error(message);
          }
        }

        await signInWithPassword({ email: emailForSignIn, password: credentials.password });

        setForm((prev) => ({ ...prev, password: '' }));

        if (typeof window !== 'undefined') {
          const redirectParam = new URLSearchParams(window.location.search).get('redirect');
          if (redirectParam) {
            window.location.assign(redirectParam);
          } else {
            window.location.replace('/');
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan. Silakan coba lagi.';
        const normalized = message.toLowerCase();
        let handledByField = false;

        if (normalized.includes('username') || normalized.includes('email')) {
          setErrors((prev) => ({ ...prev, identifier: message }));
          handledByField = true;
        }
        if (normalized.includes('password') || normalized.includes('kata sandi')) {
          setErrors((prev) => ({ ...prev, password: message }));
          handledByField = true;
        }

        if (!handledByField) {
          setSubmitError(message);
        } else {
          setSubmitError(null);
        }
      } finally {
        setLoading(false);
      }
    },
    [form.identifier, form.password, loading, validate]
  );

  const passwordType = useMemo(() => (showPassword ? 'text' : 'password'), [showPassword]);

  const handleGoogleLogin = useCallback(async () => {
    if (socialLoading || loading) return;
    setSubmitError(null);
    setSocialLoading(true);

    try {
      const data = await signInWithProvider('google');
      if (data?.url) {
        window.location.assign(data.url);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal masuk dengan Google. Silakan coba lagi.';
      setSubmitError(message);
    } finally {
      setSocialLoading(false);
    }
  }, [loading, socialLoading]);

  return (
    <ErrorBoundary>
      <main className="min-h-screen w-full bg-surface text-text">
        <div className="grid min-h-screen grid-cols-1 gap-y-10 lg:grid-cols-[0.44fr_0.56fr]">
          <section className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
            <div className="mx-auto flex w-full max-w-md flex-col gap-10">
              <header className="space-y-3">
                <div className="flex items-center gap-3">
                  <Logo className="h-10 w-10" />
                  <div className="space-y-1">
                    <p className="text-lg font-semibold">HematWoi</p>
                    <p className="text-sm text-muted">Atur keuangan kamu dengan tenang</p>
                  </div>
                </div>
              </header>

              <div className="space-y-8">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={socialLoading || loading}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {socialLoading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                    ) : (
                      <IconBrandGoogle className="h-5 w-5" aria-hidden="true" />
                    )}
                    <span>{socialLoading ? 'Menghubungkan…' : 'Sign in with Google'}</span>
                  </button>
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    title="Login dengan Apple belum tersedia"
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <IconBrandApple className="h-5 w-5" aria-hidden="true" />
                    <span>Sign in with Apple</span>
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">OR</span>
                  <div className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                  <div className="space-y-1.5">
                    <label htmlFor="identifier" className="text-sm font-medium text-text">
                      Email atau Username
                    </label>
                    <input
                      id="identifier"
                      name="identifier"
                      type="text"
                      autoComplete="username"
                      required
                      value={form.identifier}
                      onChange={handleFieldChange('identifier')}
                      className="min-h-[44px] w-full rounded-2xl border border-border-subtle bg-surface px-3 py-3 text-sm text-text transition placeholder:text-muted focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                      placeholder="nama@email.com atau username"
                      aria-invalid={Boolean(errors.identifier)}
                    />
                    {errors.identifier ? (
                      <p className="text-xs text-danger" role="alert" aria-live="polite">
                        {errors.identifier}
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
                        type={passwordType}
                        autoComplete="current-password"
                        required
                        value={form.password}
                        onChange={handleFieldChange('password')}
                        className="min-h-[44px] w-full rounded-2xl border border-border-subtle bg-surface px-3 py-3 pr-12 text-sm text-text transition placeholder:text-muted focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                        placeholder="Masukkan password"
                        aria-invalid={Boolean(errors.password)}
                      />
                      <button
                        type="button"
                        onClick={togglePasswordVisibility}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                        aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <Eye className="h-5 w-5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    {errors.password ? (
                      <p className="text-xs text-danger" role="alert" aria-live="polite">
                        {errors.password}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label htmlFor="remember" className="flex cursor-pointer items-center gap-2 text-sm text-text">
                      <input
                        id="remember"
                        name="remember"
                        type="checkbox"
                        checked={form.remember}
                        onChange={handleRememberChange}
                        className="h-4 w-4 rounded border-border-subtle text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                      />
                      <span>Remember me</span>
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-sm font-semibold text-primary transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                    >
                      Forgot Password?
                    </Link>
                  </div>

                  <button
                    type="submit"
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                    ) : null}
                    <span>{loading ? 'Memproses…' : 'Login'}</span>
                  </button>
                  {submitError ? (
                    <p className="text-sm font-medium text-danger" role="alert" aria-live="polite">
                      {submitError}
                    </p>
                  ) : null}
                </form>
              </div>
            </div>
          </section>

          <aside className="hidden flex-col justify-center px-6 pb-16 pt-0 sm:px-12 sm:pb-20 lg:flex lg:px-16 lg:py-12">
            <div className="flex w-full grow items-center justify-center">
              <div
                className="h-full w-full min-h-[320px] rounded-3xl border border-border-subtle bg-surface-alt"
                aria-hidden="true"
              />
            </div>
          </aside>
        </div>
      </main>
    </ErrorBoundary>
  );
}
