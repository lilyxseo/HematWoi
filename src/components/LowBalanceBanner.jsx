import "./Animations.css";

export default function LowBalanceBanner({ message, actions = [], onClose }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="card bg-amber-100 text-amber-900 border-amber-300 max-w-md pointer-events-auto"
    >
      <div className="flex items-start gap-2">
        <span className="animate-pulse-slow" aria-hidden="true">🪫</span>
        <div className="flex-1 text-sm">
          {message} <span className="animate-pulse-slow">😅</span>
          {actions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {actions.map((a) => (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  className="btn btn-secondary text-xs"
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Dismiss"
            className="text-sm ml-2"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
