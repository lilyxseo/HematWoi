# Dashboard Layout Guidelines

## Two-Column Cards
- Wrap related cards in `grid` container.
- Breakpoints:
  - `lg:grid-cols-12` for desktop.
  - `md:grid-cols-2` for tablet.
- Use column spans for proportion `7/12` and `5/12` on desktop:
  - `lg:col-span-7` for Progress/Milestone card.
  - `lg:col-span-5` for Financial Insights card.
- Cards should stretch equally (`h-full`) and internal lists may scroll.

## Action Tiles
- Use `grid gap-3 md:grid-cols-2 lg:grid-cols-3` for responsive layout.
- Each tile is a focusable link/button with:
  - Circular brand-tinted icon (`bg-brand-500/10 text-brand-600`).
  - Title and optional shortcut description.
- States:
  - `hover:shadow-md` for elevation.
  - `focus:ring-2 focus:ring-brand-500 focus:ring-offset-2` for accessibility.
  - `active:bg-surface-2` for pressed state.
