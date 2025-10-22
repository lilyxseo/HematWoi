import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const emailRegex = /^(?:[a-zA-Z0-9_'^&\+`{}~!#$%*?\/\|=.-]+)@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

type FieldErrors = {
  email?: string;
  password?: string;
};

export default function ModernLoginDashboard() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

  const validate = () => {
    const newErrors: FieldErrors = {};

    if (!email.trim()) {
      newErrors.email = 'Email wajib diisi.';
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = 'Format email tidak valid.';
    }

    if (!password.trim()) {
      newErrors.password = 'Password wajib diisi.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      alert('Login berhasil!');
      setIsSubmitting(false);
    }, 800);
  };

  const handleSocialLogin = (provider: 'Google' | 'Apple') => {
    alert(`Login via ${provider} berhasil (mock)`);
    console.log(`Login via ${provider} berhasil (mock)`);
  };

  return (
    <main className="min-h-screen bg-gray-50 px-[6vw] py-[10vh] font-sans text-slate-900">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-center">
        <div className="grid w-full gap-10 overflow-hidden rounded-2xl border border-gray-200 bg-white/80 p-8 shadow-xl backdrop-blur-md transition-all duration-300 sm:p-10 lg:grid-cols-[0.44fr_0.56fr] animate-fade-in">
          <section className="flex flex-col gap-8" aria-labelledby="login-form-heading">
            <header className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-lg font-semibold text-indigo-600">IQ</span>
                <span className="text-lg font-semibold tracking-wide text-slate-800">IQMS Dashboard</span>
              </div>
              <div>
                <h1 id="login-form-heading" className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                  Login to Dashboard
                </h1>
                <p className="mt-1 text-sm text-slate-500">Fill the below form to login</p>
              </div>
            </header>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => handleSocialLogin('Google')}
                className="group flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <span className="flex items-center justify-center gap-3">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true" fill="none">
                    <path
                      d="M20.283 12.341c0-.638-.057-1.252-.164-1.841H12v3.48h4.637a3.96 3.96 0 0 1-1.719 2.595v2.16h2.777c1.628-1.498 2.588-3.705 2.588-6.394Z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 21c2.34 0 4.298-.773 5.73-2.165l-2.777-2.16c-.77.518-1.754.825-2.953.825-2.266 0-4.186-1.536-4.872-3.6H4.188v2.258A8.997 8.997 0 0 0 12 21Z"
                      fill="#34A853"
                    />
                    <path
                      d="M7.128 13.9A5.4 5.4 0 0 1 6.834 12c0-.66.118-1.3.294-1.9V7.842H4.188A8.997 8.997 0 0 0 3 12a8.997 8.997 0 0 0 1.188 4.158L7.128 13.9Z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 6.3c1.273 0 2.41.439 3.303 1.302l2.475-2.475C16.296 3.83 14.338 3 12 3 8.188 3 4.884 5.187 3.188 8.158L6.834 10.1C7.62 8.036 9.734 6.3 12 6.3Z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>Sign in with Google</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleSocialLogin('Apple')}
                className="group flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <span className="flex items-center justify-center gap-3">
                  <svg className="h-5 w-5 text-slate-900" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                    <path d="M16.365 1.43c0 1.14-.417 2.082-1.253 2.832-.836.75-1.788 1.193-2.855 1.328-.047-.137-.07-.332-.07-.586 0-1.09.42-2.01 1.259-2.758.839-.747 1.791-1.195 2.857-1.344.041.172.062.375.062.528Z" />
                    <path d="M21 17.122c-.328.747-.713 1.422-1.152 2.025-.666.934-1.193 1.577-1.579 1.928-.629.58-1.303.876-2.023.887-.517 0-1.142-.148-1.874-.442-.733-.295-1.407-.442-2.023-.442-.656 0-1.354.147-2.095.442-.74.295-1.338.45-1.792.463-.679.03-1.372-.277-2.077-.923-.443-.4-.99-1.065-1.64-1.996-.704-.995-1.286-2.145-1.744-3.45C2.333 13.03 2 11.776 2 10.56c0-1.599.346-2.98 1.037-4.147C3.78 5.065 4.7 4.24 5.8 3.717c.862-.413 1.793-.634 2.794-.662.548 0 1.266.17 2.155.51.89.34 1.46.512 1.71.512.184 0 .812-.197 1.882-.59.756-.273 1.395-.388 1.918-.348 1.418.114 2.492.674 3.224 1.68-1.281.776-1.918 1.868-1.906 3.276.012 1.09.408 1.994 1.188 2.712.353.336.748.598 1.183.787-.095.28-.196.548-.303.805Z" />
                  </svg>
                  <span>Sign in with Apple</span>
                </span>
              </button>
            </div>

            <div className="relative flex items-center justify-center" role="presentation">
              <span className="h-px w-full bg-gray-200" aria-hidden="true" />
              <span className="absolute rounded-full bg-white px-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                OR
              </span>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={`w-full rounded-xl border px-4 py-3 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-0 ${
                    errors.email ? 'border-red-400 focus:border-red-400' : 'border-gray-200 focus:border-indigo-300'
                  }`}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  required
                />
                {errors.email ? (
                  <p id="email-error" className="text-xs text-red-500">
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Password
                </label>
                <div
                  className={`flex items-center rounded-xl border ${
                    errors.password ? 'border-red-400' : 'border-gray-200'
                  } focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-400`}
                >
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border-0 bg-transparent px-4 py-3 text-sm focus:outline-none"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    required
                  />
                  <button
                    type="button"
                    className="pr-3 text-lg text-slate-500 transition hover:text-indigo-500 focus:outline-none focus-visible:text-indigo-500"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                {errors.password ? (
                  <p id="password-error" className="text-xs text-red-500">
                    {errors.password}
                  </p>
                ) : null}
                <div className="text-right">
                  <Link
                    to="/forgot-password"
                    className="text-sm font-medium text-indigo-600 underline transition hover:text-indigo-500"
                  >
                    Forgot Password?
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-sm font-semibold text-white shadow-md transition focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="absolute inset-0 opacity-0 transition group-hover:opacity-20" aria-hidden="true" />
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-transparent" aria-hidden="true" />
                    Processing...
                  </span>
                ) : (
                  'Login'
                )}
              </button>

              {hasErrors ? (
                <p className="text-center text-xs text-slate-400">Pastikan semua input terisi dengan benar sebelum melanjutkan.</p>
              ) : null}
            </form>
          </section>

          <section
            className="flex min-h-[260px] flex-col justify-between gap-6 rounded-xl bg-gradient-to-br from-indigo-50 via-purple-50 to-purple-100 p-6 shadow-inner transition-all duration-300 lg:min-h-[540px]"
            aria-label="Dashboard preview"
          >
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-400">Dashboard Preview</p>
              <h2 className="text-2xl font-semibold text-slate-800">Manage your operations more professionally</h2>
              <p className="text-sm text-slate-500">
                Monitor structured data, keep projects on track, and collaborate seamlessly with your team.
              </p>
            </div>

            <div className="grid flex-1 gap-4 lg:grid-cols-[0.3fr_0.7fr]">
              <aside className="flex flex-col gap-2 rounded-lg bg-white/70 p-4 shadow-sm backdrop-blur-sm">
                {['Overview', 'Structures', 'Pour Sessions', 'Reports'].map((item, index) => (
                  <button
                    key={item}
                    type="button"
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                      index === 0
                        ? 'bg-gradient-to-r from-indigo-500/80 to-purple-500/80 text-white shadow'
                        : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
                    }`}
                  >
                    <span>{item}</span>
                    {index === 0 ? <span className="text-xs uppercase tracking-wide">Active</span> : null}
                  </button>
                ))}
              </aside>

              <div className="flex flex-col gap-4 rounded-lg bg-white/70 p-4 shadow-sm backdrop-blur-sm">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Active Projects', value: '24' },
                    { label: 'In Progress', value: '12' },
                    { label: 'Revenue', value: '$86K' },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg border border-white/60 bg-gradient-to-br from-white to-indigo-50/60 p-3 text-sm shadow-sm transition"
                    >
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{stat.label}</p>
                      <p className="mt-2 text-xl font-semibold text-slate-800">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">Project Calendar</h3>
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-600">August</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { day: '12 Mon', status: 'In Progress', tone: 'bg-amber-100 text-amber-700' },
                      { day: '13 Tue', status: 'Finished', tone: 'bg-emerald-100 text-emerald-700' },
                      { day: '14 Wed', status: 'Not Started', tone: 'bg-slate-100 text-slate-600' },
                      { day: '15 Thu', status: 'In Progress', tone: 'bg-amber-100 text-amber-700' },
                      { day: '16 Fri', status: 'Finished', tone: 'bg-emerald-100 text-emerald-700' },
                      { day: '17 Sat', status: 'In Progress', tone: 'bg-amber-100 text-amber-700' },
                    ].map((item) => (
                      <div
                        key={item.day}
                        className={`flex flex-col gap-1 rounded-lg border border-white/60 bg-white/60 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${item.tone}`}
                      >
                        <span className="text-xs font-semibold">{item.day}</span>
                        <span className="text-[11px] font-medium">{item.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
