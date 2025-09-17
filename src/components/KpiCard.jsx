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
      <CardBody className="space-y-2">
        <div className="whitespace-nowrap text-sm font-medium text-muted/90">
          {label}
        </div>
        {loading ? (
          <div className="mx-auto h-7 w-24 rounded-full bg-white/20 animate-pulse" />
        ) : (
          <div
            className={clsx(
              "whitespace-nowrap text-2xl font-bold tracking-tight sm:text-3xl",
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
