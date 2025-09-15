import clsx from "clsx";
import Card, { CardBody } from "./Card";

export default function KpiCard({ label, value = "-", variant = "brand" }) {
  const color =
    variant === "income" || variant === "success"
      ? "text-success"
      : variant === "expense" || variant === "danger"
      ? "text-danger"
      : "text-brand";

  return (
    <Card className="text-center">
      <CardBody className="space-y-1">
        <div className="text-sm text-muted">{label}</div>
        <div className={clsx("text-2xl font-semibold", color)}>{value}</div>
      </CardBody>
    </Card>
  );
}
