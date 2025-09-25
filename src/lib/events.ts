export const TRANSACTIONS_REFRESH_EVENT = 'hematwoi:transactions-refresh';

export function dispatchTransactionsRefresh(detail?: unknown) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }
  window.dispatchEvent(new CustomEvent(TRANSACTIONS_REFRESH_EVENT, { detail }));
}
