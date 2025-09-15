import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function FAB() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate("/add")}
      className={[
        "fixed right-4 bottom-[calc(4rem+env(safe-area-inset-bottom))]",
        "z-60 rounded-full bg-brand-var text-white p-4 shadow-lg",
      ].join(" ")}
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}

