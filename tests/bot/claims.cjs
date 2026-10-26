const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth; create table auth.users(id uuid primary key);
      create role anon; create role authenticated; create role service_role bypassrls;
      create table public.accounts(id uuid primary key);
      insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`);
    await db.exec(fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20261026000000_bot_recording_workflow.sql'), 'utf8'));
    const user = '00000000-0000-0000-0000-000000000001';
    const claim = async (context, message, userId = user) => (await db.query('select public.claim_whatsapp_request($1,$2,$3) as claim', [userId, context, message])).rows[0].claim;
    await db.exec('set role service_role');
    const first = await claim('private','msg1'); assert.equal(first.kind, 'claimed');
    assert.equal((await claim('private','msg1')).kind, 'duplicate');
    assert.equal((await claim('group','msg2')).kind, 'busy');
    assert.equal((await claim('private','msg1','00000000-0000-0000-0000-000000000002')).kind, 'claimed');
    await db.query("update public.whatsapp_inbound_requests set state='ready',reply='saved receipt',parsed=$2 where id=$1", [first.id, {command:'last_transaction',transactionId:'test'}]);
    const replay = await claim('private','msg1'); assert.equal(replay.state, 'ready'); assert.equal(replay.reply, 'saved receipt');
    assert.equal((await claim('private','msg2')).kind, 'claimed');
    await assert.rejects(db.query('insert into public.whatsapp_inbound_requests(user_id,context_key,message_id) values ($1,$2,$3)',[user,'another','msg3']), /duplicate key/);
    await db.exec('reset role');
    // A deployment rerun must preserve existing claims and preferences.
    await db.exec(fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20261026000000_bot_recording_workflow.sql'), 'utf8'));
    assert.equal((await claim('private','msg1')).reply, 'saved receipt');
    await db.exec('set role authenticated');
    await assert.rejects(claim('private','unauthorized'), /permission denied/);
    await assert.rejects(db.query('select * from public.whatsapp_inbound_requests'), /permission denied/);
    await assert.rejects(db.query('select * from public.whatsapp_recording_preferences'), /permission denied/);
    console.log('PASS: migration executes; claim/replay/busy/user isolation, unique constraints and restricted grants verified.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
