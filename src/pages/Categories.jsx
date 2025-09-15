import ManageCategories from "../components/ManageCategories";
import { Page } from "../components/ui/Page";
import { Card, CardBody } from "../components/ui/Card";

export default function Categories({ cat, onSave }) {
  return (
    <Page title="Kategori">
      <Card>
        <CardBody>
          <ManageCategories cat={cat} onSave={onSave} />
        </CardBody>
      </Card>
    </Page>
  );
}
