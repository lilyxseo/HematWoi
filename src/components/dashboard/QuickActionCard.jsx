import { forwardRef } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";

const baseClasses =
  "group relative flex min-h-[120px] flex-col items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-white/10 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent sm:p-5";

const circleClasses =
  "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-inset ring-white/20";

const QuickActionCard = forwardRef(
  (
    { icon: Icon, title, hint, to, onClick, className = "", "aria-label": ariaLabel, children, ...props },
    ref
  ) => {
    const Component = to ? Link : "button";

    return (
      <Component
        ref={ref}
        to={to}
        onClick={onClick}
        aria-label={ariaLabel || title}
        className={clsx(baseClasses, className)}
        {...props}
      >
        <div className="flex w-full items-start justify-between gap-3">
          {Icon && (
            <span className={circleClasses} aria-hidden="true">
              <Icon className="h-5 w-5" />
            </span>
          )}
          {hint && (
            <span className="rounded-full border border-border-subtle/80 bg-surface-alt/70 px-2 py-1 text-[11px] font-semibold text-muted">
              {hint}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-text dark:text-slate-100">
            {title}
          </p>
          {children}
        </div>
        <span
          className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10 transition group-hover:ring-white/20"
          aria-hidden="true"
        />
      </Component>
    );
  }
);

QuickActionCard.displayName = "QuickActionCard";

export default QuickActionCard;
