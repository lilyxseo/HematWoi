import { Page } from "../components/ui/Page";
import ResponsiveGrid from "../components/ui/ResponsiveGrid";
import { Card, CardHeader, CardBody } from "../components/ui/Card";

export default function Dashboard() {
  return (
    <Page title="Dashboard">
      <ResponsiveGrid>
        <Card>
          <CardHeader title="Net This Month" subtitle="Ringkasan" />
          <CardBody>{/* KPI cards / angka */}</CardBody>
        </Card>
        <Card className="compact">
          <CardHeader title="Tren 6 Bulan" />
          <CardBody>
            <div className="chart-wrap">{/* chart component */}</div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Kategori (Bulan ini)" />
          <CardBody>{/* donut */}</CardBody>
        </Card>
      </ResponsiveGrid>
    </Page>
  );
}
