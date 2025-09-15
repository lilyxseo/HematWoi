import { useState, useMemo } from "react";
import Page from "../layout/Page";
import Section from "../layout/Section";
import BudgetHeader from "../components/budget/BudgetHeader";
import BudgetFilterBar from "../components/budget/BudgetFilterBar";
import BudgetSummaryKPIs from "../components/budget/BudgetSummaryKPIs";
import EnvelopeGrid from "../components/budget/EnvelopeGrid";
import BudgetTable from "../components/budget/BudgetTable";
import BudgetDetailPanel from "../components/budget/BudgetDetailPanel";

export default function Budgets({ currentMonth, data }) {
  const [filter, setFilter] = useState({
    month: currentMonth || new Date().toISOString().slice(0, 7),
    search: "",
  });
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem("budget:view") || "grid";
    } catch {
      return "grid";
    }
  });
  const [selected, setSelected] = useState(null);

  const budgets = data?.budgets || [];
  const txs = data?.txs || [];

  const spentByCat = useMemo(() => {
    const map = {};
    txs.forEach((t) => {
      if (!t?.date || !t?.type) return;
      const m = String(t.date).slice(0, 7);
      if (t.type === "expense" && m === filter.month) {
        const key = t.category || "";
        map[key] = (map[key] || 0) + Number(t.amount || 0);
      }
    });
    return map;
  }, [txs, filter.month]);

  const items = useMemo(() => {
    return budgets
      .filter((b) => b.month === filter.month)
      .map((b) => {
        const actual = Number(spentByCat[b.category] || 0);
        const remaining = Number(b.amount || 0) - actual;
        const pct =
          b.amount > 0 ? Math.min(100, Math.round((actual / b.amount) * 100)) : 0;
        return { ...b, actual, remaining, pct };
      })
      .filter((b) =>
        b.category.toLowerCase().includes(filter.search.toLowerCase())
      );
  }, [budgets, spentByCat, filter]);

  const totals = items.reduce(
    (acc, i) => {
      acc.planned += Number(i.amount || 0);
      acc.actual += i.actual;
      return acc;
    },
    { planned: 0, actual: 0 }
  );
  totals.remaining = totals.planned - totals.actual;

  return (
    <Page>
      <BudgetHeader totals={totals} view={view} setView={setView} />
      <Section first>
        <BudgetFilterBar filter={filter} setFilter={setFilter} />
        <BudgetSummaryKPIs totals={totals} />
      </Section>
      <Section>
        {view === "grid" ? (
          <EnvelopeGrid items={items} onSelect={setSelected} />
        ) : (
          <BudgetTable items={items} onSelect={setSelected} />
        )}
      </Section>
      <BudgetDetailPanel item={selected} onClose={() => setSelected(null)} />
    </Page>
  );
}
