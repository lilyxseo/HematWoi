export async function registerPwaWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  if (!['https:', 'http:'].includes(window.location.protocol)) return;
  try {
    await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
  } catch (error) {
    // Installation support must not prevent the application from starting.
    console.warn('Pendaftaran aplikasi HematWoi belum berhasil.', error);
  }
}
