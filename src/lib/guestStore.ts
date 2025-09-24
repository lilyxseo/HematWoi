export type GuestTx = {
  gid: string;
  amount: number;
  date: string;
  type: 'expense' | 'income';
  category_id: string | null;
  note: string;
  imported: boolean;
  created_at: string;
};

export type GuestTxPayload = Pick<GuestTx, 'amount' | 'date' | 'type'> & {
  category_id?: string | null;
  note?: string | null;
};

const STORAGE_KEY = 'hw:guest:transactions';

function readStorage(): GuestTx[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item) => typeof item === 'object' && item !== null) as GuestTx[];
  } catch (error) {
    console.error('[guestStore] Failed to read guest transactions', error);
    return [];
  }
}

function writeStorage(list: GuestTx[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (error) {
    console.error('[guestStore] Failed to write guest transactions', error);
  }
}

export function getGuestTx(): GuestTx[] {
  return readStorage();
}

export function setGuestTx(list: GuestTx[]): void {
  if (!Array.isArray(list)) {
    writeStorage([]);
    return;
  }
  const normalized = list
    .filter((item): item is GuestTx => typeof item === 'object' && item !== null && typeof item.gid === 'string')
    .map((item) => ({
      gid: item.gid,
      amount: Number(item.amount) || 0,
      date: typeof item.date === 'string' ? item.date : '',
      type: item.type === 'income' ? 'income' : 'expense',
      category_id: item.category_id ?? null,
      note: item.note ?? '',
      imported: Boolean(item.imported),
      created_at: item.created_at ?? new Date().toISOString(),
    }));
  writeStorage(normalized);
}

export function addGuestTx(payload: GuestTxPayload): GuestTx {
  const list = readStorage();
  const now = new Date();
  const tx: GuestTx = {
    gid: globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
    amount: Number(payload.amount) || 0,
    date: typeof payload.date === 'string' ? payload.date : '',
    type: payload.type === 'income' ? 'income' : 'expense',
    category_id: payload.category_id ?? null,
    note: payload.note ?? '',
    imported: false,
    created_at: now.toISOString(),
  };
  list.push(tx);
  writeStorage(list);
  return tx;
}

export function markImported(gids: string[]): void {
  if (!Array.isArray(gids) || gids.length === 0) {
    return;
  }
  const set = new Set(gids);
  const list = readStorage();
  const updated = list.map((item) =>
    set.has(item.gid)
      ? {
          ...item,
          imported: true,
        }
      : item,
  );
  writeStorage(updated);
}

export function clearImported(): void {
  const list = readStorage();
  const filtered = list.filter((item) => !item.imported);
  if (filtered.length !== list.length) {
    writeStorage(filtered);
  }
}

export function hasUnsyncedGuestTx(): boolean {
  return readStorage().some((item) => !item.imported);
}

export { STORAGE_KEY as GUEST_TX_STORAGE_KEY };
