import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/;

const googleIcon = (
  <svg
    aria-hidden="true"
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M22.5 12.2727c0-.8182-.0682-1.4091-.2182-2.0227H12v3.7091h5.9545c-.1205.9239-.7728 2.3159-2.2182 3.2545l-.0205.1318 3.2227 2.4941.2237.0227C21.4091 18.7045 22.5 15.7727 22.5 12.2727z"
      fill="#4285F4"
    />
    <path
      d="M12 22.5c2.9091 0 5.3545-.9591 7.1386-2.6182l-3.4-2.6336c-.9091.6182-2.1318 1.0455-3.7386 1.0455-2.8636 0-5.2909-1.9182-6.1636-4.5636l-.1273.0105-3.3273 2.5764-.0432.1182C3.1364 19.9773 7.2182 22.5 12 22.5z"
      fill="#34A853"
    />
    <path
      d="M5.83636 13.7309C5.60909 13.1182 5.47727 12.4636 5.47727 11.7727c0-.6909.13182-1.3455.34545-1.9582l-.00568-.13182-3.37273-2.62274-.110229.05045C1.45682 8.48636.954545 10.0682.954545 11.7727c0 1.7045.502275 3.2864 1.379775 4.6627l3.50204-2.7045z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.02273c2.0182 0 3.3818.87272 4.1545 1.6l3.0364-2.94546C17.3409 1.76364 14.9091.75 12 .75 7.21818.75 3.13636 3.27273 1.33409 7.07955l3.49091 2.7341C5.69636 6.94091 8.11818 5.02273 12 5.02273z"
      fill="#EA4335"
    />
  </svg>
);

const appleIcon = (
  <svg
    aria-hidden="true"
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M16.365 1.5c0 1.098-.45 2.148-1.209 2.971-.776.84-2.058 1.49-3.129 1.404-.147-1.05.45-2.175 1.209-2.998.776-.84 2.148-1.47 3.129-1.377z" />
    <path d="M20.775 17.748c-.573 1.344-.84 1.94-1.572 3.129-1.02 1.65-2.463 3.705-4.242 3.72-1.575.015-1.995-1.02-4.158-1.02-2.163 0-2.628 1.005-4.203 1.035-1.755.03-3.096-1.875-4.116-3.519-2.235-3.615-3.939-10.233-1.68-14.682 1.164-2.298 3.255-3.75 5.52-3.78 1.725-.03 3.351 1.155 4.173 1.155.822 0 2.28-1.425 3.849-1.215.655.03 2.82.27 4.158 2.325-.105.067-2.475 1.453-2.445 4.35.03 3.465 3.015 4.62 3.045 4.635-.03.075-.48 1.665-1.071 2.587z" />
  </svg>
);

export default function ModernDashboardLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const welcomeTips = useMemo(
    () => [
      'Monitor finances with clarity.',
      'Collaborate across teams effortlessly.',
      'Unlock insights tailored for you.',
    ],
    []
  );

  const validate = () => {
    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      nextErrors.email = 'Email wajib diisi.';
    } else if (!emailRegex.test(email)) {
      nextErrors.email = 'Email tidak valid.';
    }

    if (!password.trim()) {
      nextErrors.password = 'Password wajib diisi.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    window.setTimeout(() => {
      setIsSubmitting(false);
      alert('Login berhasil!');
    }, 600);
  };

  const handleSocialLogin = (provider: 'Google' | 'Apple') => {
    alert(`Login via ${provider} berhasil (mock)`);
    console.log(`Login via ${provider} (mock)`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-indigo-50 px-[6vw] py-[10vh] font-['Inter',_'Poppins',_sans-serif]">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-xl backdrop-blur-md transition-all duration-300 md:p-10 lg:grid-cols-[0.44fr_0.56fr]">
        <div className="flex flex-col justify-between space-y-10 md:space-y-12">
          <div className="space-y-8 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-lg font-semibold text-indigo-600">
                IQ
              </div>
              <span className="text-lg font-semibold text-slate-900">IQMS Dashboard</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">Login to Dashboard</h1>
              <p className="text-sm text-slate-500">Fill the below form to login</p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <button
                type="button"
                onClick={() => handleSocialLogin('Google')}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                {googleIcon}
                Sign in with Google
              </button>
              <button
                type="button"
                onClick={() => handleSocialLogin('Apple')}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                {appleIcon}
                Sign in with Apple
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs font-medium uppercase text-slate-400">
              <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
              OR
              <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
            </div>

            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  className="rounded-xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                {errors.email ? (
                  <p id="email-error" className="text-xs font-medium text-rose-500">
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-indigo-500 underline underline-offset-2 transition-colors duration-150 hover:text-indigo-600"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    required
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    className="w-full rounded-xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-3 flex items-center text-lg text-slate-500 transition-colors duration-150 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                {errors.password ? (
                  <p id="password-error" className="text-xs font-medium text-rose-500">
                    {errors.password}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 text-sm font-semibold text-white shadow-md transition-transform duration-200 hover:scale-[1.01] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2 text-sm">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                    Processing...
                  </span>
                ) : (
                  'Login'
                )}
              </button>
            </form>
          </div>

          <div className="hidden text-sm text-slate-400 md:block">
            <p className="font-medium text-slate-500">Quick tips</p>
            <ul className="mt-2 space-y-1 text-slate-400">
              {welcomeTips.map((tip) => (
                <li key={tip} className="flex items-center gap-2">
                  <span className="text-indigo-400">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50 via-purple-50 to-indigo-100 p-6 shadow-inner transition-all duration-300 md:min-h-[320px] lg:min-h-[540px]">
          <div className="absolute -top-24 right-12 h-48 w-48 rounded-full bg-indigo-200/40 blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-20 left-8 h-36 w-36 rounded-full bg-purple-200/30 blur-3xl" aria-hidden="true" />

          <div className="relative space-y-4 text-indigo-900">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
              Productivity Hub
            </p>
            <h2 className="text-2xl font-semibold leading-tight text-indigo-900 lg:text-3xl">
              Manage your operations more professionally
            </h2>
            <p className="max-w-md text-sm text-indigo-700">
              Streamline team collaboration, monitor project performance, and stay ahead with real-time analytics tailored for construction teams.
            </p>
          </div>

          <div className="relative grid gap-6 rounded-2xl bg-white/70 p-6 shadow-lg backdrop-blur">
            <div className="flex gap-4">
              <div className="w-36 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 p-4 text-white shadow-md">
                <p className="text-xs uppercase tracking-widest text-indigo-100">Overview</p>
                <p className="mt-3 text-3xl font-semibold">82%</p>
                <p className="text-xs text-indigo-100">Project Health</p>
              </div>
              <div className="grid flex-1 gap-3">
                <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-white/80 px-4 py-3 text-sm text-indigo-900">
                  <span>Active Sites</span>
                  <span className="font-semibold">12</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-white/80 px-4 py-3 text-sm text-indigo-900">
                  <span>Team Members</span>
                  <span className="font-semibold">48</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-white/80 px-4 py-3 text-sm text-indigo-900">
                  <span>Alerts</span>
                  <span className="font-semibold text-amber-500">4</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl border border-indigo-100 bg-white/70 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-indigo-900">Project Calendar</p>
                <span className="text-xs font-medium text-indigo-500">August 2024</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs font-medium">
                {[
                  { label: 'Mon', status: 'In Progress', tone: 'text-indigo-600 bg-indigo-100' },
                  { label: 'Tue', status: 'Finished', tone: 'text-emerald-600 bg-emerald-100' },
                  { label: 'Wed', status: 'Not Started', tone: 'text-amber-600 bg-amber-100' },
                  { label: 'Thu', status: 'In Progress', tone: 'text-indigo-600 bg-indigo-100' },
                  { label: 'Fri', status: 'Finished', tone: 'text-emerald-600 bg-emerald-100' },
                  { label: 'Sat', status: 'Not Started', tone: 'text-amber-600 bg-amber-100' },
                ].map((day) => (
                  <div
                    key={`${day.label}-${day.status}`}
                    className={`flex flex-col gap-1 rounded-xl border border-indigo-100 bg-white/80 p-3 text-indigo-900 transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow`}
                  >
                    <span className="text-xs font-semibold uppercase text-slate-500">{day.label}</span>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${day.tone}`}>
                      {day.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
