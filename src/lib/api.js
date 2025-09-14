import { supabase } from "./supabase";

// SELECT
export async function listTransactions({ type, month, q, page = 1, pageSize = 20 } = {}) {
  let query = supabase
    .from("transactions")
    .select(
      "id,date,type,amount,note,category_id,categories:category_id (name)",
      { count: "exact" }
    )
    .order("date", { ascending: false });

  if (type) {
    query = query.eq("type", type);
  }
  if (month) {
    const start = `${month}-01`;
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    query = query.gte("date", start).lt("date", end.toISOString().slice(0, 10));
  }
  if (q) {
    const like = `%${q}%`;
    query = query.or(`note.ilike.${like},categories.name.ilike.${like}`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  const rows = (data || []).map((t) => ({ ...t, category: t.categories?.name || null }));
  return { rows, total: count || 0, page, pageSize };
}

// INSERT
export async function addTransaction({ date, type, amount, note, category_id }) {
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      date,
      type,
      amount,
      note: note || null,
      category_id: category_id || null,
    })
    .select("id,date,type,amount,note,category_id,categories:category_id (name)")
    .single();
  if (error) throw error;
  return { ...data, category: data.categories?.name || null };
}

// UPDATE
export async function updateTransaction(id, patch) {
  const { data, error } = await supabase
    .from("transactions")
    .update(patch)
    .eq("id", id)
    .select("id,date,type,amount,note,category_id,categories:category_id (name)")
    .single();
  if (error) throw error;
  return { ...data, category: data.categories?.name || null };
}

// DELETE
export async function deleteTransaction(id) {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}
