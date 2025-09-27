import { useState } from "react";
import { useLocation, useRoutes } from "react-router-dom";
import { NAV_ITEMS } from "../router/nav.config";
import { buildBreadcrumbs } from "../router/breadcrumbs";
import { ROUTES } from "../router/routes";
import AppSidebar from "./AppSidebar";
import { ModeProvider, useMode } from "../hooks/useMode";
import AppTopbar from "./AppTopbar";

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
        <AppTopbar breadcrumbs={breadcrumbs} />
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
