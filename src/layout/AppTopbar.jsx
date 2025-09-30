import { useEffect, useRef, useState } from "react";
import { Bell, LogIn, LogOut, Menu, Settings, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function getDisplayName(user) {
  if (!user) return "Masuk";
  const metadataName = user.user_metadata?.full_name;
  if (metadataName && typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }
  if (user.email) return user.email;
  return "Pengguna";
}

export default function AppTopbar() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const dropdownRef = useRef(null);
  const profileButtonRef = useRef(null);
  const navigate = useNavigate();
  const isAuthenticated = Boolean(user);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!profileOpen) return;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        profileButtonRef.current &&
        !profileButtonRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [profileOpen]);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.getPropertyValue("--app-topbar-h");
    root.style.setProperty("--app-topbar-h", "64px");
    return () => {
      if (previous) {
        root.style.setProperty("--app-topbar-h", previous);
      } else {
        root.style.removeProperty("--app-topbar-h");
      }
    };
  }, []);

  const displayName = getDisplayName(user);
  const initial = displayName.charAt(0).toUpperCase();

  const handleNavigate = (path) => {
    setProfileOpen(false);
    navigate(path);
  };

  const handleSignOut = async () => {
    setProfileOpen(false);
    try {
      await supabase.auth.signOut();
      navigate("/auth");
    } catch {
      /* ignore sign-out errors */
    }
  };

  return (
    <header className="sticky inset-x-0 top-0 z-[65] border-b border-border/70 bg-surface-1/80 backdrop-blur supports-[backdrop-filter]:bg-surface-1/60">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new Event("hw:open-sidebar"));
            }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-surface-1 text-text shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95 lg:hidden"
            aria-label="Buka navigasi"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-base font-semibold text-text">HematWoi</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-surface-1 text-text transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95"
            aria-label="Lihat notifikasi"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 inline-flex h-2 w-2 rounded-full bg-brand" />
          </button>
          <div className="relative" ref={dropdownRef}>
            <button
              ref={profileButtonRef}
              type="button"
              onClick={() => setProfileOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-surface-1 px-2.5 py-1.5 text-sm font-medium text-text shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold uppercase text-brand">
                {isAuthenticated ? initial : <UserRound className="h-4 w-4" />}
              </span>
              <span className="hidden max-w-[8.5rem] truncate text-left md:block">{displayName}</span>
            </button>
            {profileOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-border/70 bg-surface-1 text-sm shadow-lg focus:outline-none"
              >
                {isAuthenticated ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleNavigate("/profile")}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-text transition hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2"
                      role="menuitem"
                    >
                      <UserRound className="h-4 w-4" />
                      Profil Saya
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigate("/settings")}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-text transition hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2"
                      role="menuitem"
                    >
                      <Settings className="h-4 w-4" />
                      Pengaturan
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-danger transition hover:bg-danger/10 focus-visible:outline-none focus-visible:bg-danger/10"
                      role="menuitem"
                    >
                      <LogOut className="h-4 w-4" />
                      Keluar
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col gap-3 px-4 py-3">
                    <p className="text-sm text-muted">
                      Kamu belum login. Masuk untuk mengakses profil dan pengaturan.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        navigate("/auth");
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand/40 bg-brand/10 px-3 py-2 text-sm font-semibold text-brand transition-colors duration-200 hover:border-brand/60 hover:bg-brand/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      role="menuitem"
                    >
                      <LogIn className="h-4 w-4" />
                      Masuk
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
