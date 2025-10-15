# HematWoi Vercel Deployment Guide

## Supabase Configuration Checklist

1. **Authentication → URL Configuration**
   - **Site URL:** `https://hemat-woi.me`
   - **Redirect URLs:**
     - `https://hemat-woi.me/auth/callback`
     - *(Optional preview)* `https://*.vercel.app/auth/callback`
2. **OAuth Providers (Google, etc.)**
   - Register `https://hemat-woi.me` as an authorized domain/origin in the provider console.
   - Add `https://hemat-woi.me/auth/callback` (and preview URL if used) to the provider redirect URIs.
3. **CORS Settings**
   - Allow origins `https://hemat-woi.me` and, if required for previews, `https://*.vercel.app`.

## Deployment Steps

1. Connect the repository to Vercel. Use framework preset **Vite**, build command `npm run build`, and output directory `dist`.
2. In **Vercel → Project Settings → Environment Variables**, set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_BASE_URL`
3. Commit and push the updated configuration files (`capacitor.config.ts`, `vercel.json`, `.env.production`). Vercel will automatically build and deploy.
4. Publish the deployment. The Capacitor mobile apps will immediately load the new version from `https://hemat-woi.me` without rebuilding the APK/IPA.
5. If using `vite-plugin-pwa`, ensure the service worker is configured with `registerType: 'autoUpdate'` and `workbox: { clientsClaim: true, skipWaiting: true }` so it respects the cache headers (do not permanently cache `/`).
