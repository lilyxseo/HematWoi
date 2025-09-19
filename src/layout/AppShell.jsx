import { useState } from "react";
import { NavLink, useLocation, useRoutes } from "react-router-dom";
import { NAV_ITEMS } from "../router/nav.config";
import { buildBreadcrumbs } from "../router/breadcrumbs";
import { ROUTES } from "../router/routes";
import AppSidebar from "./AppSidebar";
import { ModeProvider, useMode } from "../hooks/useMode";

function ShellContent() {
  const element = useRoutes(ROUTES);
  const location = useLocation();
  const breadcrumbs = buildBreadcrumbs(location.pathname, NAV_ITEMS);
  const { mode } = useMode();
  const [theme, setTheme] = useState("dark");
  const [brand, setBrand] = useState({ h: 211, s: 92, l: 60 });

  return (
    <div className="flex min-h-screen w-full min-w-0">
      <AppSidebar
        theme={theme}
        setTheme={setTheme}
        brand={brand}
        setBrand={setBrand}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <nav
          aria-label="Breadcrumb"
          className="border-b p-4 text-sm"
        >
          {breadcrumbs.map((b, idx) => (
            <span key={b.path}>
              {idx > 0 && " / "}
              {idx < breadcrumbs.length - 1 ? (
                <NavLink to={b.path}>{b.title}</NavLink>
              ) : (
                <span>{b.title}</span>
              )}
            </span>
          ))}
        </nav>
        <main className="flex-1 min-w-0 p-4">{element}</main>
        <div className="border-t p-2 text-right text-xs">
          {mode === "online" ? "✅ Online Mode aktif" : "📴 Local Mode aktif"}
        </div>
      </div>
    </div>
  );
}

export default function AppShell() {
  return (
    <ModeProvider>
      <ShellContent />
    </ModeProvider>
  );
}
