import { useId, useState, type KeyboardEvent } from 'react';
import clsx from 'clsx';

export type TagInputProps = {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  helperText?: string;
  error?: string | null;
  disabled?: boolean;
};

function normalizeTag(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;
  return cleaned.replace(/\s+/g, ' ');
}

const TagInput = ({ label, value, onChange, placeholder = 'Tambah tag…', helperText, error, disabled }: TagInputProps) => {
  const id = useId();
  const [inputValue, setInputValue] = useState('');

  const commit = (raw: string) => {
    const parts = raw
      .split(/[\s,]+/)
      .map(normalizeTag)
      .filter((tag): tag is string => Boolean(tag));
    if (!parts.length) return;
    const set = new Set(value);
    parts.forEach((tag) => set.add(tag));
    onChange(Array.from(set));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
      event.preventDefault();
      if (inputValue.trim()) {
        commit(inputValue);
        setInputValue('');
      }
    } else if (event.key === 'Backspace' && !inputValue && value.length) {
      event.preventDefault();
      const next = value.slice(0, -1);
      onChange(next);
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      commit(inputValue);
      setInputValue('');
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((item) => item !== tag));
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-muted-foreground">
        {label}
      </label>
      <div
        className={clsx(
          'flex min-h-[44px] flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background px-3 py-2 ring-2 ring-transparent transition focus-within:ring-primary/60 dark:border-zinc-700/70 dark:bg-zinc-900/60',
          disabled && 'opacity-60'
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-1 text-xs font-medium text-primary dark:bg-primary/20"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-primary transition hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Hapus tag ${tag}`}
              disabled={disabled}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={value.length ? undefined : placeholder}
          disabled={disabled}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
};

export default TagInput;
