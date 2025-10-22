import { FormEvent, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Logo from "../components/Logo";
import { Icon } from "../components/icons";

const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;

export default function AuthLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((value) => !value);
  }, []);

  const handleSocialLogin = useCallback((provider: "Google" | "Apple") => {
    console.info(`Login via ${provider} (mock)`);
    window.alert(`Login via ${provider} (mock)`);
  }, []);

  const resetErrors = useCallback(() => {
    setErrors({ email: "", password: "" });
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isSubmitting) return;

      resetErrors();
      let hasError = false;

      if (!email.trim()) {
        hasError = true;
        setErrors((prev) => ({ ...prev, email: "Email wajib diisi." }));
      } else if (!EMAIL_PATTERN.test(email.trim())) {
        hasError = true;
        setErrors((prev) => ({ ...prev, email: "Gunakan format email yang valid." }));
      }

      if (!password.trim()) {
        hasError = true;
        setErrors((prev) => ({ ...prev, password: "Password wajib diisi." }));
      }

      if (hasError) {
        return;
      }

      setIsSubmitting(true);
      await new Promise((resolve) => setTimeout(resolve, 800));
      window.alert("Login berhasil (mock)");
      setIsSubmitting(false);
    },
    [email, isSubmitting, password, resetErrors]
  );

  const passwordToggleIcon = useMemo(() => {
    return showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />;
  }, [showPassword]);

  return (
    <div className="grid min-h-screen w-full grid-cols-1 items-stretch bg-background md:grid-cols-2 lg:grid-cols-[2fr_3fr]">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-md space-y-10">
          <div className="flex items-start gap-4">
            <Logo className="h-10 w-10" />
            <div>
              <p className="text-xl font-semibold text-text">HematWoi</p>
              <p className="text-sm text-muted">Atur keuangan kamu dengan tenang</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="btn w-full"
                onClick={() => handleSocialLogin("Google")}
              >
                <Icon name="brand-google" className="h-5 w-5" />
                <span>Sign in with Google</span>
              </button>
              <button
                type="button"
                className="btn w-full"
                onClick={() => handleSocialLogin("Apple")}
              >
                <Icon name="brand-apple" className="h-5 w-5" />
                <span>Sign in with Apple</span>
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted">
              <div className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
              <span className="font-medium">OR</span>
              <div className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
            </div>

            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-text">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={errors.email ? "true" : undefined}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
                {errors.email ? (
                  <p id="email-error" className="text-xs font-medium text-danger" aria-live="polite">
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium text-text">
                    Password
                  </label>
                  <Link to="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="pr-12"
                    aria-invalid={errors.password ? "true" : undefined}
                    aria-describedby={errors.password ? "password-error" : undefined}
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-3 flex items-center justify-center rounded-full p-1 text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                  >
                    <span className="sr-only">{showPassword ? "Sembunyikan password" : "Tampilkan password"}</span>
                    {passwordToggleIcon}
                  </button>
                </div>
                {errors.password ? (
                  <p id="password-error" className="text-xs font-medium text-danger" aria-live="polite">
                    {errors.password}
                  </p>
                ) : null}
              </div>

              <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Memproses...</span>
                  </span>
                ) : (
                  "Login"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="flex h-full w-full flex-col justify-center p-6 md:p-10">
        <div className="h-full w-full rounded-3xl border border-border-subtle bg-surface-alt shadow-sm" aria-hidden="true" />
      </div>
    </div>
  );
}
