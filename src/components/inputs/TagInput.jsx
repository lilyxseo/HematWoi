import { useId, useMemo, useState } from "react";
import { X } from "lucide-react";

function normalizeTokens(input) {
  if (!input) return [];
  return input
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export default function TagInput({ value = [], onChange, label = "Tags", helper = "Pisahkan dengan koma", error }) {
  const id = useId();
  const [draft, setDraft] = useState("");

  const uniqueTags = useMemo(() => {
    return Array.from(new Set(value.map((tag) => tag.trim()).filter(Boolean)));
  }, [value]);

  const commitDraft = () => {
    const tokens = normalizeTokens(draft);
    if (!tokens.length) {
      setDraft("");
      return;
    }
    const combined = Array.from(new Set([...uniqueTags, ...tokens]));
    onChange?.(combined);
    setDraft("");
  };

  const handleKeyDown = (event) => {
    if (["Enter", "Tab", ",", " "].includes(event.key)) {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Backspace" && !draft && uniqueTags.length) {
      event.preventDefault();
      onChange?.(uniqueTags.slice(0, -1));
    }
  };

  const removeTag = (tag) => {
    onChange?.(uniqueTags.filter((item) => item !== tag));
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      <div
        className="min-h-[44px] w-full rounded-2xl border border-border/60 bg-background/70 px-3 py-2 ring-2 ring-transparent transition focus-within:ring-2 focus-within:ring-primary dark:border-white/10"
      >
        <div className="flex flex-wrap items-center gap-2">
          {uniqueTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-2 py-1 text-xs font-medium text-primary dark:bg-primary/15"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-primary transition hover:bg-primary/20"
                aria-label={`Hapus tag ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            id={id}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitDraft}
            placeholder="Tambah tag"
            className="flex-1 min-w-[120px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            aria-invalid={Boolean(error)}
          />
        </div>
      </div>
      {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
