# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server
npm run build     # tsc -b && vite build (must pass clean before every commit)
npm run lint      # eslint (must pass clean before every commit)
npm run test      # vitest run (must pass clean before every commit)
npm run format    # prettier --write .
```

`npm run build && npm run lint && npm run test` is the full correctness gate — all three
must pass clean before every commit. The suite is ~140 tests across `src/__tests__/`;
keeping it green is required (a red suite on `main` is what motivated a dedicated repair
phase once — don't ship past it).

## Working agreement

- Build one phase at a time; summarise decisions after each phase
- Do not start the next phase without explicit user confirmation
- Flag ambiguities not covered by `ARCHITECTURE.md` rather than guessing
- Do not add `Co-Authored-By` to commits

## TypeScript constraints

`tsconfig.app.json` enables `noUnusedLocals` and `noUnusedParameters` in addition to `strict: true`. Unused symbols fail the build — there is no workaround. Do not introduce a symbol until it has a real caller.

All imports use the `@/` alias (maps to `src/`).

## Data model

The central type is `Chart` in `src/types/chart.ts`. Key details:

- `slots: Array<Slot | null>` is **visual-cell-indexed and sparse**. The default is `slots: []`. Out-of-bounds reads return `undefined`, not `null`. Always read slots through `getSlot(chart, slotIndex)` from `src/utils/chart.ts`, never via direct array access.
- `Slot` is a discriminated union on `kind`: `'scryfall'` (card art from Scryfall) and `'custom'` (a user-uploaded image stored as a data URL).
- `heroConfig: HeroConfig` drives the hybrid hero layout; `titleFont?: string` selects the title typeface. Both are on `Chart`.
- Crop fields (`cropX`, `cropY`, `cropScale`) are on every slot and drive framing/square mode — do not remove them.
- Sort fields (`cmc`, `colors`, `typeLine`) are stored on `ScryfallSlot` (nullable) so sort works offline without a re-fetch.
- `CURRENT_SCHEMA_VERSION` is `4` (`src/utils/schemaVersion.ts`), with a migration chain v1→v2→v3→v4. When adding a non-optional field, bump the version and add a migration step that fills existing charts/slots with the new field's default; `migrateAll` runs on load before render.

## Grid rendering

`generateCellMap(rows, cols, heroConfig)` in `src/utils/cellMap.ts` produces the `CellMap` — the grid renderer consumes this and never computes slot positions itself. In uniform mode every cell is `{ kind: 'slot', slotIndex: i }`. The union also has `'hero'` (a spanning cell) and `'covered'` (occupied by an adjacent hero); `covered` cells must render `null` (no DOM node). All downstream logic (drop targets, "next empty", capacity, numbering) filters on `kind !== 'covered'`.

React keys in the grid must be `cell.slotIndex`, not array index. Cells render `<img>` with `object-fit: cover` (never `background-image`) — `.cell img` CSS is already in `Grid.module.css`.

## State

Chart state lives in the `useCharts` hook (`src/hooks/useCharts.ts`): a localStorage-persisted
multi-chart store (`charts[]` + `activeId` under `mtg-chart:charts` / `mtg-chart:activeId`)
with CRUD (`createChart`, `deleteChart`, `updateChart`, `setActiveId`) and share-link
reconstruction. When the app loads with a `?c=` share payload, `loadOrInit` returns a
placeholder chart plus a `pendingReconstruction` stub list; a `useEffect` batches the stubs
to Scryfall's `/cards/collection` endpoint and fills the real slots, exposing
`isReconstructing` / reconstruction error/warning state. Writes are debounced through a
persist scheduler and degrade gracefully on `QuotaExceededError`.

Undo/redo lives **in `App.tsx`**, above `useCharts`: a per-session `{ past, future }` history
stack (not persisted). `App.tsx` wraps `updateChart` so only content mutations push history
(chart-level ops and image-cache refreshes don't), and coalesces bursts of same-field edits
(e.g. a crop drag or title typing) into a single undo entry. Mutation callbacks passed down as
props are typed domain callbacks — keep mutation logic in `App`/`useCharts`, not in components.

## Styling

CSS Modules per component. Global tokens in `src/index.css`:

| Token | Value | Use |
|---|---|---|
| `--bg-base` | `#0b0c0e` | page / chart canvas background |
| `--bg-panel` | `#111317` | control panel |
| `--bg-cell` | `#1a1c21` | empty cell placeholder |
| `--accent` | `#d4a23c` | interactive / active states only |
| `--panel-width` | `260px` | sidebar width |
| `--radius-sm` | `4px` | cells, buttons |
| `--radius-md` | `8px` | canvas container |

Chart style values (`backgroundColor`, `cellGap`, `padding`, `cornerRadius`) are always applied as inline styles — never hardcoded in CSS. Numeric values passed as inline styles get `px` appended automatically by React.

## Scryfall

API base: `https://api.scryfall.com`. Do not set `User-Agent` client-side — browsers block it.

Image rendering always uses `artCrop` (the landscape art-box crop). `normal` is stored in `imageUris` for post-MVP use but never rendered. For multi-face cards (`card.card_faces`), populate `imageUris` for all faces at add time; face toggle requires no re-fetch. Skip any card missing `art_crop` on any image-bearing face.
