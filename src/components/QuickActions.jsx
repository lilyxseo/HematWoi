import { PlusCircle, Wallet, CreditCard } from "lucide-react";
import Card, { CardHeader } from "./Card";
import QuickActionCard from "./dashboard/QuickActionCard";

export default function QuickActions() {
  const actions = [
    {
      to: "/transaction/add",
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
    <Card className="h-full rounded-3xl border border-border/70 bg-card/70 p-5 shadow-sm">
      <CardHeader
        title="Quick Actions"
        subtext="Akses cepat ke aksi favoritmu"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {actions.map((action) => (
          <QuickActionCard
            key={action.to}
            to={action.to}
            icon={action.icon}
            title={action.label}
            hint={action.shortcut}
          />
        ))}
      </div>
    </Card>
  );
}
