import { supabase } from './supabase'

// SELECT
export async function listTransactions() {
  const { data, error } = await supabase
    .from('transactions')
    .select('id,date,type,amount,note,category_id, categories:category_id (name,type)')
    .order('date', { ascending: false })
  if (error) throw error
  // opsional: flatten nama kategori
  return data.map(t => ({ ...t, category: t.categories?.name || null }))
}

// INSERT
export async function addTransaction(tx) {
  // TRIGGER akan mengisi user_id otomatis
  const insert = {
    date: tx.date, type: tx.type,
    amount: tx.amount, note: tx.note || null,
    category_id: tx.category_id || null
  }
  const { data, error } = await supabase.from('transactions').insert(insert).select().single()
  if (error) throw error
  return data
}

// UPDATE
export async function updateTransaction(id, patch) {
  const { data, error } = await supabase.from('transactions').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

// DELETE
export async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}
