import { PlusCircle, Wallet, CreditCard } from "lucide-react";
import Card, { CardHeader } from "./Card";
import QuickActionCard from "./dashboard/QuickActionCard";
import { useTransactionFormPrefetch } from "../hooks/useTransactionFormPrefetch";

export default function QuickActions() {
  const { prefetchAddForm } = useTransactionFormPrefetch();
  const actions = [
    {
      to: "/transaction/add",
      label: "Tambah Transaksi",
      icon: PlusCircle,
      shortcut: "Ctrl/Cmd + T",
      onMouseEnter: prefetchAddForm,
      onTouchStart: prefetchAddForm,
      onClick: prefetchAddForm,
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
    <Card className="h-full">
      <CardHeader
        title="Quick Actions"
        subtext="Akses cepat ke aksi favoritmu"
      />
      <div className="grid grid-cols-1 gap-4">
        {actions.map((action) => (
          <QuickActionCard
            key={action.to}
            to={action.to}
            icon={action.icon}
            title={action.label}
            hint={action.shortcut}
            onMouseEnter={action.onMouseEnter}
            onTouchStart={action.onTouchStart}
            onClick={action.onClick}
          />
        ))}
      </div>
    </Card>
  );
}
