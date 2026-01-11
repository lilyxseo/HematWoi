import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2 } from 'lucide-react';
import type { GoalPayload, GoalPriority, GoalRecord, GoalStatus } from '../../lib/api-goals';

const todayIso = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function normalizeDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function parseDecimal(value: string): number {
  if (!value) return Number.NaN;
  const cleaned = value.replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(/,/g, '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatAmountInput(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('id-ID');
}

const PRESET_PERCENTAGES = [25, 50, 75, 100];

interface CategoryOption {
  id: string;
  name: string;
}

interface MilestoneFormValue {
  id: string;
  label: string;
  amount: string;
}

interface GoalFormValues {
  title: string;
  description: string;
  target_amount: string;
  start_date: string;
  due_date: string;
  priority: GoalPriority;
  status: GoalStatus;
  category_id: string;
  color: string;
  icon: string;
}

interface GoalFormProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialData?: GoalRecord | null;
  categories: CategoryOption[];
  submitting?: boolean;
  onSubmit: (payload: GoalPayload) => Promise<void> | void;
  onClose: () => void;
}

interface FieldErrors {
  [key: string]: string | undefined;
}

function buildDefaultValues(initial?: GoalRecord | null): GoalFormValues {
  if (!initial) {
    return {
      title: '',
      description: '',
      target_amount: '',
      start_date: todayIso(),
      due_date: '',
      priority: 'normal',
      status: 'active',
      category_id: '',
      color: '#3898F8',
      icon: '',
    };
  }
  return {
    title: initial.title ?? '',
    description: initial.description ?? '',
    target_amount: initial.target_amount ? formatAmountInput(String(initial.target_amount)) : '',
    start_date: normalizeDateInput(initial.start_date) || todayIso(),
    due_date: normalizeDateInput(initial.due_date) || '',
    priority: initial.priority,
    status: initial.status,
    category_id: initial.category_id ?? '',
    color: initial.color ?? '#3898F8',
    icon: initial.icon ?? '',
  };
}

function identifyPresetMilestones(initial: GoalRecord | null) {
  if (!initial || !initial.target_amount) {
    return {
      presets: new Set<number>(PRESET_PERCENTAGES),
      custom: [] as MilestoneFormValue[],
    };
  }
  const presets = new Set<number>();
  const custom: MilestoneFormValue[] = [];
  const target = initial.target_amount;
  initial.milestones.forEach((milestone, index) => {
    const percent = (milestone.amount / target) * 100;
    const matched = PRESET_PERCENTAGES.find((value) => Math.abs(value - percent) <= 2);
    if (matched) {
      presets.add(matched);
    } else {
      custom.push({
        id: `${initial.id}-custom-${index}`,
        label: milestone.label,
        amount: formatAmountInput(String(milestone.amount)),
      });
    }
  });
  if (presets.size === 0) {
    PRESET_PERCENTAGES.forEach((value) => presets.add(value));
  }
  return { presets, custom };
}

function clampHex(value: string) {
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value.toUpperCase();
  return '#3898F8';
}

export default function GoalForm({ open, mode, initialData = null, categories, submitting, onSubmit, onClose }: GoalFormProps) {
  const [values, setValues] = useState<GoalFormValues>(() => buildDefaultValues(initialData));
  const [{ presets, custom }, setMilestonesState] = useState(() => identifyPresetMilestones(initialData));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [dateWarning, setDateWarning] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setValues(buildDefaultValues(initialData));
      setMilestonesState(identifyPresetMilestones(initialData));
      setErrors({});
      setDateWarning(null);
    }
  }, [open, initialData]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => firstFieldRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  const targetAmountNumber = useMemo(() => {
    const parsed = parseDecimal(values.target_amount);
    if (Number.isNaN(parsed) || parsed <= 0) return 0;
    return parsed;
  }, [values.target_amount]);

  useEffect(() => {
    if (!values.start_date || !values.due_date) {
      setDateWarning(null);
      return;
    }
    const start = new Date(values.start_date);
    const due = new Date(values.due_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(due.getTime())) {
      setDateWarning(null);
      return;
    }
    if (due.getTime() < start.getTime()) {
      setDateWarning('Tanggal target lebih awal dari tanggal mulai.');
    } else {
      setDateWarning(null);
    }
  }, [values.start_date, values.due_date]);

  const handleChange = (field: keyof GoalFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { value } = event.target;
      setValues((prev) => ({
        ...prev,
        [field]:
          field === 'color'
            ? clampHex(value)
            : field === 'target_amount'
              ? formatAmountInput(value)
              : value,
      }));
    };

  const togglePreset = (percent: number) => () => {
    setMilestonesState((prev) => {
      const next = new Set(prev.presets);
      if (next.has(percent)) {
        next.delete(percent);
      } else {
        next.add(percent);
      }
      return { presets: next, custom: prev.custom };
    });
  };

  const handleCustomChange = (id: string, field: keyof MilestoneFormValue) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setMilestonesState((prev) => ({
        presets: prev.presets,
        custom: prev.custom.map((item) =>
          item.id === id
            ? { ...item, [field]: field === 'amount' ? formatAmountInput(value) : value }
            : item,
        ),
      }));
    };

  const handleAddCustom = () => {
    setMilestonesState((prev) => ({
      presets: prev.presets,
      custom: [
        ...prev.custom,
        {
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          label: '',
          amount: '',
        },
      ],
    }));
  };

  const handleRemoveCustom = (id: string) => () => {
    setMilestonesState((prev) => ({
      presets: prev.presets,
      custom: prev.custom.filter((item) => item.id !== id),
    }));
  };

  const validate = (): { errors: FieldErrors; targetValue: number; milestones: GoalPayload['milestones'] } => {
    const validationErrors: FieldErrors = {};

    if (!values.title.trim()) {
      validationErrors.title = 'Judul wajib diisi.';
    } else if (values.title.trim().length > 80) {
      validationErrors.title = 'Maksimum 80 karakter.';
    }

    const targetValue = parseDecimal(values.target_amount);
    if (Number.isNaN(targetValue) || targetValue <= 0) {
      validationErrors.target_amount = 'Masukkan target nominal lebih dari 0.';
    }

    const startDate = values.start_date ? new Date(values.start_date) : null;
    const dueDate = values.due_date ? new Date(values.due_date) : null;
    if (startDate && dueDate && dueDate.getTime() < startDate.getTime()) {
      validationErrors.due_date = 'Tanggal target harus setelah tanggal mulai.';
    }

    const milestoneList: GoalPayload['milestones'] = [];
    if (!Number.isNaN(targetValue) && targetValue > 0) {
      presets.forEach((percent) => {
        const amount = (targetValue * percent) / 100;
        milestoneList.push({ label: `${percent}%`, amount });
      });
    }

    custom.forEach((item) => {
      const trimmedLabel = item.label.trim();
      const amountValue = parseDecimal(item.amount);
      if (!trimmedLabel || Number.isNaN(amountValue) || amountValue <= 0) {
        validationErrors[`milestone-${item.id}`] = 'Label dan nominal milestone wajib diisi.';
      } else {
        milestoneList.push({ label: trimmedLabel, amount: amountValue });
      }
    });

    return { errors: validationErrors, targetValue, milestones: milestoneList };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { errors: validationErrors, targetValue, milestones } = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      const firstError = Object.keys(validationErrors)[0];
      if (firstError.startsWith('milestone-')) {
        dialogRef.current?.querySelector<HTMLInputElement>(`[data-error-id="${firstError}"]`)?.focus();
      } else {
        dialogRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${firstError}"]`)?.focus();
      }
      return;
    }

    const payload: GoalPayload = {
      title: values.title.trim(),
      description: values.description.trim() || null,
      target_amount: Number(targetValue.toFixed(2)),
      start_date: values.start_date || todayIso(),
      due_date: values.due_date || null,
      priority: values.priority,
      status: values.status,
      category_id: values.category_id || null,
      color: values.color,
      icon: values.icon.trim() || null,
      milestones,
    };

    try {
      await onSubmit(payload);
    } catch (submitError) {
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        // eslint-disable-next-line no-console
        console.error('[HW][GoalForm] submit', submitError);
      }
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/40" role="dialog" aria-modal="true">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div
          ref={dialogRef}
          className="w-full max-w-2xl rounded-3xl border border-border/60 bg-card/95 p-6 text-text shadow-xl backdrop-blur"
        >
          <header className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{mode === 'create' ? 'Tambah Goal' : 'Edit Goal'}</p>
              <h2 className="mt-1 text-2xl font-bold text-text">{mode === 'create' ? 'Goal baru' : values.title || 'Perbarui goal'}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-1 text-text transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
              aria-label="Tutup form goal"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-text">
                Nama goal
                <input
                  ref={firstFieldRef}
                  name="title"
                  type="text"
                  value={values.title}
                  onChange={handleChange('title')}
                  placeholder="Contoh: Dana darurat"
                  className={`h-[44px] rounded-xl border px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] ${
                    errors.title ? 'border-danger/70' : 'border-border bg-surface-1'
                  }`}
                  required
                />
                {errors.title ? <span className="text-xs text-danger">{errors.title}</span> : null}
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-text">
                Target nominal
                <input
                  name="target_amount"
                  type="text"
                  inputMode="numeric"
                  value={values.target_amount}
                  onChange={handleChange('target_amount')}
                  placeholder="10.000.000"
                  className={`h-[44px] rounded-xl border px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] ${
                    errors.target_amount ? 'border-danger/70' : 'border-border bg-surface-1'
                  }`}
                  required
                />
                {errors.target_amount ? <span className="text-xs text-danger">{errors.target_amount}</span> : null}
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-text md:col-span-2">
                Deskripsi
                <textarea
                  name="description"
                  value={values.description}
                  onChange={handleChange('description')}
                  rows={3}
                  className="min-h-[92px] rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                  placeholder="Catatan singkat atau detail target"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-text">
                Mulai sejak
                <input
                  name="start_date"
                  type="date"
                  value={values.start_date}
                  onChange={handleChange('start_date')}
                  className="h-[44px] rounded-xl border border-border bg-surface-1 px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-text">
                Target selesai
                <input
                  name="due_date"
                  type="date"
                  value={values.due_date}
                  onChange={handleChange('due_date')}
                  className={`h-[44px] rounded-xl border px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] ${
                    errors.due_date ? 'border-danger/70' : 'border-border bg-surface-1'
                  }`}
                />
                {errors.due_date ? <span className="text-xs text-danger">{errors.due_date}</span> : null}
                {dateWarning ? <span className="text-xs text-amber-500">{dateWarning}</span> : null}
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-text">
                Prioritas
                <select
                  name="priority"
                  value={values.priority}
                  onChange={handleChange('priority')}
                  className="h-[44px] rounded-xl border border-border bg-surface-1 px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                >
                  <option value="low">Rendah</option>
                  <option value="normal">Normal</option>
                  <option value="high">Tinggi</option>
                  <option value="urgent">Mendesak</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-text">
                Status
                <select
                  name="status"
                  value={values.status}
                  onChange={handleChange('status')}
                  className="h-[44px] rounded-xl border border-border bg-surface-1 px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                >
                  <option value="active">Aktif</option>
                  <option value="paused">Ditahan</option>
                  <option value="achieved">Tercapai</option>
                  <option value="archived">Diarsipkan</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-text">
                Kategori
                <select
                  name="category_id"
                  value={values.category_id}
                  onChange={handleChange('category_id')}
                  className="h-[44px] rounded-xl border border-border bg-surface-1 px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                >
                  <option value="">Tanpa kategori</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-text">
                Warna kartu
                <input
                  name="color"
                  type="color"
                  value={values.color}
                  onChange={handleChange('color')}
                  className="h-[44px] w-full rounded-xl border border-border bg-surface-1 px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-text">
                Ikon (emoji atau teks)
                <input
                  name="icon"
                  type="text"
                  value={values.icon}
                  onChange={handleChange('icon')}
                  placeholder="Contoh: 💰"
                  className="h-[44px] rounded-xl border border-border bg-surface-1 px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                />
              </label>
            </div>

            <section className="space-y-3 rounded-2xl border border-border/60 bg-surface-1/80 p-4">
              <header className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-text">Milestones progres</h3>
                <p className="text-xs text-muted">
                  Pilih milestone persentase atau tambahkan milestone khusus untuk checklist progres.
                </p>
              </header>

              <div className="flex flex-wrap gap-2">
                {PRESET_PERCENTAGES.map((percent) => {
                  const checked = presets.has(percent);
                  const amountValue = targetAmountNumber > 0 ? Math.round((targetAmountNumber * percent) / 100) : 0;
                  return (
                    <label
                      key={`preset-${percent}`}
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                        checked ? 'border-brand bg-brand/10 text-brand' : 'border-border bg-surface-1 text-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={togglePreset(percent)}
                        className="sr-only"
                      />
                      {percent}%
                      <span className="text-[11px] text-muted">{amountValue ? amountValue.toLocaleString('id-ID') : '-'}</span>
                    </label>
                  );
                })}
              </div>

              <div className="space-y-3">
                {custom.map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr,minmax(120px,1fr),auto] items-center gap-2">
                    <input
                    data-error-id={`milestone-${item.id}`}
                    type="text"
                    value={item.label}
                    onChange={handleCustomChange(item.id, 'label')}
                    placeholder="Label milestone"
                    className={`h-[40px] rounded-xl border px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] ${
                      errors[`milestone-${item.id}`] ? 'border-danger/70' : 'border-border bg-surface-1'
                    }`}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={item.amount}
                    onChange={handleCustomChange(item.id, 'amount')}
                    placeholder="Nominal"
                    className={`h-[40px] rounded-xl border px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] ${
                      errors[`milestone-${item.id}`] ? 'border-danger/70' : 'border-border bg-surface-1'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleRemoveCustom(item.id)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-1 text-muted transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                    aria-label="Hapus milestone"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {errors[`milestone-${item.id}`] ? (
                    <span className="col-span-3 text-xs text-danger">{errors[`milestone-${item.id}`]}</span>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddCustom}
                className="inline-flex h-[40px] items-center justify-center gap-2 rounded-xl border border-border bg-surface-1 px-4 text-sm font-medium text-text transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Tambah milestone khusus
              </button>
            </div>
          </section>

          <footer className="flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-[44px] items-center justify-center rounded-xl border border-border bg-surface-1 px-5 text-sm font-medium text-text transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={Boolean(submitting)}
              className="inline-flex h-[44px] items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Menyimpan…' : mode === 'create' ? 'Simpan Goal' : 'Perbarui Goal'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  </div>,
    document.body,
  );
}
