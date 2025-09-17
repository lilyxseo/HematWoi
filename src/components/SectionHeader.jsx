export default function SectionHeader({ title, description, children }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-bold tracking-tight text-text sm:text-2xl">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-muted/90">{description}</p>
        )}
      </div>
      {children && <div className="flex-shrink-0">{children}</div>}
    </header>
  );
}
