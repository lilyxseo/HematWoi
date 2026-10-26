// Test double for the SDK query protocol; SQL claim semantics are tested separately.
type Row = Record<string, any>;
export const db: Record<string, Row[]> = {};
let tick = 0;
export let failTable: string | null = null;
let failOperation: string | null = null;
export function failOnce(table: string, operation: string | null = null) { failTable = table; failOperation = operation; }
export function reset() {
  for (const key of Object.keys(db)) delete db[key];
  tick = 0; failTable = null;
  db.whatsapp_users = [{ user_id: 'user-1', phone: '628123456789' }, { user_id: 'user-2', phone: '628999999999' }];
  db.accounts = [{ id: 'cash-id', user_id: 'user-1', name: 'Cash', type: 'cash' }, { id: 'bank-id', user_id: 'user-1', name: 'Seabank', type: 'bank' }];
  db.categories = [{ id: 'food-id', user_id: 'user-1', name: 'Makan', type: 'expense' }];
}
class Query {
  filters: Array<(row: Row) => boolean> = [];
  operation = 'select'; values: Row[] = []; singleRow = false; max = Infinity;
  orders: Array<{key: string; ascending: boolean}> = [];
  constructor(public table: string) { db[table] ??= []; }
  select(..._args: any[]) { return this; }
  insert(values: Row | Row[]) { this.operation = 'insert'; this.values = Array.isArray(values) ? values : [values]; return this; }
  upsert(value: Row) { this.operation = 'upsert'; this.values = [value]; return this; }
  update(value: Row) { this.operation = 'update'; this.values = [value]; return this; }
  delete() { this.operation = 'delete'; return this; }
  eq(key: string, value: any) { this.filters.push(row => row[key] === value); return this; }
  neq(key: string, value: any) { this.filters.push(row => row[key] !== value); return this; }
  is(key: string, value: any) { this.filters.push(row => value === null ? row[key] == null : row[key] === value); return this; }
  not(key: string, _operator: string, value: any) { return this.neq(key, value); }
  ilike(key: string, value: string) { const pattern = new RegExp('^' + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i'); this.filters.push(row => pattern.test(row[key] ?? '')); return this; }
  in(key: string, values: any[]) { this.filters.push(row => values.includes(row[key])); return this; }
  gte(key: string, value: any) { this.filters.push(row => row[key] >= value); return this; }
  lte(key: string, value: any) { this.filters.push(row => row[key] <= value); return this; }
  lt(key: string, value: any) { this.filters.push(row => row[key] < value); return this; }
  or(_value: string) { return this; }
  order(key: string, options: { ascending: boolean } = { ascending: true }) { this.orders.push({key, ascending: options.ascending}); return this; }
  limit(max: number) { this.max = max; return this; }
  range(start: number, end: number) { this.max = end - start + 1; return this; }
  maybeSingle() { this.singleRow = true; return this; }
  single() { this.singleRow = true; return this; }
  then(resolve: (value: any) => any, reject?: (error: any) => any) {
    return Promise.resolve().then(() => {
      if (failTable === this.table && (!failOperation || failOperation === this.operation)) { failTable = null; throw new Error("simulated database failure"); }
      let rows = db[this.table].filter(row => this.filters.every(filter => filter(row)));
      if (this.operation === 'insert') {
        rows = this.values.map(value => ({ id: crypto.randomUUID(), created_at: new Date(Date.now() + tick++).toISOString(), inserted_at: new Date().toISOString(), ...value }));
        db[this.table].push(...rows);
      } else if (this.operation === 'upsert') {
        const existing = db[this.table].find(row => row.user_id === this.values[0].user_id);
        if (existing) Object.assign(existing, this.values[0]); else db[this.table].push({...this.values[0]});
        rows = [existing ?? this.values[0]];
      } else if (this.operation === 'update') rows.forEach(row => Object.assign(row, this.values[0]));
      else if (this.operation === 'delete') db[this.table] = db[this.table].filter(row => !rows.includes(row));
      for (const order of [...this.orders].reverse()) rows.sort((a,b) => (a[order.key] < b[order.key] ? -1 : a[order.key] > b[order.key] ? 1 : 0) * (order.ascending ? 1 : -1));
      const count = rows.length; rows = rows.slice(0, this.max);
      return { data: structuredClone(this.singleRow ? rows[0] ?? null : rows), error: null, count };
    }).then(resolve, reject);
  }
}
export function createClient(..._args: any[]) {
  return { from: (table: string) => new Query(table), rpc: async (name: string, args: Row) => {
    if (name !== 'claim_whatsapp_request') return { data: [{ cash_balance: 0, non_cash_balance: 0, total_balance: 0 }], error: null };
    const rows = db.whatsapp_inbound_requests ??= [];
    const existing = rows.find(row => row.user_id === args.p_user_id && row.context_key === args.p_context_key && row.message_id === args.p_message_id);
    if (existing) return { data: { kind: 'duplicate', ...existing }, error: null };
    if (rows.some(row => row.user_id === args.p_user_id && row.state === 'processing')) return { data: {kind:'busy'}, error:null };
    const row = { id: crypto.randomUUID(), user_id: args.p_user_id, context_key: args.p_context_key, message_id: args.p_message_id, state: 'processing' };
    rows.push(row); return { data: {kind:'claimed',id:row.id}, error:null };
  }};
}
export type SupabaseClient = ReturnType<typeof createClient>;
