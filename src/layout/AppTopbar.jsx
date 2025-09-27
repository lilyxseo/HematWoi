import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Settings,
  User as UserIcon,
} from "lucide-react";
import Logo from "../components/Logo";
import { supabase } from "../lib/supabase";

function useCurrentUser() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        setUser(data.user ?? null);
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        setUser(session?.user ?? null);
      }
    );

    return () => {
      active = false;
      subscription.subscription?.unsubscribe?.();
    };
  }, []);

  return user;
}

function ProfileMenu() {
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const displayName = useMemo(() => {
    if (!user) return "Pengguna";
    const fullName = user.user_metadata?.full_name;
    if (fullName && String(fullName).trim()) {
      return String(fullName).trim();
    }
    const email = user.email;
    if (email && String(email).trim()) {
      return String(email).trim();
    }
    return "Pengguna";
  }, [user]);

  const initials = useMemo(() => {
    const source = displayName || "Pengguna";
    const parts = source.split(/\s+/).filter(Boolean);
    if (!parts.length) return "P";
    const first = parts[0]?.[0];
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1];
    const chars = `${first ?? ""}${last ?? ""}`.toUpperCase();
    return chars || "P";
  }, [displayName]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    } finally {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-surface-1 px-2.5 py-1.5 text-left text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold text-brand">
          {initials}
        </span>
        <span className="hidden min-w-0 flex-col sm:flex">
          <span className="truncate text-xs text-muted">Akun</span>
          <span className="truncate text-sm font-semibold text-text">
            {displayName}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Menu profil"
          className="absolute right-0 mt-3 w-56 rounded-2xl border border-border/70 bg-surface-1 p-2 text-sm shadow-lg shadow-black/10"
        >
          <Link
            to="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-text transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <UserIcon className="h-4 w-4" aria-hidden="true" />
            Profil Saya
          </Link>
          <Link
            to="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-text transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            Pengaturan
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-text transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Keluar
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function AppTopbar({ onMenuClick = () => {} }) {
  useEffect(() => {
    const root = document.documentElement;
    const previousHeaderHeight = root.style.getPropertyValue("--app-header-height");
    const previousTopbarHeight = root.style.getPropertyValue("--app-topbar-h");
    root.style.setProperty("--app-header-height", "64px");
    root.style.setProperty("--app-topbar-h", "64px");
    return () => {
      if (previousHeaderHeight) {
        root.style.setProperty("--app-header-height", previousHeaderHeight);
      } else {
        root.style.removeProperty("--app-header-height");
      }
      if (previousTopbarHeight) {
        root.style.setProperty("--app-topbar-h", previousTopbarHeight);
      } else {
        root.style.removeProperty("--app-topbar-h");
      }
    };
  }, []);

  return (
    <header
      className="sticky top-0 z-[60] w-full border-b border-border/70 bg-surface-1/95 backdrop-blur supports-[backdrop-filter]:bg-surface-1/80"
      style={{ "--app-topbar-h": "64px" }}
    >
      <div className="mx-auto flex h-[var(--app-topbar-h)] w-full max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-surface-1 text-text shadow-sm transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Buka menu navigasi"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2">
            <Logo className="h-8 w-auto" />
            <span className="text-base font-semibold text-text">HematWoi</span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            aria-label="Lihat notifikasi"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-surface-1 text-text shadow-sm transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            <span className="pointer-events-none absolute right-2 top-2 inline-flex h-2 w-2 rounded-full bg-brand" />
          </button>
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
