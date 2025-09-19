import clsx from "clsx";
import type { ReactNode } from "react";

interface SidebarSectionProps {
  title?: string;
  collapsed?: boolean;
  children: ReactNode;
}

export default function SidebarSection({
  title,
  collapsed = false,
  children,
}: SidebarSectionProps) {
  return (
    <section className="mt-6 first:mt-0">
      {title ? (
        <p
          className={clsx(
            "px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted transition-opacity duration-200",
            collapsed && "sr-only"
          )}
        >
          {title}
        </p>
      ) : null}
      <div
        className={clsx(
          "mt-2 space-y-2",
          collapsed && "space-y-2"
        )}
      >
        {children}
      </div>
    </section>
  );
}
