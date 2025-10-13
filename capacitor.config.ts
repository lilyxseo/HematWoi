import { CapacitorConfig } from '@capacitor/cli';

const webClientId =
  process.env.GOOGLE_WEB_CLIENT_ID ??
  process.env.VITE_GOOGLE_WEB_CLIENT_ID ??
  process.env.VITE_GOOGLE_CLIENT_ID;
const iosClientId =
  process.env.GOOGLE_IOS_CLIENT_ID ?? process.env.VITE_GOOGLE_IOS_CLIENT_ID;
const androidClientId =
  process.env.GOOGLE_ANDROID_CLIENT_ID ?? process.env.VITE_GOOGLE_ANDROID_CLIENT_ID;

const config: CapacitorConfig = {
  appId: 'com.hematwoi.app',
  appName: 'HematWoi',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
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
