import type { CapacitorConfig } from '@capacitor/cli';

const GOOGLE_WEB_CLIENT_ID =
  process.env.GOOGLE_WEB_CLIENT_ID ??
  process.env.VITE_GOOGLE_WEB_CLIENT_ID ??
  process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  '';

if (!GOOGLE_WEB_CLIENT_ID) {
  console.warn(
    '[capacitor] Missing GOOGLE_WEB_CLIENT_ID environment variable. Native Google Sign-In will not work until it is provided.'
  );
}

const config: CapacitorConfig = {
  appId: 'com.hematwoi.app',
  appName: 'HematWoi',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#0e0f11',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0e0f11',
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: GOOGLE_WEB_CLIENT_ID,
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
