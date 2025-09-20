import Breadcrumbs from "./Breadcrumbs";

export default function PageHeader({ title, description, children }) {
  return (
    <div className="mb-[var(--section-y)] min-w-0">
      <Breadcrumbs />
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-text">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted">
              {description}
            </p>
          )}
        </div>
        {children && <div className="flex flex-wrap justify-end gap-2">{children}</div>}
      </div>
    </div>
  );
}
