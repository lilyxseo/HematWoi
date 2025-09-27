import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { Bell, ChevronDown } from "lucide-react";
import userAvatar from "../assets/avatars/saver.svg";

export default function AppTopbar({ breadcrumbs = [] }) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isUserMenuOpen) return;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isUserMenuOpen]);

  return (
    <header className="border-b border-border-subtle bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/60">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <nav aria-label="Breadcrumb" className="flex-1">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-muted">
            {breadcrumbs.map((breadcrumb, index) => (
              <li key={breadcrumb.path} className="flex items-center gap-2">
                {index > 0 && <span className="text-muted">/</span>}
                {index < breadcrumbs.length - 1 ? (
                  <NavLink
                    to={breadcrumb.path}
                    className="transition-colors hover:text-text focus-visible:outline-none focus-visible:text-text"
                  >
                    {breadcrumb.title}
                  </NavLink>
                ) : (
                  <span className="font-medium text-text">{breadcrumb.title}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-surface-alt text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            aria-label="Buka notifikasi"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger animate-blink" />
          </button>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              className="flex items-center gap-3 rounded-full border border-transparent bg-surface px-2 py-1 text-left transition-colors hover:border-border-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              aria-haspopup="menu"
              aria-expanded={isUserMenuOpen}
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
            >
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-surface-alt">
                <img src={userAvatar} alt="Foto pengguna" className="h-full w-full object-cover" />
              </span>
              <span className="hidden text-left sm:flex sm:flex-col">
                <span className="text-sm font-semibold text-text">Rudi Santoso</span>
                <span className="text-xs text-muted">Personal Account</span>
              </span>
              <ChevronDown className="h-4 w-4 text-muted" />
            </button>

            {isUserMenuOpen && (
              <div
                role="menu"
                aria-label="Menu pengguna"
                className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-border-subtle bg-surface-alt p-2 shadow-lg"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text transition-colors hover:bg-surface"
                  role="menuitem"
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  My Profile
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text transition-colors hover:bg-surface"
                  role="menuitem"
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  Pengaturan
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger transition-colors hover:bg-surface"
                  role="menuitem"
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
