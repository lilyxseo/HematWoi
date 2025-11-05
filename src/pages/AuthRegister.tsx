import { useCallback, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import ErrorBoundary from '../components/system/ErrorBoundary';
import Logo from '../components/Logo';
import { registerWithoutConfirmation, signInWithPassword } from '../lib/auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

type FormState = {
  fullName: string;
  email: string;
  password: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

type StatusState = {
  type: 'success' | 'error' | 'info';
  message: string;
} | null;

export default function AuthRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({ fullName: '', email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<StatusState>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleFieldChange = useCallback(
    (field: keyof FormState) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setForm((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: undefined }));
        setStatus(null);
      },
    []
  );

  const passwordType = useMemo(() => (showPassword ? 'text' : 'password'), [showPassword]);

  const validate = useCallback((state: FormState): FormErrors => {
    const nextErrors: FormErrors = {};
    if (!state.fullName.trim()) {
      nextErrors.fullName = 'Nama lengkap wajib diisi.';
    }
    const email = state.email.trim();
    if (!email) {
      nextErrors.email = 'Email wajib diisi.';
    } else if (!EMAIL_PATTERN.test(email)) {
      nextErrors.email = 'Gunakan format email yang valid.';
    }
    if (!state.password) {
      nextErrors.password = 'Kata sandi wajib diisi.';
    } else if (state.password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`;
    }
    return nextErrors;
  }, []);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (loading) return;

      const nextErrors = validate(form);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        return;
      }

      setLoading(true);
      setStatus({ type: 'info', message: 'Memproses pendaftaran…' });

      try {
        const email = form.email.trim().toLowerCase();
        const fullName = form.fullName.trim();

        await registerWithoutConfirmation({
          email,
          password: form.password,
          fullName,
        });

        await signInWithPassword({ email, password: form.password });

        setStatus({ type: 'success', message: 'Berhasil mendaftar. Mengalihkan…' });
        setForm({ fullName: '', email: '', password: '' });
        navigate('/dashboard', { replace: true });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Terjadi kesalahan. Silakan coba lagi nanti.';
        setStatus({ type: 'error', message });
        if (message.toLowerCase().includes('email')) {
          setErrors((prev) => ({ ...prev, email: message }));
        } else if (message.toLowerCase().includes('sand') || message.toLowerCase().includes('password')) {
          setErrors((prev) => ({ ...prev, password: message }));
        }
      } finally {
        setLoading(false);
      }
    },
    [form, loading, navigate, validate]
  );

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

          <section className="flex flex-col justify-center px-6 pb-16 pt-10 sm:px-12 sm:pb-24 sm:pt-20 lg:px-16 lg:py-12">
            <div className="mx-auto w-full max-w-[420px] space-y-10">
              <div className="flex items-center justify-center">
                <Link to="/" className="inline-flex items-center gap-2 text-lg font-semibold text-primary">
                  <Logo className="h-8 w-8" aria-hidden="true" />
                  HematWoi
                </Link>
              </div>

              <div className="space-y-6">
                <div className="space-y-2 text-center">
                  <h1 className="text-2xl font-bold">Buat akun baru</h1>
                  <p className="text-sm text-text-muted">Daftar dan mulai atur keuanganmu sekarang juga.</p>
                </div>

                {status ? (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      status.type === 'error'
                        ? 'border-danger/30 bg-danger/5 text-danger'
                        : status.type === 'success'
                          ? 'border-success/30 bg-success/5 text-success'
                          : 'border-border-subtle bg-surface-alt text-text'
                    }`}
                    role="status"
                    aria-live="polite"
                  >
                    {status.message}
                  </div>
                ) : null}

                <form className="space-y-5" onSubmit={handleSubmit} noValidate>
                  <div className="space-y-2">
                    <label htmlFor="fullName" className="text-sm font-semibold text-text">
                      Nama Lengkap
                    </label>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      autoComplete="name"
                      value={form.fullName}
                      onChange={handleFieldChange('fullName')}
                      className="input"
                      placeholder="Nama lengkap"
                      required
                    />
                    {errors.fullName ? (
                      <p className="text-xs text-danger" role="alert" aria-live="polite">
                        {errors.fullName}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-semibold text-text">
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={handleFieldChange('email')}
                      className="input"
                      placeholder="nama@email.com"
                      required
                    />
                    {errors.email ? (
                      <p className="text-xs text-danger" role="alert" aria-live="polite">
                        {errors.email}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-semibold text-text">
                      Kata Sandi
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        name="password"
                        type={passwordType}
                        autoComplete="new-password"
                        value={form.password}
                        onChange={handleFieldChange('password')}
                        className="input pr-12"
                        placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter`}
                        required
                      />
                      <button
                        type="button"
                        onClick={togglePasswordVisibility}
                        className="absolute inset-y-0 right-3 flex items-center text-text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                        aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </div>
                    {errors.password ? (
                      <p className="text-xs text-danger" role="alert" aria-live="polite">
                        {errors.password}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="submit"
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                    ) : null}
                    <span>{loading ? 'Mendaftar…' : 'Daftar'}</span>
                  </button>
                </form>

                <p className="text-center text-sm text-text-muted">
                  Sudah punya akun?{' '}
                  <Link
                    to="/auth"
                    className="font-semibold text-primary transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                  >
                    Masuk di sini
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
