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

import {
  LayoutDashboard,
  ListChecks,
  Wallet,
  Flag,
  HandCoins,
  Tags,
  Database,
  Repeat,
  Settings as SettingsIcon,
  User as UserIcon,
  CreditCard,
} from 'lucide-react';

export const NAV_ITEMS: NavItem[] = [
  {
    title: 'Dashboard',
    path: '/',
    icon: <LayoutDashboard className="h-5 w-5" />,
    section: 'primary',
    inSidebar: true,
    protected: true,
  },
  {
    title: 'Transaksi',
    path: '/transactions',
    icon: <ListChecks className="h-5 w-5" />,
    section: 'primary',
    inSidebar: true,
    protected: true,
  },
  {
    title: 'Akun',
    path: '/accounts',
    icon: <CreditCard className="h-5 w-5" />,
    section: 'primary',
    inSidebar: true,
    protected: true,
  },
  {
    title: 'Tambah',
    path: '/transaction/add',
    inSidebar: false,
    protected: true,
  },
  {
    title: 'Anggaran',
    path: '/budgets',
    icon: <Wallet className="h-5 w-5" />,
    section: 'primary',
    inSidebar: true,
    protected: true,
  },
  {
    title: 'Goals',
    path: '/goals',
    icon: <Flag className="h-5 w-5" />,
    section: 'primary',
    inSidebar: true,
    protected: true,
  },
  {
    title: 'Hutang',
    path: '/debts',
    icon: <HandCoins className="h-5 w-5" />,
    section: 'primary',
    inSidebar: true,
    protected: true,
  },
  {
    title: 'Hutang',
    path: '/debs',
    inSidebar: false,
    protected: true,
    breadcrumb: 'Hutang',
  },
  {
    title: 'Kategori',
    path: '/categories',
    icon: <Tags className="h-5 w-5" />,
    section: 'primary',
    inSidebar: true,
    protected: true,
  },
  {
    title: 'Data',
    path: '/data',
    icon: <Database className="h-5 w-5" />,
    section: 'primary',
    inSidebar: true,
    protected: true,
  },
  {
    title: 'Langganan',
    path: '/subscriptions',
    icon: <Repeat className="h-5 w-5" />,
    section: 'primary',
    inSidebar: true,
    protected: true,
  },
  {
    title: 'Profile',
    path: '/profile',
    icon: <UserIcon className="h-5 w-5" />,
    section: 'secondary',
    inSidebar: true,
    protected: true,
  },
  {
    title: 'Settings',
    path: '/settings',
    icon: <SettingsIcon className="h-5 w-5" />,
    section: 'secondary',
    inSidebar: true,
    protected: true,
  },
  {
    title: 'Auth',
    path: '/auth',
    inSidebar: false,
    protected: false,
  },
];
