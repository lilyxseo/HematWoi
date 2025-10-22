import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const EMAIL_REGEX = /^(?:[a-zA-Z0-9_'^&%+\-])+(?:\.(?:[a-zA-Z0-9_'^&%+\-])+)*@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

type FormErrors = {
  email?: string;
  password?: string;
};

const socialProviders = [
  {
    id: 'google',
    label: 'Sign in with Google',
    icon: (
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M21.6 12.2273C21.6 11.4182 21.5273 10.8364 21.3727 10.2273H12V13.9728H17.7091C17.5937 14.8819 17 16.3 15.6091 17.2364L15.5886 17.3669L18.6454 19.7305L18.8573 19.751C20.8 17.9728 21.6 15.3364 21.6 12.2273Z"
          fill="#4285F4"
        />
        <path
          d="M12 21.6C14.9073 21.6 17.3364 20.641 18.8573 19.751L15.6091 17.2364C14.8364 17.7637 13.8 18.1728 12 18.1728C9.16366 18.1728 6.78185 16.3946 5.92729 13.9L5.80542 13.9109L2.625 16.3636L2.58331 16.4818C4.0909 19.8091 7.77274 21.6 12 21.6Z"
          fill="#34A853"
        />
        <path
          d="M5.92725 13.9C5.70283 13.2909 5.57272 12.6364 5.57272 11.9546C5.57272 11.2727 5.70283 10.6182 5.91607 10.0091L5.91005 9.87159L2.68859 7.38184L2.58327 7.42725C1.90916 8.78184 1.52728 10.3182 1.52728 11.9546C1.52728 13.5909 1.90916 15.1273 2.58327 16.4818L5.92725 13.9Z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.72727C14.0727 5.72727 15.4727 6.61818 16.2909 7.36363L18.9336 4.83631C17.3255 3.25449 14.9073 2.4 12 2.4C7.77274 2.4 4.0909 4.1909 2.58331 7.42726L5.91611 10.0091C6.78186 7.51455 9.16368 5.72727 12 5.72727Z"
          fill="#EA4335"
        />
      </svg>
    ),
  },
  {
    id: 'apple',
    label: 'Sign in with Apple',
    icon: (
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M18.71 13.89c-.03-3.13 2.55-4.64 2.67-4.72-1.46-2.15-3.73-2.44-4.53-2.46-1.93-.2-3.76 1.16-4.73 1.16-.99 0-2.49-1.14-4.09-1.11-2.1.03-4.05 1.22-5.12 3.1-2.19 3.8-.56 9.42 1.57 12.52 1.06 1.52 2.31 3.23 3.96 3.17 1.58-.06 2.17-1.02 4.08-1.02 1.9 0 2.43 1.02 4.09.99 1.69-.03 2.76-1.54 3.8-3.07 1.2-1.77 1.7-3.49 1.72-3.58-.04-.02-3.29-1.26-3.32-4.98z" />
        <path d="M15.73 4.23c.85-1.03 1.43-2.45 1.27-3.87-1.23.05-2.72.82-3.6 1.85-.79.92-1.49 2.39-1.31 3.79 1.38.11 2.79-.7 3.64-1.77z" />
      </svg>
    ),
  },
];

export default function ModernDashboardLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formSpacing = useMemo(() => 'space-y-5', []);

  const handleValidate = () => {
    const nextErrors: FormErrors = {};

    if (!email.trim()) {
      nextErrors.email = 'Email wajib diisi.';
    } else if (!EMAIL_REGEX.test(email.trim())) {
      nextErrors.email = 'Masukkan email yang valid.';
    }

    if (!password.trim()) {
      nextErrors.password = 'Password wajib diisi.';
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const isValid = handleValidate();
    if (!isValid) {
      return;
    }

    try {
      setIsSubmitting(true);
      await new Promise((resolve) => setTimeout(resolve, 600));
      console.log('[ModernDashboardLogin] Login success mock');
      alert('Login berhasil!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocialLogin = (provider: 'google' | 'apple') => {
    console.log(`[ModernDashboardLogin] Social login via ${provider}`);
    const providerLabel = provider === 'google' ? 'Google' : 'Apple';
    alert(`Login via ${providerLabel} berhasil (mock)`);
  };

  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-slate-100"
      style={{ fontFamily: 'Inter, Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      <div className="flex min-h-screen items-center justify-center px-[6vw] py-[10vh] md:px-[7vw] lg:px-[8vw] xl:px-[10vw]">
        <div className="w-full max-w-[1200px] overflow-hidden rounded-2xl border border-gray-200 bg-white/80 shadow-xl backdrop-blur-md transition-all duration-300">
          <div className="grid grid-cols-1 md:grid-cols-[44%_56%]">
            <div className="flex flex-col justify-between gap-10 p-8 sm:p-10 lg:p-12">
              <div className="space-y-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-lg font-semibold text-indigo-600 shadow-sm">
                    IQ
                  </div>
                  <div>
                    <p className="text-base font-semibold text-gray-900">IQMS Dashboard</p>
                    <p className="text-xs text-gray-500">HematWoi Suite</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h1 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
                    Login to Dashboard
                  </h1>
                  <p className="text-sm text-gray-500">Fill the below form to login</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  {socialProviders.map((provider) => (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => handleSocialLogin(provider.id as 'google' | 'apple')}
                      className="group inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white/80 px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 sm:w-auto"
                      aria-label={provider.label}
                    >
                      <span className="text-gray-500 transition-transform duration-200 group-hover:scale-105">
                        {provider.icon}
                      </span>
                      {provider.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-4">
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                  <span className="text-xs font-semibold tracking-[0.3em] text-gray-400">OR</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                </div>

                <form className={formSpacing} onSubmit={handleSubmit} noValidate>
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium text-gray-700">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      aria-label="Email address"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white/80 px-4 py-3 text-sm text-gray-900 shadow-sm transition-all duration-200 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    {errors.email ? (
                      <p className="text-xs text-red-500">{errors.email}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <label htmlFor="password" className="font-medium text-gray-700">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="font-medium text-indigo-500 underline-offset-4 transition-colors duration-200 hover:text-indigo-600 hover:underline focus:outline-none focus-visible:text-indigo-600"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        aria-label="Password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white/80 px-4 py-3 pr-12 text-sm text-gray-900 shadow-sm transition-all duration-200 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-3 flex items-center text-lg text-gray-500 transition-colors duration-200 hover:text-gray-700 focus:outline-none"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
                    {errors.password ? (
                      <p className="text-xs text-red-500">{errors.password}</p>
                    ) : null}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="relative inline-flex w-full items-center justify-center overflow-hidden rounded-lg bg-gradient-to-r from-indigo-500 via-indigo-500 to-purple-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-0 transition-opacity duration-300 hover:opacity-20" aria-hidden="true" />
                    <span className="flex items-center gap-2">
                      {isSubmitting ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" aria-hidden="true" />
                      ) : null}
                      <span>{isSubmitting ? 'Processing...' : 'Login'}</span>
                    </span>
                  </button>
                </form>
              </div>

              <p className="text-center text-xs text-gray-400">
                By continuing you agree to our <span className="font-semibold text-gray-500">Terms</span> and{' '}
                <span className="font-semibold text-gray-500">Privacy Policy</span>.
              </p>
            </div>

            <div className="flex min-h-[260px] flex-col justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-8 sm:p-10 lg:p-12">
              <div className="animate-[fade-in_0.6s_ease] space-y-6 rounded-xl border border-white/60 bg-white/70 p-6 shadow-md backdrop-blur-md transition-all duration-300">
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
                    Manage smarter
                  </span>
                  <h2 className="text-2xl font-semibold text-gray-900">
                    Manage your operations more professionally
                  </h2>
                  <p className="text-sm text-gray-500">
                    Monitor budgets, track pour sessions, and keep your structures on schedule.
                  </p>
                </div>

                <div className="flex flex-col gap-6 lg:flex-row">
                  <aside className="flex w-full max-w-[180px] flex-col gap-3">
                    {['Overview', 'Structures', 'Pour Sessions', 'Reports'].map((item, index) => (
                      <div
                        key={item}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                          index === 0
                            ? 'bg-indigo-500/10 text-indigo-600 shadow-sm'
                            : 'text-gray-500 hover:bg-white/70 hover:text-indigo-600'
                        }`}
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${index === 0 ? 'bg-indigo-500' : 'bg-gray-300'}`} />
                        {item}
                      </div>
                    ))}
                  </aside>

                  <div className="flex-1 space-y-6">
                    <div className="grid gap-4 sm:grid-cols-3">
                      {[
                        { title: 'Active Projects', value: '12' },
                        { title: 'Pour Sessions', value: '28' },
                        { title: 'Teams On-site', value: '7' },
                      ].map((stat) => (
                        <div
                          key={stat.title}
                          className="group rounded-lg border border-white/60 bg-white/80 p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg"
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            {stat.title}
                          </p>
                          <p className="mt-3 text-2xl font-semibold text-gray-900">{stat.value}</p>
                          <span className="mt-1 inline-flex items-center text-xs text-green-500">
                            ▲ 4.3%
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-700">Schedule Overview</h3>
                        <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-600">
                          March 2025
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        {[
                          { label: 'In Progress', status: 'bg-amber-100 text-amber-700', description: 'Structure #08' },
                          { label: 'Finished', status: 'bg-emerald-100 text-emerald-700', description: 'Pour 21' },
                          { label: 'Not Started', status: 'bg-slate-100 text-slate-600', description: 'Report Q2' },
                          { label: 'In Progress', status: 'bg-amber-100 text-amber-700', description: 'Structure #12' },
                          { label: 'Finished', status: 'bg-emerald-100 text-emerald-700', description: 'Pour 22' },
                          { label: 'Not Started', status: 'bg-slate-100 text-slate-600', description: 'Team Onboarding' },
                        ].map((item) => (
                          <div
                            key={`${item.label}-${item.description}`}
                            className="rounded-lg border border-white/60 bg-white/80 p-3 shadow-sm transition-all duration-200 hover:border-indigo-200 hover:shadow-lg"
                          >
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${item.status}`}
                            >
                              {item.label}
                            </span>
                            <p className="mt-2 text-sm font-medium text-gray-700">{item.description}</p>
                            <p className="text-xs text-gray-400">Due in 2 days</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

