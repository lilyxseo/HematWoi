import type { ReactNode } from 'react';
import clsx from 'clsx';

type SidebarSectionProps = {
  heading: string;
  children: ReactNode;
  isMini: boolean;
};

export function SidebarSection({ heading, children, isMini }: SidebarSectionProps) {
  return (
    <section className="flex flex-col gap-2">
      <p
        className={clsx(
          'px-2 text-xs font-semibold uppercase tracking-wide text-slate-500 transition-all duration-200 dark:text-slate-400',
          isMini ? 'sr-only' : 'block',
        )}
      >
        {heading}
      </p>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

export default SidebarSection;
