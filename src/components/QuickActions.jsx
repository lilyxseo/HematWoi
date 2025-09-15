import { Link } from "react-router-dom";
import { PlusCircle, Wallet, CreditCard } from "lucide-react";

export default function QuickActions() {
  const actions = [
    {
      to: "/add",
      label: "Tambah Transaksi",
      icon: PlusCircle,
    },
    {
      to: "/budgets",
      label: "Tambah Budget",
      icon: Wallet,
    },
    {
      to: "/subscriptions",
      label: "Tambah Subscription",
      icon: CreditCard,
    },
  ];

  return (
    <div className="card">
      <h2 className="font-semibold mb-3">Quick Actions</h2>
      <div className="grid sm:grid-cols-3 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.to}
              to={action.to}
              className="btn btn-secondary justify-center"
            >
              <Icon className="h-4 w-4" />
              {action.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
