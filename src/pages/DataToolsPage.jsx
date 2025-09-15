import { useNavigate } from "react-router-dom";
import DataTools from "../components/DataTools";
import BankImportButton from "../components/BankImportButton";
import { Page } from "../components/ui/Page";
import { Card, CardBody } from "../components/ui/Card";

export default function DataToolsPage({ onExport, onImportJSON, onImportCSV }) {
  const navigate = useNavigate();
  return (
    <Page title="Data">
      <Card>
        <CardBody>
          <DataTools
            onExport={onExport}
            onImportJSON={onImportJSON}
            onImportCSV={onImportCSV}
            onManageCat={() => navigate("/categories")}
          />
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <BankImportButton />
        </CardBody>
      </Card>
    </Page>
  );
}
