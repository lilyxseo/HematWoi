import { useEffect, useState } from "react";
import Logo from "./Logo";
import SignIn from "./SignIn";
import { supabase } from "../lib/supabase";
import { Sun, Moon } from "lucide-react";

function formatCurrency(n = 0) {
  const pref = window.__hw_prefs?.currency === "USD" ? "USD" : "IDR";
  const locale = pref === "USD" ? "en-US" : "id-ID";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: pref,
    minimumFractionDigits: 0,
  }).format(n);
}

export default function TopBar({
  stats,
  useCloud,
  setUseCloud,
  theme,
  setTheme,
}) {
  const [sessionUser, setSessionUser] = useState(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSessionUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      setSessionUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (sessionUser && showSignIn) setShowSignIn(false);
  }, [sessionUser, showSignIn]);

  const shortEmail = (email = "") =>
    email.length > 20 ? email.slice(0, 17) + "..." : email;

  const handleToggle = (e) => {
    const next = e.target.checked;
    if (next && !sessionUser) {
      setShowSignIn(true);
      setUseCloud(false);
      return;
    }
    setUseCloud(next);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (useCloud) setUseCloud(false);
  };

  useEffect(() => {
    const month = new Date().toISOString().slice(0, 7);
    if (
      stats?.balance > 0 &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      !sessionStorage.getItem(`hw:confetti:${month}`)
    ) {
      sessionStorage.setItem(`hw:confetti:${month}`, '1');
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1200);
    }
  }, [stats]);

  return (
    <header className="relative">
      <a
        href="#main"
        className="sr-only focus:not-sr-only absolute left-2 top-2 z-50 bg-white text-blue-600 px-3 py-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        Lewati ke konten
      </a>
      {showConfetti && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 15 }).map((_, i) => (
            <span
              key={i}
              className="confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDuration: `${700 + Math.random() * 500}ms`,
              }}
            />
          ))}
        </div>
      )}
      <div className="max-w-5xl mx-auto p-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Logo />
        <h1 className="font-bold text-lg">HematWoi</h1>
      </div>
      <div className="flex items-center gap-4">
        <span className="badge">{useCloud ? "Cloud" : "LOCAL MODE (Dummy)"}</span>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={useCloud} onChange={handleToggle} />
          Cloud
        </label>
        <div className="font-semibold hidden sm:block">
          Saldo: {formatCurrency(stats?.balance || 0)}
        </div>
        <button
          className="btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle dark mode"
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </button>
        <button
          className="btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("hw:open-settings"))
          }
          aria-label="Buka pengaturan"
        >
          ⚙️
        </button>
        {sessionUser ? (
          <>
            <span className="badge">{shortEmail(sessionUser.email)}</span>
            <button className="btn" onClick={handleLogout}>
              Keluar
            </button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={() => setShowSignIn(true)}>
            Masuk
          </button>
        )}
      </div>
        <SignIn open={showSignIn} onClose={() => setShowSignIn(false)} />
      </div>
    </header>
  );
}
