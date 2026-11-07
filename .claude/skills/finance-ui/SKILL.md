---
name: finance-ui
description: UI and UX conventions for this finance tracker (Next.js + Tailwind v4 + Notion). Use before adding or changing any page, form, table, dialog, badge, icon, color or chart in src/, so new UI matches the existing design system and works on phones and in dark mode.
---

# Finance Tracker UI conventions

Read the relevant files before writing UI; reuse what exists instead of inventing new patterns.

## Building blocks (reuse, don't re-create)

- `src/components/ui.tsx`: `Card`, `PageHeader`, `Empty`, `Badge` (tones: neutral, good, warning, critical, accent), `Field`, `Input`, `Select`, `Button` (variants: primary, ghost, danger), `inputClass`, `cx`.
- `src/components/icons.tsx`: stroke icons on a 24px grid (`IconPlus`, `IconAlert`, `IconCheck`, `IconClock`, …). Size them with `className` (`h-4 w-4` default, `h-3.5 w-3.5` inside badges). Add new icons here with the same `icon()` factory. **Never use emoji or text glyphs (⚠ ✓ ▲ !) as icons.**
- `src/components/nav-links.ts`: the single list of pages and "add" actions. Adding a page means adding it here; the sidebar and the Ctrl+K command palette both read it.
- `src/components/forms/delete-button.tsx`: delete with a required reason (reason goes into the Notion page's Notes, page moves to Notion trash). Use it for any deletable entry; add the kind to `DELETABLE` in `src/app/actions.ts`.
- `src/components/forms/edit-forms.tsx`: `EditDialog` for edit-in-place dialogs.
- `src/components/toaster.tsx`: `toast(message, ok)` for feedback after client actions.
- `src/components/auto-submit-form.tsx`: GET filter forms that apply on change (no "Filter" button).

## Color

- Only use theme tokens (`bg-surface`, `bg-surface-2`, `bg-page`, `text-ink`, `text-ink-2`, `text-muted`, `border-line`, `bg-accent`, `text-accent`, `text-accent-ink`, `text-good-text`, `text-critical-text`, …). No hex values or Tailwind palette colors (`bg-green-500`) in components.
- Tokens live in `src/app/globals.css`. Dark mode is defined twice there (system preference block and `[data-theme="dark"]` block); change both together.
- Text on `bg-accent` uses `text-accent-ink`, not `text-white` (accent is light in dark mode).
- Status colors (good, warning, critical) always come with an icon and a text label, never color alone.
- Charts use `--series-1` (income, green) and `--series-2` (expenses, orange). The pair was validated for colorblind safety with the dataviz skill's `validate_palette.js`; re-run it if you change either value, in both modes.

## Layout and responsiveness

- Every page must work at 390px wide with **no horizontal page scroll**.
- Grid/flex children that hold tables or long text need `min-w-0` (`Card` already has it; wrapper columns like `lg:col-span-3` need it too).
- Tables: put the minimum width behind `sm:` (`sm:min-w-[720px]`), hide secondary columns with `hidden sm:table-cell` / `md:table-cell`, and show the most important hidden value as a small `sm:hidden` line under the name.
- Summary/stat cards: two per row on phones (`grid-cols-2`), larger on `sm:`.
- Long "add" forms on list pages go in a collapsible `<details id="add">` that opens with `?add=1#add`, so the list is visible first.
- The sidebar is fixed at `lg:` and a drawer below that; page content sits in `lg:pl-60`.

## Feedback states

- `src/app/loading.tsx` and `src/app/error.tsx` cover every route; add a route-specific `loading.tsx` only when its layout differs a lot.
- Empty lists use `Empty` with a one-line hint about what to do next.
- Buttons show pending text while a server action runs (`Saving…`, `Deleting…`).
- Destructive actions confirm in a dialog; nothing is deleted on a single click.

## Accessibility

- Icon-only buttons need `aria-label` (and `title` for hover).
- Keyboard focus: links and buttons get the global accent outline from `globals.css`; inputs use their own `focus:ring` from `inputClass`.
- Respect `prefers-reduced-motion` (handled globally; don't add animations that bypass it).

## Verify before calling UI work done

1. `npx tsc --noEmit -p .` and `npx eslint src` pass.
2. Look at the pages you changed at 390px and 1440px, in light and dark (`ft_theme` cookie = `light` / `dark`). A headless browser (playwright-core with the installed Chrome, run from a scratch directory, not added to this project) works well; log in by setting the `ft_session` cookie to the HMAC described in `src/lib/session.ts`.
3. Check `document.documentElement.scrollWidth - innerWidth` is 0 on phone width.
