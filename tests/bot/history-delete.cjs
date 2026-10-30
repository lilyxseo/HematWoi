const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
(async () => {
 const db = new PGlite();
 const user = '00000000-0000-0000-0000-000000000001';
 const other = '00000000-0000-0000-0000-000000000002';
 const ids = [1,2,3,4].map(i => `10000000-0000-0000-0000-00000000000${i}`);
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table transactions(id uuid primary key,user_id uuid not null,deleted_at timestamptz);
    insert into transactions values('${ids[0]}','${user}',null),('${ids[1]}','${user}',null),('${ids[2]}','${user}',now()),('${ids[3]}','${other}',null);`);
  const migration = fs.readFileSync(path.join(__dirname,'../../supabase/migrations/20261030010000_bot_bulk_history_delete.sql'),'utf8');
  await db.exec(migration); await db.exec(migration);
  const remove = async selected => (await db.query('select public.delete_whatsapp_history_transactions($1,$2::uuid[]) as result',[user,selected])).rows[0].result;
  const alive = async () => (await db.query('select id from transactions where user_id=$1 and deleted_at is null',[user])).rows.map(row => row.id);
  assert.equal((await remove([ids[0],ids[2]])).ok,false); assert.equal((await alive()).length,2);
  assert.equal((await remove([ids[0],ids[3]])).ok,false); assert.equal((await alive()).length,2);
  await assert.rejects(remove([]),/INVALID_HISTORY_SELECTION/);
  await assert.rejects(remove([ids[0],ids[0]]),/INVALID_HISTORY_SELECTION/);
  await assert.rejects(remove([ids[0],null]),/INVALID_HISTORY_SELECTION/);
  const result = await remove([ids[1],ids[0]]); assert.equal(result.count,2); assert.equal(result.ok,true);
  assert.deepEqual(result.deleted_ids.sort(),[ids[0],ids[1]].sort()); assert.equal((await alive()).length,0);
  assert.equal((await remove([ids[0],ids[1]])).ok,false);
  assert.equal(Number((await db.query('select count(*) as count from transactions')).rows[0].count),4);
  await db.exec('set role authenticated'); await assert.rejects(remove([ids[0]]),/permission denied/);
  console.log('PASS: atomic bulk soft-delete, stale/missing/foreign selections, repeated deletion, invalid arrays, data retention and restricted grants.');
 } finally { await db.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
