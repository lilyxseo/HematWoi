import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTransactionFormPrefetch } from "../hooks/useTransactionFormPrefetch";

export default function FAB() {
  const navigate = useNavigate();
  const { prefetchAddForm } = useTransactionFormPrefetch();
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <button
      type="button"
      onClick={() => {
        prefetchAddForm();
        navigate("/transaction/add");
      }}
      onMouseEnter={prefetchAddForm}
      onTouchStart={prefetchAddForm}
      aria-label="Tambah transaksi"
      className={[
        "fixed right-4 bottom-[calc(4rem+env(safe-area-inset-bottom))]",
        "z-60 rounded-full bg-brand-var text-white p-4 shadow-lg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand",
        reduceMotion ? "" : "animate-fab",
      ].filter(Boolean).join(" ")}
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
