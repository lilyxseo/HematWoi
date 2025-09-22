import clsx from "clsx";

export default function Card({ className = "", children }) {
  return (
    <div
      className={clsx(
        "card relative isolate overflow-hidden text-sm text-text",
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
          <h3 className="text-lg font-semibold text-text">
            {title}
          </h3>
        )}
        {subtext && (
          <p className="text-sm text-muted">
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
        "mt-4 border-t border-border-subtle pt-4",
        className
      )}
    >
      {children}
    </div>
  );
}
