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

The app uses TailwindCSS with a unified colour palette:
- `brand` `#3898f8`
- `brand-hover` `#2584e4`
- `brand-secondary` `#50b6ff`
- `brand-secondary-hover` `#379de7`
- `brand-text` `#13436d`

Dark mode is supported via the `dark` class on `<html>`.

## Layout Components

- **Breadcrumbs** – renders a path based on the current route.
- **PageHeader** – shows page title, description and optional action buttons.

These components aim to keep spacing and typography consistent across pages.

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
