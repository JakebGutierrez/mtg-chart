# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server
npm run build     # tsc -b && vite build (must pass clean before every commit)
npm run lint      # eslint (must pass clean before every commit)
npm run format    # prettier --write .
```

There are no tests yet. `npm run build && npm run lint` is the full correctness gate.

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
- `Slot.kind: 'scryfall'` is a discriminator — reserved so a future `'custom'` kind is additive.
- Post-MVP crop fields (`cropX?`, `cropY?`, `cropScale?`) are already on `Slot` — do not remove them.
- `schemaVersion: 1` is present from day one. Bump it and write a migration in `src/utils/schemaVersion.ts` when adding non-optional fields.

## Grid rendering

`generateCellMap(rows, cols)` in `src/utils/cellMap.ts` produces the `CellMap` — the grid renderer consumes this and never computes slot positions itself. In uniform mode every cell is `{ kind: 'slot', slotIndex: i }`. The union also has `'hero'` and `'covered'` for post-MVP hybrid layout; `covered` cells must render `null` (no DOM node).

React keys in the grid must be `cell.slotIndex`, not array index. Cells render `<img>` with `object-fit: cover` (never `background-image`) — `.cell img` CSS is already in `Grid.module.css`.

## State

`App.tsx` owns `useState<Chart>`. Chart config flows down as props. Mutation callbacks (e.g. `onSlotFill`) are typed domain callbacks, not raw `setChart` — keep mutation logic in App. Reach for `useReducer` + context only when a second independent write site appears.

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

## What is not built yet (stubs only)

`useCharts`, `useScryfall`, `useExport`, `scryfall.ts`, `imageBlob.ts`, `schemaVersion.ts`, `SearchPanel`, `ContextMenu`, `NameDisplay`, `PrintingSwitcher` — all are empty placeholder files awaiting their respective phases.
