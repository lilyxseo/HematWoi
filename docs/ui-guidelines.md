# UI Guidelines

## Spacing Tokens
- `--page-y`: vertical padding for pages.
- `--section-y`: gap between sections on a page.
- `--block-y`: internal gap for cards and grids.

## Layout Pattern
1. **Page** – applies `--page-y` as top/bottom padding.
2. **Section** – use `<Section>` to add `--section-y` spacing between blocks.
3. **Card/Block** – internal spacing uses `--block-y`; avoid extra margin/padding on child elements.

## Sidebar
- Fixed at `100dvh` with its own scroll.
- Width variables: `--sidebar-w-expanded` (280px) and `--sidebar-w-collapsed` (72px).
- Current width is exposed as `--sidebar-width` and updates with the collapse toggle.
- Main content should offset using `margin-left: var(--sidebar-width)` on desktop.
