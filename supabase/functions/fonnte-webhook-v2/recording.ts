/** Small, deterministic helpers shared by the webhook and regression tests. */
export function quickEditAlias(text: string): string {
  return text.trim().replace(/^(?:ganti|ubah)\s+(akun|kategori|tanggal|judul)\s+/i, '$1 ')
    .replace(/^(?:nominal|(?:ganti|ubah)\s+nominal)\s+/i, 'edit ');
}

export function splitRecordingLines(message: string): string[] | null {
  const lines = message.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return lines.length > 1 ? lines : null;
}

export function detailedReceipt(input: {
  type: string; title?: string | null; amount: number; categoryName?: string | null;
  accountName?: string | null; toAccountName?: string | null; date?: string | null;
  balanceSection?: string; budgetSection?: string | null; warnings?: string[];
}): string {
  const amount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(input.amount);
  const lines = [
    `✅ ${input.type === 'income' ? 'Pemasukan' : input.type === 'transfer' ? 'Transfer' : 'Pengeluaran'} Tercatat`,
    '',
    `Tanggal: ${input.date ?? '-'}`,
    ...(input.type === 'transfer' ? [] : [`Kategori: ${input.categoryName ?? '-'}`]),
    `Judul: ${input.title || input.categoryName || 'Transaksi'}`,
    `Nominal: ${amount}`,
  ];
  if (input.type === 'transfer') lines.push(`Dari: ${input.accountName ?? '-'}`, `Ke: ${input.toAccountName ?? '-'}`);
  else lines.push(`Akun: ${input.accountName ?? '-'}`);
  lines.push('', input.balanceSection || '💰 Saldo Saat Ini\nInformasi saldo belum tersedia.');
  if (input.type === 'expense') lines.push('', input.budgetSection || '📊 Belum ada budget untuk kategori ini pada periode transaksi.');
  if (input.warnings?.length) lines.push('', ...input.warnings);
  const suggestedAccount = input.accountName?.toLowerCase().includes('seabank') ? 'cash' : 'seabank';
  lines.push('', '━━━━━━━━━━━━━━', '⚡ Koreksi Cepat', '• edit 30000', '• kategori makan', `• akun ${suggestedAccount}`, '• tanggal 01/06', '• judul pertamax turbo');
  return lines.join('\n');
}

export function selectPendingChoice(value: string, choices: Array<{ id: string; name: string }>): { id: string; name: string } | null {
  if (/^\d+$/.test(value.trim())) return choices[Number(value.trim()) - 1] ?? null;
  return choices.find(choice => choice.name.toLocaleLowerCase() === value.trim().toLocaleLowerCase()) ?? null;
}

/** Damerau-Levenshtein: a single insert/delete/substitution/transposition only. */
export function isSingleTypo(input: string, expected: string): boolean {
  if (input === expected || Math.abs(input.length - expected.length) > 1) return false;
  if (input.length === expected.length) {
    const differences = [...input].map((char, i) => char === expected[i] ? -1 : i).filter(i => i >= 0);
    if (differences.length === 1) return true;
    const [a, b] = differences;
    return differences.length === 2 && b === a + 1 && input[a] === expected[b] && input[b] === expected[a];
  }
  const shorter = input.length < expected.length ? input : expected;
  const longer = input.length < expected.length ? expected : input;
  for (let i = 0; i < longer.length; i++) if (longer.slice(0, i) + longer.slice(i + 1) === shorter) return true;
  return false;
}

export function matchUniqueName<T extends { name: string }>(text: string, choices: T[]): T | null {
  const normalized = text.trim().toLocaleLowerCase();
  const exact = choices.filter(choice => choice.name.toLocaleLowerCase() === normalized);
  if (exact.length) return exact.length === 1 ? exact[0] : null;
  // Short names and numbers are too ambiguous to autocorrect safely.
  if (normalized.length < 4 || /\d/.test(normalized)) return null;
  const matches = choices.filter(choice => choice.name.length >= 4 && !/\d/.test(choice.name) && isSingleTypo(normalized, choice.name.toLocaleLowerCase()));
  return matches.length === 1 ? matches[0] : null;
}

export function correctCommandTypo(text: string): string {
  const [first, ...rest] = text.trim().split(/\s+/);
  const editFields = ['akun', 'kategori', 'tanggal', 'judul', 'nominal'];
  if (['ganti', 'ubah'].includes(first) && rest.length >= 2) {
    const field = matchUniqueName(rest[0], editFields.map(name => ({ name })));
    if (field) return [first, field.name, ...rest.slice(1)].join(' ');
  }
  if (rest.length >= 2 && editFields.includes(rest[0]) && first.length >= 4 && isSingleTypo(first, 'ganti')) {
    return ['ganti', ...rest].join(' ');
  }
  // Destructive commands (hapus/undo), amounts, dates, and transaction descriptions are never guessed.
  const commands = ['saldo', 'history', 'kategori', 'akun', 'nominal', 'tanggal', 'judul', 'preferensi', 'koreksi', 'budget'];
  if (commands.includes(first)) return text;
  // Only correct single-word read commands, or an explicit editing field plus a value.
  const eligible = rest.length ? ['kategori', 'nominal', 'tanggal', 'judul'] : commands;
  const candidate = matchUniqueName(first, eligible.map(name => ({ name })));
  return candidate ? [candidate.name, ...rest].join(' ') : text;
}
