// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { patchTransaction } from '../lib/api-data';

const FIELD_LABELS = {
  date: 'Tanggal',
  title: 'Catatan',
  type: 'Tipe',
  category: 'Kategori',
  account: 'Akun',
  amount: 'Nominal',
  tags: 'Tag',
};

const TYPE_OPTIONS = new Set(['income', 'expense', 'transfer']);

function toInputDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toIsoDate(value?: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map((part) => Number.parseInt(part, 10));
    if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
    const local = new Date(y, m - 1, d, 12, 0, 0);
    if (Number.isNaN(local.getTime())) return null;
    local.setHours(0, 0, 0, 0);
    const withTimezone = new Date(local.getTime() - local.getTimezoneOffset() * 60 * 1000);
    return withTimezone.toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeAmountInput(value: string | number | null | undefined) {
  if (value == null) return null;
  const candidate = String(value).replace(/[^0-9.,-]/g, '').replace(/,/g, '.');
  const parsed = Number.parseFloat(candidate);
  if (!Number.isFinite(parsed)) return null;
  return Number(parsed.toFixed(2));
}

function normalizeTags(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (!normalized.length) return null;
  const unique = Array.from(new Set(normalized));
  return unique.join(',');
}

function findCategory(categories, id) {
  if (!id) return null;
  return categories.find((category) => category.id === id) || null;
}

function findAccount(accounts, id) {
  if (!id) return null;
  return accounts.find((account) => account.id === id) || null;
}

export function useTransactionInlineEditing({ rows, categories, accounts, addToast }) {
  const [displayRows, setDisplayRows] = useState(rows || []);
  const baseMapRef = useRef(new Map());
  const optimisticRef = useRef(new Map());
  const queuedRef = useRef(new Map());
  const timersRef = useRef(new Map());
  const statusRef = useRef(new Map());
  const [, forceStatus] = useState(0);
  const displayRowsRef = useRef(displayRows);
  const categoriesRef = useRef(categories || []);
  const accountsRef = useRef(accounts || []);
  const undoRef = useRef(null);
  const undoTimerRef = useRef(null);
  const [undoState, setUndoState] = useState(null);
  const [conflict, setConflict] = useState(null);

  useEffect(() => {
    categoriesRef.current = categories || [];
  }, [categories]);

  useEffect(() => {
    accountsRef.current = accounts || [];
  }, [accounts]);

  const syncBaseRows = useCallback(
    (nextRows: any[]) => {
      const baseMap = new Map();
      nextRows.forEach((row) => {
        if (!row?.id) return;
        baseMap.set(row.id, row);
      });
      baseMapRef.current = baseMap;
      setDisplayRows((prev) =>
        nextRows.map((row) => {
          const optimistic = optimisticRef.current.get(row.id);
          return optimistic ? { ...row, ...optimistic } : row;
        }),
      );
    },
    [],
  );

  useEffect(() => {
    syncBaseRows(rows || []);
  }, [rows, syncBaseRows]);

  useEffect(() => {
    displayRowsRef.current = displayRows;
  }, [displayRows]);

  const setStatus = useCallback((rowId: string, field: string, status?: { state: string; message?: string }) => {
    const key = `${rowId}:${field}`;
    const next = new Map(statusRef.current);
    if (!status || status.state === 'idle') {
      next.delete(key);
    } else {
      next.set(key, status);
    }
    statusRef.current = next;
    forceStatus((value) => value + 1);
  }, []);

  const getStatus = useCallback((rowId: string, field: string) => {
    const key = `${rowId}:${field}`;
    return statusRef.current.get(key) || { state: 'idle' };
  }, []);

  const formatValue = useCallback((row, field: string) => {
    switch (field) {
      case 'date':
        return row.date ? new Date(row.date).toLocaleDateString('id-ID') : '-';
      case 'title':
        return row.title || row.notes || '-';
      case 'type':
        return row.type ? row.type.charAt(0).toUpperCase() + row.type.slice(1) : '-';
      case 'category':
        return row.category?.name || row.category || '-';
      case 'account':
        return row.account?.name || row.account || '-';
      case 'amount':
        return row.amount != null ? new Intl.NumberFormat('id-ID').format(Number(row.amount)) : '-';
      case 'tags':
        return row.tags ? row.tags.split(',').join(', ') : '-';
      default:
        return row[field] ?? '-';
    }
  }, []);

  const clearUndo = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    undoRef.current = null;
    setUndoState(null);
  }, []);

  const scheduleUndo = useCallback((payload) => {
    clearUndo();
    undoRef.current = payload;
    setUndoState({ field: payload.field, rowId: payload.rowId, label: FIELD_LABELS[payload.field] || payload.field });
    undoTimerRef.current = window.setTimeout(() => {
      undoRef.current = null;
      setUndoState(null);
    }, 6000);
  }, [clearUndo]);

  const applyPatch = useCallback(
    async (rowId: string, field: string, rawValue, options: any = {}) => {
      const key = `${rowId}:${field}`;
      if (timersRef.current.has(key)) {
        clearTimeout(timersRef.current.get(key));
        timersRef.current.delete(key);
      }
      queuedRef.current.delete(key);

      const baseRow = options.prevOverride || baseMapRef.current.get(rowId) || displayRowsRef.current.find((row) => row.id === rowId);
      if (!baseRow) return;

      const categoriesList = categoriesRef.current;
      const accountsList = accountsRef.current;

      let patch: Record<string, unknown> | null = null;
      let optimistic: Record<string, unknown> = {};
      let revertPatch: Record<string, unknown> = {};
      let errorMessage: string | null = null;

      const nextRow = { ...baseRow };

      const applyOptimistic = (updates) => {
        optimistic = { ...optimistic, ...updates };
        Object.assign(nextRow, updates);
      };

      switch (field) {
        case 'date': {
          const normalized = toIsoDate(typeof rawValue === 'string' ? rawValue : toInputDate(rawValue));
          if (!normalized) {
            errorMessage = 'Tanggal tidak valid';
            break;
          }
          if (baseRow.date === normalized) {
            patch = null;
            break;
          }
          patch = { date: normalized };
          applyOptimistic({ date: normalized });
          revertPatch = { date: baseRow.date || null };
          break;
        }
        case 'title': {
          const value = typeof rawValue === 'string' ? rawValue.trim() : '';
          const normalized = value || null;
          if ((baseRow.title || baseRow.notes || null) === normalized) {
            patch = null;
            break;
          }
          patch = { title: normalized, notes: normalized };
          applyOptimistic({ title: normalized, notes: normalized, note: normalized });
          revertPatch = { title: baseRow.title || null, notes: baseRow.notes || null };
          break;
        }
        case 'type': {
          const value = typeof rawValue === 'string' ? rawValue.toLowerCase() : '';
          if (!TYPE_OPTIONS.has(value)) {
            errorMessage = 'Tipe tidak valid';
            break;
          }
          if (baseRow.type === value) {
            patch = null;
            break;
          }
          patch = { type: value };
          applyOptimistic({ type: value });
          revertPatch = { type: baseRow.type || null };
          break;
        }
        case 'category': {
          const id = rawValue || null;
          if (id) {
            const found = findCategory(categoriesList, id);
            if (!found) {
              errorMessage = 'Kategori tidak ditemukan';
              break;
            }
            if (baseRow.category_id === id) {
              patch = null;
              break;
            }
            patch = { category_id: id };
            applyOptimistic({
              category_id: id,
              category: { id, name: found.name, type: found.type },
            });
            revertPatch = { category_id: baseRow.category_id || null };
          } else {
            if (!baseRow.category_id) {
              patch = null;
              break;
            }
            patch = { category_id: null };
            applyOptimistic({ category_id: null, category: null });
            revertPatch = { category_id: baseRow.category_id || null };
          }
          break;
        }
        case 'account': {
          const id = rawValue || null;
          if (id) {
            const found = findAccount(accountsList, id);
            if (!found) {
              errorMessage = 'Akun tidak ditemukan';
              break;
            }
            if (baseRow.account_id === id) {
              patch = null;
              break;
            }
            patch = { account_id: id };
            applyOptimistic({ account_id: id, account: { id, name: found.name } });
            revertPatch = { account_id: baseRow.account_id || null };
          } else {
            if (!baseRow.account_id) {
              patch = null;
              break;
            }
            patch = { account_id: null };
            applyOptimistic({ account_id: null, account: null });
            revertPatch = { account_id: baseRow.account_id || null };
          }
          break;
        }
        case 'amount': {
          const normalized = normalizeAmountInput(rawValue);
          if (!normalized || normalized <= 0) {
            errorMessage = 'Nominal harus lebih dari 0';
            break;
          }
          if (Number(baseRow.amount) === normalized) {
            patch = null;
            break;
          }
          patch = { amount: normalized };
          applyOptimistic({ amount: normalized });
          revertPatch = { amount: baseRow.amount || null };
          break;
        }
        case 'tags': {
          const normalized = normalizeTags(typeof rawValue === 'string' ? rawValue : Array.isArray(rawValue) ? rawValue.join(',') : null);
          if ((baseRow.tags || null) === (normalized || null)) {
            patch = null;
            break;
          }
          patch = { tags: normalized };
          applyOptimistic({ tags: normalized });
          revertPatch = { tags: baseRow.tags || null };
          break;
        }
        default:
          patch = null;
      }

      if (errorMessage) {
        setStatus(rowId, field, { state: 'error', message: errorMessage });
        return;
      }

      if (!patch) {
        setStatus(rowId, field, { state: 'idle' });
        return;
      }

      setStatus(rowId, field, { state: 'saving' });
      optimisticRef.current.set(rowId, { ...(optimisticRef.current.get(rowId) || {}), ...optimistic });
      setDisplayRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...optimistic } : row)));

      try {
        const { next } = await patchTransaction(rowId, patch, { prev: baseRow, force: options.force });
        optimisticRef.current.delete(rowId);
        baseMapRef.current.set(rowId, next);
        setDisplayRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...next } : row)));
        setStatus(rowId, field, { state: 'saved' });
        window.setTimeout(() => {
          const currentStatus = getStatus(rowId, field);
          if (currentStatus.state === 'saved') {
            setStatus(rowId, field, { state: 'idle' });
          }
        }, 1200);
        if (!options.skipUndo) {
          scheduleUndo({ rowId, field, prevRow: baseRow, revertPatch, value: rawValue });
        }
      } catch (error) {
        optimisticRef.current.delete(rowId);
        setDisplayRows((prev) => prev.map((row) => (row.id === rowId ? baseRow : row)));
        if (error?.code === 'conflict') {
          setConflict({ rowId, field, latest: error.latest, prevRow: baseRow, value: rawValue });
          setStatus(rowId, field, { state: 'error', message: 'Data telah berubah' });
        } else {
          setStatus(rowId, field, { state: 'error', message: 'Tidak bisa menyimpan. Cek koneksi atau ulangi.' });
          addToast?.({ message: 'Tidak bisa menyimpan. Cek koneksi atau ulangi.', type: 'danger' });
        }
      }
    },
    [addToast, getStatus, scheduleUndo, setStatus],
  );

  const queueUpdate = useCallback(
    (rowId: string, field: string, value: any, options: { debounceMs?: number } = {}) => {
      const key = `${rowId}:${field}`;
      queuedRef.current.set(key, value);
      if (timersRef.current.has(key)) {
        clearTimeout(timersRef.current.get(key));
        timersRef.current.delete(key);
      }
      const delay = options.debounceMs ?? 0;
      if (delay > 0) {
        const timer = window.setTimeout(() => {
          timersRef.current.delete(key);
          const queuedValue = queuedRef.current.get(key);
          queuedRef.current.delete(key);
          applyPatch(rowId, field, queuedValue);
        }, delay);
        timersRef.current.set(key, timer);
      } else {
        queuedRef.current.delete(key);
        applyPatch(rowId, field, value);
      }
    },
    [applyPatch],
  );

  const flushUpdate = useCallback(
    (rowId: string, field: string) => {
      const key = `${rowId}:${field}`;
      const queuedValue = queuedRef.current.get(key);
      if (timersRef.current.has(key)) {
        clearTimeout(timersRef.current.get(key));
        timersRef.current.delete(key);
      }
      queuedRef.current.delete(key);
      if (queuedValue !== undefined) {
        applyPatch(rowId, field, queuedValue);
      }
    },
    [applyPatch],
  );

  const cancelUpdate = useCallback(
    (rowId: string, field: string) => {
      const key = `${rowId}:${field}`;
      if (timersRef.current.has(key)) {
        clearTimeout(timersRef.current.get(key));
        timersRef.current.delete(key);
      }
      queuedRef.current.delete(key);
      optimisticRef.current.delete(rowId);
      const baseRow = baseMapRef.current.get(rowId);
      if (baseRow) {
        setDisplayRows((prev) => prev.map((row) => (row.id === rowId ? { ...baseRow } : row)));
      }
      setStatus(rowId, field, { state: 'idle' });
    },
    [setStatus],
  );

  const commitUpdate = useCallback(
    (rowId: string, field: string, value: any, options = {}) => {
      applyPatch(rowId, field, value, options);
    },
    [applyPatch],
  );

  const handleUndo = useCallback(() => {
    const payload = undoRef.current;
    if (!payload) return;
    const baseRow = baseMapRef.current.get(payload.rowId);
    const rawValue = (() => {
      switch (payload.field) {
        case 'date':
          return toInputDate(payload.prevRow?.date);
        case 'title':
          return payload.prevRow?.title || payload.prevRow?.notes || '';
        case 'type':
          return payload.prevRow?.type || 'expense';
        case 'category':
          return payload.prevRow?.category_id || null;
        case 'account':
          return payload.prevRow?.account_id || null;
        case 'amount':
          return payload.prevRow?.amount || null;
        case 'tags':
          return payload.prevRow?.tags || '';
        default:
          return null;
      }
    })();
    clearUndo();
    applyPatch(payload.rowId, payload.field, rawValue, { prevOverride: baseRow, skipUndo: true, force: true });
  }, [applyPatch, clearUndo]);

  const applyRealtimeUpsert = useCallback((row) => {
    if (!row?.id) return;
    baseMapRef.current.set(row.id, row);
    setDisplayRows((prev) => {
      const index = prev.findIndex((item) => item.id === row.id);
      const optimistic = optimisticRef.current.get(row.id);
      const merged = optimistic ? { ...row, ...optimistic } : row;
      if (index === -1) {
        return [merged, ...prev];
      }
      const clone = [...prev];
      clone[index] = merged;
      return clone;
    });
  }, []);

  const applyRealtimeDelete = useCallback((id: string) => {
    baseMapRef.current.delete(id);
    optimisticRef.current.delete(id);
    setDisplayRows((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const resolveConflictWithLatest = useCallback(() => {
    if (!conflict) return;
    baseMapRef.current.set(conflict.latest.id, conflict.latest);
    optimisticRef.current.delete(conflict.latest.id);
    setDisplayRows((prev) => prev.map((row) => (row.id === conflict.latest.id ? conflict.latest : row)));
    setStatus(conflict.rowId, conflict.field, { state: 'idle' });
    setConflict(null);
  }, [conflict, setStatus]);

  const resolveConflictForce = useCallback(() => {
    if (!conflict) return;
    const { rowId, field, latest, value } = conflict;
    setConflict(null);
    applyPatch(rowId, field, value, { prevOverride: latest, force: true });
  }, [applyPatch, conflict]);

  return useMemo(
    () => ({
      rows: displayRows,
      queueUpdate,
      flushUpdate,
      cancelUpdate,
      commitUpdate,
      getStatus,
      formatValue,
      undoState,
      onUndo: handleUndo,
      clearUndo,
      conflict,
      resolveConflictWithLatest,
      resolveConflictForce,
      applyRealtimeUpsert,
      applyRealtimeDelete,
      categories,
      accounts,
    }),
    [
      displayRows,
      queueUpdate,
      flushUpdate,
      cancelUpdate,
      commitUpdate,
      getStatus,
      formatValue,
      undoState,
      handleUndo,
      clearUndo,
      conflict,
      resolveConflictWithLatest,
      resolveConflictForce,
      applyRealtimeUpsert,
      applyRealtimeDelete,
      categories,
      accounts,
    ],
  );
}
