import { useEffect } from "react";
import clsx from "clsx";

export default function MainLayout({
  sidebar = null,
  children,
  hideSidebar = false,
  topbar = null,
  className = "",
}) {
  useEffect(() => {
    const { style } = document.body;
    const prevOverflowX = style.overflowX;
    style.overflowX = "hidden";
    return () => {
      style.overflowX = prevOverflowX;
    };
  }, []);

  return (
    <div className={clsx("relative flex min-h-screen min-w-0 bg-bg text-text", className)}>
      {!hideSidebar && sidebar}
      <div
        className={clsx(
          "flex min-h-screen w-full min-w-0 flex-col transition-[padding-left] duration-300 ease-out",
          hideSidebar ? "pl-0" : "pl-0 lg:pl-[var(--sidebar-width)]"
        )}
      >
        {topbar}
        <main
          id="main"
          tabIndex={-1}
          className="flex-1 min-w-0 overflow-y-auto focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
