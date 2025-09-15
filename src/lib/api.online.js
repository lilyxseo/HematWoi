import { supabase } from "./supabase";

export async function listTransactions() {
  const { data, error } = await supabase
    .from("transactions")
    .select("id,date,type,amount,note,category_id")
    .order("date", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addTransaction({ date, type, amount, note, category_id }) {
  const { data, error } = await supabase
    .from("transactions")
    .insert({ date, type, amount, note, category_id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTransaction(id, patch) {
  const { data, error } = await supabase
    .from("transactions")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTransaction(id) {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}
