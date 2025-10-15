import { CapacitorConfig } from '@capacitor/cli';

const webClientId =
  process.env.GOOGLE_WEB_CLIENT_ID ??
  process.env.VITE_GOOGLE_WEB_CLIENT_ID ??
  process.env.VITE_GOOGLE_CLIENT_ID;
const iosClientId =
  process.env.GOOGLE_IOS_CLIENT_ID ?? process.env.VITE_GOOGLE_IOS_CLIENT_ID;
const androidClientId =
  process.env.GOOGLE_ANDROID_CLIENT_ID ?? process.env.VITE_GOOGLE_ANDROID_CLIENT_ID;

const shouldUseLocalAssets = process.env.CAPACITOR_USE_LOCAL === 'true';

const serverConfig: CapacitorConfig['server'] = shouldUseLocalAssets
  ? {
      androidScheme: 'https',
    }
  : {
      url: process.env.CAPACITOR_SERVER_URL ?? 'https://hematwoi.vercel.app',
      cleartext: true,
    };

const config: CapacitorConfig = {
  appId: 'com.hematwoi.app',
  appName: 'HematWoi',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: serverConfig,
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0e0f11',
    },
    GoogleAuth: {
      scopes: ['profile', 'email', 'openid'],
      grantOfflineAccess: true,
      forceCodeForRefreshToken: true,
      serverClientId: webClientId,
      iosClientId,
      androidClientId,
    },
  },
};

export default config;
