import { db, reset, failOnce } from './fake-supabase.ts';
import { detailedReceipt, parseHistoryDeleteCommand, parseAdjustCommand, correctCommandTypo, matchUniqueName } from '../../supabase/functions/fonnte-webhook-v2/recording.ts';
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
Deno.test('Fonnte LID menu payload without message ID responds and deduplicates retries', async () => {
  setup();
  const payload = { choices: [], device: '628000000000', inboxid: 0, isgroup: false, mode: 'lid', senderlid: '123456789@lid', timestamp: 1793012337, type: 'text', text: 'non-button message' };
  const first = await send('menu', '', payload);
  assert(first.status === 200); assert(latestReply().includes('Pencatatan cepat'));
  assert((await (await send('menu', '', payload)).json()).duplicate === true);
});
Deno.test('Fonnte timestamp recording payload recognizes account typo without 422', async () => {
  setup(); const payload = { device: '628000000000', inboxid: 0, mode: 'lid', timestamp: 1793007377, type: 'text', text: 'non-button message' };
  const first = await send('fm 200 seabanj', '', payload);
  assert(first.status === 200); assert(latestReply().includes('Pilih kategori'));
  assert((await (await send('fm 200 seabanj', '', payload)).json()).duplicate === true);
  await send('1'); assert(active().length === 1); assert(active()[0].account_id === 'bank-id'); assert(active()[0].amount === 200);
});
Deno.test('same text with different original timestamps remains a new transaction', async () => {
  setup();
  await send('makan 25rb cash', '', { timestamp: 1793007377 });
  await send('makan 25rb cash', '', { timestamp: '1793007378' });
  assert(active().length === 2);
});
Deno.test('invalid timestamps fail closed when no ID exists', async () => {
  for (const timestamp of [0, -1, 'invalid', true, 1.5]) {
    setup(); assert((await send('makan 25rb cash', '', {timestamp})).status === 422); assert(active().length === 0);
  }
});
Deno.test('pending category can be selected by number then saved once', async () => {
  setup(); await send('misteri 25rb cash');
  assert(active().length === 0); assert(latestReply().includes('1. Makan'));
  await send('1'); assert(active().length === 1); assert(active()[0].category_id === 'food-id');
  assert(latestReply().includes('Tercatat'));
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
Deno.test('cancel undoes the latest bot transaction once and does not delete older records', async () => {
  setup();
  await send('makan 10rb cash'); const previous = active()[0].id;
  await send('makan 25rb cash');
  assert(latestReply().includes('• undo / cancel — batalkan transaksi terakhir'));
  await send('CANCEL', 'cancel-id');
  assert(active().length === 1 && active()[0].id === previous);
  await send('cancel', 'cancel-id');
  await send('cancel');
  assert(active().length === 1 && active()[0].id === previous);
});
Deno.test('undo and cancel discard a pending draft without touching the previous saved transaction', async () => {
  for (const command of ['undo', 'cancel']) {
    setup(); await send('makan 10rb cash'); const previous = active()[0].id;
    await send('misteri 25rb cash');
    assert(latestReply().includes('undo / cancel'));
    await send(command);
    assert(latestReply().includes('Transaksi tertunda dibatalkan'));
    await send(command);
    assert(active().length === 1 && active()[0].id === previous);
  }
});
Deno.test('cancel cannot undo a transaction from a different conversation', async () => {
  setup(); await send('makan 25rb cash');
  await send('cancel', 'group-cancel', {group:'120000000000@g.us',participant:'628123456789'});
  assert(active().length === 1);
});
Deno.test('adjust records only the difference to the target and supports cancel', async () => {
  setup(); await send('makan 25rb seabank');
  await send('adjust seabank 100rb','adjust-once');
  let adjustment = active().find(row => row.title === 'Adjuster Seabank');
  assert(adjustment?.amount === 125000 && adjustment.type === 'income');
  assert(latestReply().includes('Saldo sebelumnya:') && latestReply().includes('100.000'));
  await send('adjust seabank 100rb','adjust-once'); assert(active().length === 2);
  await send('cancel'); assert(active().length === 1);
});
Deno.test('adjust handles decreases, zero balance, and unchanged target without empty history', async () => {
  setup(); await send('adjust seabank 100rb'); await send('adjust seabank 40rb');
  assert(active().at(-1).type === 'expense' && active().at(-1).amount === 60000);
  await send('adjust seabank 0'); assert(active().at(-1).amount === 40000);
  const count = active().length;
  await send('adjust seabank 0'); assert(active().length === count); assert(latestReply().includes('Tidak ada transaksi Adjuster baru'));
});
Deno.test('adjust validates input without guessing amounts or writing to unknown accounts', async () => {
  setup();
  for (const text of ['adjust', 'adjust seabank seratus', 'adjust seabank 1OOrb', 'adjust rekeningasing 100rb']) await send(text);
  assert(active().length === 0);
  assert(parseAdjustCommand('adjust bank utama 100.000')?.target === 100000);
  assert(parseAdjustCommand('adjust seabank -1,5jt')?.target === -1500000);
  assert(parseAdjustCommand('adjust seabank 0')?.target === 0);
});
Deno.test('adjust command works in a group and menu documents the target meaning', async () => {
  setup(); await send('adjust seabank 100rb','group-adjust',{group:'120000000000@g.us',participant:'628123456789'});
  assert(active().length === 1 && active()[0].title === 'Adjuster Seabank');
  await send('menu'); assert(latestReply().includes('adjust seabank 100rb'));
});
Deno.test('history supports comma-separated numbers, deduplication and replay protection', async () => {
  setup();
  for (const amount of [10,20,30,40]) await send(`makan ${amount}rb cash`);
  await send('history'); assert(latestReply().includes('hapus 1,2,3'));
  const snapshot = db.whatsapp_message_logs.at(-1).parsed.displayedTransactions;
  const selectedIds = snapshot.filter(row => [1,2,3].includes(row.no)).map(row => row.id);
  assert(selectedIds.length === 3);
  await send('hapus 1, 2,3,2','bulk-delete');
  assert(active().length === 1 && !selectedIds.includes(active()[0].id));
  assert(latestReply().includes('3 transaksi berhasil dihapus'));
  await send('hapus 1, 2,3,2','bulk-delete'); assert(active().length === 1);
});
Deno.test('undo after history deletion cannot accidentally remove another older receipt', async () => {
  setup(); await send('makan 10rb cash'); await send('makan 20rb cash');
  const lastSaved = db.whatsapp_message_logs.at(-1).parsed.transactionId;
  await send('history');
  const snapshot = db.whatsapp_message_logs.at(-1).parsed.displayedTransactions;
  const selected = snapshot.find(row => row.id !== lastSaved);
  await send(`hapus ${selected.no}`); assert(active().length === 1);
  await send('undo'); assert(active().length === 1 && active()[0].id === lastSaved);
});
Deno.test('invalid or unknown history numbers never delete a subset', async () => {
  setup(); await send('makan 10rb cash'); await send('makan 20rb cash'); await send('history');
  for (const command of ['hapus 1,99','hapus 0,1','hapus 1,','hapus 1,a','hapus -1','hapus 1-2']) {
    await send(command); assert(active().length === 2,command);
  }
  await send('hapus 1'); assert(active().length === 1);
});
Deno.test('stale history selection refuses the whole deletion and retains the other entry', async () => {
  setup(); await send('makan 10rb cash'); await send('makan 20rb cash'); await send('history');
  const snapshot = db.whatsapp_message_logs.at(-1).parsed.displayedTransactions;
  db.transactions.find(row => row.id === snapshot[0].id).deleted_at = new Date().toISOString();
  await send('hapus 1,2'); assert(active().length === 1);
  assert(latestReply().includes('Tidak ada transaksi tambahan dihapus'));
});
Deno.test('bulk deletion requires history from the same conversation and user', async () => {
  setup(); await send('makan 10rb cash'); await send('hapus 1,2'); assert(active().length === 1);
  await send('history');
  await send('hapus 1','delete-other-chat',{group:'120000000000@g.us',participant:'628123456789'});
  assert(active().length === 1 && latestReply().includes('Belum ada history'));
});
Deno.test('history delete parser does not intercept entity deletion or bare undo alias', () => {
  for (const command of ['hapus','hapus budget 1','hapus kategori makan','hapus hutang 1','hapus wishlist 1']) assert(parseHistoryDeleteCommand(command) === null);
  const parsed = parseHistoryDeleteCommand('hapus 1,2,2');
  assert(parsed && !('error' in parsed) && parsed.numbers.join(',') === '1,2');
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
Deno.test('detailed receipt includes balance, budget remaining, warnings and correction help', () => {
  const receipt = detailedReceipt({ type:'expense', title:'Lunch', amount:25000, categoryName:'Makan', accountName:'Cash', date:'2026-10-26', balanceSection:'💰 Saldo Saat Ini\nCash: Rp100.000', budgetSection:'📆 Budget Bulanan\nTerpakai: Rp25.000 / Rp200.000\nSisa: Rp175.000\n🗓️ Budget Mingguan\nSisa: Rp50.000', warnings:['⚠️ Saldo mulai menipis.'] });
  for (const expected of ['25.000', 'Cash', 'Makan', '2026-10-26', 'Saldo Saat Ini', '175.000', 'Budget Mingguan', '50.000', 'menipis', '• edit 30000']) assert(receipt.includes(expected), expected);
});
Deno.test('expense receipt preserves the original requested WhatsApp layout exactly', () => {
  const money = (value: number) => new Intl.NumberFormat('id-ID', {style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);
  const balance = `💰 Saldo Saat Ini\nCash: ${money(45000)}\nNon Cash: ${money(-87506)}\nTotal: ${money(-42506)}`;
  const budget = `📆 Budget Bulanan\n• Terpakai: ${money(258000)} / ${money(250000)}\n• Sisa: ${money(-8000)}\n⚠️ Budget bulanan hampir habis (103.2%)\n\n🗓️ Budget Mingguan\n• Terpakai: ${money(3500)} / ${money(50000)}\n• Sisa: ${money(46500)}`;
  const warnings = ['🚨 Budget Makan sudah melewati limit.', '⚠️ Saldo mulai menipis.'];
  const receipt = detailedReceipt({type:'expense', date:'2026-10-26', categoryName:'Makan',title:'fm',amount:3500,accountName:'Seabank',balanceSection:balance,budgetSection:budget,warnings});
  assert(receipt === [`✅ Pengeluaran Tercatat`, '', 'Tanggal: 2026-10-26', 'Kategori: Makan', 'Judul: fm', `Nominal: ${money(3500)}`, 'Akun: Seabank', '', balance, '', budget, '', ...warnings, '', '━━━━━━━━━━━━━━', '⚡ Koreksi Cepat', '• edit 30000', '• kategori makan', '• akun cash', '• tanggal 01/06', '• judul pertamax turbo', '• undo / cancel — batalkan transaksi terakhir', '• adjust seabank 100rb — atur saldo akun'].join('\n'), receipt);
});
Deno.test('ordinary recording includes an over-budget warning based on database usage', async () => {
  setup();
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  db.budgets = [{id:'over-budget',user_id:'user-1',category_id:'food-id',planned_amount:250000,period_month:today.slice(0,7)+'-01'}];
  db.transactions = [{id:'previous-expense',user_id:'user-1',category_id:'food-id',account_id:'bank-id',type:'expense',amount:254500,date:today}];
  const response = await send('makan fm 3500 seabank');
  assert(response.status === 200);
  assert(latestReply().includes('103.2%'), latestReply());
  assert(latestReply().includes('🚨 Budget Makan sudah melewati limit.'), latestReply());
  assert(latestReply().includes('• akun cash'));
});
Deno.test('successful recording computes remaining monthly budget after the insert', async () => {
  setup();
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  db.budgets = [{ id:'budget-food', user_id:'user-1', category_id:'food-id', planned_amount:200000, period_month:today.slice(0,7)+'-01' }];
  const response = await send('makan 25rb cash');
  assert(response.status === 200); assert(active().length === 1);
  assert(latestReply().includes('Budget Bulanan'), latestReply());
  assert(latestReply().includes('175.000'), latestReply());
});
Deno.test('saved recording returns detailed balance even when budget lookup fails', async () => {
  setup(); failOnce('budgets', 'select');
  const response = await send('makan 25rb cash');
  assert(response.status === 200); assert(active().length === 1);
  assert(latestReply().includes('Saldo Saat Ini'));
  assert(latestReply().includes('Informasi budget belum dapat diambil'));
  assert(latestReply().includes('Transaksi tetap tersimpan'));
});
Deno.test('an uncertain request is never automatically rerun', async () => {
  setup();
  db.whatsapp_inbound_requests = [{id:'uncertain',user_id:'user-1',context_key:'628123456789',message_id:':uncertain',state:'review'}];
  const response = await send('makan 25rb cash','uncertain');
  assert((await response.json()).reason === 'manual_review_required'); assert(active().length === 0);
});
// The fake is intentionally scoped to this test process; never calls real WhatsApp APIs.
Deno.test('cleanup network stub', () => { globalThis.fetch = originalFetch; });
