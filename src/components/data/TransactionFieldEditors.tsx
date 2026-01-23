// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  Check,
  ChevronDown,
  CircleAlert,
  Loader2,
  Tag,
  X,
} from 'lucide-react';
import { isPrivacyModeEnabled } from '../../lib/privacy-mode';

const TYPE_OPTIONS = [
  { value: 'income', label: 'Pemasukan' },
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'transfer', label: 'Transfer' },
];

function toInputDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseTags(value?: string) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function StatusIcon({ status }) {
  if (!status || status.state === 'idle') return null;
  if (status.state === 'saving') {
    return <Loader2 className="ml-2 h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />;
  }
  if (status.state === 'saved') {
    return <Check className="ml-2 h-4 w-4 text-emerald-500" aria-hidden="true" />;
  }
  if (status.state === 'error') {
    return <CircleAlert className="ml-2 h-4 w-4 text-red-500" aria-hidden="true" />;
  }
  return null;
}

function FieldWrapper({
  children,
  status,
  className,
  variant = 'table',
}: {
  children: React.ReactNode;
  status: { state: string; message?: string };
  className?: string;
  variant?: 'table' | 'sheet';
}) {
  return (
    <div
      className={clsx(
        'group/field flex min-w-0 items-center gap-2',
        variant === 'sheet' ? 'rounded-2xl border border-border bg-background/80 px-3 py-2' : 'rounded-lg px-2 py-1.5',
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <span className="sr-only" aria-live="polite">
        {status?.state === 'saving'
          ? 'Menyimpan'
          : status?.state === 'saved'
          ? 'Tersimpan'
          : status?.state === 'error'
          ? status?.message || 'Gagal menyimpan'
          : 'Siap'}
      </span>
      <StatusIcon status={status} />
    </div>
  );
}

export function TransactionDateEditor({ row, editing, variant = 'table', autoFocus = false }) {
  const status = editing.getStatus(row.id, 'date');
  const [value, setValue] = useState(() => toInputDate(row.date));

  useEffect(() => {
    if (status.state !== 'saving') {
      setValue(toInputDate(row.date));
    }
  }, [row.date, status.state]);

  const handleChange = (event) => {
    setValue(event.target.value);
    editing.queueUpdate(row.id, 'date', event.target.value, { debounceMs: 0 });
  };

  const handleBlur = () => {
    editing.flushUpdate(row.id, 'date');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      editing.flushUpdate(row.id, 'date');
    } else if (event.key === 'Escape') {
      event.preventDefault();
      editing.cancelUpdate(row.id, 'date');
      setValue(toInputDate(row.date));
    }
  };

  return (
    <FieldWrapper status={status} variant={variant}>
      <input
        type="date"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
    </FieldWrapper>
  );
}

export function TransactionTitleEditor({ row, editing, variant = 'table', autoFocus = false }) {
  const status = editing.getStatus(row.id, 'title');
  const display = row.title ?? row.notes ?? '';
  const [value, setValue] = useState(display);

  useEffect(() => {
    if (status.state !== 'saving') {
      setValue(row.title ?? row.notes ?? '');
    }
  }, [row.title, row.notes, status.state]);

  const handleChange = (event) => {
    setValue(event.target.value);
    editing.queueUpdate(row.id, 'title', event.target.value, { debounceMs: 400 });
  };

  const handleBlur = () => {
    editing.flushUpdate(row.id, 'title');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      editing.flushUpdate(row.id, 'title');
    } else if (event.key === 'Escape') {
      event.preventDefault();
      editing.cancelUpdate(row.id, 'title');
      setValue(row.title ?? row.notes ?? '');
    }
  };

  return (
    <FieldWrapper status={status} variant={variant}>
      <input
        type="text"
        value={value}
        placeholder="Catatan"
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
    </FieldWrapper>
  );
}

export function TransactionTypeEditor({ row, editing, variant = 'table' }) {
  const status = editing.getStatus(row.id, 'type');
  const handleChange = (event) => {
    editing.commitUpdate(row.id, 'type', event.target.value);
  };

  return (
    <FieldWrapper status={status} variant={variant}>
      <select
        value={row.type || 'expense'}
        onChange={handleChange}
        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm capitalize text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} className="capitalize">
            {option.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

function useSearchableOptions(options, open) {
  const inputRef = useRef(null);
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);
  return inputRef;
}

function SearchableSelect({
  row,
  editing,
  field,
  options,
  placeholder,
  variant,
}) {
  const status = editing.getStatus(row.id, field);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const buttonRef = useRef(null);
  const currentName = useMemo(() => {
    if (field === 'category') {
      return row.category?.name ?? row.category ?? '';
    }
    if (field === 'account') {
      return row.account?.name ?? row.account ?? '';
    }
    return '';
  }, [row, field]);
  const currentId = field === 'category' ? row.category_id : row.account_id;

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  useEffect(() => {
    if (!open && status.state !== 'saving') {
      setQuery('');
    }
  }, [status.state, open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const lower = query.trim().toLowerCase();
    return options.filter((option) => option.name.toLowerCase().includes(lower));
  }, [options, query]);

  const handleSelect = (option) => {
    editing.commitUpdate(row.id, field, option?.id || null);
    setOpen(false);
  };

  const handleClear = () => {
    editing.commitUpdate(row.id, field, null);
    setOpen(false);
  };

  const inputRef = useSearchableOptions(options, open);

  return (
    <FieldWrapper status={status} variant={variant} className="relative">
      <button
        type="button"
        ref={buttonRef}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-md border border-border bg-background px-2 py-1 text-sm text-left text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className={clsx('truncate', !currentId && !currentName && 'text-muted-foreground')}>
          {currentName || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-xl border border-border bg-popover p-2 shadow-xl">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1">
            <input
              ref={inputRef}
              type="text"
              placeholder={`Cari ${placeholder.toLowerCase()}`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-transparent text-sm text-foreground focus:outline-none"
            />
            {query && (
              <button
                type="button"
                className="text-xs text-muted-foreground"
                onClick={() => setQuery('')}
              >
                Hapus
              </button>
            )}
          </div>
          <div className="mt-2 max-h-48 min-h-[40px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">Tidak ada hasil</p>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={clsx(
                    'flex w-full items-center justify-between rounded-md px-2 py-1 text-sm',
                    option.id === currentId ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60',
                  )}
                >
                  <span className="truncate">{option.name}</span>
                  {option.id === currentId ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                </button>
              ))
            )}
          </div>
          <div className="mt-2 flex justify-between">
            <button
              type="button"
              className="text-xs text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              Tutup
            </button>
            <button type="button" className="text-xs text-primary" onClick={handleClear}>
              Kosongkan
            </button>
          </div>
        </div>
      )}
    </FieldWrapper>
  );
}

export function TransactionCategoryEditor({ row, editing, variant = 'table' }) {
  return (
    <SearchableSelect
      row={row}
      editing={editing}
      field="category"
      options={editing.categories || []}
      placeholder="Pilih kategori"
      variant={variant}
    />
  );
}

export function TransactionAccountEditor({ row, editing, variant = 'table' }) {
  return (
    <SearchableSelect
      row={row}
      editing={editing}
      field="account"
      options={editing.accounts || []}
      placeholder="Pilih akun"
      variant={variant}
    />
  );
}

function normalizeAmountInput(value: string) {
  if (!value) return '';
  const cleaned = value.replace(/[^0-9,-.]/g, '').replace(/,/g, '.');
  return cleaned;
}

function formatCurrency(value: number | string | null | undefined) {
  if (value == null || value === '') return '';
  if (isPrivacyModeEnabled()) return '••••••';
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return new Intl.NumberFormat('id-ID').format(number);
}

export function TransactionAmountEditor({ row, editing, variant = 'table', autoFocus = false }) {
  const status = editing.getStatus(row.id, 'amount');
  const [focused, setFocused] = useState(false);
  const [value, setValue] = useState(() => (row.amount != null ? String(row.amount) : ''));

  useEffect(() => {
    if (!focused && status.state !== 'saving') {
      setValue(row.amount != null ? String(row.amount) : '');
    }
  }, [row.amount, focused, status.state]);

  const handleChange = (event) => {
    const next = normalizeAmountInput(event.target.value);
    setValue(next);
  };

  const commit = () => {
    editing.commitUpdate(row.id, 'amount', value || null);
  };

  const handleBlur = () => {
    setFocused(false);
    commit();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
      setFocused(false);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      editing.cancelUpdate(row.id, 'amount');
      setValue(row.amount != null ? String(row.amount) : '');
      setFocused(false);
    }
  };

  return (
    <FieldWrapper status={status} variant={variant}>
      <input
        type="text"
        inputMode="decimal"
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        value={focused ? value : formatCurrency(row.amount)}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="w-full rounded-md border border-border bg-background px-2 py-1 text-right text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
    </FieldWrapper>
  );
}

export function TransactionTagsEditor({ row, editing, variant = 'table', autoFocus = false }) {
  const status = editing.getStatus(row.id, 'tags');
  const [tags, setTags] = useState(() => parseTags(row.tags));
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    setTags(parseTags(row.tags));
  }, [row.tags]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const commit = (nextTags) => {
    setTags(nextTags);
    editing.commitUpdate(row.id, 'tags', nextTags.join(','));
  };

  const handleRemove = (index) => {
    const next = tags.filter((_, i) => i !== index);
    commit(next);
  };

  const pushTag = (tag) => {
    const cleaned = tag.trim();
    if (!cleaned) return;
    if (tags.includes(cleaned)) {
      setValue('');
      return;
    }
    const next = [...tags, cleaned];
    setTags(next);
    setValue('');
    editing.queueUpdate(row.id, 'tags', next.join(','), { debounceMs: 400 });
  };

  const handleChange = (event) => {
    const input = event.target.value;
    if (input.includes(',')) {
      const parts = input.split(',');
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          setValue(part);
        } else {
          pushTag(part);
        }
      });
      return;
    }
    setValue(input);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      pushTag(value);
      editing.flushUpdate(row.id, 'tags');
    } else if (event.key === 'Backspace' && !value) {
      setTags((prev) => {
        if (!prev.length) return prev;
        const next = prev.slice(0, -1);
        editing.queueUpdate(row.id, 'tags', next.join(','), { debounceMs: 400 });
        return next;
      });
    } else if (event.key === 'Escape') {
      event.preventDefault();
      editing.cancelUpdate(row.id, 'tags');
      setTags(parseTags(row.tags));
      setValue('');
    }
  };

  const handleBlur = () => {
    if (value.trim()) {
      pushTag(value);
      setValue('');
    }
    editing.flushUpdate(row.id, 'tags');
  };

  return (
    <FieldWrapper status={status} variant={variant}>
      <div className="flex flex-wrap items-center gap-1">
        {tags.length === 0 && !value ? (
          <span className="flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
            <Tag className="h-3 w-3" /> Tag
          </span>
        ) : null}
        {tags.map((tag, index) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={() => handleRemove(index)}
              className="text-primary hover:text-primary/70"
              aria-label={`Hapus tag ${tag}`}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={tags.length ? '' : 'Tambah tag'}
          className="min-w-[60px] flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>
    </FieldWrapper>
  );
}

export const TransactionEditors = {
  TransactionDateEditor,
  TransactionTitleEditor,
  TransactionTypeEditor,
  TransactionCategoryEditor,
  TransactionAccountEditor,
  TransactionAmountEditor,
  TransactionTagsEditor,
};
