import clsx from "clsx";
import Card, { CardBody } from "./Card";

export default function KpiCard({
  label,
  value = "-",
  variant = "brand",
  loading = false,
}) {
  const color =
    variant === "income" || variant === "success"
      ? "text-success"
      : variant === "expense" || variant === "danger"
      ? "text-danger"
      : "text-brand";

  return (
    <Card className="text-center">
      <CardBody className="space-y-1">
        <div className="text-sm text-muted whitespace-nowrap">{label}</div>
        {loading ? (
          <div className="mx-auto h-6 w-24 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
        ) : (
          <div
            className={clsx(
              "text-2xl font-semibold whitespace-nowrap",
              color
            )}
          >
            {value}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
