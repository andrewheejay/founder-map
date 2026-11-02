# Polish pass and search zoom: design

Date: 2026-11-02. Builds on main at 3968d85 (all three handoff prompts merged). Spec authority remains `CLAUDE.md`; this document amends it in the two places noted in section 6.

## Intent

Two asks from the user:

1. Close every item left open by the three code reviews (the "deferred minors" and the "standing product calls" listed in `docs/acceptance.md` and the Prompt 1 to 3 final reports).
2. When a search narrows the map (the example: typing "microsoft", whose matches all sit in the Big tech engineer cluster), the map smoothly zooms to fit the matching founders instead of leaving the user to find them.

## Goals

- Every open item is either fixed with a test, or recorded below as a ruling with the reason it stands.
- The search zoom feels like one motion, respects reduced motion, and never fights the phone pin zoom or the user's own zoom when nothing is filtered.
- No behavior the acceptance report calls PASS regresses. Suite green, `tsc` clean, build green.

## Non-goals

- No new data, no layout change, no visual redesign.
- No URL encoding of filters (the spec's optional v1.1).
- No deploy. Nothing is pushed.

## Anti-goals

- Hover must not override a pinned node (the spec's pin semantics; a reviewer called this out as a gap, it is by design and stays).
- The map must not zoom on every hover or re-render, only when the matched set changes.

## Part A: search zoom (new behavior)

**Trigger.** The set of matched founders is recomputed on every state change. When its membership changes and at least one filter is active and the set is non-empty, the map animates to fit the matched founders. When the filters become inactive (cleared, last chip removed, Clear all), the map animates back to the whole-map view (the same transform as the Fit button). Hover, pin, tab, view, sort, layer, and drawer changes never trigger a zoom. All filters count, not only the search box: a Path chip zooms to that cluster, a fund filter fits (near) the whole map.

**Fit.** The bounding box of the matched founders' positions, padded by 60 viewBox units on every side (room for labels), scaled to fit the 1100 x 840 viewBox, clamped to [0.8, 2.4]. One match gives scale 2.4 centered on that founder (the same scale the phone pin zoom uses). The transform is `translate(W/2 - cx*k, H/2 - cy*k) scale(k)` where (cx, cy) is the box center. Pure function `fitTransform(points, W, H, pad, minK, maxK)` in `src/map/geometry.ts`.

**Motion.** 420 ms with d3's default ease (cubic in-out); 0 ms under `prefers-reduced-motion`. A new fit interrupts a running one (d3 transitions on the same element replace each other), so typing letter by letter glides to each new target.

**Interactions.** A phone pin still zooms to the pinned node at 2.4; whichever happens last wins. The Fit button still fits the whole map. With no filters active the user's manual zoom is left alone. Zero matches: no zoom (the previous view stays; the empty state is visible in the table and counts).

**API.** `MapView.fitTo(points: Pt[]): void` (no-op for an empty list). `app.ts` tracks the matched ids between pushes and calls `fitTo` or `fit`.

## Part B: open items, with the decision for each

Fixed (each with a failing test first):

1. Whitespace-only search no longer counts as an active filter and shows no chip (`searchTokens(q).length`, chip label trimmed).
2. A `data-select` whose id is not in the graph is ignored (click and keyboard).
3. Layer chips get `aria-pressed` from a `pressed` argument of `chip()`, not a string replace.
4. The close-icon SVG lives once in `src/html.ts` (`CROSS_ICON`), used by the active row and the card.
5. `insightsHTML` and `badgeRowsHTML` work on a graph with no hubs and no badged founders (six bullets with "none yet" wording instead of a throw; the note degrades to the company sentence only).
6. Badge bar segments carry `aria-label="<Path>: <n> of <total> <badge> founders"` (and the OSS row `"<label>: <n> companies"`); the visible number stays.
7. The filter reducers never mutate their input (test only; the code already copies).
8. `syncControls` loses its `as never` casts (a `has(set: ReadonlySet<string>, v)` helper).
9. `src/map/map.ts` reads the dim (0.32) and filtered (0.07) opacities from `design/tokens.json` through a new `src/tokens.ts`, so the CSS variables and the SVG agree by construction.
10. `validateData` rejects a hub listed twice in one list of a founder and `secondaryPath` equal to `path`.
11. `placeLabels` uses a `for` loop and no casts.
12. tsconfig split: `tsconfig.json` type-checks `src/` with `types: ["vite/client"]` only; `tsconfig.node.json` checks `scripts/`, `tests/`, `vite.config.ts` with Node types. The build runs both.
13. The SVG keeps `role="group"`; `CLAUDE.md` 7.7 is amended to say so (the img role hides the node buttons from assistive technology, which Lighthouse flags).
14. A node hidden by a layer toggle is shown while it is the focused or pinned node, with its links and label, so a card link to a one-off hub shows the node.
15. Map keyboard: roving tabindex. One node is in the Tab order (the pinned node, else the last node the keyboard visited, else the leftmost shown node). Arrow Left/Right move to the previous/next shown node by x, Arrow Up/Down by y (clamped, no wrap), Home/End to the leftmost/rightmost. Enter/Space pin as before. Focusing a node by keyboard previews it in the card like a mouse hover (same pin rule: never while pinned); leaving the map clears the preview. `CLAUDE.md` section 6 "Keyboard" is amended. Pure helper `mapNavKey(key, current, nodes)` in `src/map/nav.ts`.
16. CSV fallback: the textarea sits in a panel with a Close button (`#csv-close`). Close or Esc hides the panel and returns focus to Copy. `copyText` keeps its signature.
17. Source column sorts by hostname (what it displays). CSV still exports the full URL.
18. `scripts/layout.ts` builds its default output path with `fileURLToPath` (exported as `DEFAULT_OUT`).
19. `tests/clipboard.test.ts` exercises the no-op branch with a document whose `URL` has no `createObjectURL`, and the real branch with stubs for `createObjectURL`, `revokeObjectURL`, and the anchor click, so jsdom prints nothing.
20. Contrast test adds accent on accentTint and accent on tableHead (both themes; lowest is 4.97).
21. Table rows: not focusable themselves; the founder name is a button (`data-row`, `aria-pressed` when selected) for keyboard and assistive tech. Clicking anywhere on a row selects; clicking the selected row (or its button) again clears, like a map node. The selected row carries `aria-current="true"`. Inactive headers omit `aria-sort` (only the sorted header has it).
22. Reduced motion is live: the map exposes `setReduceMotion(on)` and `app.ts` subscribes to the media query change; the card scroll also reads the query at the time of the scroll.
23. Sorting uses one `Intl.Collator('en', { sensitivity: 'base', numeric: true })` for the column value and the name tiebreak.
24. The header brand mark uses CSS classes for its fills (ink, surface, accent) instead of hex literals, so it follows the dark theme.
25. README says `http://localhost:5173`, which is what `npm run dev` prints.
26. `docs/acceptance.md`: the known-gaps list and the keyboard walkthrough row are updated for items 13, 15, and 21.

Rulings (stand as they are; each is reported to the user):

- Hover is ignored while a node is pinned and on touch pointers. Spec section 6 defines hover as the pointer preview and click as the pin; touch has no hover. Cost if wrong: one condition in `hoverFocusAllowed`.
- The table keeps `min-width: 1280px` and scrolls horizontally inside its card on every desktop width (the card shares the row with the 320 px side column). Thirteen columns in the ~1000 px that remain would wrap into tall rows, which is what the minimum was added to prevent. Cost if wrong: one CSS value.
- The Download CSV button stays (an addition beyond the spec's Copy; it is the more useful of the two on phones).
- The Fit button fits the whole map, not the matched set; the matched fit happens automatically when filters change.

## Constraints

- Conventions from `CLAUDE.md` section 10: one-line imperative commits with a scope prefix; no em dashes in UI copy or docs; never hand-edit `data/*.json`.
- TDD per task; the suite, `tsc --noEmit` for both configs, and `npm run build` are green at the end.
- No new runtime dependency.

## Left to the builder

File placement of the small helpers (`src/tokens.ts`, `src/map/nav.ts`), exact test names, the CSS for the CSV panel and the brand classes, and the wording of the "none yet" insight fallbacks.
