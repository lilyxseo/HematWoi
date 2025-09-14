import { supabase } from './supabase'

// SELECT
export async function listTransactions(filter = {}, page = 1, pageSize = 50) {
  let query = supabase
    .from('transactions')
    .select('id,date,type,amount,note,category_id,categories:category_id (name,type)')
    .order('date', { ascending: false })

  if (filter.type && filter.type !== 'all') {
    query = query.eq('type', filter.type)
  }
  if (filter.month && filter.month !== 'all') {
    const start = filter.month + '-01'
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)
    query = query.gte('date', start).lt('date', end.toISOString().slice(0, 10))
  }
  if (filter.q) {
    const q = `%${filter.q}%`
    query = query.or(`note.ilike.${q},categories.name.ilike.${q}`)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error } = await query.range(from, to)
  if (error) throw error
  // flatten nama kategori supaya seragam dengan mode lokal
  return data.map(t => ({ ...t, category: t.categories?.name || null }))
}

// INSERT
export async function addTransaction(tx) {
  const insert = {
    date: tx.date,
    type: tx.type,
    amount: tx.amount,
    note: tx.note || null,
    category_id: tx.category_id || null
  }
  const { data, error } = await supabase
    .from('transactions')
    .insert(insert)
    .select('id,date,type,amount,note,category_id,categories:category_id (name,type)')
    .single()
  if (error) throw error
  return { ...data, category: data.categories?.name || null }
}

// UPDATE
export async function updateTransaction(id, patch) {
  const { data, error } = await supabase
    .from('transactions')
    .update(patch)
    .eq('id', id)
    .select('id,date,type,amount,note,category_id,categories:category_id (name,type)')
    .single()
  if (error) throw error
  return { ...data, category: data.categories?.name || null }
}

// DELETE
export async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}
