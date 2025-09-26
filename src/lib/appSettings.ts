import { supabase } from './supabase';

export type DashboardContent = {
  title: string;
  subtitle: string;
  ctaLabel: string;
};

export const DEFAULT_DASHBOARD_CONTENT: DashboardContent = {
  title: 'Dashboard',
  subtitle: 'Ringkasan keuanganmu',
  ctaLabel: 'Lihat Ringkasan Hari Ini',
};

function normalizeString(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    return value;
  }
  return fallback;
}

export function parseDashboardContentValue(value: any): DashboardContent {
  if (value && typeof value === 'object') {
    const raw = value as Record<string, unknown>;
    return {
      title: normalizeString(raw.title, DEFAULT_DASHBOARD_CONTENT.title),
      subtitle: normalizeString(raw.subtitle, DEFAULT_DASHBOARD_CONTENT.subtitle),
      ctaLabel: normalizeString(
        typeof raw.ctaLabel === 'string' ? raw.ctaLabel : (raw.cta_label as string | undefined),
        DEFAULT_DASHBOARD_CONTENT.ctaLabel
      ),
    };
  }

  return { ...DEFAULT_DASHBOARD_CONTENT };
}

export async function fetchDashboardContent(): Promise<DashboardContent> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'dashboard_content')
      .maybeSingle();

    if (error) throw error;

    return parseDashboardContentValue(data?.value);
  } catch (error) {
    console.warn('[appSettings] fetchDashboardContent failed, falling back to defaults', error);
    return { ...DEFAULT_DASHBOARD_CONTENT };
  }
}
