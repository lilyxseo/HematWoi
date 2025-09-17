import clsx from "clsx";

export default function Card({ className = "", children }) {
  return (
    <div
      className={clsx(
        "card relative isolate overflow-hidden text-sm text-text/90 dark:text-slate-200/90",
        "supports-[backdrop-filter]:bg-white/60 supports-[backdrop-filter]:dark:bg-white/5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtext,
  actions,
  className = "",
}) {
  return (
    <div
      className={clsx(
        "mb-4 flex flex-wrap items-start justify-between gap-3 text-left",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {title && (
          <h3 className="text-lg font-semibold text-text dark:text-slate-100">
            {title}
          </h3>
        )}
        {subtext && (
          <p className="text-sm text-muted/90 dark:text-slate-300/80">
            {subtext}
          </p>
        )}
      </div>
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </div>
  );
}

export function CardBody({ className = "", children }) {
  return <div className={clsx("space-y-3", className)}>{children}</div>;
}

export function CardFooter({ className = "", children }) {
  return (
    <div
      className={clsx(
        "mt-4 border-t border-white/10 pt-4 dark:border-white/10",
        className
      )}
    >
      {children}
    </div>
  );
}
