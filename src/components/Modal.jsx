export default function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  const stop = (e) => e.stopPropagation();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div className="card w-full max-w-md m-4" onClick={stop}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">{title}</h2>
          <button className="btn" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
