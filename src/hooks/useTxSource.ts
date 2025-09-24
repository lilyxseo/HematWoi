import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  createTransactionCloud,
  createTransactionGuest,
  deleteTransactionCloud,
  deleteTransactionGuest,
  hasUnsyncedGuestTx,
  listTransactionsCloud,
  listTransactionsGuest,
  type TransactionPayload,
} from '../lib/data';
import { GUEST_TX_STORAGE_KEY } from '../lib/guestStore';

export type TransactionItem = {
  id: string;
  amount: number;
  date: string;
  type: 'expense' | 'income';
  category_id: string | null;
  note: string | null;
  origin: 'guest' | 'cloud';
  created_at?: string;
};

type UseTxSourceResult = {
  mode: 'guest' | 'cloud';
  uid: string | null;
  hasLocalUnsynced: boolean;
  listTransactions: () => Promise<TransactionItem[]>;
  createTransaction: (payload: TransactionPayload) => Promise<TransactionItem>;
  deleteTransaction: (id: string) => Promise<boolean>;
  refreshLocalStatus: () => void;
};

const VALID_TYPES = new Set(['expense', 'income']);

function normalizeGuestTransaction(tx: any): TransactionItem {
  return {
    id: String(tx.gid ?? tx.id ?? ''),
    amount: Number(tx.amount) || 0,
    date: typeof tx.date === 'string' ? tx.date : '',
    type: tx.type === 'income' ? 'income' : 'expense',
    category_id: tx.category_id ?? null,
    note: tx.note ?? '',
    origin: 'guest',
    created_at: tx.created_at,
  };
}

function normalizeCloudTransaction(tx: any): TransactionItem {
  return {
    id: String(tx.id ?? tx.gid ?? ''),
    amount: Number(tx.amount) || 0,
    date: typeof tx.date === 'string' ? tx.date : '',
    type: tx.type === 'income' ? 'income' : 'expense',
    category_id: tx.category_id ?? null,
    note: tx.note ?? '',
    origin: 'cloud',
    created_at: tx.created_at,
  };
}

function validatePayload(payload: TransactionPayload) {
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Nominal harus lebih dari 0.');
  }
  if (typeof payload.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    throw new Error('Tanggal harus dalam format YYYY-MM-DD.');
  }
  if (!VALID_TYPES.has(payload.type)) {
    throw new Error('Jenis transaksi tidak valid.');
  }
}

function sortByDateDesc(a: TransactionItem, b: TransactionItem) {
  if (a.date === b.date) {
    return (b.created_at ?? '').localeCompare(a.created_at ?? '');
  }
  return b.date.localeCompare(a.date);
}

export default function useTxSource(): UseTxSourceResult {
  const [mode, setMode] = useState<'guest' | 'cloud'>('guest');
  const [uid, setUid] = useState<string | null>(null);
  const [hasLocalUnsyncedState, setHasLocalUnsyncedState] = useState(() => hasUnsyncedGuestTx());

  const refreshLocalStatus = useCallback(() => {
    setHasLocalUnsyncedState(hasUnsyncedGuestTx());
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('[useTxSource] Failed to fetch session', error);
          setUid(null);
          setMode('guest');
          return;
        }
        const session = data?.session;
        if (session?.user?.id) {
          setUid(session.user.id);
          setMode('cloud');
        } else {
          setUid(null);
          setMode('guest');
        }
      })
      .catch((err) => {
        console.error('[useTxSource] Failed to get session', err);
        if (active) {
          setUid(null);
          setMode('guest');
        }
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user?.id) {
        setUid(session.user.id);
        setMode('cloud');
      } else {
        setUid(null);
        setMode('guest');
      }
    });

    return () => {
      active = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    refreshLocalStatus();
  }, [refreshLocalStatus]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === GUEST_TX_STORAGE_KEY) {
        refreshLocalStatus();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refreshLocalStatus]);

  const listTransactions = useCallback(async (): Promise<TransactionItem[]> => {
    if (mode === 'guest') {
      const rows = await listTransactionsGuest();
      const items = rows.map(normalizeGuestTransaction).sort(sortByDateDesc);
      refreshLocalStatus();
      return items;
    }
    if (!uid) {
      return [];
    }
    const rows = await listTransactionsCloud(uid);
    return rows.map(normalizeCloudTransaction).sort(sortByDateDesc);
  }, [mode, uid, refreshLocalStatus]);

  const createTransaction = useCallback(
    async (payload: TransactionPayload): Promise<TransactionItem> => {
      validatePayload(payload);
      if (mode === 'guest') {
        const row = await createTransactionGuest(payload);
        refreshLocalStatus();
        return normalizeGuestTransaction(row);
      }
      if (!uid) {
        throw new Error('Harus login untuk menyimpan ke cloud.');
      }
      const row = await createTransactionCloud(uid, payload);
      return normalizeCloudTransaction(row);
    },
    [mode, uid, refreshLocalStatus],
  );

  const deleteTransaction = useCallback(
    async (id: string): Promise<boolean> => {
      if (!id) {
        throw new Error('ID transaksi tidak valid.');
      }
      if (mode === 'guest') {
        const result = await deleteTransactionGuest(id);
        refreshLocalStatus();
        return result;
      }
      if (!uid) {
        throw new Error('Harus login untuk menghapus di cloud.');
      }
      return deleteTransactionCloud(uid, id);
    },
    [mode, uid, refreshLocalStatus],
  );

  return useMemo(
    () => ({
      mode,
      uid,
      hasLocalUnsynced: hasLocalUnsyncedState,
      listTransactions,
      createTransaction,
      deleteTransaction,
      refreshLocalStatus,
    }),
    [mode, uid, hasLocalUnsyncedState, listTransactions, createTransaction, deleteTransaction, refreshLocalStatus],
  );
}
