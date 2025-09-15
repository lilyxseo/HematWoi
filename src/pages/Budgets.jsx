import BudgetSection from "../components/BudgetSection";
import { Page } from "../components/ui/Page";
import { Card, CardBody } from "../components/ui/Card";

export default function Budgets({ currentMonth, data, onAdd, onRemove }) {
  return (
    <Page title="Anggaran">
      <Card>
        <CardBody>
          <BudgetSection
            filterMonth={currentMonth}
            budgets={data.budgets}
            txs={data.txs}
            categories={data.cat}
            onAdd={onAdd}
            onRemove={onRemove}
          />
        </CardBody>
      </Card>
    </Page>
  );
}
