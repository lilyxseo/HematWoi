import { useEffect, useState } from "react";
import Logo from "./Logo";
import SignIn from "./SignIn";
import { supabase } from "../lib/supabase";

function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

export default function TopBar({ stats, useCloud, setUseCloud }) {
  const [sessionUser, setSessionUser] = useState(null);
  const [showSignIn, setShowSignIn] = useState(false);

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

  return (
    <div className="max-w-5xl mx-auto p-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Logo />
        <h1 className="font-bold text-lg">HematWoi</h1>
      </div>
      <div className="flex items-center gap-4">
        <span className="badge">{useCloud ? "Cloud" : "Local"}</span>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={useCloud} onChange={handleToggle} />
          Cloud
        </label>
        <div className="font-semibold hidden sm:block">
          Saldo: {toRupiah(stats?.balance || 0)}
        </div>
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
  );
}
