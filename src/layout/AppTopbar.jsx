import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, Bell } from "lucide-react";
import clsx from "clsx";
import { supabase } from "../lib/supabase";

function getInitials(name) {
  if (!name) return "?";
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ProfileMenu() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (isMounted) setUser(data.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) setUser(session?.user ?? null);
    });
    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const displayName = useMemo(() => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    if (user?.email) {
      return user.email;
    }
    return "Tamu";
  }, [user]);

  const initials = useMemo(() => getInitials(displayName), [displayName]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface-1 px-2 py-1.5 text-left text-sm font-medium text-text shadow-sm transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="hidden text-sm font-medium sm:block">{displayName}</span>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-base font-semibold text-brand-foreground">
          {initials}
        </span>
      </button>
      <div
        className={clsx(
          "absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-border/80 bg-surface-1 text-sm shadow-lg transition",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
        role="menu"
        aria-hidden={!open}
      >
        <Link
          to="/profile"
          onClick={() => setOpen(false)}
          className="block px-4 py-2.5 text-text transition hover:bg-surface-2"
          role="menuitem"
        >
          Profil Saya
        </Link>
        <Link
          to="/settings"
          onClick={() => setOpen(false)}
          className="block px-4 py-2.5 text-text transition hover:bg-surface-2"
          role="menuitem"
        >
          Pengaturan
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="block w-full px-4 py-2.5 text-left text-text transition hover:bg-surface-2"
          role="menuitem"
        >
          Keluar
        </button>
      </div>
    </div>
  );
}

export default function AppTopbar() {
  const handleMenuClick = () => {
    window.dispatchEvent(new CustomEvent("hw:open-sidebar"));
  };

  return (
    <header
      className="sticky top-0 z-[65] border-b border-border/70 bg-surface-1/95 text-text backdrop-blur supports-[backdrop-filter]:bg-surface-1/75"
      style={{ "--app-topbar-h": "64px" }}
    >
      <div className="mx-auto flex h-[var(--app-topbar-h)] w-full max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleMenuClick}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/70 bg-surface-1 text-text shadow-sm transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
            aria-label="Buka navigasi"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-lg font-semibold tracking-tight">HematWoi</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/70 bg-surface-1 text-text shadow-sm transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Lihat notifikasi"
          >
            <Bell className="h-5 w-5" />
          </button>
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
