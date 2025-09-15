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
stored in `localStorage` under `hw:mode`.

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

## Feature Toggles

User preferences such as dark mode, MoneyTalk intensity and late-month mode are
stored in `localStorage` under the `hematwoi:v3:prefs` key. They can be tweaked
from the settings panel within the app.

## Contributing

Pull requests are welcome. Please run `pnpm test` before submitting to ensure
all unit tests—including MoneyTalk queue, wallet status mapper, challenge
evaluation and late-month mode activation—pass.
