import { useId, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

type TagInputProps = {
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  helperText?: string;
  error?: string;
};

const INPUT_BASE =
  'h-11 w-full rounded-2xl border bg-background px-3 text-sm text-text ring-2 ring-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60';

export default function TagInput({ label, value, onChange, placeholder, helperText, error }: TagInputProps) {
  const id = useId();
  const [inputValue, setInputValue] = useState('');

  const commitTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    const exists = value.some((item) => item.toLowerCase() === tag.toLowerCase());
    if (exists) {
      setInputValue('');
      return;
    }
    onChange([...value, tag]);
    setInputValue('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitTag(inputValue);
    } else if (event.key === 'Backspace' && !inputValue) {
      event.preventDefault();
      onChange(value.slice(0, -1));
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      commitTag(inputValue);
    }
  };

  return (
    <div>
      <label htmlFor={id} className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border-subtle bg-muted/10 px-3 py-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-xl bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted"
          >
            {tag}
            <button
              type="button"
              className="rounded-full p-0.5 text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => onChange(value.filter((item) => item !== tag))}
              aria-label={`Hapus tag ${tag}`}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`${INPUT_BASE} h-8 min-w-[120px] flex-1 border-none bg-transparent px-0 py-0 text-sm focus-visible:ring-0`}
        />
      </div>
      {helperText ? <p className="mt-1 text-xs text-muted">{helperText}</p> : null}
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
