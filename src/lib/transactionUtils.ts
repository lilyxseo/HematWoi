export type TransactionDeletionFlags = {
  deleted_at?: unknown
  deletedAt?: unknown
  deleted?: unknown
}

function isDeletedFlag(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (
      normalized === '' ||
      normalized === '0' ||
      normalized === 'false' ||
      normalized === 'null' ||
      normalized === 'undefined'
    ) {
      return false
    }
    return true
  }
  return Boolean(value)
}

export function isTransactionDeleted(
  tx: TransactionDeletionFlags | null | undefined,
): boolean {
  if (!tx) return false
  if (isDeletedFlag((tx as TransactionDeletionFlags)?.deleted_at)) return true
  if (isDeletedFlag((tx as TransactionDeletionFlags)?.deletedAt)) return true
  if (isDeletedFlag((tx as TransactionDeletionFlags)?.deleted)) return true
  return false
}

export { isDeletedFlag }

