import { KPIStack } from '../../components/widgets/KPIStack';
import { RecentMovements } from '../../components/widgets/RecentMovements';
import { Card } from '../../components/ui/Card';

const DashboardPage = () => {
  return (
    <div className="space-y-6">
      <KPIStack />
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <h3 className="text-lg font-semibold text-[var(--color-text)]">Guided actions</h3>
          <p className="mt-2 text-sm text-slate-500">
            Fast access to critical flows for operators. Use keyboard shortcuts: <kbd>Alt+1</kbd> Receive,
            <kbd>Alt+2</kbd> Putaway, <kbd>Alt+3</kbd> Pick.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>• Monitor inbound staging lanes and assign putaway tasks.</li>
            <li>• Auto-batch pick waves based on route priority.</li>
            <li>• Cycle count variances escalate to supervisors instantly.</li>
          </ul>
        </Card>
        <div className="lg:col-span-7">
          <RecentMovements />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
