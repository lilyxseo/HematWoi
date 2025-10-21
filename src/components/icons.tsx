import * as TablerIcons from '@tabler/icons-react';
import type { TablerIcon } from '@tabler/icons-react';

type IconRegistry = Record<string, TablerIcon>;

const TABLER_REGISTRY = TablerIcons as Record<string, TablerIcon>;
const FALLBACK_ICON = TablerIcons.IconCircle;

const ICON_SYNONYMS: Record<string, string> = {
  home: 'IconHome',
  dashboard: 'IconLayoutDashboard',
  wallet: 'IconWallet',
  wallets: 'IconWallet',
  saving: 'IconPigMoney',
  savings: 'IconPigMoney',
  piggybank: 'IconPigMoney',
  'piggy-bank': 'IconPigMoney',
  piggy_bank: 'IconPigMoney',
  budget: 'IconPigMoney',
  budgets: 'IconPigMoney',
  target: 'IconTarget',
  goal: 'IconTarget',
  goals: 'IconTarget',
  tag: 'IconTag',
  tags: 'IconTags',
  label: 'IconTag',
  labels: 'IconTags',
  repeat: 'IconRepeat',
  recurring: 'IconRepeat',
  list: 'IconList',
  lists: 'IconList',
  tasks: 'IconListCheck',
  checklist: 'IconListCheck',
  chartline: 'IconChartLine',
  chart: 'IconChartBar',
  charts: 'IconChartBar',
  analytics: 'IconChartDots',
  analysis: 'IconChartDots',
  graph: 'IconChartLine',
  graphs: 'IconChartLine',
  data: 'IconDatabase',
  debt: 'IconReportMoney',
  debts: 'IconReportMoney',
  shield: 'IconShield',
  security: 'IconShieldLock',
  protect: 'IconShieldCheck',
  protection: 'IconShieldCheck',
  settings: 'IconSettings',
  preference: 'IconAdjustmentsHorizontal',
  preferences: 'IconAdjustmentsHorizontal',
  config: 'IconSettings',
  configuration: 'IconSettings',
  user: 'IconUser',
  users: 'IconUsers',
  profile: 'IconUserCircle',
  account: 'IconId',
  person: 'IconUser',
  people: 'IconUsers',
  bell: 'IconBell',
  notification: 'IconBellRinging',
  notifications: 'IconBellRinging',
  alert: 'IconAlertTriangle',
  alerts: 'IconAlertTriangle',
  reminder: 'IconBellRinging',
  reminders: 'IconBellRinging',
  subscription: 'IconBellCog',
  subscriptions: 'IconBellCog',
  piechart: 'IconChartPie',
  'pie-chart': 'IconChartPie',
  pie_chart: 'IconChartPie',
  calendar: 'IconCalendar',
  schedule: 'IconCalendarTime',
  date: 'IconCalendar',
  dates: 'IconCalendar',
  folderkanban: 'IconLayoutKanban',
  'folder-kanban': 'IconLayoutKanban',
  folder: 'IconFolder',
  folders: 'IconFolders',
  kanban: 'IconLayoutKanban',
  board: 'IconLayoutKanban',
  category: 'IconFolders',
  categories: 'IconFolders',
  project: 'IconFolder',
  projects: 'IconFolder',
  trendingup: 'IconTrendingUp',
  trending: 'IconTrendingUp',
  trend: 'IconTrendingUp',
  growth: 'IconTrendingUp',
  progress: 'IconProgressCheck',
  performance: 'IconChartArrowsVertical',
  insight: 'IconBulb',
  insights: 'IconBulb',
  receipt: 'IconReceipt',
  receipts: 'IconReceipt',
  transaction: 'IconReceipt2',
  transactions: 'IconReceipt2',
  report: 'IconReport',
  reports: 'IconReport',
  invoice: 'IconReceiptTax',
  invoices: 'IconReceiptTax',
  statement: 'IconReport',
  'arrow-up': 'IconArrowUp',
  arrowup: 'IconArrowUp',
  arrow_up: 'IconArrowUp',
  up: 'IconArrowUp',
  'arrow-down': 'IconArrowDown',
  arrowdown: 'IconArrowDown',
  arrow_down: 'IconArrowDown',
  down: 'IconArrowDown',
  pencil: 'IconPencil',
  edit: 'IconEdit',
  pen: 'IconPencil',
  trash: 'IconTrash',
  delete: 'IconTrash',
  remove: 'IconTrash',
};

export const ICONS: IconRegistry = Object.fromEntries(
  Object.entries(ICON_SYNONYMS)
    .map(([alias, tablerName]) => {
      const icon = TABLER_REGISTRY[tablerName];
      return icon ? [alias, icon] : null;
    })
    .filter((entry): entry is [string, TablerIcon] => Boolean(entry))
);

export const ICON_NAMES = Object.keys(ICONS).sort((a, b) => a.localeCompare(b));

function toComponentName(raw: string): string {
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  if (!trimmed) return 'IconCircle';
  if (trimmed.startsWith('Icon') && TABLER_REGISTRY[trimmed]) {
    return trimmed;
  }

  const withoutPrefix = trimmed.replace(/^Icon/i, '');
  const spaced = withoutPrefix.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  const pascal = spaced
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');

  return `Icon${pascal}`;
}

function resolveIcon(name?: string | null): TablerIcon {
  if (typeof name !== 'string') {
    return FALLBACK_ICON;
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return FALLBACK_ICON;
  }

  const alias = ICONS[trimmed.toLowerCase()];
  if (alias) {
    return alias;
  }

  if (TABLER_REGISTRY[trimmed]) {
    return TABLER_REGISTRY[trimmed];
  }

  const componentName = toComponentName(trimmed);
  if (TABLER_REGISTRY[componentName]) {
    return TABLER_REGISTRY[componentName];
  }

  const prefixed = `Icon${trimmed}`;
  if (TABLER_REGISTRY[prefixed]) {
    return TABLER_REGISTRY[prefixed];
  }

  return FALLBACK_ICON;
}

interface IconProps {
  name?: string | null;
  className?: string;
  label?: string;
}

export function Icon({ name, className, label }: IconProps) {
  const normalized = typeof name === 'string' ? name.trim() : '';
  const IconComponent = resolveIcon(normalized);

  return (
    <IconComponent
      aria-label={label ?? (normalized || 'icon')}
      className={className ?? 'w-5 h-5'}
      stroke={1.75}
    />
  );
}
