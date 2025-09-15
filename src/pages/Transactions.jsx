import Filters from "../components/Filters";
import TxTable from "../components/TxTable";
import FAB from "../components/FAB";
import { Page } from "../components/ui/Page";
import ResponsiveGrid from "../components/ui/ResponsiveGrid";
import { Card, CardHeader, CardBody } from "../components/ui/Card";

export default function Transactions({ months, categories, filter, setFilter, items, onRemove, onUpdate }) {
  return (
    <Page title="Transaksi">
      <ResponsiveGrid>
        <Card>
          <CardHeader title="Filter" />
          <CardBody>
            <Filters months={months} categories={categories} filter={filter} setFilter={setFilter} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Daftar Transaksi" />
          <CardBody>
            <TxTable items={items} onRemove={onRemove} onUpdate={onUpdate} />
          </CardBody>
        </Card>
      </ResponsiveGrid>
      <FAB />
    </Page>
  );
}
