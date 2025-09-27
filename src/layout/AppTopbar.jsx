import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, Menu, User2 } from "lucide-react";

const noop = () => {};

export default function AppTopbar({
  onMenuClick = noop,
  onProfileClick = noop,
  onSettingsClick = noop,
  onLogoutClick = noop,
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!profileOpen) return;

    const handlePointerDown = (event) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target)) return;
      setProfileOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setProfileOpen(false);
        requestAnimationFrame(() => {
          triggerRef.current?.focus?.();
        });
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);

  const handleMenuItem = useCallback(
    (handler) => () => {
      setProfileOpen(false);
      handler?.();
    },
    []
  );

  return (
    <header
      className="sticky top-0 z-[60] border-b border-border/70 bg-surface-1/95 text-text shadow-sm backdrop-blur supports-[backdrop-filter]:bg-surface-1/80"
      style={{ "--app-topbar-h": "64px" }}
    >
      <div className="flex h-[var(--app-topbar-h)] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-surface-1 text-text shadow-sm transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
          >
            <span className="sr-only">Buka menu navigasi</span>
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-base font-semibold sm:text-lg">HematWoi</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-surface-1 text-text shadow-sm transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Lihat notifikasi"
          >
            <Bell className="h-5 w-5" />
          </button>
          <div className="relative" ref={containerRef}>
            <button
              type="button"
              ref={triggerRef}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-surface-1 px-3 py-2 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <User2 className="h-5 w-5" aria-hidden="true" />
              <span className="hidden text-sm sm:inline">Profil</span>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
            {profileOpen ? (
              <div
                className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-border/70 bg-surface-1 text-sm shadow-lg shadow-black/10 focus:outline-none"
                role="menu"
                aria-label="Menu profil"
              >
                <button
                  type="button"
                  onClick={handleMenuItem(onProfileClick)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-text transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                  role="menuitem"
                >
                  Profil saya
                </button>
                <button
                  type="button"
                  onClick={handleMenuItem(onSettingsClick)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-text transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                  role="menuitem"
                >
                  Pengaturan
                </button>
                <button
                  type="button"
                  onClick={handleMenuItem(onLogoutClick)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-destructive transition-colors duration-150 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                  role="menuitem"
                >
                  Keluar
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
