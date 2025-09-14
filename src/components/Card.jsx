export default function Card({ title, actions, children }) {
  return (
    <div className="card">
      {(title || actions) && (
        <div className="flex items-center justify-between mb-2">
          {title && <h2 className="font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
