export interface DebtPaymentDraft {
  id: string;
  debt_id: string;
  user_id?: string | null;
  amount: number;
  paid_at: string;
  account_id: string;
  note: string | null;
  created_at: string;
}

const STORAGE_KEY = 'hw:debtPaymentDrafts';

type StoredDraft = DebtPaymentDraft & { version?: number };

function isLocalStorageAvailable(): boolean {
  try {
    if (typeof globalThis.localStorage === 'undefined') return false;
    const key = `${STORAGE_KEY}:check`;
    globalThis.localStorage.setItem(key, '1');
    globalThis.localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn('[HW] debt-payment-drafts storage unavailable', error);
    return false;
  }
}

function readDrafts(): StoredDraft[] {
  if (!isLocalStorageAvailable()) return [];
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        id: String(item.id ?? ''),
        debt_id: String(item.debt_id ?? ''),
        user_id: item.user_id ?? null,
        amount: Number(item.amount ?? 0),
        paid_at: typeof item.paid_at === 'string' ? item.paid_at : new Date().toISOString().slice(0, 10),
        account_id: String(item.account_id ?? ''),
        note: item.note ?? null,
        created_at: typeof item.created_at === 'string' ? item.created_at : new Date().toISOString(),
        version: typeof item.version === 'number' ? item.version : undefined,
      }))
      .filter((item) => item.id && item.debt_id && item.account_id);
  } catch (error) {
    console.warn('[HW] debt-payment-drafts read failed', error);
    return [];
  }
}

function writeDrafts(drafts: StoredDraft[]): void {
  if (!isLocalStorageAvailable()) return;
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.warn('[HW] debt-payment-drafts write failed', error);
  }
}

export function listDrafts(): DebtPaymentDraft[] {
  return readDrafts();
}

export function listDraftsByDebt(debtId: string): DebtPaymentDraft[] {
  if (!debtId) return [];
  return readDrafts().filter((draft) => draft.debt_id === debtId);
}

export function saveDraft(draft: DebtPaymentDraft): void {
  if (!draft.id) {
    throw new Error('Draft harus memiliki id.');
  }
  const existing = readDrafts();
  const filtered = existing.filter((item) => item.id !== draft.id);
  filtered.unshift({ ...draft, version: Date.now() });
  writeDrafts(filtered);
}

export function removeDraft(id: string): void {
  if (!id) return;
  const existing = readDrafts();
  const filtered = existing.filter((item) => item.id !== id);
  if (filtered.length === existing.length) return;
  writeDrafts(filtered);
}

export function replaceDrafts(next: DebtPaymentDraft[]): void {
  writeDrafts(next.map((item) => ({ ...item, version: Date.now() })));
}
