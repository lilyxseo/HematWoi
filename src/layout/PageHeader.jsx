import Breadcrumbs from "./Breadcrumbs";

export default function PageHeader({ title, description, children }) {
  return (
    <div className="mb-[var(--section-y)]">
      <Breadcrumbs />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-text dark:text-white">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {description}
            </p>
          )}
        </div>
        {children && <div className="flex gap-2">{children}</div>}
      </div>
    </div>
  );
}
