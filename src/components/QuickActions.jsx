import { Link } from "react-router-dom";
import { PlusCircle, Wallet, CreditCard } from "lucide-react";

export default function QuickActions() {
  const actions = [
    {
      to: "/add",
      label: "Tambah Transaksi",
      icon: PlusCircle,
      shortcut: "Ctrl/Cmd + T",
    },
    {
      to: "/budgets",
      label: "Tambah Budget",
      icon: Wallet,
      shortcut: "Ctrl/Cmd + B",
    },
    {
      to: "/subscriptions",
      label: "Tambah Subscription",
      icon: CreditCard,
      shortcut: "Ctrl/Cmd + S",
    },
  ];

  return (
    <div className="card">
      <h2 className="mb-[var(--block-y)] font-semibold">Quick Actions</h2>
      <div className="grid gap-[var(--block-y)] sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.to}
              to={action.to}
              className="group flex items-start gap-3 rounded-lg border p-3 transition shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 active:bg-surface-2"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/10 text-brand-600">
                <Icon className="h-5 w-5" />
              </span>
              <span className="flex flex-col">
                <span className="font-medium">{action.label}</span>
                <span className="text-xs text-muted">{action.shortcut}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
