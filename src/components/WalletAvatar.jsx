import { useEffect, useState } from "react";
import clsx from "clsx";
import Skeleton from "./Skeleton";
import { playKrik } from "../lib/walletSound";

const sizes = {
  sm: "w-12 h-12 text-xl",
  md: "w-16 h-16 text-2xl",
  lg: "w-24 h-24 text-4xl",
};

const expressions = {
  FAT: "😄",
  NORMAL: "🙂",
  THIN: "😟",
  FLAT: "😢",
};

function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

export default function WalletAvatar({
  status,
  trend = 0,
  balance = 0,
  isOverBudget = false,
  size = "md",
  soundEnabled = false,
  onClick,
  label,
}) {
  const [anim, setAnim] = useState(false);
  const expr = isOverBudget && status !== "FAT" ? "😟" : expressions[status];

  useEffect(() => {
    setAnim(true);
    const t = setTimeout(() => setAnim(false), 300);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (soundEnabled && isOverBudget) playKrik();
  }, [isOverBudget, soundEnabled]);

  if (!status) return <Skeleton className={sizes[size]} />;

  const scale =
    status === "FAT" ? "scale-110" : status === "THIN" ? "scale-95" : status === "FLAT" ? "scale-90" : "scale-100";

  const aria = label ||
    (status === "FAT"
      ? "Dompet gemuk, saldo sehat"
      : status === "NORMAL"
      ? "Dompet normal"
      : status === "THIN"
      ? "Dompet kurus"
      : "Dompet kempes");
  const trendLabel = `${trend > 0 ? '+' : ''}${trend}%`;
  const titleText = `${aria}. Saldo ${toRupiah(balance)}. Tren 7D ${trendLabel}`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={aria}
      className={clsx(
        "relative rounded-full flex items-center justify-center bg-brand-secondary text-text transition-transform duration-300",
        sizes[size],
        anim && "animate-bounce"
      )}
      title={titleText}
    >
      <span className={clsx("transition-transform duration-300", scale)}>{expr}</span>
    </button>
  );
}

