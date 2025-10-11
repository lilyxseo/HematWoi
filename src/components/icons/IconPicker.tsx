import { useEffect, useId, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import clsx from 'clsx';

import { Icon, ICON_NAMES } from '../icons';

type IconPickerProps = {
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  disabled?: boolean;
  id?: string;
};

const INPUT_CLASS =
  'h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary';

export function IconPicker({
  label,
  value,
  onChange,
  placeholder = 'Cari atau ketik nama ikon',
  helperText,
  disabled,
  id,
}: IconPickerProps) {
  const generatedId = useId();
  const inputId = id ?? `${generatedId}-icon-search`;
  const [search, setSearch] = useState<string>(value ?? '');

  useEffect(() => {
    setSearch(value ?? '');
  }, [value]);

  const normalizedSearch = search.trim().toLowerCase();
  const normalizedValue = typeof value === 'string' ? value.trim().toLowerCase() : '';

  const filteredIcons = useMemo(() => {
    if (!normalizedSearch) {
      return ICON_NAMES;
    }
    return ICON_NAMES.filter((name) => name.includes(normalizedSearch));
  }, [normalizedSearch]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setSearch(next);
    onChange(next);
  };

  const handleClear = () => {
    setSearch('');
    onChange('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-semibold text-muted-foreground">
          {label}
        </label>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon name={normalizedValue} className="h-4 w-4" />
          <span>{normalizedValue || 'Tidak ada'}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          value={search}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className={clsx(INPUT_CLASS, disabled && 'cursor-not-allowed opacity-60')}
        />
        {normalizedValue ? (
          <button
            type="button"
            onClick={handleClear}
            className="h-11 rounded-2xl border border-border/60 px-4 text-sm font-medium text-muted-foreground transition hover:border-destructive hover:text-destructive"
          >
            Hapus
          </button>
        ) : null}
      </div>
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
      <div className="max-h-60 overflow-y-auto rounded-2xl border border-border/60 bg-muted/20 p-2">
        {filteredIcons.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {filteredIcons.map((name) => {
              const isSelected = normalizedValue === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setSearch(name);
                    onChange(name);
                  }}
                  className={clsx(
                    'flex flex-col items-center gap-2 rounded-xl border p-3 text-xs capitalize transition',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-transparent bg-background text-muted-foreground hover:border-primary/60 hover:text-foreground'
                  )}
                  aria-pressed={isSelected}
                  disabled={disabled}
                >
                  <Icon name={name} className="h-5 w-5" />
                  <span className="line-clamp-1 w-full text-center break-all text-[11px] font-medium">{name}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">Ikon tidak ditemukan.</p>
        )}
      </div>
    </div>
  );
}

export default IconPicker;
