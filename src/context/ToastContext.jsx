/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from 'react';
import Toast from '../components/Toast';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

const DEFAULT_DURATION = 5000;

function normalizeToast(input, fallbackType) {
  if (typeof input === 'string' || typeof input === 'number') {
    return {
      title: null,
      message: String(input),
      description: null,
      type: fallbackType,
      duration: DEFAULT_DURATION,
    };
  }

  const {
    title,
    message,
    description,
    type,
    status,
    duration,
  } = input || {};

  return {
    title: title ?? null,
    message: message ?? title ?? '',
    description: description ?? null,
    type: type ?? status ?? fallbackType,
    duration: duration ?? DEFAULT_DURATION,
  };
}

function normalizeToastType(type = 'info') {
  if (type === 'danger') return 'error';
  return type;
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (input, type = 'info') => {
      const id = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
      const normalized = normalizeToast(input, type);
      const normalizedType = normalizeToastType(normalized.type);
      const toast = {
        id,
        type: normalizedType,
        title: normalized.title,
        message: normalized.message,
        description: normalized.description,
      };

      setToasts((ts) => [...ts, toast]);
      setTimeout(() => removeToast(id), normalized.duration);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <Toast toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}
