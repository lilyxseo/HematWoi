import { useMemo } from "react";
import Page from "../layout/Page";
import PageHeader from "../layout/PageHeader";
import Section from "../layout/Section";
import KpiCards from "../components/KpiCards";
import QuoteBubble from "../components/QuoteBubble";
import SavingsProgress from "../components/SavingsProgress";
import AchievementBadges from "../components/AchievementBadges";
import QuickActions from "../components/QuickActions";
import SectionHeader from "../components/SectionHeader";
import MonthlyTrendChart from "../components/MonthlyTrendChart";
import CategoryDonut from "../components/CategoryDonut";
import TopSpendsTable from "../components/TopSpendsTable";
import RecentTransactions from "../components/RecentTransactions";
import useInsights from "../hooks/useInsights";
import EventBus from "../lib/eventBus";

// Each content block uses <Section> to maintain a single vertical rhythm.
export default function Dashboard({ stats, txs }) {
  const streak = useMemo(() => {
    const dates = new Set(txs.map((t) => new Date(t.date).toDateString()));
    let count = 0;
    const today = new Date();
    while (
      dates.has(
        new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() - count
        ).toDateString()
      )
    ) {
      count++;
    }
    return count;
  }, [txs]);

  const insights = useInsights(txs);
  const savingsTarget = stats?.savingsTarget || 1_000_000;

  return (
    <Page>
      <PageHeader title="Dashboard" description="Ringkasan keuanganmu" />
      <Section first>
        <KpiCards
          income={stats?.income || 0}
          expense={stats?.expense || 0}
          net={stats?.balance || 0}
        />
      </Section>
      <Section>
        <QuoteBubble />
      </Section>
      <Section>
        <div className="grid gap-[var(--block-y)] md:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SavingsProgress
              current={stats?.balance || 0}
              target={savingsTarget}
            />
          </div>
          <div className="lg:col-span-5">
            <AchievementBadges
              stats={stats}
              streak={streak}
              target={savingsTarget}
            />
          </div>
        </div>
      </Section>
      <Section>
        <QuickActions />
      </Section>
      <Section>
        <SectionHeader title="Analisis Bulanan" />
        <div className="grid gap-[var(--block-y)] md:grid-cols-2">
          <MonthlyTrendChart data={insights.trend} />
          <CategoryDonut data={insights.categories} />
        </div>
        <div className="grid gap-[var(--block-y)] md:grid-cols-2">
          <TopSpendsTable
            data={insights.topSpends}
            onSelect={(t) => EventBus.emit("tx:open", t)}
          />
          <RecentTransactions txs={txs} />
        </div>
      </Section>
    </Page>
  );
}
