import Filters from "../components/Filters";
import TxTable from "../components/TxTable";
import FAB from "../components/FAB";
import Page from "../layout/Page";
import Section from "../layout/Section";
import PageHeader from "../layout/PageHeader";

export default function Transactions({
  months,
  categories,
  filter,
  setFilter,
  items,
  onRemove,
  onUpdate,
}) {
  return (
    <Page>
      <PageHeader title="Transaksi" description="Kelola catatan keuangan" />
      <Section first>
        <Filters
          months={months}
          categories={categories}
          filter={filter}
          setFilter={setFilter}
        />
      </Section>
      <Section>
        <TxTable items={items} onRemove={onRemove} onUpdate={onUpdate} />
      </Section>
      <FAB />
    </Page>
  );
}
