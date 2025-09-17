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
    const prevOverflow = style.overflow;
    style.overflow = "hidden";
    return () => {
      style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div className={clsx("relative flex min-h-screen bg-bg text-text", className)}>
      {!hideSidebar && sidebar}
      <div
        className={clsx(
          "flex min-h-screen w-full flex-col transition-[padding-left] duration-300 ease-out",
          hideSidebar
            ? "pl-0"
            : "pl-0 md:pl-[var(--sidebar-width)]"
        )}
      >
        {topbar}
        <main
          id="main"
          tabIndex={-1}
          className="flex-1 overflow-y-auto focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
