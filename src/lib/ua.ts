export function isHematWoiApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.userAgent?.includes('HematWoiWebView') ?? false;
}
