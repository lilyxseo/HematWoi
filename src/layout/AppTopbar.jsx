import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Bell, ChevronDown, LogOut, Settings, User as UserIcon } from "lucide-react";

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "HW";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AppTopbar({
  user,
  onNavigateProfile,
  onOpenSettings,
  onLogout,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const displayName = useMemo(() => {
    return (
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email ||
      "Pengguna"
    );
  }, [user]);

  const secondaryLabel = useMemo(() => {
    if (user?.email) return user.email;
    if (user?.user_metadata?.username) return user.user_metadata.username;
    return "Mode lokal";
  }, [user]);

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const initials = useMemo(() => getInitials(displayName), [displayName]);

  useEffect(() => {
    function handleClick(event) {
      if (!open) return;
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKey(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const headerStyle = {
    "--app-topbar-h": "64px",
  };

  return (
    <header
      className={clsx(
        "sticky top-0 z-[60] border-b border-border/70 bg-surface-1/95 text-text backdrop-blur supports-[backdrop-filter]:bg-surface-1/80",
        className
      )}
      style={headerStyle}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-wide text-muted">
          <span className="hidden sm:inline">HematWoi</span>
          <span className="inline-flex h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
          <span className="text-xs font-medium text-muted">Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-surface-2 text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Lihat notifikasi"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            <span className="absolute top-2 right-2 inline-flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
            </span>
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="flex items-center gap-3 rounded-full border border-border/70 bg-surface-2/80 px-2 py-1 pl-1 pr-3 text-left text-sm font-medium text-text shadow-sm transition hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              onClick={() => setOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <span className="relative inline-flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-surface-1">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-sm font-semibold uppercase text-muted">{initials}</span>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface-2 bg-emerald-500" aria-hidden="true" />
              </span>
              <span className="hidden min-w-0 flex-1 sm:flex sm:flex-col">
                <span className="truncate text-sm font-semibold text-text">{displayName}</span>
                <span className="truncate text-xs text-muted">{secondaryLabel}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
            </button>
            {open ? (
              <div
                role="menu"
                aria-label="Menu pengguna"
                className="absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl border border-border/70 bg-surface-1/95 p-1 text-sm shadow-lg backdrop-blur"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-surface-2/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                  onClick={() => {
                    setOpen(false);
                    onNavigateProfile?.();
                  }}
                  role="menuitem"
                >
                  <UserIcon className="h-4 w-4 text-muted" aria-hidden="true" />
                  My Profile
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-surface-2/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                  onClick={() => {
                    setOpen(false);
                    onOpenSettings?.();
                  }}
                  role="menuitem"
                >
                  <Settings className="h-4 w-4 text-muted" aria-hidden="true" />
                  Pengaturan
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-danger transition hover:bg-surface-2/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                  onClick={() => {
                    setOpen(false);
                    onLogout?.();
                  }}
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
