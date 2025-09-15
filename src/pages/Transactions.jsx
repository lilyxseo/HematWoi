import FilterBar from "../components/FilterBar";
import FilterChips from "../components/FilterChips";
import TxTable from "../components/TxTable";
import KPIMini from "../components/KPIMini";
import Page from "../layout/Page";
import Section from "../layout/Section";
import PageHeader from "../layout/PageHeader";
import useTransactionsQuery from "../hooks/useTransactionsQuery";
import { Plus, Download, Upload } from "lucide-react";

export default function Transactions() {
  const { items, months, categories, filter, setFilter, loading } = useTransactionsQuery();

  const totalNet = items.reduce((acc, t) => acc + (t.type === "expense" ? -t.amount : t.amount), 0);

  return (
    <Page>
      <PageHeader title="Transaksi" description="Kelola catatan keuangan">
        <span className="hidden items-center gap-1 sm:flex">
          <span className="rounded-full bg-surface-2 px-2 py-1 text-xs">
            {items.length} item · Rp {totalNet.toLocaleString("id-ID")}
          </span>
        </span>
        <div className="flex gap-2">
          <button className="btn btn-primary flex items-center gap-1">
            <Plus className="h-4 w-4" /> Tambah Transaksi
          </button>
          <button className="btn flex items-center gap-1">
            <Upload className="h-4 w-4" /> Import
          </button>
          <button className="btn flex items-center gap-1">
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </PageHeader>
      <Section first>
        <FilterBar
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
        <KPIMini items={items} />
      </Section>
      <Section>
        <TxTable items={items} loading={loading} onRemove={() => {}} onUpdate={() => {}} />
      </Section>
    </Page>
  );
}
