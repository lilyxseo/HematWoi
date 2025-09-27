import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Settings,
  UserRound,
} from "lucide-react";
import useSupabaseUser from "../hooks/useSupabaseUser";
import { supabase } from "../lib/supabase";

function Breadcrumbs({ items }) {
  if (!items?.length) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 text-xs font-medium text-muted-foreground sm:text-sm"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span
            key={item.path}
            className="flex items-center gap-2 truncate"
          >
            {index > 0 && <span className="text-muted-foreground/60">/</span>}
            {isLast ? (
              <span className="truncate text-text">{item.title}</span>
            ) : (
              <NavLink
                to={item.path}
                className="truncate text-muted-foreground transition hover:text-text"
              >
                {item.title}
              </NavLink>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function ProfileAvatar({ name, email }) {
  const initials = useMemo(() => {
    const source = name || email || "?";
    return source
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [name, email]);

  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold text-brand shadow-sm">
      {initials}
    </span>
  );
}

export default function AppTopBar({ breadcrumbs, onMenuClick }) {
  const { user, loading } = useSupabaseUser();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!profileOpen) return;

    const handlePointerDown = (event) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);

  const displayName = user?.user_metadata?.full_name || user?.email || "Pengguna";
  const displayEmail = user?.email || "Masuk untuk pengalaman penuh";

  const handleMenuClick = () => {
    if (typeof onMenuClick === "function") {
      onMenuClick();
    }
  };

  async function handleLogout() {
    setProfileOpen(false);
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setLoggingOut(false);
    }
  }

  const profileActions = [
    {
      label: "My Profile",
      icon: <UserRound className="h-4 w-4" />,
      onSelect: () => {
        setProfileOpen(false);
        navigate("/profile");
      },
    },
    {
      label: "Pengaturan",
      icon: <Settings className="h-4 w-4" />,
      onSelect: () => {
        setProfileOpen(false);
        window.dispatchEvent(new CustomEvent("hw:open-settings"));
      },
    },
    {
      label: "Logout",
      icon: <LogOut className="h-4 w-4" />,
      onSelect: handleLogout,
      danger: true,
    },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-surface-1/90 backdrop-blur supports-[backdrop-filter]:bg-surface-1/70">
      <div className="flex flex-col gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={handleMenuClick}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-surface-1 text-text shadow-md shadow-black/5 transition hover:-translate-y-0.5 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
              aria-label="Buka navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Navigasi
              </p>
              <Breadcrumbs items={breadcrumbs} />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-surface-1 text-text shadow-md shadow-black/5 transition hover:-translate-y-0.5 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Lihat notifikasi"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 inline-flex h-2 w-2 rounded-full bg-brand" />
            </button>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                className="group inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-surface-1 px-2 py-1.5 text-left text-sm shadow-md shadow-black/5 transition hover:-translate-y-0.5 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-3"
              >
                {loading ? (
                  <span className="flex h-10 w-10 animate-pulse items-center justify-center rounded-full bg-surface-2" />
                ) : (
                  <ProfileAvatar name={user?.user_metadata?.full_name} email={user?.email} />
                )}
                <span className="hidden min-w-0 flex-col text-left sm:flex">
                  <span className="truncate text-sm font-semibold text-text">
                    {displayName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {displayEmail}
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition ${
                    profileOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {profileOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-3 w-56 origin-top-right rounded-2xl border border-border/70 bg-surface-1/95 p-1.5 shadow-xl shadow-black/10 backdrop-blur"
                >
                  {profileActions.map(({ label, icon, onSelect, danger }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={onSelect}
                      disabled={loggingOut && label === "Logout"}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-surface-2 ${
                        danger ? "text-danger" : "text-text"
                      } disabled:cursor-wait disabled:opacity-70`}
                      role="menuitem"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-muted-foreground">
                        {icon}
                      </span>
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
