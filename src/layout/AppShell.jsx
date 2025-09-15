import { NavLink, useLocation, useRoutes } from "react-router-dom";
import { NAV_ITEMS } from "../router/nav.config";
import { buildBreadcrumbs } from "../router/breadcrumbs";
import { ROUTES } from "../router/routes";
import Sidebar from "./Sidebar";
import { ModeProvider, useMode } from "../hooks/useMode";

function ShellContent() {
  const element = useRoutes(ROUTES);
  const location = useLocation();
  const breadcrumbs = buildBreadcrumbs(location.pathname, NAV_ITEMS);
  const { mode } = useMode();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <nav aria-label="Breadcrumb" className="border-b p-4 text-sm">
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
        <main className="p-4 flex-1">{element}</main>
        <div className="p-2 text-xs text-right border-t">
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
