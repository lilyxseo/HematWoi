# Sidebar Navigation

The global navigation is driven by a single configuration file: [`src/router/nav.config.tsx`](../src/router/nav.config.tsx).
Each item in the array defines the route `path`, human readable `title` and the icon from `lucide-react`.

```ts
export type NavItem = {
  title: string;
  path: string;
  icon?: React.ReactNode;
  section?: 'primary' | 'secondary';
  inSidebar?: boolean;
  protected?: boolean;
};
```

## Adding a menu item

1. Import a suitable icon from `lucide-react`.
2. Append a new object to `NAV_ITEMS` with `title`, `path` and `icon`.
3. Set `section` to `"primary"` for main items or `"secondary"` for footer links.
4. If the page requires authentication set `protected: true`.

The [`Sidebar`](../src/layout/Sidebar.jsx) component renders the logo, a divider, all primary links followed by secondary links and a footer with sync status, cloud toggle, theme switch and user controls.

Collapsed state is stored in `localStorage` (`hw:sidebar-collapsed`) and the mobile drawer can be opened via the hamburger button on small screens.
