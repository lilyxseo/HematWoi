import { supabase } from "./supabase";

const defaults = {
  income: ["Gaji", "Bonus", "Lainnya"],
  expense: [
    "Makan",
    "Transport",
    "Belanja",
    "Tagihan",
    "Kesehatan",
    "Hiburan",
    "Lainnya",
  ],
};

export async function seedDefaultCategoriesIfEmpty() {
  const { count, error } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  if ((count || 0) > 0) return;
  const rows = [
    ...defaults.income.map((name) => ({ type: "income", name })),
    ...defaults.expense.map((name) => ({ type: "expense", name })),
  ];
  const { error: err } = await supabase.from("categories").insert(rows);
  if (err && err.code !== "23505") throw err;
}
