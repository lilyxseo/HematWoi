const STORAGE_KEY = "hw:local:transactions";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(rows) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

export async function listTransactions() {
  return readAll();
}

export async function addTransaction(tx) {
  const rows = readAll();
  const record = { id: crypto.randomUUID(), ...tx };
  rows.push(record);
  writeAll(rows);
  return record;
}

export async function updateTransaction(id, patch) {
  const rows = readAll();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx !== -1) {
    rows[idx] = { ...rows[idx], ...patch };
    writeAll(rows);
    return rows[idx];
  }
  return null;
}

export async function deleteTransaction(id) {
  const rows = readAll().filter((r) => r.id !== id);
  writeAll(rows);
}
