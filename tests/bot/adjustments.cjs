const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  const user = '00000000-0000-0000-0000-000000000001';
  const other = '00000000-0000-0000-0000-000000000002';
  const account = '10000000-0000-0000-0000-000000000001';
  const cash = '10000000-0000-0000-0000-000000000002';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table public.accounts(id uuid primary key,user_id uuid not null,name text not null);
      create table public.transactions(id uuid primary key default gen_random_uuid(),user_id uuid not null,account_id uuid references accounts(id),to_account_id uuid references accounts(id),type text check(type in ('income','expense','transfer')),date date not null,amount numeric not null check(amount>0),title text,notes text,deleted_at timestamptz);
      insert into public.accounts values('${account}','${user}','Seabank'),('${cash}','${user}','Cash');
      insert into public.transactions(user_id,account_id,to_account_id,type,date,amount) values
        ('${user}','${account}',null,'income','2026-10-30',100000),
        ('${user}','${account}',null,'expense','2026-10-30',30000),
        ('${user}','${cash}','${account}','transfer','2026-10-30',10000),
        ('${user}','${account}','${cash}','transfer','2026-10-30',5000),
        ('${user}','${account}',null,'income','2027-01-01',5000);
      insert into public.transactions(user_id,account_id,type,date,amount,deleted_at) values ('${user}','${account}','expense','2026-10-30',50000,now());
      insert into public.transactions(user_id,account_id,type,date,amount) values ('${other}','${account}','income','2026-10-30',999999);`);
    const migration = fs.readFileSync(path.join(__dirname,'../../supabase/migrations/20261030000000_bot_balance_adjuster.sql'),'utf8');
    await db.exec(migration); await db.exec(migration);
    const adjust = async (target, uid = user) => (await db.query('select public.adjust_whatsapp_account_balance($1,$2,$3,$4) as result',[uid,account,target,'2026-10-30'])).rows[0].result;
    let result = await adjust(100000);
    assert.equal(result.before,80000); assert.equal(result.delta,20000); assert.equal(result.type,'income');
    const row = (await db.query('select * from transactions where id=$1',[result.transaction_id])).rows[0];
    assert.equal(row.title,'Adjuster Seabank'); assert.equal(Number(row.amount),20000); assert.match(row.notes,/saldo_sebelum=80000; target=100000; selisih=20000/);
    result = await adjust(40000); assert.equal(result.before,100000); assert.equal(result.delta,-60000); assert.equal(result.type,'expense');
    const count = Number((await db.query('select count(*) as count from transactions')).rows[0].count);
    result = await adjust(40000); assert.equal(result.transaction_id,null); assert.equal(result.delta,0);
    assert.equal(Number((await db.query('select count(*) as count from transactions')).rows[0].count),count);
    result = await adjust(0); assert.equal(result.delta,-40000);
    result = await adjust(-10000); assert.equal(result.delta,-10000);
    // Soft-deleting the last adjustment restores the ledger balance to zero.
    await db.query('update transactions set deleted_at=now() where id=$1',[result.transaction_id]);
    assert.equal((await adjust(0)).transaction_id,null);
    await assert.rejects(adjust(100000,other),/ADJUST_ACCOUNT_NOT_FOUND/);
    await assert.rejects(adjust('NaN'),/INVALID_ADJUST_TARGET/);
    await assert.rejects(adjust(1.5),/INVALID_ADJUST_TARGET/);
    await db.exec('set role authenticated');
    await assert.rejects(adjust(100000),/permission denied/);
    console.log('PASS: adjust RPC, ledger transfers/future/deleted/user isolation, history, increase/decrease/zero/negative/no-op, undo, rerun and permissions.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
