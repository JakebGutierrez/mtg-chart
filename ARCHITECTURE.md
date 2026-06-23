# MTG Chart — Architecture

## Overview

Single-page app: Vite + React + TypeScript, static deploy (Vercel).
No backend. All state in localStorage.

---

## Folder Structure

```
src/
  components/
    ControlPanel/       # Left sidebar — all chart controls
    Grid/               # Grid renderer + cell components
    SearchPanel/        # Scryfall search bar + results
    PrintingSwitcher/   # Modal for alternate printings
    ContextMenu/        # Right-click menu
    NameDisplay/        # Sidebar and overlay name renderers
  hooks/
    useCharts.ts        # Multi-chart CRUD + localStorage sync
    useScryfall.ts      # Debounced search, printings fetch, AbortController
    useExport.ts        # Blob pre-fetch, preflight, canvas export
  types/
    chart.ts            # Chart, Slot, CellMap, and enums
  utils/
    scryfall.ts         # API URL builders, response normalisation, art_crop filter
    imageBlob.ts        # fetch-as-blob + object URL helpers
    cellMap.ts          # CellMap generation (uniform) and traversal utilities
    schemaVersion.ts    # Migration runner (v1 → vN)
```

---

## Data Model (schemaVersion: 1)

```typescript
interface Chart {
  id: string                          // uuid
  name: string
  schemaVersion: number               // integer, currently 1
  gridRows: number
  gridCols: number
  layout: "uniform" | "hybrid"        // only "uniform" built in MVP
  displayMode: "landscape" | "square" // only "landscape" built in MVP
  nameDisplayMode: "none" | "sidebar" | "overlay"
  title: string
  backgroundColor: string             // hex
  cellGap: number                     // px
  padding: number                     // px
  cornerRadius: number                // px
  slots: Array<Slot | null>           // visual-cell-indexed, row-major, sparse
}

interface Slot {
  kind: "scryfall"                    // discriminator; reserved for future "custom"
  scryfallId: string                  // stable identity for re-fetch
  oracleId: string
  cardName: string
  setCode: string
  collectorNumber: string
  layout: string                      // Scryfall layout field (transform, modal_dfc, etc.)
  selectedFaceIndex: 0 | 1           // MVP supports 2-face cards only
  imageUris: Array<{                  // indexed by face; length 1 for single-face cards
    artCrop: string
    normal: string
  }>
  // imageUris is refreshable cache, not permanent identity.
  // imageUris[selectedFaceIndex].artCrop is the rendered and exported image.
  // normal is stored for the post-MVP manual framing feature; unused in MVP.
  // All faces populated at add time and at printing-switch time — face toggle
  // requires no re-fetch.
  // If artCrop 404s during export: re-fetch by scryfallId, update cache, persist.
}
```

### Reserved for post-MVP (non-breaking, bump schemaVersion when added)

Per-slot crop/frame for manual framing and square mode:
```typescript
cropX?: number      // 0–1 normalised horizontal offset, default 0.5
cropY?: number      // 0–1 normalised vertical offset, default 0.5
cropScale?: number  // 1.0 = fit; >1 = zoom in, default 1.0
```

Migration: add `{ cropX: 0.5, cropY: 0.5, cropScale: 1.0 }` to all existing slots —
equivalent to the MVP `object-fit: cover` behaviour.

Custom items:
```typescript
// slot.kind = "custom" + localImageDataUrl?: string
```
`kind` is reserved now so adding "custom" is additive, not a migration.

### schemaVersion migration

On app load: if any stored chart has `schemaVersion < currentSchemaVersion`, run the
migration chain (v1→v2→…→current), filling missing fields with their defaults, then
persist before rendering.

### MVP cell rendering

Cells use `<img>` with `object-fit: cover` and `overflow: hidden` — **not** CSS
`background-image`. This is required so post-MVP crop transforms (CSS translate/scale)
can be applied to the same element without restructuring.

---

## Grid: CellMap Abstraction

The central seam between uniform and hybrid layouts.

```typescript
type CellDef =
  | { kind: "slot";    slotIndex: number }
  | { kind: "hero";    slotIndex: number; rowSpan: number; colSpan: number }
  | { kind: "covered" }                   // occupied by adjacent hero; not a drop target

type CellMap = CellDef[]                  // length = rows × cols, row-major
```

The grid renderer consumes a CellMap — it never computes slot positions itself.
In uniform mode (MVP), CellMap is trivially generated: cell `i` → `{ kind: "slot", slotIndex: i }`.

**Hero-ness belongs to board positions, not slot contents.** Dragging a card out of a
hero cell moves the card's Slot data; the hero position stays hero and becomes empty.
Drag operations move card data only — layout roles never change.

`slots` is **visual-cell-indexed**. Covered positions remain `null` in `Chart.slots`.

Derived semantics:
- Valid drop targets: `kind !== "covered"`
- "Next empty slot": first `slotIndex` where `slots[slotIndex] === null` and `kind !== "covered"`
- Capacity: `cellMap.filter(c => c.kind !== "covered").length`
- Numbering: follows `slotIndex` order, skips `"covered"` cells
- CellMap is memoized on `[gridRows, gridCols, heroConfig]`

### Grid resize guard

Shrink is blocked if any occupied slot would be out-of-bounds in the new layout.
For each non-null slot at index `i`:
```
row = floor(i / currentCols)
col = i % currentCols
blocked if row >= newRows OR col >= newCols
```
This catches sparse occupancy (e.g. single card in the bottom-right of a 3×3,
shrinking to 2×2) — not just total card count.

### Post-MVP: Hybrid hero layout

Add `heroConfig?: Array<{ row: number; col: number; rowSpan: number; colSpan: number }>`
to `Chart`. `cellMap.ts` generates the CellMap from this config (marking covered cells,
assigning hero slotIndices, renumbering the rest sequentially). The grid renderer,
export, DnD semantics, and "next empty" logic are all already correct because they
filter on `kind !== "covered"` — no changes needed in those layers.

---

## CORS & Export Strategy

**Choice: client-side blob fetch + canvas 2D API rendering. Pure static deploy.**

Scryfall's image CDN (`cards.scryfall.io`) currently responds with
`Access-Control-Allow-Origin: *`. This is operational behaviour, not a contractual
guarantee. Risk: if Scryfall tightens CORS, a single Vercel serverless proxy function
is the fix — no rewrite required.

### Export flow (`useExport.ts`)

**Step 1 — Platform-aware pixel-budget preflight**

```typescript
const isIOS =
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// Dimensions derived from chart config (not DOM measurements — must be deterministic)
const sidebarWidth = nameDisplayMode === 'sidebar'
  ? measured via ctx.measureText() on a scratch canvas after fonts.ready
  : 0
const titleHeight = title ? titleFontSize * 1.5 : 0

const exportWidth  = (cols * cellW + (cols-1) * gap + 2 * padding + sidebarWidth) * scale
const exportHeight = (rows * cellH + (rows-1) * gap + 2 * padding + titleHeight)  * scale

// Desktop: 8,192px per side (conservative for Chrome/Firefox/Edge/Safari 15.4+)
// iOS: 3,000,000 total pixels (conservative floor for all iOS devices)
// Note: total-area limits can still be hit on low-memory desktop hardware at extreme
// grid sizes; canvas creation failure is caught in Step 4.
if (isIOS) {
  if (exportWidth * exportHeight > 3_000_000) {
    // offer 1× — if still over, hard error
  }
} else {
  if (exportWidth > 8192 || exportHeight > 8192) {
    // offer 1× — if still over, hard error: "Grid is too large to export.
    // Reduce grid size or cell dimensions."
  }
}
```

**Step 2 — Pre-fetch images as blobs**
```
fetch(artCropUrl, { mode: 'cors' }) → Blob → URL.createObjectURL()
On 404: re-fetch card by scryfallId → re-derive artCrop → update Slot.imageUris, persist
If still fails: abort export, show error naming the card. Never produce a partial image.
```

**Step 3 — Load images**
```
Create HTMLImageElement per blob URL.
Await img.decode() for all.
```

**Step 4 — Draw to canvas**
```typescript
const canvas = document.createElement('canvas')
canvas.width = exportWidth
canvas.height = exportHeight
const ctx = canvas.getContext('2d')
if (!ctx) throw new Error('Canvas unavailable — device may be low on memory.')
ctx.scale(scale, scale)   // all subsequent drawing uses CSS pixel coordinates

await document.fonts.ready

// Draw: background, cells (cover-crop drawImage with roundRect clip), title, name display
```

Cover-crop math (equivalent to `object-fit: cover`):
```
if srcAspect > dstAspect:  sh=imgH, sw=imgH*dstAspect, sx=(imgW-sw)/2, sy=0
else:                       sw=imgW, sh=imgW/dstAspect, sx=0, sy=(imgH-sh)/2
ctx.drawImage(img, sx, sy, sw, sh, cellX, cellY, cellW, cellH)
```

**Step 5 — Cleanup (always)**
```typescript
finally { blobUrls.forEach(url => URL.revokeObjectURL(url)) }
```

**Step 6 — Download**
```typescript
canvas.toBlob((blob) => {
  if (!blob) {
    showExportError('Export failed — try 1× scale or a smaller grid.')
    return
  }
  triggerDownload(blob)
}, 'image/png')
```

### Export image source: `artCrop`

`artCrop` is the only Scryfall image that shows the correct landscape art-box crop.
`normal` and `large` are full portrait cards — cover-crop math on them would crop to
the vertical midpoint of the card (the text box area), not the art.

Known limitation: `artCrop` is lower resolution than `normal`/`large`. Large cells on
small grids (e.g. 2×2) will show interpolation. This is the correct tradeoff for MVP.
`normal` is stored in `imageUris` now so the post-MVP manual framing path has it
available without a schema change.

### Export defaults

| Setting       | Default                               |
|---------------|---------------------------------------|
| Scale         | 2× (1× offered if over pixel budget)  |
| Image source  | `artCrop` for all tiles               |
| Background    | `chart.backgroundColor` (`#0b0c0e`)  |
| Padding       | `chart.padding` (default 16px)        |
| Title         | Rendered above grid if non-empty      |
| Name display  | Matches active `nameDisplayMode`      |
| Control UI    | Not included in export                |

**True print-resolution export (post-MVP).** 300 DPI for large grids would exceed
canvas area limits on iOS and be very slow on mobile. The print path would need to
tile the canvas and stitch. Do not attempt as default.

---

## Scryfall API

Endpoints:
```
Search:     GET /cards/search?q={query}+lang:en+-is:digital+-t:token+-t:emblem
Printings:  GET /cards/search?q=oracleId:{id}+lang:en+-is:digital&unique=prints
Re-fetch:   GET /cards/{scryfallId}   (on 404 artCrop during export only)
```

All search requests:
- `AbortController`: cancel in-flight request when a new query fires
- Stale-response guard: discard results if query no longer matches current input
- 429: show "Too many requests — please wait." No auto-retry in MVP
- 300ms debounce
- Filter: skip any card/printing missing `art_crop` for **any** image-bearing face
  (check all entries in `card_faces`, not just face 0)

Printing switch: when a user selects a new printing from the modal, the card data for
that printing is already in the modal's result set — extract `imageUris` for all faces
from it directly. No second fetch needed.

---

## Post-MVP Integration Points (priority order)

1. **Hybrid hero layout** — add `heroConfig` array to `Chart`; generate non-trivial
   CellMap in `cellMap.ts`; renderer, export, and DnD unchanged.

2. **Drag-to-move / swap cells** — `draggable` on filled cells, `onDrop` on any cell.
   One new callback `handleSlotSwap(from, to)` in `App.tsx`: move if target empty, swap
   if filled. CellMap semantics already correct — drag moves card data only, layout roles
   unchanged. No data model change needed. ~30–40 lines MVP, no animation required.

3. **Manual drag-to-frame + square mode** — add `cropX`/`cropY`/`cropScale` to `Slot`;
   export applies transform to canvas draw call using `large` image URI (already stored).
   Requires `<img>` element in live UI (already mandated).

3. **Decklist import** — parse MTGO format (`4x Lightning Bolt (M20)`); batch Scryfall
   lookups by set code + collector number.

4. **URL-encoded share links** — serialise `Chart` to base64 query param.

5. **Custom items** — `slot.kind = "custom"` + `localImageDataUrl`; no Scryfall fetch
   path. `kind` discriminator is already in place.

6. **Supabase backend** — swap `useCharts` localStorage calls for API calls; schema is
   self-contained and portable.

7. **Font selection** — requires `@font-face` data URLs available before canvas draw;
   `await document.fonts.ready` hook already in export flow.

8. **Standalone numbering toggle** — additive UI control; no model change.

9. **True print-resolution export** — canvas tile-and-stitch; significant new code.
