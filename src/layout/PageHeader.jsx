import Breadcrumbs from "./Breadcrumbs";
import { useHousehold } from "../context/HouseholdContext";

export default function PageHeader({ title, description, children }) {
  const { householdViewEnabled } = useHousehold();
  return (
    <div className="mb-[var(--section-y)] min-w-0">
      <Breadcrumbs />
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-text">
            {title}
          </h1>
          {householdViewEnabled && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
              <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
              Keluarga Aktif
            </span>
          )}
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
