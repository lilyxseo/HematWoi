import type { ChangeEvent, FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const emailRegex = /^(?:[a-zA-Z0-9_'^&+{}=\-`~!#$%*?\/|]+(?:\.[a-zA-Z0-9_'^&+{}=\-`~!#$%*?\/|]+)*|"(?:[^"\\]|\\.)+")@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

export default function DashboardLogin() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const isFormValid = useMemo(() => {
    return emailRegex.test(form.email.trim()) && form.password.trim().length > 0;
  }, [form.email, form.password]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: typeof errors = {};

    if (!form.email.trim()) {
      nextErrors.email = 'Email wajib diisi.';
    } else if (!emailRegex.test(form.email.trim())) {
      nextErrors.email = 'Format email tidak valid.';
    }

    if (!form.password.trim()) {
      nextErrors.password = 'Password wajib diisi.';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    window.setTimeout(() => {
      window.alert('Login berhasil!');
      setLoading(false);
    }, 1000);
  };

  const handleSocialLogin = (provider: 'Google' | 'Apple') => {
    console.log(`Login via ${provider}`);
    window.alert(`Login via ${provider} berhasil (mock)`);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-100 via-gray-50 to-indigo-50 px-[6vw] py-[10vh] font-sans text-slate-800 md:px-[8vw] lg:px-[10vw] lg:py-[8vh]">
      <div className="mx-auto flex max-w-[1200px] animate-fade-in flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white/80 shadow-xl shadow-slate-200/60 backdrop-blur-md transition-shadow duration-300 hover:shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-[0.44fr_0.56fr]">
          <div className="flex flex-col gap-8 px-6 py-10 md:px-10 lg:px-14">
            <header className="space-y-6">
              <Link to="/" className="inline-flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500 text-white shadow-md">
                  IQ
                </span>
                <span className="text-lg font-semibold text-slate-900">IQMS Dashboard</span>
              </Link>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold text-slate-900 md:text-[2.2rem]">Login to Dashboard</h1>
                <p className="text-sm text-slate-500">Fill the below form to login</p>
              </div>
            </header>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => handleSocialLogin('Google')}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 11v3.6h5.1c-.2 1.3-.9 2.4-1.9 3.1l3 2.3c1.8-1.6 2.8-3.9 2.8-6.6 0-.6-.1-1.3-.2-1.9H12Z"
                    fill="#4285F4"
                  />
                  <path
                    d="M6.7 13.7l-.8.6-2.4 1.9A8.94 8.94 0 0 1 3 12c0-1.4.3-2.7.9-3.8l2.8 2.2c-.2.6-.3 1.1-.3 1.6 0 .6.1 1.1.3 1.7Z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 4.8c1.3 0 2.5.5 3.4 1.4l2.5-2.5A8.92 8.92 0 0 0 12 3a9 9 0 0 0-8 4.9l3.2 2.5C7.8 7.7 9.7 6 12 6Z"
                    fill="#34A853"
                  />
                  <path
                    d="m12 21c2.4 0 4.6-.8 6.1-2.3l-3-2.3c-.8.5-1.9.8-3.1.8-2.3 0-4.2-1.6-4.9-3.8L3.9 16C5.4 18.8 8.4 21 12 21Z"
                    fill="#EA4335"
                  />
                </svg>
                Sign in with Google
              </button>
              <button
                type="button"
                onClick={() => handleSocialLogin('Apple')}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                >
                  <path d="M16.365 1.43c0 1.14-.418 2.09-1.254 2.85-.99.918-2.125.838-2.125.918 0 .08 1.135.159 2.125 1.277 1.135 1.118 1.254 2.314 1.254 2.314h-.089s-1.045.159-2.08-.798c-.796-.638-1.254-1.516-1.254-1.516h-.089s-.596 1.197-1.493 1.835c-.975.877-2.348.598-2.348.598h-.089s.298 1.755 1.612 3.192c.895.957 1.85 1.674 3.324 1.674 1.433 0 2.487-.777 3.144-.777.657 0 1.433.797 2.189.797.716 0 1.373-.199 1.91-.399 0 0-.995 3.47-3.501 3.47-1.234 0-2.19-.877-2.707-.877-.516 0-1.492.877-2.766.877-1.134 0-2.229-.638-3.184-1.555C6.034 13.967 4.78 11.572 4.78 8.779c0-2.514 1.074-4.568 2.488-5.605.915-.637 1.91-.996 2.906-.996.836 0 1.552.279 2.089.279.597 0 1.373-.358 2.467-.358 1.91-.04 3.635.478 3.635.478Z" />
                </svg>
                Sign in with Apple
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
              OR
              <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
            </div>

            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-600">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={handleInputChange}
                  placeholder="you@example.com"
                  className="h-12 rounded-xl border border-slate-200 bg-white/70 px-4 text-sm text-slate-800 shadow-sm transition-all duration-200 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                {errors.email ? (
                  <p className="text-sm text-red-500" role="alert">
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium text-slate-600">
                    Password
                  </label>
                  <a
                    href="/forgot-password"
                    className="text-sm font-medium text-indigo-500 underline decoration-indigo-200 underline-offset-4 transition hover:text-indigo-600"
                  >
                    Forgot Password?
                  </a>
                </div>
                <div className="relative flex items-center">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={form.password}
                    onChange={handleInputChange}
                    placeholder="Enter your password"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white/70 px-4 pr-12 text-sm text-slate-800 shadow-sm transition-all duration-200 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-2 inline-flex items-center rounded-lg px-2 text-xl text-slate-400 transition hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                {errors.password ? (
                  <p className="text-sm text-red-500" role="alert">
                    {errors.password}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={loading || !isFormValid}
                className="relative flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 text-sm font-semibold text-white shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 opacity-90" aria-hidden="true" />
                <span className="relative flex items-center gap-2">
                  {loading ? (
                    <svg
                      className="h-5 w-5 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
                    </svg>
                  ) : null}
                  {loading ? 'Processing...' : 'Login'}
                </span>
              </button>
            </form>
          </div>

          <div className="flex items-center bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 px-6 py-10 md:px-8 lg:px-12">
            <div className="w-full space-y-6 rounded-3xl bg-white/70 p-6 shadow-lg shadow-indigo-200/40 ring-1 ring-white/50 backdrop-blur-lg transition duration-300 md:p-8">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-400">Preview</p>
                <h2 className="text-2xl font-semibold text-slate-800">
                  Manage your operations more professionally
                </h2>
                <p className="text-sm text-slate-500">
                  Gain clear visibility into budgets, schedules, and production workflows all from a single, intelligent dashboard.
                </p>
              </div>

              <div className="grid gap-4 rounded-2xl bg-white/80 p-4 shadow-inner shadow-indigo-100">
                <div className="grid gap-3 md:grid-cols-[0.35fr_0.65fr]">
                  <aside className="flex flex-col gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm font-medium text-indigo-600">
                    {['Overview', 'Structures', 'Pour Sessions', 'Reports'].map((item, index) => (
                      <button
                        key={item}
                        type="button"
                        className={`flex items-center justify-between rounded-lg px-3 py-2 transition-all duration-200 ${
                          index === 0
                            ? 'bg-white/90 text-indigo-600 shadow-sm'
                            : 'hover:bg-white/60 hover:text-indigo-700'
                        }`}
                      >
                        <span>{item}</span>
                        <span className="text-xs text-indigo-300">›</span>
                      </button>
                    ))}
                  </aside>

                  <section className="flex flex-col gap-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      {[
                        { label: 'Active Projects', value: '12' },
                        { label: 'Teams Online', value: '8' },
                        { label: 'Alerts', value: '3' },
                      ].map((stat) => (
                        <article
                          key={stat.label}
                          className="rounded-xl border border-indigo-100 bg-white/90 p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <p className="text-xs uppercase tracking-wide text-indigo-300">{stat.label}</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-800">{stat.value}</p>
                        </article>
                      ))}
                    </div>

                    <div className="space-y-3 rounded-xl border border-indigo-100 bg-white/90 p-4 shadow-sm">
                      <div className="flex items-center justify-between text-sm text-slate-500">
                        <span className="font-semibold text-slate-700">Project Calendar</span>
                        <span className="text-xs text-indigo-400">June 2025</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        {[
                          { day: 'Mon', status: 'In Progress', tone: 'bg-indigo-100 text-indigo-600' },
                          { day: 'Tue', status: 'Finished', tone: 'bg-emerald-100 text-emerald-600' },
                          { day: 'Wed', status: 'Not Started', tone: 'bg-slate-100 text-slate-500' },
                          { day: 'Thu', status: 'In Progress', tone: 'bg-indigo-100 text-indigo-600' },
                          { day: 'Fri', status: 'Finished', tone: 'bg-emerald-100 text-emerald-600' },
                          { day: 'Sat', status: 'Not Started', tone: 'bg-slate-100 text-slate-500' },
                        ].map((item) => (
                          <div
                            key={item.day + item.status}
                            className="flex flex-col items-start gap-1 rounded-lg border border-indigo-50 bg-white/70 p-3 transition hover:-translate-y-0.5 hover:border-indigo-200"
                          >
                            <span className="text-xs font-semibold uppercase text-slate-400">{item.day}</span>
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${item.tone}`}>{item.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
