import type { ChangeEvent, FormEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { IconBrandApple, IconBrandGoogle } from '@tabler/icons-react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Logo from '../components/Logo';
import Input from '../components/ui/Input';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = {
  email?: string;
  password?: string;
};

export default function AuthLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasErrors = useMemo(() => Object.keys(fieldErrors).length > 0, [fieldErrors]);

  const validate = useCallback(() => {
    const nextErrors: FieldErrors = {};

    if (!email.trim()) {
      nextErrors.email = 'Email wajib diisi.';
    } else if (!emailPattern.test(email.trim())) {
      nextErrors.email = 'Masukkan email yang valid.';
    }

    if (!password.trim()) {
      nextErrors.password = 'Password wajib diisi.';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [email, password]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isSubmitting) return;

      if (!validate()) {
        return;
      }

      setIsSubmitting(true);

      window.setTimeout(() => {
        setIsSubmitting(false);
        window.alert('Login berhasil (mock)');
      }, 700);
    },
    [isSubmitting, validate]
  );

  const handleTogglePassword = useCallback(() => {
    setShowPassword((current) => !current);
  }, []);

  const handleSocialClick = useCallback((provider: 'Google' | 'Apple') => {
    window.console.log(`Login via ${provider} (mock)`);
  }, []);

  const handleEmailChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
  }, []);

  const handlePasswordChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  }, []);

  return (
    <div className="grid min-h-screen grid-cols-1 gap-y-10 md:grid-cols-2 md:gap-y-0 lg:grid-cols-[11fr_14fr]">
      <div className="order-1 flex items-center justify-center px-6 py-10 sm:px-10 md:order-1 md:px-12 lg:px-16">
        <div className="w-full max-w-md space-y-10">
          <header className="space-y-3">
            <div className="flex items-center gap-3">
              <Logo className="h-10 w-10" />
              <div>
                <p className="text-xl font-semibold text-text">HematWoi</p>
                <p className="text-sm text-muted">Atur keuangan kamu dengan tenang</p>
              </div>
            </div>
          </header>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="btn btn-secondary flex-1"
                onClick={() => handleSocialClick('Google')}
              >
                <IconBrandGoogle className="h-5 w-5" aria-hidden="true" />
                Sign in with Google
              </button>
              <button
                type="button"
                className="btn btn-secondary flex-1"
                onClick={() => handleSocialClick('Apple')}
              >
                <IconBrandApple className="h-5 w-5" aria-hidden="true" />
                Sign in with Apple
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted">
              <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
              OR
              <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
            </div>

            <form className="space-y-5" noValidate onSubmit={handleSubmit}>
              <Input
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={handleEmailChange}
                error={fieldErrors.email}
              />

              <div className="space-y-1.5">
                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={handlePasswordChange}
                    required
                    autoComplete="current-password"
                    placeholder=" "
                    aria-invalid={Boolean(fieldErrors.password)}
                    className="peer min-h-[44px] w-full rounded-2xl border border-border-subtle bg-surface-alt px-3 pr-12 pb-1 pt-4 text-sm text-text transition-colors placeholder:text-transparent focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <label
                    htmlFor="login-password"
                    className="pointer-events-none absolute left-3 top-2 text-xs font-medium text-muted transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-placeholder-shown:text-muted peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-primary"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleTogglePassword}
                    className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                  </button>
                </div>
                {fieldErrors.password ? <p className="form-error">{fieldErrors.password}</p> : null}
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="text-xs text-muted">Pastikan email dan password kamu benar.</div>
                <a
                  className="font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2"
                  href="/forgot-password"
                >
                  Forgot Password?
                </a>
              </div>

              <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Memproses…
                  </>
                ) : (
                  'Login'
                )}
              </button>
            </form>
          </div>

          {hasErrors ? (
            <p className="text-xs text-muted" aria-live="polite">
              Silakan periksa kembali data yang dimasukkan.
            </p>
          ) : null}
        </div>
      </div>

      <div className="order-2 flex items-stretch px-6 pb-10 md:order-2 md:px-8 md:pb-10 md:pt-10 lg:px-16">
        <div className="h-full w-full rounded-3xl border border-border-subtle bg-surface" aria-hidden="true" />
      </div>
    </div>
  );
}
