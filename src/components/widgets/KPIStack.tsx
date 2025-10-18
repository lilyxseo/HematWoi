import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

const kpis = [
  {
    title: "Today's Tasks",
    value: 128,
    change: '+12% vs yesterday',
    variant: 'success' as const
  },
  {
    title: 'Out of stock',
    value: 6,
    change: 'Needs immediate action',
    variant: 'danger' as const
  },
  {
    title: 'Slow moving',
    value: 18,
    change: 'Check velocity',
    variant: 'warning' as const
  }
];

export const KPIStack = () => {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {kpis.map((kpi) => (
        <Card key={kpi.title} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">{kpi.title}</p>
            <Badge variant={kpi.variant}>{kpi.change}</Badge>
          </div>
          <p className="text-3xl font-semibold text-[var(--color-text)]">{kpi.value}</p>
        </Card>
      ))}
    </div>
  );
};
