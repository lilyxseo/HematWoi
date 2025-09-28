export function isHematWoiApp(): boolean {
  if (typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent ?? '';
  const normalizedAgent = userAgent.toLowerCase();
  if (normalizedAgent.includes('hematwoi')) {
    return true;
  }

  const brands = Array.isArray(navigator.userAgentData?.brands)
    ? navigator.userAgentData?.brands ?? []
    : [];

  return brands.some(({ brand }) => typeof brand === 'string' && /hematwoi/i.test(brand));
}
