export default function SectionHeader({ title, children }) {
  return (
    <header className="mb-2 flex items-center justify-between gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && <div className="text-sm text-muted">{children}</div>}
    </header>
  );
}
