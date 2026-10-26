import { db, reset, failOnce } from './fake-supabase.ts';
import { compactReceipt, correctCommandTypo, matchUniqueName } from '../../supabase/functions/fonnte-webhook-v2/recording.ts';
let handler: (request: Request) => Promise<Response>;
const originalServe = Deno.serve;
Deno.serve = ((fn: typeof handler) => { handler = fn; return {}; }) as typeof Deno.serve;
Deno.env.set('SUPABASE_URL', 'http://localhost');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-only');
Deno.env.set('FONNTE_TOKEN', 'test-only');
await import('../../supabase/functions/fonnte-webhook-v2/index.ts');
Deno.serve = originalServe;
const originalFetch = globalThis.fetch;
let deliveryOK = true;
let replies: string[] = [];
globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
  if (String(url) !== 'https://api.fonnte.com/send') throw new Error('Unexpected network destination');
  replies.push(String((init?.body as FormData).get('message')));
  return Promise.resolve(Response.json({ status: deliveryOK }));
}) as typeof fetch;
let sequence = 0;
function setup() { reset(); deliveryOK = true; replies = []; }
async function send(message: string, id: string | undefined = `test-${sequence++}`, extra = {}) {
  return await handler(new Request('http://localhost/webhook', { method: 'POST', body: JSON.stringify({ sender: '628123456789', message, id, ...extra }) }));
}
function assert(value: unknown, message = 'Assertion failed'): asserts value { if (!value) throw new Error(message); }
const active = () => (db.transactions ?? []).filter(row => !row.deleted_at);
const latestReply = () => replies.at(-1) ?? '';

Deno.test('one webhook ID is applied once, including parallel deliveries', async () => {
  setup();
  await Promise.all([send('makan 25rb cash', 'same'), send('makan 25rb cash', 'same')]);
  assert(active().length === 1, 'duplicate inserted transactions');
  const result = await send('makan 25rb cash', 'same');
  assert((await result.json()).duplicate === true);
  assert(active().length === 1);
});
Deno.test('failed WhatsApp delivery replays receipt, not the transaction', async () => {
  setup(); deliveryOK = false;
  const first = await send('makan 25rb cash', 'delivery');
  assert(first.status === 503);
  assert(active().length === 1);
  assert(db.whatsapp_inbound_requests[0].state === 'ready');
  deliveryOK = true;
  await send('makan 25rb cash', 'delivery');
  assert(active().length === 1);
  assert(db.whatsapp_inbound_requests[0].state === 'delivered');
});
Deno.test('missing stable message ID cannot mutate finances', async () => {
  setup(); const result = await send('makan 25rb cash', '');
  assert(result.status === 422); assert(active().length === 0);
});
Deno.test('pending category can be selected by number then saved once', async () => {
  setup(); await send('misteri 25rb cash');
  assert(active().length === 0); assert(latestReply().includes('1. Makan'));
  await send('1'); assert(active().length === 1); assert(active()[0].category_id === 'food-id');
  assert(latestReply().includes('tercatat'));
});
Deno.test('numbered selection retains entity ID if its display name changes', async () => {
  setup(); await send('misteri 25rb cash');
  db.categories[0].name = 'Makanan';
  await send('1'); assert(active().length === 1); assert(active()[0].category_id === 'food-id');
  assert(latestReply().includes('Makanan'));
});
Deno.test('ordinary recording works in groups and other conversation undo cannot touch it', async () => {
  setup(); await send('makan 25rb cash', 'group-recording', { group: '120000000000@g.us', participant: '628123456789' });
  assert(active().length === 1);
  await send('undo'); assert(active().length === 1);
});
Deno.test('pending cancellation and expiry do not resurrect drafts', async () => {
  setup(); await send('misteri 25rb cash'); await send('batal'); await send('1');
  assert(active().length === 0);
  setup(); await send('misteri 25rb cash');
  db.whatsapp_message_logs.at(-1)!.parsed.expiresAt = Date.now() - 1;
  await send('1'); assert(active().length === 0); assert(latestReply().includes('Sesi transaksi habis'));
});
Deno.test('pending two-step flow retains its original expiry and validates choices', async () => {
  setup(); db.whatsapp_recording_preferences = [{ user_id: 'user-1', learning_enabled: false, learned_accounts: {}, default_account_id: null }];
  await send('misteri 25rb');
  const expiry = db.whatsapp_message_logs.at(-1)!.parsed.expiresAt;
  await send('99'); assert(active().length === 0); assert(latestReply().includes('tidak tersedia'));
  await send('1');
  assert(db.whatsapp_message_logs.at(-1)!.parsed.expiresAt === expiry);
  assert(latestReply().includes('Pilih akun'));
  await send('1'); assert(active().length === 1);
});
Deno.test('quick correction learns account and default/learning/reset remain controllable', async () => {
  setup(); await send('makan 25rb cash'); await send('nominal 30rb');
  assert(active()[0].amount === 30000);
  await send('ganti akun seabank'); assert(active()[0].account_id === 'bank-id');
  assert(Object.values(db.whatsapp_recording_preferences[0].learned_accounts).includes('bank-id'));
  await send('akun default seabank'); await send('belajar akun mati');
  await send('makan 20rb'); assert(active().at(-1)!.account_id === 'bank-id');
  await send('reset pembelajaran');
  assert(Object.keys(db.whatsapp_recording_preferences[0].learned_accounts).length === 0);
  await send('preferensi'); assert(latestReply().includes('Belajar akun: mati'));
});
Deno.test('undo uses this conversation receipt and never deletes older app transactions', async () => {
  setup(); db.transactions = [{ id: 'from-app', user_id: 'user-1', amount: 500000, title: 'App transaction', inserted_at: '2099-01-01' }];
  await send('undo'); assert(active().length === 1);
  await send('makan 25rb cash'); await send('undo'); await send('undo');
  assert(active().length === 1); assert(active()[0].id === 'from-app');
});
Deno.test('batch returns each line outcome and duplicate delivery does not repeat valid lines', async () => {
  setup(); const text = 'makan 25rb cash\nmakan 30rb seabank\ntidak valid';
  await send(text, 'batch'); assert(active().length === 2);
  assert(latestReply().includes('2/3')); assert(latestReply().includes('3. ❌'));
  await send(text, 'batch'); assert(active().length === 2);
  await send('nominal 35rb'); assert(active().filter(row => row.amount === 35000).length === 1);
});
Deno.test('typos work without guessing ambiguous names, amounts, or destructive commands', async () => {
  assert(correctCommandTypo('sldo') === 'saldo');
  assert(correctCommandTypo('nomnal 25rb') === 'nominal 25rb');
  assert(correctCommandTypo('hapud') === 'hapud');
  assert(correctCommandTypo('makan 2Srb cash') === 'makan 2Srb cash');
  assert(matchUniqueName('casa', [{name:'cash'}, {name:'case'}]) === null);
  setup(); await send('makan 25rb seaabank');
  assert(active().length === 1); assert(active()[0].account_id === 'bank-id');
  await send('katgori makna'); assert(active()[0].category_id === 'food-id');
});
Deno.test('group undo cannot delete transactions from the private conversation', async () => {
  setup(); await send('makan 25rb cash');
  await send('undo', 'group-undo', { group: '120000000000@g.us', participant: '628123456789' });
  assert(active().length === 1);
});
Deno.test('commit followed by a log failure requires review, never an automatic second insert', async () => {
  setup();
  // Fail only INSERT logging, after the preflight SELECT has succeeded.
  failOnce('whatsapp_message_logs', 'insert');
  const firstResponse = await send('makan 25rb cash', 'saved-before-failure');
  assert(firstResponse.status === 503);
  assert(db.whatsapp_inbound_requests[0].state === 'review');
  const response = await send('makan 25rb cash', 'saved-before-failure');
  assert(response.status === 503); assert(active().length === 1);
});
Deno.test('failed initial query fails closed without recording', async () => {
  setup(); failOnce('whatsapp_recording_preferences');
  const response = await send('makan 25rb', 'fail');
  assert(response.status === 503); assert(active().length === 0);
  assert(db.whatsapp_inbound_requests[0].state === 'review');
  await send('makan 25rb', 'fail'); assert(active().length === 0);
});
Deno.test('batch limit rejects the whole message before inserting', async () => {
  setup(); await send(Array(21).fill('makan 25rb cash').join('\n'));
  assert(active().length === 0); assert(latestReply().includes('Maksimal 20'));
});
Deno.test('receipt stays short while preserving amount, account, category and date', () => {
  const receipt = compactReceipt({ type:'expense', title:'Lunch', amount:25000, categoryName:'Makan', accountName:'Cash', date:'2026-10-26' });
  assert(receipt.includes('25.000') && receipt.includes('Cash') && receipt.includes('Makan') && receipt.includes('2026-10-26'));
  assert(receipt.split('\n').length <= 7);
});
Deno.test('an uncertain request is never automatically rerun', async () => {
  setup();
  db.whatsapp_inbound_requests = [{id:'uncertain',user_id:'user-1',context_key:'628123456789',message_id:':uncertain',state:'review'}];
  const response = await send('makan 25rb cash','uncertain');
  assert((await response.json()).reason === 'manual_review_required'); assert(active().length === 0);
});
// The fake is intentionally scoped to this test process; never calls real WhatsApp APIs.
Deno.test('cleanup network stub', () => { globalThis.fetch = originalFetch; });
