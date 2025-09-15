import { useEffect } from "react";
import LowBalanceBanner from "./LowBalanceBanner";
import "./Animations.css";

export default function LateMonthMode({ active, onDismiss, onCreateChallenge }) {
  useEffect(() => {
    document.body.classList.toggle("late-month-mode", active);
    return () => document.body.classList.remove("late-month-mode");
  }, [active]);

  if (!active) return null;

  const actions = [
    {
      label: "Lihat Pengeluaran Terbesar",
      onClick: () => onDismiss && onDismiss(),
    },
    {
      label: "Buat Challenge Hemat 3 Hari",
      onClick: onCreateChallenge,
    },
    {
      label: "Tunda Belanja Non-Urgent",
      onClick: () => onDismiss && onDismiss(),
    },
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-center p-4 pointer-events-none">
      <LowBalanceBanner
        message="⚠️ Tanggal Tua detected. Dompet memasuki mode bertahan hidup."
        actions={actions}
        onClose={onDismiss}
      />
    </div>
  );
}
