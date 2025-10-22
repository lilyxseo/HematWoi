import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

import Logo from '../components/Logo';
import { Icon } from '../components/icons';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormErrors = Partial<Record<'email' | 'password', string>>;

type SocialProvider = 'Google' | 'Apple';

export default function AuthLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const emailHintId = errors.email ? 'login-email-error' : undefined;
  const passwordHintId = errors.password ? 'login-password-error' : undefined;

  const validate = () => {
    const nextErrors: FormErrors = {};
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail) {
      nextErrors.email = 'Email wajib diisi.';
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      nextErrors.email = 'Masukkan email yang valid.';
    }

    if (!trimmedPassword) {
      nextErrors.password = 'Password wajib diisi.';
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      // Mock login success notification
      alert('Login berhasil (mock)');
      console.log('Login berhasil (mock)');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSocialClick = (provider: SocialProvider) => {
    console.log(`Login via ${provider} (mock)`);
    alert(`Login via ${provider} (mock)`);
  };

  return (
    <div className="grid min-h-screen w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-12">
      <div className="order-1 flex flex-col justify-center px-6 py-12 sm:px-10 md:col-span-1 lg:col-span-5 xl:px-16">
        <div className="mx-auto w-full max-w-md space-y-10">
          <header className="flex items-center gap-3">
            <Logo className="h-10 w-10" title="HematWoi" />
            <div>
              <p className="text-lg font-semibold leading-tight text-text">HematWoi</p>
              <p className="text-sm text-muted">Atur keuangan kamu dengan tenang</p>
            </div>
          </header>

          <div className="space-y-8">
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => handleSocialClick('Google')}
                className="btn w-full"
              >
                <Icon name="IconBrandGoogle" className="h-5 w-5" label="Google" />
                <span>Sign in with Google</span>
              </button>
              <button
                type="button"
                onClick={() => handleSocialClick('Apple')}
                className="btn w-full"
              >
                <Icon name="IconBrandApple" className="h-5 w-5" label="Apple" />
                <span>Sign in with Apple</span>
              </button>
            </div>

            <div className="flex items-center gap-4">
              <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
              <span className="text-xs font-semibold tracking-wide text-muted">OR</span>
              <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
            </div>

            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              <div className="space-y-2">
                <label htmlFor="login-email" className="text-sm font-medium text-text">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (errors.email) {
                      setErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  required
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={emailHintId}
                  autoComplete="email"
                  inputMode="email"
                />
                {errors.email ? (
                  <p id={emailHintId} className="text-xs font-medium text-danger" role="alert">
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label htmlFor="login-password" className="text-sm font-medium text-text">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (errors.password) {
                        setErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    required
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={passwordHintId}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-3 flex items-center justify-center rounded-full p-2 text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password ? (
                  <p id={passwordHintId} className="text-xs font-medium text-danger" role="alert">
                    {errors.password}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center justify-end">
                <Link to="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
                  Forgot Password?
                </Link>
              </div>

              <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden="true"
                    />
                    <span>Memproses...</span>
                  </>
                ) : (
                  'Login'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="order-2 flex min-h-[280px] items-center justify-center border-t border-border-subtle bg-surface-alt px-6 py-12 sm:px-10 md:col-span-1 md:border-l md:border-t-0 lg:order-2 lg:col-span-7">
        <div className="h-full w-full max-w-3xl rounded-3xl border border-border-subtle bg-surface" aria-hidden="true" />
      </div>
    </div>
  );
}
