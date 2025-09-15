export type NavItem = {
  title: string;
  path: string;
  icon?: React.ReactNode;
  section?: string;
  inSidebar?: boolean;
  inTopbar?: boolean;
  protected?: boolean;
  featureFlag?: string;
  roles?: string[];
  breadcrumb?: string;
  children?: NavItem[];
};

import { Home, BarChart3 } from 'lucide-react';

export const NAV_ITEMS: NavItem[] = [
  {
    title: 'Home',
    path: '/',
    icon: <Home className="h-4 w-4" />,
    section: 'Main',
    inSidebar: true,
    protected: false,
  },
  {
    title: 'Reports',
    path: '/reports',
    icon: <BarChart3 className="h-4 w-4" />,
    section: 'Main',
    inSidebar: true,
    protected: true,
    featureFlag: 'reports',
  }
  ,
  {
    title: 'Auth',
    path: '/auth',
    inSidebar: false,
    protected: false,
  }
];
