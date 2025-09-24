import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { supabase } from '../../lib/supabase';
import Page from '../../layout/Page';
import Section from '../../layout/Section';
import { useToast } from '../../context/ToastContext';
import {
  applyRolloverToNext,
  bulkUpsertBudgets,
  computeRollover,
  copyBudgets,
  deleteBudget,
  formatBudgetAmount,
  getPeriods,
  getSummary,
  listBudgets,
  listRules,
  type BudgetRecord,
  type BudgetRuleRecord,
  type CarryRule,
  type BudgetSummary,
  upsertBudget,
  BudgetRulesUnavailableError,
} from '../../lib/api-budgets';
import BudgetsSummary from '../../components/budgets/BudgetsSummary';
import BudgetsFilterBar, {
  type BudgetsFilterState,
} from '../../components/budgets/BudgetsFilterBar';
import BudgetsTable from '../../components/budgets/BudgetsTable';
import BudgetCard from '../../components/budgets/BudgetCard';
import BudgetDetailDrawer from '../../components/budgets/BudgetDetailDrawer';
import BudgetRuleForm from '../../components/budgets/BudgetRuleForm';
import AutoAllocateDialog from '../../components/budgets/AutoAllocateDialog';
import Modal from '../../components/Modal.jsx';
import BudgetForm from '../../components/budgets/BudgetForm';
import type { BudgetViewModel } from '../../components/budgets/types';

export interface BudgetsPageProps {
  currentMonth?: string;
  data?: {
    budgets?: BudgetRecord[];
  };
}

interface UndoItem {
  id: string;
  previous: BudgetRecord;
  timeoutId: number;
  expiresAt: number;
}

interface CategoryOption {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

const DEFAULT_SUMMARY: BudgetSummary = {
  planned: 0,
  actual: 0,
  remaining: 0,
  overspend: 0,
  coverageDays: null,
};

function determineStatus(view: BudgetViewModel): BudgetViewModel['status'] {
  if (view.remaining < 0) return 'overspend';
  const ceiling = view.planned + view.rolloverIn;
  if (ceiling <= 0) return 'on-track';
  const ratio = view.actual / ceiling;
  if (ratio >= 0.8) return 'warning';
  return 'on-track';
}

function buildViewModel(record: BudgetRecord, summary: BudgetSummary): BudgetViewModel {
  const actual = record.activity?.actual ?? 0;
  const inflow = record.activity?.inflow ?? 0;
  const outflow = record.activity?.outflow ?? 0;
  const remaining = record.planned + record.rollover_in - actual;
  const coverageDays = summary.coverageDays;
  const progressBase = record.planned + record.rollover_in;
  const progress = progressBase > 0 ? Math.min(actual / progressBase, 1) : 0;
  const label = record.category_id ? record.name ?? 'Kategori' : record.name ?? 'Envelope';
  const view: BudgetViewModel = {
    id: record.id,
    label,
    categoryId: record.category_id ?? null,
    period: record.period_month,
    planned: record.planned,
    rolloverIn: record.rollover_in,
    rolloverOut: record.rollover_out,
    actual,
    inflow,
    outflow,
    remaining,
    carryRule: record.carry_rule,
    note: record.note ?? null,
    activity: record.activity,
    status: 'on-track',
    progress,
    coverageDays,
    raw: record,
  };
  view.status = determineStatus(view);
  return view;
}

function buildTip(summary: BudgetSummary, views: BudgetViewModel[]): string {
  if (!views.length) return 'Belum ada anggaran untuk periode ini.';
  if (summary.remaining <= 0) {
    const highest = [...views].sort((a, b) => b.actual - a.actual)[0];
    if (!highest) return 'Periksa pengeluaran Anda untuk tetap on-track.';
    const need = formatBudgetAmount(Math.abs(summary.remaining));
    return `Overspend ${need}. Pertimbangkan kurangi ${highest.label} minggu ini.`;
  }
  const suggestion = formatBudgetAmount(summary.remaining);
  return `Saran alokasi ${suggestion} agar on-track bulan ini.`;
}

export default function BudgetsPage({ currentMonth }: BudgetsPageProps) {
  const { addToast } = useToast();
  const [periods, setPeriods] = useState<string[]>([]);
  const [period, setPeriod] = useState(() => currentMonth ?? new Date().toISOString().slice(0, 7));
  const [filters, setFilters] = useState<BudgetsFilterState>({
    q: '',
    categoryId: 'all',
    status: 'all',
    sort: 'name',
    open: false,
  });
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [views, setViews] = useState<BudgetViewModel[]>([]);
  const [summary, setSummary] = useState<BudgetSummary>(DEFAULT_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<BudgetRuleRecord[]>([]);
  const [rulesSupported, setRulesSupported] = useState(true);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selected, setSelected] = useState<BudgetViewModel | null>(null);
  const [ruleEditing, setRuleEditing] = useState<BudgetRuleRecord | null>(null);
  const [ruleBudget, setRuleBudget] = useState<BudgetViewModel | null>(null);
  const [autoAllocateOpen, setAutoAllocateOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [budgetFormOpen, setBudgetFormOpen] = useState(false);
  const undoStack = useRef<UndoItem[]>([]);
  const [, forceRerenderUndo] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const fetched = await getPeriods({ months: 18, anchor: period });
        if (mounted) setPeriods(fetched);
      } catch (error) {
        addToast(`Gagal memuat daftar periode: ${error instanceof Error ? error.message : 'tidak diketahui'}`, 'error');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [period, addToast]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('id, name, type')
          .order('name');
        if (error) throw error;
        if (mounted) {
          const normalized = (data ?? [])
            .filter((row) => row?.id && row?.name)
            .map((row) => ({
              id: row.id as string,
              name: row.name as string,
              type: (row.type as 'income' | 'expense') ?? 'expense',
            }));
          setCategories(normalized);
        }
      } catch (error) {
        addToast(`Gagal memuat kategori: ${error instanceof Error ? error.message : 'tidak diketahui'}`, 'error');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [addToast]);

  const refreshRules = async () => {
    if (!rulesSupported) return;
    try {
      const rows = await listRules();
      setRules(rows);
      setRulesSupported(true);
    } catch (error) {
      if (error instanceof BudgetRulesUnavailableError) {
        setRules([]);
        setRulesSupported(false);
      } else {
        addToast(`Gagal memuat aturan: ${error instanceof Error ? error.message : 'tidak diketahui'}`, 'error');
      }
    }
  };

  useEffect(() => {
    refreshRules();
  }, []);

  useEffect(() => {
    if (rulesSupported) return;
    setRuleBudget(null);
    setRuleEditing(null);
    setAutoAllocateOpen(false);
  }, [rulesSupported]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [rows, summaryData] = await Promise.all([
          listBudgets({ period, q: filters.q || undefined, categoryId: filters.categoryId === 'all' ? undefined : filters.categoryId, withActivity: true, sort: filters.sort }),
          getSummary({ period }),
        ]);
        if (!cancelled) {
          setBudgets(rows);
          setSummary(summaryData);
        }
      } catch (error) {
        if (!cancelled) {
          addToast(`Gagal memuat anggaran: ${error instanceof Error ? error.message : 'tidak diketahui'}`, 'error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period, filters.q, filters.categoryId, filters.sort, addToast]);

  useEffect(() => {
    const filtered = budgets
      .map((record) => buildViewModel(record, summary))
      .filter((item) => {
        if (filters.status === 'overspend' && item.remaining >= 0) return false;
        if (filters.status === 'on-track' && item.remaining < 0) return false;
        if (filters.categoryId && filters.categoryId !== 'all') {
          return item.categoryId === filters.categoryId;
        }
        return true;
      })
      .filter((item) => {
        if (!filters.q) return true;
        return item.label.toLowerCase().includes(filters.q.toLowerCase());
      });
    setViews(filtered);
  }, [budgets, summary, filters]);

  useEffect(() => {
    if (!budgets.length) {
      setSummary(DEFAULT_SUMMARY);
      return;
    }
    const totalPlanned = budgets.reduce((sum, row) => sum + Number(row.planned ?? 0), 0);
    const totalRolloverIn = budgets.reduce((sum, row) => sum + Number(row.rollover_in ?? 0), 0);
    const totalActual = budgets.reduce(
      (sum, row) => sum + Number(row.activity?.actual ?? 0),
      0
    );
    const remaining = totalPlanned + totalRolloverIn - totalActual;
    const base = new Date(`${period}-01T00:00:00Z`);
    const daysInMonth = Number.isNaN(base.getTime())
      ? 30
      : new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
    const coverage = totalActual > 0 ? Math.max(Math.floor(remaining / (totalActual / daysInMonth)), 0) : null;
    setSummary({
      planned: totalPlanned,
      actual: totalActual,
      remaining,
      overspend: remaining < 0 ? Math.abs(remaining) : 0,
      coverageDays: coverage,
    });
  }, [budgets, period]);

  const tip = useMemo(() => buildTip(summary, views), [summary, views]);

  const handleUndo = (id: string) => {
    const existingIndex = undoStack.current.findIndex((item) => item.id === id);
    if (existingIndex === -1) return;
    const [target] = undoStack.current.splice(existingIndex, 1);
    window.clearTimeout(target.timeoutId);
    forceRerenderUndo((x) => x + 1);
    (async () => {
      try {
        await upsertBudget({
          period: target.previous.period_month.slice(0, 7),
          category_id: target.previous.category_id ?? undefined,
          name: target.previous.name ?? undefined,
          planned: target.previous.planned,
          carry_rule: target.previous.carry_rule,
          note: target.previous.note ?? undefined,
          rollover_in: target.previous.rollover_in,
          rollover_out: target.previous.rollover_out,
        });
        setBudgets((prev) =>
          prev.map((row) => (row.id === target.previous.id ? { ...target.previous } : row))
        );
        addToast('Perubahan dibatalkan', 'success');
      } catch (error) {
        addToast(`Gagal membatalkan perubahan: ${error instanceof Error ? error.message : 'tidak diketahui'}`, 'error');
      }
    })();
  };

  const pushUndo = (previous: BudgetRecord) => {
    const timeoutId = window.setTimeout(() => {
      undoStack.current = undoStack.current.filter((item) => item.id !== previous.id);
      forceRerenderUndo((x) => x + 1);
    }, 6000);
    undoStack.current.push({
      id: previous.id,
      previous,
      timeoutId,
      expiresAt: Date.now() + 6000,
    });
    forceRerenderUndo((x) => x + 1);
  };

  const handleInlineUpdate = async (
    id: string,
    payload: Partial<Pick<BudgetRecord, 'planned' | 'rollover_in' | 'carry_rule'>>
  ) => {
    const target = budgets.find((item) => item.id === id);
    if (!target) return;
    const previous = { ...target };
    const next: BudgetRecord = {
      ...target,
      ...('planned' in payload ? { planned: payload.planned ?? target.planned } : {}),
      ...('rollover_in' in payload
        ? { rollover_in: payload.rollover_in ?? target.rollover_in }
        : {}),
      ...('carry_rule' in payload
        ? { carry_rule: (payload.carry_rule ?? target.carry_rule) as CarryRule }
        : {}),
    };
    setBudgets((prev) => prev.map((row) => (row.id === id ? next : row)));
    pushUndo(previous);
    try {
      await upsertBudget({
        period: next.period_month.slice(0, 7),
        category_id: next.category_id ?? undefined,
        name: next.name ?? undefined,
        planned: next.planned,
        carry_rule: next.carry_rule,
        note: next.note ?? undefined,
        rollover_in: next.rollover_in,
        rollover_out: next.rollover_out,
      });
    } catch (error) {
      setBudgets((prev) => prev.map((row) => (row.id === id ? previous : row)));
      addToast(`Gagal menyimpan perubahan: ${error instanceof Error ? error.message : 'tidak diketahui'}`, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBudget(id);
      setBudgets((prev) => prev.filter((row) => row.id !== id));
      addToast('Anggaran dihapus', 'success');
    } catch (error) {
      addToast(`Gagal menghapus anggaran: ${error instanceof Error ? error.message : 'tidak diketahui'}`, 'error');
    }
  };

  const handleCopy = async () => {
    if (periods.length < 2) return;
    const fromPeriod = periods[1];
    try {
      await copyBudgets({ fromPeriod, toPeriod: period, strategy: 'clone', includeRolloverIn: false });
      addToast('Anggaran bulan lalu disalin', 'success');
      const rows = await listBudgets({ period, withActivity: true, sort: filters.sort });
      setBudgets(rows);
    } catch (error) {
      addToast(`Gagal menyalin anggaran: ${error instanceof Error ? error.message : 'tidak diketahui'}`, 'error');
    }
  };

  const handleComputeRollover = async () => {
    try {
      const rows = await computeRollover({ period });
      setBudgets(rows);
      addToast('Rollover berhasil dihitung', 'success');
    } catch (error) {
      addToast(`Gagal menghitung rollover: ${error instanceof Error ? error.message : 'tidak diketahui'}`, 'error');
    }
  };

  const handleApplyRollover = async () => {
    try {
      await applyRolloverToNext({ period });
      addToast('Rollover diterapkan ke bulan berikut', 'success');
    } catch (error) {
      addToast(`Gagal menerapkan rollover: ${error instanceof Error ? error.message : 'tidak diketahui'}`, 'error');
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const header = ['category_or_name', 'planned', 'rollover_in', 'carry_rule', 'note'];
      const lines = [header.join(',')];
      budgets.forEach((row) => {
        const label = row.category_id ? row.name ?? '' : row.name ?? '';
        const cells = [
          `"${label.replace(/"/g, '""')}"`,
          row.planned.toFixed(2),
          row.rollover_in.toFixed(2),
          row.carry_rule,
          row.note ? `"${row.note.replace(/"/g, '""')}"` : '',
        ];
        lines.push(cells.join(','));
      });
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `budgets-${period}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addToast('Data anggaran diekspor', 'success');
    } catch (error) {
      addToast(`Gagal mengekspor CSV: ${error instanceof Error ? error.message : 'tidak diketahui'}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  const parseCsv = (content: string) => {
    const rows = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!rows.length) return [];
    const [, ...dataRows] = rows;
    return dataRows.map((row) => {
      const parts: string[] = [];
      let buffer = '';
      let inQuotes = false;
      for (let i = 0; i < row.length; i += 1) {
        const char = row[i];
        if (char === '"') {
          if (inQuotes && row[i + 1] === '"') {
            buffer += '"';
            i += 1;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          parts.push(buffer);
          buffer = '';
        } else {
          buffer += char;
        }
      }
      parts.push(buffer);
      return parts;
    });
  };

  const handleImportCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) {
        addToast('File kosong atau tidak valid', 'warning');
        return;
      }
      const payloads = rows
        .map((cols) => {
          const [label, plannedStr, rolloverInStr, carryRule, note] = cols;
          const planned = Number.parseFloat(plannedStr ?? '0');
          const rolloverIn = Number.parseFloat(rolloverInStr ?? '0');
          const carry = (carryRule as CarryRule) ?? 'carry-positive';
          return {
            period,
            name: label || undefined,
            planned: Number.isFinite(planned) ? planned : 0,
            rollover_in: Number.isFinite(rolloverIn) ? rolloverIn : 0,
            carry_rule: ['none', 'carry-positive', 'carry-all', 'reset-zero'].includes(carry)
              ? (carry as CarryRule)
              : 'carry-positive',
            note: note || undefined,
          };
        })
        .filter((item) => item.name);
      const saved = await bulkUpsertBudgets(payloads);
      setBudgets(saved);
      addToast('CSV berhasil diimpor', 'success');
    } catch (error) {
      addToast(`Gagal mengimpor CSV: ${error instanceof Error ? error.message : 'tidak diketahui'}`, 'error');
    } finally {
      event.target.value = '';
    }
  };

  const filteredViews = useMemo(() => {
    if (filters.status === 'warning') {
      return views.filter((item) => item.status === 'warning');
    }
    return views;
  }, [views, filters.status]);

  return (
    <Page>
      <Section first>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium" htmlFor="period-picker">
              Periode
            </label>
            <select
              id="period-picker"
              className="h-11 rounded-2xl border border-border bg-surface-1 px-4 text-sm"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            >
              {periods.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="h-11 rounded-2xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow"
              onClick={() => setBudgetFormOpen(true)}
            >
              Tambah Anggaran
            </button>
            <button
              type="button"
              className={`h-11 rounded-2xl border border-border px-4 text-sm font-medium ${
                rulesSupported ? '' : 'cursor-not-allowed opacity-60'
              }`}
              onClick={() => {
                if (!rulesSupported) return;
                setAutoAllocateOpen(true);
              }}
              disabled={!rulesSupported}
              aria-disabled={!rulesSupported}
              title={
                rulesSupported
                  ? undefined
                  : 'Template otomatis membutuhkan tabel budget_rules di Supabase'
              }
            >
              Template
            </button>
            <button
              type="button"
              className="h-11 rounded-2xl border border-border px-4 text-sm font-medium"
              onClick={handleCopy}
            >
              Salin dari …
            </button>
            <button
              type="button"
              className="h-11 rounded-2xl border border-border px-4 text-sm font-medium"
              onClick={handleExportCsv}
              disabled={exporting}
            >
              Ekspor CSV
            </button>
            <button
              type="button"
              className="h-11 rounded-2xl border border-border px-4 text-sm font-medium"
              onClick={() => fileInputRef.current?.click()}
            >
              Impor CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleImportCsv}
            />
          </div>
          {!rulesSupported && (
            <p className="text-xs text-amber-500">
              Aturan anggaran dan Template otomatis belum tersedia. Tambahkan tabel
              <code className="mx-1 rounded bg-surface-2 px-1">budget_rules</code> di Supabase untuk
              mengaktifkan fitur ini.
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-surface-1 p-4 text-sm text-muted">
          {tip}
        </div>
      </Section>

      <Section>
        <BudgetsSummary summary={summary} loading={loading} />
      </Section>

      <Section>
        <BudgetsFilterBar
          filters={filters}
          onChange={setFilters}
          categories={categories}
        />
      </Section>

      {undoStack.current.length > 0 && (
        <Section>
          <div className="rounded-2xl border border-dashed border-border bg-surface-1 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Perubahan tersimpan. Anda dapat membatalkan dalam 6 detik.</span>
              <div className="flex flex-wrap gap-2">
                {undoStack.current.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="rounded-xl border border-border px-3 py-1 text-xs font-medium"
                    onClick={() => handleUndo(item.id)}
                  >
                    Undo {formatBudgetAmount(item.previous.planned)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>
      )}

      <Section>
        <div className="hidden lg:block">
          <BudgetsTable
            budgets={filteredViews}
            loading={loading}
            onInlineUpdate={handleInlineUpdate}
            onOpenDetail={setSelected}
            onDelete={handleDelete}
            onManageRule={(budget) => {
              if (!rulesSupported) return;
              const target = rules.find((rule) => rule.category_id === budget.categoryId) ?? null;
              setRuleBudget(budget);
              setRuleEditing(target);
            }}
            onComputeRollover={handleComputeRollover}
            onApplyRollover={handleApplyRollover}
            rulesEnabled={rulesSupported}
          />
        </div>
        <div className="space-y-4 lg:hidden">
          {filteredViews.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              onOpenDetail={() => setSelected(budget)}
              onEdit={(field, value) =>
                handleInlineUpdate(budget.id, { [field]: value } as Partial<BudgetRecord>)
              }
              onRule={() => {
                if (!rulesSupported) return;
                const target = rules.find((rule) => rule.category_id === budget.categoryId) ?? null;
                setRuleBudget(budget);
                setRuleEditing(target);
              }}
              onDelete={() => handleDelete(budget.id)}
              rulesEnabled={rulesSupported}
            />
          ))}
        </div>
      </Section>

      <BudgetDetailDrawer
        budget={selected}
        onClose={() => setSelected(null)}
        period={period}
      />

      <Modal
        open={budgetFormOpen}
        title="Tambah Anggaran"
        onClose={() => setBudgetFormOpen(false)}
      >
        <BudgetForm
          period={period}
          categories={categories}
          onCancel={() => setBudgetFormOpen(false)}
          onSaved={async () => {
            setBudgetFormOpen(false);
            const rows = await listBudgets({ period, withActivity: true, sort: filters.sort });
            setBudgets(rows);
          }}
        />
      </Modal>

      {rulesSupported && (
        <Modal
          open={!!ruleBudget}
          title={ruleEditing?.id ? 'Edit Aturan' : 'Buat Aturan'}
          onClose={() => {
            setRuleEditing(null);
            setRuleBudget(null);
          }}
        >
          {ruleBudget && (
            <BudgetRuleForm
              budget={ruleBudget}
              rule={ruleEditing ?? undefined}
              onSaved={() => {
                setRuleEditing(null);
                setRuleBudget(null);
                refreshRules();
              }}
            />
          )}
        </Modal>
      )}

      <AutoAllocateDialog
        open={autoAllocateOpen}
        onClose={() => setAutoAllocateOpen(false)}
        period={period}
        budgets={budgets.map((record) => buildViewModel(record, summary))}
        onApplied={async () => {
          setAutoAllocateOpen(false);
          const rows = await listBudgets({ period, withActivity: true, sort: filters.sort });
          setBudgets(rows);
        }}
        rulesEnabled={rulesSupported}
      />
    </Page>
  );
}
