import { NavLink, useLocation, useRoutes } from 'react-router-dom';
import { NAV_ITEMS } from '../router/nav.config';
import { buildBreadcrumbs } from '../router/breadcrumbs';
import { isFeatureEnabled } from '../featureFlags';
import { ROUTES } from '../router/routes';

export default function AppShell() {
  const element = useRoutes(ROUTES);
  const location = useLocation();
  const sidebarItems = NAV_ITEMS.filter(
    (i) => i.inSidebar && (!i.featureFlag || isFeatureEnabled(i.featureFlag))
  );
  const breadcrumbs = buildBreadcrumbs(location.pathname, NAV_ITEMS);

  return (
    <div className="flex min-h-screen">
      <aside className="w-48 border-r p-4 space-y-2">
        {sidebarItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              isActive ? 'font-semibold text-blue-600' : ''
            }
          >
            {item.title}
          </NavLink>
        ))}
      </aside>
      <div className="flex-1">
        <nav aria-label="Breadcrumb" className="border-b p-4 text-sm">
          {breadcrumbs.map((b, idx) => (
            <span key={b.path}>
              {idx > 0 && ' / '}
              {idx < breadcrumbs.length - 1 ? (
                <NavLink to={b.path}>{b.title}</NavLink>
              ) : (
                <span>{b.title}</span>
              )}
            </span>
          ))}
        </nav>
        <main className="p-4">{element}</main>
      </div>
    </div>
  );
}
