export const flags: Record<string, boolean> = {
  reports: true,
};

export function isFeatureEnabled(name: string): boolean {
  return !!flags[name];
}
