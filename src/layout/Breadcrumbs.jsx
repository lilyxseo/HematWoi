import { NavLink, useLocation } from "react-router-dom";

function capitalize(str = "") {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) return null;
  let path = "";
  return (
    <nav aria-label="Breadcrumb" className="mb-2 text-xs text-muted">
      <ol className="flex items-center gap-1">
        <li>
          <NavLink to="/" className="hover:text-brand">
            Home
          </NavLink>
        </li>
        {segments.map((seg, idx) => {
          path += `/${seg}`;
          const isLast = idx === segments.length - 1;
          return (
            <li key={path} className="flex items-center gap-1">
              <span>/</span>
              {isLast ? (
                <span>{capitalize(seg)}</span>
              ) : (
                <NavLink to={path} className="hover:text-brand">
                  {capitalize(seg)}
                </NavLink>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
