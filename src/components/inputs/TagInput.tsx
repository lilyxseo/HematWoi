import { useState, type KeyboardEvent } from 'react';
import clsx from 'clsx';

type TagInputProps = {
  id: string;
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  helper?: string;
  error?: string | null;
};

function normalizeTag(value: string): string | null {
  const cleaned = value.trim();
  if (!cleaned) return null;
  return cleaned.replace(/\s+/g, ' ');
}

export function TagInput({ id, label, value, onChange, placeholder, helper, error }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const commitValue = (raw: string) => {
    const normalized = normalizeTag(raw);
    if (!normalized) return;
    if (value.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
      setInputValue('');
      return;
    }
    onChange([...value, normalized]);
    setInputValue('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
      event.preventDefault();
      commitValue(inputValue);
    } else if (event.key === 'Backspace' && inputValue === '' && value.length > 0) {
      event.preventDefault();
      const next = [...value];
      next.pop();
      onChange(next);
    }
  };

  const handleBlur = () => {
    if (inputValue) {
      commitValue(inputValue);
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((item) => item !== tag));
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div
          className={clsx(
            'flex min-h-[44px] w-full flex-wrap items-center gap-2 rounded-2xl border bg-background px-3 py-2 ring-2 ring-transparent focus-within:ring-2 focus-within:ring-primary',
            error && 'border-destructive',
          )}
        >
          {value.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="rounded-full p-1 text-primary transition hover:bg-primary/20"
                aria-label={`Hapus tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            id={id}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={value.length === 0 ? placeholder : undefined}
            className="flex-1 min-w-[120px] bg-transparent py-1 text-sm text-foreground outline-none"
          />
        </div>
      </label>
      {helper && !error ? <p className="text-sm text-muted-foreground">{helper}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export default TagInput;
