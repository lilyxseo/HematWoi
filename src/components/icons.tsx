import * as TablerIcons from "@tabler/icons-react";

type TablerIconComponent = typeof TablerIcons.IconCircle;

const TABLER_ICON_REGISTRY = TablerIcons as Record<string, TablerIconComponent>;

const ICON_ALIASES: Record<string, string> = {
  home: "IconHome",
  dashboard: "IconHome",
  wallet: "IconWallet",
  wallets: "IconWallet",
  saving: "IconPigMoney",
  savings: "IconPigMoney",
  piggybank: "IconPigMoney",
  "piggy-bank": "IconPigMoney",
  piggy_bank: "IconPigMoney",
  budget: "IconPigMoney",
  budgets: "IconPigMoney",
  target: "IconTarget",
  goal: "IconTarget",
  goals: "IconTarget",
  tag: "IconTag",
  tags: "IconTag",
  label: "IconTag",
  labels: "IconTag",
  repeat: "IconRepeat",
  recurring: "IconRepeat",
  list: "IconList",
  lists: "IconList",
  tasks: "IconList",
  checklist: "IconList",
  chartline: "IconChartLine",
  chart: "IconChartLine",
  charts: "IconChartLine",
  analytics: "IconChartLine",
  analysis: "IconChartLine",
  graph: "IconChartLine",
  graphs: "IconChartLine",
  data: "IconChartLine",
  debt: "IconChartLine",
  debts: "IconChartLine",
  shield: "IconShield",
  security: "IconShield",
  protect: "IconShield",
  protection: "IconShield",
  settings: "IconSettings",
  preference: "IconSettings",
  preferences: "IconSettings",
  config: "IconSettings",
  configuration: "IconSettings",
  user: "IconUser",
  users: "IconUser",
  profile: "IconUser",
  account: "IconUser",
  person: "IconUser",
  people: "IconUser",
  bell: "IconBell",
  notification: "IconBell",
  notifications: "IconBell",
  alert: "IconBell",
  alerts: "IconBell",
  reminder: "IconBell",
  reminders: "IconBell",
  subscription: "IconBell",
  subscriptions: "IconBell",
  piechart: "IconChartPie",
  "pie-chart": "IconChartPie",
  pie_chart: "IconChartPie",
  calendar: "IconCalendar",
  schedule: "IconCalendar",
  date: "IconCalendar",
  dates: "IconCalendar",
  folderkanban: "IconLayoutKanban",
  "folder-kanban": "IconLayoutKanban",
  folder: "IconLayoutKanban",
  folders: "IconLayoutKanban",
  kanban: "IconLayoutKanban",
  board: "IconLayoutKanban",
  category: "IconLayoutKanban",
  categories: "IconLayoutKanban",
  project: "IconLayoutKanban",
  projects: "IconLayoutKanban",
  trendingup: "IconTrendingUp",
  trending: "IconTrendingUp",
  trend: "IconTrendingUp",
  growth: "IconTrendingUp",
  progress: "IconTrendingUp",
  performance: "IconTrendingUp",
  insight: "IconTrendingUp",
  insights: "IconTrendingUp",
  receipt: "IconReceipt",
  receipts: "IconReceipt",
  transaction: "IconReceipt",
  transactions: "IconReceipt",
  report: "IconReceipt",
  reports: "IconReceipt",
  invoice: "IconReceipt",
  invoices: "IconReceipt",
  statement: "IconReceipt",
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

export const ICON_NAMES = Object.keys(ICON_ALIASES).sort((a, b) => a.localeCompare(b));

interface IconProps {
  name?: string | null;
  className?: string;
  label?: string;
}

function toPascalCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

function resolveIconComponent(input: string | null | undefined): TablerIconComponent {
  const normalized = typeof input === "string" ? input.trim() : "";
  if (!normalized) {
    return TABLER_ICON_REGISTRY.IconCircle;
  }

  const key = normalized.toLowerCase();
  const aliases: string[] = [];
  const aliasHit = ICON_ALIASES[key];
  if (aliasHit) {
    aliases.push(aliasHit);
  }

  const pascal = toPascalCase(normalized);
  if (pascal) {
    if (pascal.startsWith("Icon")) {
      aliases.push(pascal);
    } else {
      aliases.push(`Icon${pascal}`);
      aliases.push(pascal);
    }
  }

  aliases.push(normalized);
  aliases.push(normalized.startsWith("Icon") ? normalized : `Icon${normalized}`);

  for (const candidate of aliases) {
    const icon = TABLER_ICON_REGISTRY[candidate];
    if (icon) {
      return icon;
    }
  }

  return TABLER_ICON_REGISTRY.IconCircle;
}

export function Icon({ name, className, label }: IconProps) {
  const IconComponent = resolveIconComponent(name ?? null);
  const normalized = typeof name === "string" ? name.trim().toLowerCase() : "";

  return (
    <IconComponent
      aria-label={label ?? (normalized || "icon")}
      className={className ?? "w-5 h-5"}
      stroke={1.5}
    />
  );
}
