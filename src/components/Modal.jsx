export default function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  const stop = (e) => e.stopPropagation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6" onClick={onClose}>
      <div
        className="card w-full max-w-lg overflow-hidden p-0 shadow-[0_30px_80px_-40px_rgb(15_23_42/0.55)]"
        onClick={stop}
      >
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-border-subtle bg-surface px-6 py-4">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
