# HematWoi

A personal finance playground built with React 19 and Vite. The project now
includes a reusable layout system and basic accessibility helpers.

## Getting Started

```bash
pnpm install
pnpm dev
```

## Mobile (Capacitor) Setup

HematWoi ships with Capacitor configuration so the same React + Vite codebase
can be packaged as a native Android or iOS app. The key files are:

- [`capacitor.config.ts`](./capacitor.config.ts) – global Capacitor options
  (app id, name, splash + status bar defaults).
- [`android/app/src/main/AndroidManifest.xml`](./android/app/src/main/AndroidManifest.xml)
  – intent filter for the `hematwoi://auth/callback` deeplink and required
  camera/notification permissions.
- [`ios/App/App/Info.plist`](./ios/App/App/Info.plist) – URL schemes for
  deeplinks and Google Sign-In (`hematwoi` + reversed client id).
- [`src/lib/native.ts`](./src/lib/native.ts) & [`src/lib/native-auth.ts`](./src/lib/native-auth.ts)
  – platform detection, Preferences/Notifications/Camera wrappers and native
  Google Sign-In helpers.

### Commands

```bash
# build the web bundle and copy it into android/ios, then run `npx cap sync`
npm run build:mobile

# resynchronise dependencies/platforms without rebuilding assets
npm run cap:sync

# open the Android or iOS project in Android Studio / Xcode
npm run cap:open:android
npm run cap:open:ios
```

After running `npm run build:mobile` you can use the standard Capacitor flow:

```bash
npx cap open android   # Android Studio (build APK/AAB)
npx cap open ios       # Xcode (build IPA/TestFlight)
```

### Environment variables

Create a `.env` (or configure your CI secrets) with the following keys:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GOOGLE_WEB_CLIENT_ID=   # OAuth 2.0 Web client id
VITE_SUPABASE_REDIRECT_URL=  # optional, defaults to current origin
```

On iOS you must also provide the reversed client id (from the Google iOS client)
via `GOOGLE_REVERSED_CLIENT_ID` in Xcode ➜ Info ➜ URL Types. The generated
`Info.plist` reads that value through the build setting.

### Google Sign-In configuration

1. Create three OAuth clients in Google Cloud Console: **Web**, **Android** and
   **iOS** (same project).
2. Android client requirements:
   - Package id: `com.hematwoi.app`.
   - Add SHA-1 and SHA-256 fingerprints for both debug and release keystores.
     In Android Studio open **Gradle** ➜ `:app` ➜ *Tasks* ➜ *android*
     ➜ **signingReport**. The report printed in the *Run* tool window lists the
     fingerprints you need to copy into the Google OAuth client configuration.
3. iOS client: use the bundle id `com.hematwoi.app` and note the
   `REVERSED_CLIENT_ID` – paste it into Xcode’s URL Types (or set the
   `GOOGLE_REVERSED_CLIENT_ID` build setting).
4. Web client: copy the client id into `VITE_GOOGLE_WEB_CLIENT_ID`.
5. In Supabase Dashboard ➜ Authentication ➜ URL Configuration add:
   - `hematwoi://auth/callback`
   - `https://hemat-woi.me/auth/callback` (or your production domain)

The React side calls `supabase.auth.signInWithIdToken(...)` using the `id_token`
returned by the Capacitor Google Auth plugin. Deeplinks are handled via
`registerNativeDeeplinkHandler` so returning to the app from the system browser
completes the Supabase session automatically.

#### Debugging native sign-in

- `DEVELOPER_ERROR` – incorrect SHA-1/SHA-256, bundle id or client id. Verify
  the Android client configuration matches the keystore you are using.
- `TOKEN_MISSING` – Google returned no `id_token`; ensure the web client id is
  passed to the plugin (`VITE_GOOGLE_WEB_CLIENT_ID`) and the OAuth consent
  screen is published.
- `SIGN_IN_FAILED` – generic Google API error. Check device connectivity and
  Google Play Services updates.

### Native features

- **Camera / Gallery / File picker**: `takePhotoOrPick()` uses the Capacitor
  Camera plugin natively and falls back to `<input type="file">` on the web.
  Use `captureReceipt()` + `uploadReceipt()` to save transaction proofs into the
  Supabase Storage bucket `receipts/`.
- **Preferences**: `writeJsonPreference` mirrors important UI settings
  (`hwTheme`, `hw:lastUser`, `hw:prefs`) into Capacitor Preferences so they load
  before React renders, avoiding theme flashes.
- **Local notifications**: `scheduleDebtReminderNotification` registers a
  reminder seven days before each debt’s due date. Permissions and Android
  notification channels are handled automatically.
- **Status bar & splash**: `bootstrapNativeApp()` applies the dark theme status
  bar and hides the splash screen once the app is ready. Custom splash assets
  can be generated with `npx cordova-res --skip-config --copy`.
- **Deeplinks**: the scheme `hematwoi://auth/callback` re-enters the React router
  at the correct page and replays the Supabase login (PKCE/id-token).

### Troubleshooting

- Reset Capacitor state: `npx cap sync` (or `npm run cap:sync`) after installing
  new dependencies.
- When adding new native plugins, re-run `npm run build:mobile` so the web assets
  are copied into `android/` and `ios/`.
- If Android release builds strip Google Auth classes, ensure ProGuard keeps the
  plugin package (Android Studio ➜ `app/proguard-rules.pro`).

Run unit tests with:

```bash
pnpm test
```

## Data Mode

HematWoi now runs in **Online Mode** by default using Supabase for all CRUD
operations. A toggle in the sidebar switches to **Local Mode** where data is
stored in `localStorage`/IndexedDB. Press the button again to return to
Online Mode. The choice persists in `localStorage` under `hw:mode` so refreshes
keep the selected mode. A small badge in the footer shows whether `✅ Online`
or `📴 Local` mode is active.

## Transactions Page

The transactions page now keeps filter state in the URL, allowing bookmarks or
shared links to reproduce the same view. Users can quickly adjust type, month,
category, sort order or search text via a compact filter bar. Active filters are
shown as removable chips below the bar so each criterion can be cleared
individually.

## Sync & Offline Queue

All reads and writes go to Supabase when online. If a request fails due to
network issues the operation is stored in an outbox inside IndexedDB and
replayed automatically when connectivity returns. Operations are batched,
retried with exponential backoff and merged with Realtime updates.

To clear local caches or the outbox open the devtools console and run:

```js
localStorage.clear();
indexedDB.deleteDatabase('hw-cache');
indexedDB.deleteDatabase('hw-oplog');
```

During development you can simulate offline mode by toggling:

```js
window.__sync = { fakeOffline: true };
```

The sync banner at the top of the app shows current status and allows
manually flushing the outbox via a “Sync Now” button.

## Goals UI

Goal cards now calculate progress using saved vs target, display a computed ETA
based on recent savings, and offer quick actions for editing, deleting and
adding savings.

## Folder Structure

```
src/
  layout/        # App-wide layout helpers (breadcrumbs, page headers)
  components/    # Feature components
  pages/         # Route pages
  context/       # React context providers
  lib/           # Utilities and tests
```

## Daftar Halaman & Rute

| Title   | Path      | Protected | Section | Flag    |
|---------|-----------|-----------|---------|---------|
| Home    | `/`       | No        | Main    | -       |
| Reports | `/reports`| Yes       | Main    | -       |

![Reports page screenshot](docs/reports.png)

Halaman **Reports** dapat diakses melalui tautan sidebar atau langsung ke `/reports`.

## Reports Page

The reports view collects historical transactions into monthly dashboards. You can:

- Switch between recorded months and optionally compare them with the previous period.
- Review KPI tiles with sparkline trends for income, expense, balance and savings rate.
- Explore spending patterns via net balance trend lines, category distribution donut, daily heatmap and top spend table.
- Read automatically generated insights (no-spend days, biggest category, etc.) and drill into highlighted transactions.
- Export the filtered report as CSV or PDF, complete with KPI, category and day-by-day breakdowns plus budget usage.

## UI Guidelines

The app uses TailwindCSS with a unified design system. Core colour tokens:

- `brand-300` `#50b6ff`
- `brand-500` `#3898f8`
- `brand-600` `#2584e4`
- `success` `#22c55e`
- `danger` `#ef4444`
- `warning` `#f59e0b`

Neutral tokens (used mostly in dark mode):

- `neutral.background` `#0f172a`
- `neutral.surface-1` `#1e293b`
- `neutral.surface-2` `#334155`
- `neutral.text` `#f1f5f9`
- `neutral.muted` `#94a3b8`

Typography uses fluid heading sizes (`h1`–`h6`) and a default body size that scales between breakpoints. Radius sizes (`DEFAULT`, `md`, `sm`) and shadows (`sm`, `md`, `lg`) are defined in `tailwind.config.cjs`.

Dark mode is supported via the `dark` class on `<html>`, allowing a manual theme toggle.

Class names are automatically sorted using `prettier-plugin-tailwindcss`. Run `pnpm lint` or your editor's format command to keep class order consistent.

### Adding New Tokens

Design tokens for colours, spacing and typography live in `tailwind.config.cjs` under `theme.extend`. To add a new token:

1. Edit `tailwind.config.cjs` and add the value under the relevant key (e.g. `extend.colors` or `extend.spacing`).
2. Document the token in `docs/design-tokens.md` for future reference.
3. Use the new class in components with the standard Tailwind syntax, e.g. `bg-surface-2` or `text-brand-500`.


## Layout Components

- **Breadcrumbs** – renders a path based on the current route.
- **PageHeader** – shows page title, description and optional action buttons.

These components aim to keep spacing and typography consistent across pages.

## Card System & Quote Bubble

The dashboard and other pages share a flexible `Card` component with optional
`CardHeader`, `CardBody` and `CardFooter` sections. Cards use a subtle border,
rounded corners and responsive padding (`p-4` on mobile, `p-6` on larger
screens). Header titles use `font-semibold` while longer content in the body can
be truncated with `line-clamp` utilities. Footers are reserved for secondary
actions or meta information.

Key performance indicators use the `KpiCard` variant which centres the value and
applies semantic colours (`success` for income, `danger` for expense, `brand` for
net totals).

Daily quotes render inside a `QuoteBubble` component, styled like a chat message
with typographic opening and closing quotes. When no quote is available a short
neutral placeholder is shown.

## Dashboard & Profile

- KPI cards show income, expense and balance with semantic colours.
- Daily quote appears as a chat-style bubble with typographic quotes.
- Avatar level and XP controls moved from the dashboard to the new Profile page.

## Settings & Preferences

The `/settings` page groups application preferences into:

- **General UI** – dark mode, density (compact/comfortable) and language (ID/EN).
- **Gamification** – avatar leveling toggle, MoneyTalk intensity and sound FX.
- **Finance** – currency (IDR by default), digit separator format and first day of week.
- **Privacy** – mock PIN lock and an incognito mode that hides amounts.
- **Data Mode** – switch between cloud or local storage; a "Seed Dummy Data" button appears when using local mode.
- **Backup** – export or import all user data as a JSON file.

Preferences are stored in `localStorage` under the `hw:prefs` key with the schema:

```json
{
  "darkMode": false,
  "density": "comfortable",
  "language": "id",
  "avatarLeveling": true,
  "moneyTalk": "normal",
  "soundFx": true,
  "currency": "IDR",
  "digitFormat": "comma",
  "firstDay": 1,
  "pinLock": false,
  "incognito": false
}
```

## Theme System Guide

Colors across the app are driven by CSS custom properties with light, dark and
system modes. Key tokens include:

- `--bg`, `--surface`, `--surface-2`, `--border`
- `--text`, `--text-muted`, `--heading`
- `--brand-h`, `--brand-s`, `--brand-l`, `--brand-foreground`

User preferences are stored in `localStorage` under `hwTheme` with structure
`{ mode: 'light' | 'dark' | 'system', brand: { h, s, l } }`. An inline script in
`index.html` applies these settings before React mounts to prevent a flash of the
default theme. Sidebar controls allow switching mode and picking a brand color,
which updates the variables globally.

## Contributing

Pull requests are welcome. Please run `pnpm test` before submitting to ensure
all unit tests—including MoneyTalk queue, wallet status mapper, challenge
evaluation and late-month mode activation—pass.
