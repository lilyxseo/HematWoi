import type { NavItem } from './nav.config';

export type NavTrail = { title: string; path: string };

function findTrail(items: NavItem[], pathname: string, parents: NavTrail[] = []): NavTrail[] | null {
  for (const item of items) {
    const trail = [...parents, { title: item.breadcrumb || item.title, path: item.path }];
    if (item.path === pathname) return trail;
    if (item.children) {
      const child = findTrail(item.children, pathname, trail);
      if (child) return child;
    }
  }
  return null;
}

export function buildBreadcrumbs(pathname: string, items: NavItem[]): NavTrail[] {
  const result = findTrail(items, pathname) || [];
  if (pathname !== '/') {
    const home = items.find((i) => i.path === '/');
    if (home && !result.find((r) => r.path === '/')) {
      result.unshift({ title: home.breadcrumb || home.title, path: home.path });
    }
  }
  return result;
}
