# HematWoi

A personal finance playground built with React 19 and Vite. The project now
includes a reusable layout system and basic accessibility helpers.

## Getting Started

```bash
pnpm install
pnpm dev
```

Run unit tests with:

```bash
pnpm test
```

## Data Mode

HematWoi now supports a cloud or local data mode. The default mode uses
Supabase for persistent storage. Switch to local mode from the Settings
page and optionally seed dummy data for quick testing. The current mode is
stored in `localStorage` under `hw:mode` and survives page reloads.

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
| Reports | `/reports`| Yes       | Main    | `reports` |

![Reports page screenshot](docs/reports.png)

Halaman **Reports** dapat diakses melalui tautan sidebar atau langsung ke `/reports`.

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

## Layout Components

- **Breadcrumbs** – renders a path based on the current route.
- **PageHeader** – shows page title, description and optional action buttons.

These components aim to keep spacing and typography consistent across pages.

## Dashboard & Profile

- Wallet avatar and finance mascot icons now appear on a single centred row.
- Avatar level and XP controls moved from the dashboard to the new Profile page.
- Daily quote card simplified with no category selector or repeat button.

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

## Contributing

Pull requests are welcome. Please run `pnpm test` before submitting to ensure
all unit tests—including MoneyTalk queue, wallet status mapper, challenge
evaluation and late-month mode activation—pass.
