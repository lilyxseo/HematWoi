import { supabase } from "./supabase";
import { getCurrentUserId } from "./session";

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
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { count, error } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  if ((count || 0) > 0) return;
  const now = new Date().toISOString();
  const rows = [
    ...defaults.income.map((name, index) => ({
      id: crypto.randomUUID(),
      user_id: userId,
      type: "income",
      name,
      order_index: index,
      created_at: now,
      updated_at: now,
    })),
    ...defaults.expense.map((name, index) => ({
      id: crypto.randomUUID(),
      user_id: userId,
      type: "expense",
      name,
      order_index: index,
      created_at: now,
      updated_at: now,
    })),
  ];
  const { error: err } = await supabase.from("categories").insert(rows);
  if (err && err.code !== "23505") throw err;
}
