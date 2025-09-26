import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { DIGEST_PENDING_KEY } from "../hooks/useShowDigestOnLogin";

type Status = "idle" | "loading" | "error";

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-brand" aria-hidden="true" />
      <p className="text-sm text-muted">Menghubungkan akunmu...</p>
    </div>
  );
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);

  useEffect(() => {
    let active = true;
    const code = query.get("code");
    const error = query.get("error") || query.get("error_description");

    if (!code) {
      setStatus("error");
      setErrorMessage(
        error || "Kode otorisasi tidak ditemukan. Silakan coba login kembali.",
      );
      return () => {
        active = false;
      };
    }

    const exchange = async () => {
      try {
        setStatus("loading");
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession({
          code,
        });
        if (!active) return;
        if (exchangeError) {
          setStatus("error");
          setErrorMessage(
            exchangeError.message || "Tidak dapat menyelesaikan proses login.",
          );
          return;
        }
        try {
          sessionStorage.setItem(DIGEST_PENDING_KEY, "1");
        } catch {
          /* ignore */
        }
        navigate("/", { replace: true });
      } catch (err) {
        if (!active) return;
        const message =
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat memproses login.";
        setStatus("error");
        setErrorMessage(message);
      }
    };

    void exchange();

    return () => {
      active = false;
    };
  }, [navigate, query]);

  const handleRetry = () => {
    navigate("/auth", { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-alt px-6 py-12 text-text">
      <div className="w-full max-w-md rounded-3xl border border-border-subtle bg-surface p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-text">Menyelesaikan Login</h1>
        <p className="mt-1 text-sm text-muted">
          Tunggu sebentar, kami sedang menyambungkan akun Google-mu.
        </p>
        <div className="mt-6">
          {status === "loading" ? (
            <Spinner />
          ) : (
            <div className="space-y-4">
              <div
                className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
                role="alert"
              >
                {errorMessage || "Terjadi kesalahan yang tidak diketahui."}
              </div>
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-brand px-6 text-sm font-semibold text-brand-foreground shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
              >
                Coba login lagi
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
