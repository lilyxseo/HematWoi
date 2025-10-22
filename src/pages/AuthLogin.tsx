import { useCallback, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { IconBrandApple, IconBrandGoogle } from '@tabler/icons-react';
import { Eye, EyeOff } from 'lucide-react';
import ErrorBoundary from '../components/system/ErrorBoundary';
import Logo from '../components/Logo';

type FormState = {
  email: string;
  password: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthLogin() {
  const [form, setForm] = useState<FormState>({ email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSocialLogin = useCallback((provider: 'Google' | 'Apple') => {
    return () => {
      console.log(`Login via ${provider} (mock)`);
      window.alert(`Login via ${provider} (mock)`);
    };
  }, []);

  const validate = useCallback((state: FormState): FormErrors => {
    const nextErrors: FormErrors = {};

    if (!state.email.trim()) {
      nextErrors.email = 'Email wajib diisi.';
    } else if (!EMAIL_PATTERN.test(state.email.trim())) {
      nextErrors.email = 'Gunakan format email yang valid.';
    }

    if (!state.password.trim()) {
      nextErrors.password = 'Password wajib diisi.';
    }

    return nextErrors;
  }, []);

  const handleFieldChange = useCallback(
    (field: keyof FormState) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setForm((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    []
  );

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((previous) => !previous);
  }, []);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (loading) return;

      const nextErrors = validate(form);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        return;
      }

      setLoading(true);
      window.setTimeout(() => {
        window.alert('Login berhasil (mock)');
        setLoading(false);
      }, 900);
    },
    [form, loading, validate]
  );

  const passwordType = useMemo(() => (showPassword ? 'text' : 'password'), [showPassword]);

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
                    onClick={handleSocialLogin('Google')}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                  >
                    <IconBrandGoogle className="h-5 w-5" aria-hidden="true" />
                    <span>Sign in with Google</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSocialLogin('Apple')}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
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

                  <div className="flex justify-end">
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
                </form>
              </div>
            </div>
          </section>

          <aside className="flex flex-col justify-center px-6 pb-16 pt-0 sm:px-12 sm:pb-20 lg:px-16 lg:py-12">
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
