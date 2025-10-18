# Warehouse Management System (WMS)

A desktop-first Warehouse Management System built with React, Vite, and TypeScript. The project demonstrates end-to-end operator flows (Receive, Putaway, Pick, Cycle Count, Inventory, and Master Data) with mock Supabase integration, TanStack Query, Zustand offline queueing, and Tailwind CSS UI components.

## Getting started

```bash
pnpm install
pnpm dev
```

The app starts at <http://localhost:5173>. Supabase credentials are optional; when environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are absent, the app falls back to a local mock layer backed by `localStorage`.

## Key features

- **Desktop-first layout** with responsive fallbacks for smaller screens.
- **Task-specific workspaces** (Receive, Putaway, Pick, Cycle Count) optimised for keyboard scanners.
- **Offline-aware queue** using Zustand + localforage that retries queued movements once the browser reconnects.
- **Mock Supabase wrapper** providing `listItems`, `listLocations`, `createMovement`, `listRecentMovements`, and `getInventory` APIs.
- **Typed domain models** for Items, Locations, Movements, and Inventory rows.
- **Reusable UI kit** (`Button`, `Card`, `Input`, `Select`, `DataTable`, etc.) backed by Tailwind CSS tokens.
- **Forms & validation** powered by React Hook Form + Zod.

## Available scripts

| Command      | Description                          |
| ------------ | ------------------------------------ |
| `pnpm dev`   | Start the Vite development server.   |
| `pnpm build` | Build production assets.             |
| `pnpm preview` | Preview the production build.      |
| `pnpm lint`  | Run ESLint on the project.           |
| `pnpm format`| Format files with Prettier.          |

## Environment variables (optional)

Create a `.env` file if you want to connect to Supabase:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

When these are not provided the app keeps working with the mock data layer so `pnpm dev` works out-of-the-box.
