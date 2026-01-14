export type DataInvalidationDetail = {
  entity: 'transactions' | 'categories' | 'goals' | 'budgets' | 'highlights' | string;
  ids?: string[];
  reason?: string;
};

export const DATA_INVALIDATION_EVENT = 'hw:data:invalidate';

export function emitDataInvalidation(detail: DataInvalidationDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<DataInvalidationDetail>(DATA_INVALIDATION_EVENT, { detail }));
}

export function onDataInvalidation(
  handler: (detail: DataInvalidationDetail) => void,
) {
  if (typeof window === 'undefined') return () => {};
  const wrapped = (event: Event) => {
    handler((event as CustomEvent<DataInvalidationDetail>).detail);
  };
  window.addEventListener(DATA_INVALIDATION_EVENT, wrapped);
  return () => window.removeEventListener(DATA_INVALIDATION_EVENT, wrapped);
}
