import * as TablerIcons from "@tabler/icons-react";

type TablerIconComponent = typeof TablerIcons.IconCircle;

const TABLER_ICON_LOOKUP = new Map<string, TablerIconComponent>();
const TABLER_ICONS = TablerIcons as Record<string, TablerIconComponent>;
const FALLBACK_ICON = TablerIcons.IconCircle;

function registerLookup(name: string, icon: TablerIconComponent) {
  TABLER_ICON_LOOKUP.set(name.toLowerCase(), icon);
}

function toKebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

Object.entries(TABLER_ICONS)
  .filter(([key]) => key.startsWith("Icon"))
  .forEach(([key, icon]) => {
    const trimmed = key.slice(4);
    const kebab = toKebabCase(trimmed);
    const snake = kebab.replace(/-/g, "_");
    const compact = trimmed.replace(/[^A-Za-z0-9]/g, "").toLowerCase();

    registerLookup(key, icon);
    registerLookup(trimmed, icon);
    registerLookup(kebab, icon);
    registerLookup(snake, icon);
    registerLookup(compact, icon);
  });

const RECOMMENDED_ALIASES: Record<string, string> = {
  home: "IconHome",
  dashboard: "IconLayoutDashboard",
  wallet: "IconWallet",
  wallets: "IconWallet",
  saving: "IconPigMoney",
  savings: "IconPigMoney",
  piggybank: "IconPigMoney",
  "piggy-bank": "IconPigMoney",
  piggy_bank: "IconPigMoney",
  budget: "IconCash",
  budgets: "IconCash",
  target: "IconTarget",
  goal: "IconTargetArrow",
  goals: "IconTargetArrow",
  tag: "IconTag",
  tags: "IconTags",
  label: "IconTag",
  labels: "IconTags",
  repeat: "IconRepeat",
  recurring: "IconRepeat",
  list: "IconList",
  lists: "IconList",
  tasks: "IconListCheck",
  checklist: "IconListCheck",
  chartline: "IconChartLine",
  chart: "IconChartBar",
  charts: "IconChartBar",
  analytics: "IconChartBar",
  analysis: "IconChartBar",
  graph: "IconChartLine",
  graphs: "IconChartLine",
  data: "IconDatabase",
  debt: "IconReceipt",
  debts: "IconReceipt",
  shield: "IconShield",
  security: "IconShieldCheck",
  protect: "IconShieldCheck",
  protection: "IconShieldCheck",
  settings: "IconSettings",
  preference: "IconSettings",
  preferences: "IconSettings",
  config: "IconSettings",
  configuration: "IconSettings",
  user: "IconUser",
  users: "IconUsers",
  profile: "IconUserCircle",
  account: "IconId",
  person: "IconUser",
  people: "IconUsers",
  bell: "IconBell",
  notification: "IconBell",
  notifications: "IconBell",
  alert: "IconAlertTriangle",
  alerts: "IconAlertTriangle",
  reminder: "IconBellRinging",
  reminders: "IconBellRinging",
  subscription: "IconBellRinging",
  subscriptions: "IconBellRinging",
  piechart: "IconChartPie",
  "pie-chart": "IconChartPie",
  pie_chart: "IconChartPie",
  calendar: "IconCalendar",
  schedule: "IconCalendarClock",
  date: "IconCalendar",
  dates: "IconCalendar",
  folderkanban: "IconLayoutKanban",
  "folder-kanban": "IconLayoutKanban",
  folder: "IconFolder",
  folders: "IconFolders",
  kanban: "IconLayoutKanban",
  board: "IconLayoutBoard",
  category: "IconCategory",
  categories: "IconCategory",
  project: "IconFolders",
  projects: "IconFolders",
  trendingup: "IconTrendingUp",
  trending: "IconTrendingUp",
  trend: "IconTrendingUp",
  growth: "IconTrendingUp",
  progress: "IconTrendingUp",
  performance: "IconChartBar",
  insight: "IconBulb",
  insights: "IconBulb",
  receipt: "IconReceipt",
  receipts: "IconReceipt",
  transaction: "IconArrowsLeftRight",
  transactions: "IconArrowsLeftRight",
  report: "IconReportAnalytics",
  reports: "IconReportAnalytics",
  invoice: "IconFileInvoice",
  invoices: "IconFileInvoice",
  statement: "IconFileDescription",
  "arrow-up": "IconArrowUp",
  arrowup: "IconArrowUp",
  arrow_up: "IconArrowUp",
  up: "IconArrowUp",
  "arrow-down": "IconArrowDown",
  arrowdown: "IconArrowDown",
  arrow_down: "IconArrowDown",
  down: "IconArrowDown",
  pencil: "IconPencil",
  edit: "IconPencil",
  pen: "IconPencil",
  trash: "IconTrash",
  delete: "IconTrash",
  remove: "IconTrash",
};

export const ICONS: Record<string, TablerIconComponent> = Object.fromEntries(
  Object.entries(RECOMMENDED_ALIASES)
    .map(([alias, key]) => [alias, TABLER_ICON_LOOKUP.get(key.toLowerCase())])
    .filter((entry): entry is [string, TablerIconComponent] => Boolean(entry[1]))
);

export const ICON_NAMES = Object.keys(ICONS).sort((a, b) => a.localeCompare(b));

interface IconProps {
  name?: string | null;
  className?: string;
  label?: string;
}

function buildCandidates(value: string) {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  const compact = lower.replace(/[^a-z0-9]/g, "");
  const slug = lower.replace(/[^a-z0-9]+/g, "-");
  const parts = trimmed.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const pascal = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
  const camel = pascal ? pascal.charAt(0).toLowerCase() + pascal.slice(1) : "";

  return Array.from(
    new Set(
      [
        trimmed,
        lower,
        compact,
        slug,
        slug.replace(/-/g, ""),
        pascal,
        camel,
        pascal ? `Icon${pascal}` : "",
        pascal ? `icon${pascal}` : "",
        camel ? `Icon${camel}` : "",
        camel ? `icon${camel}` : "",
      ].filter(Boolean),
    ),
  );
}

function resolveIcon(name?: string | null): TablerIconComponent {
  if (!name) {
    return FALLBACK_ICON;
  }

  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    return FALLBACK_ICON;
  }

  const aliasKey =
    RECOMMENDED_ALIASES[normalized] ??
    RECOMMENDED_ALIASES[normalized.replace(/[^a-z0-9]/g, "")];

  if (aliasKey) {
    const aliasIcon = TABLER_ICON_LOOKUP.get(aliasKey.toLowerCase());
    if (aliasIcon) {
      return aliasIcon;
    }
  }

  for (const candidate of buildCandidates(name)) {
    const match = TABLER_ICON_LOOKUP.get(candidate.toLowerCase());
    if (match) {
      return match;
    }
  }

  return FALLBACK_ICON;
}

export function Icon({ name, className, label }: IconProps) {
  const IconComponent = resolveIcon(name);
  const normalized = typeof name === "string" ? name.trim().toLowerCase() : "";

  return (
    <IconComponent
      aria-label={label ?? (normalized || "icon")}
      className={className ?? "w-5 h-5"}
    />
  );
}
