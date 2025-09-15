import Filters from "../components/Filters";
import FilterChips from "../components/FilterChips";
import TxTable from "../components/TxTable";
import FAB from "../components/FAB";
import Page from "../layout/Page";
import Section from "../layout/Section";
import PageHeader from "../layout/PageHeader";
import useTransactionsQuery from "../hooks/useTransactionsQuery";

export default function Transactions() {
  const { items, months, categories, filter, setFilter } = useTransactionsQuery();

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
        <FilterChips
          filter={filter}
          categories={categories}
          onRemove={(key) => setFilter({ [key]: undefined })}
        />
      </Section>
      <Section>
        <TxTable items={items} onRemove={() => {}} onUpdate={() => {}} />
      </Section>
      <FAB />
    </Page>
  );
}
