# Founder Map Prompt 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Founder Map: Table view with sorting and CSV, hash sync, keyboard support, dark theme with checked contrast, reduced motion, the 390px phone layout, an offline `scripts/layout.ts`, a Pages deploy workflow, the section 9 pass/fail report, and the README.

**Architecture:** Each feature is a pure renderer or reducer module with its own test (`src/table/table.ts`, `src/hash.ts`, `src/panel/tablist.ts`, `scripts/layout.ts`), wired through the existing store and `boot(doc)` in `src/app.ts`. CSS stays token-driven; the dark theme is the existing token overrides plus new dark status tokens, pinned by a contrast test over every text/background pair. The phone layout is one `@media (max-width: 640px)` block on top of the existing 980px stacking.

**Tech Stack:** Vite 8, TypeScript 7, D3 v7 (`d3-selection`, `d3-zoom`, `d3-shape`, `d3-polygon`; `d3-force` as a devDependency for the offline script only), Vitest 5 + jsdom.

**Spec:** `/Users/heejay/founder-map/CLAUDE.md` (sections 6 Table view / URL / Keyboard, 7.5 Phone, 7.6 Dark theme, 7.7 Accessibility, 8 build order 7-10, 9 acceptance, 10 conventions). Behavior reference `reference/founder-map-v4.html` (`TCOLS`, `sortedMatched`, `renderTable`, `csv`, `hashToId`, `select`, the force simulation at lines 496-562). Visual reference `reference/design/Table.dc.html` (table card header, header row, rows, status pill) and `reference/design/Phone.dc.html` (390px stack, 44px controls, 46px tabs, 44px close button).

## Global Constraints

- Static site, no backend, no React. Import only the D3 modules used (spec 3).
- No em dashes anywhere in UI copy; use commas, periods, or parentheses (spec 10).
- Commit messages: imperative, one line, scope prefix (`table:`, `app:`, `design:`, `scripts:`, `docs:`).
- Never hard-code founder facts; every count and label derives from `graph` (spec 4, 5.1).
- Text contrast 4.5:1 for every text/background pair in both themes, including 11px labels (spec 7.6, 7.7).
- 44px minimum touch targets on phones; control height 44 on phones (spec 7.3, 7.5).
- `npm run validate` runs in the build; `data/*.json` are never hand-edited without re-running validate (spec 10).
- Production JS under 300 KB gzipped (spec 9). Current: 42.3 KB.
- Test command for every task: `npx vitest run <files>`; gate before each commit: `npx vitest run && npx tsc --noEmit -p tsconfig.json`.

## Review Focus

1. Sorting with empty cell values (a founder with no schools or prior OSS) and ties: empty strings sort first ascending, ties break by founder name, the direction toggles on a second click of the same header and resets to ascending on a new header, and `aria-sort` names the active column only. Test in Task 1 (`sortFounders`) and Task 2 (app header clicks).
2. CSV cells that contain quotes, commas, or newlines (a bio-free export still has roles like "Co-founder; CTO until Dec 2025" and company status text): every cell is quoted, inner quotes doubled, rows joined by CRLF, the header is exactly the prototype's 23 names, and the row count equals the filtered rows. Test in Task 1 (`csv`).
3. A hash that names nothing (`#x`, `#f-nobody`, `#%E0`, `#c-temporal-extra`): `hashToId` returns null, nothing throws, the selection stays cleared, and closing a card leaves a clean URL. Test in Task 3 (`hashToId`, app boot with a bad hash).
4. Dark theme under `prefers-color-scheme: dark` with `data-theme="light"` forced: the light tokens win; and every pair, including status pills and the 11px muted labels on the table head, holds 4.5:1 in both themes. Test in Task 4 (`tests/contrast.test.ts`, tokens test on selector order).
5. Phone-only behavior never leaks to desktop: `zoomTo` runs only when the 640px query matches, `scrollIntoView` only under 980px and only on a pin (not hover), both honoring reduced motion; Enter on a table row selects without the page scrolling. Test in Task 5 (app with a matchMedia stub) and Task 2 (row keydown calls `preventDefault`).

---

### Task 1: Table model: columns, sorting, CSV

**Files:**
- Create: `src/table/table.ts`
- Modify: `src/state.ts` (add `Sort`, `DEFAULT_SORT`, `toggleSort`, `sort` on `State`), `src/types.ts` (add `SortKey`)
- Test: `tests/table.test.ts`, `tests/state.test.ts`

**Interfaces:**
- Consumes: `Graph`, `FounderNode` from `src/model.ts`; `FUND_LABEL`, `PATHS`, `STATUS_LABEL`, `BADGE_LABEL`, `OSS_LABEL` from `src/model.ts`; `esc` from `src/html.ts`.
- Produces:
  - `export type SortKey = 'name' | 'fund' | 'company' | 'path' | 'role' | 'status' | 'bigtech' | 'badges' | 'schools' | 'projects' | 'ossp' | 'last' | 'src'` (in `src/types.ts`)
  - `export interface Sort { key: SortKey; dir: 1 | -1 }`, `export const DEFAULT_SORT: Sort = { key: 'name', dir: 1 }`, `State.sort: Sort` (default `DEFAULT_SORT`), `export const toggleSort = (s: Sort, key: SortKey): Sort` (same key flips `dir`; new key gives `{ key, dir: 1 }`) in `src/state.ts`
  - `export interface Column { key: SortKey; label: string; get(f: FounderNode): string }`
  - `export const TABLE_COLUMNS: Column[]` in prototype order: Founder (name), Fund (FUND_LABEL), Company (name), Path (PATHS name), Role, Status (STATUS_LABEL), Big tech (`bigTech.join(', ')`), Badges (BADGE_LABEL joined ', ' in BADGE_ORDER), Schools (schools joined ', '), Prior OSS (priorOpenSource joined ', '), OSS product (OSS_LABEL), Company latest (`company.latest`), Source (`source`)
  - `export function sortFounders(rows: FounderNode[], sort: Sort): FounderNode[]` (case-insensitive compare of `get(f)`, ties by `name.localeCompare`, times `dir`; does not mutate input)
  - `export const CSV_HEADER: readonly string[]` = the 23 prototype names exactly: Name, Fund, Company, Vertical, Role, Status, Status note, Path, Also fits, Prior open source, Prior exit, Grad degree, Big tech alum, Big tech employers, All employers, Schools, Prior OSS projects, Company founded, Company latest round, Company status, Company open source, Est. founder age at founding, Source
  - `export function csvRow(f: FounderNode): (string | number)[]` (23 values: yes/no for the four badge columns, `; ` joins for list columns, `avgFounderAgeAtFounding ?? ''`)
  - `export function csv(rows: FounderNode[]): string` (every cell quoted with `"` doubled, cells joined `,`, lines joined `\r\n`, header first)
  - `export function tableHTML(rows: FounderNode[], focus: string | null, sort: Sort): string` returns `<thead>` + `<tbody>`: each `<th scope="col" aria-sort="ascending|descending|none">` wraps `<button type="button" class="th" data-sort="<key>">Label<span class="th__arrow" aria-hidden="true">▲|▼|</span></button>`; rows `<tr class="row[ is-selected]" data-select="<id>" tabindex="0">` with cells: name (`<span class="pdot[ pdot--square]" style="--c: var(--path-<path>)"></span>` + name), fund, company + `<div class="mini">vertical</div>`, path + `<div class="mini">also <secondary>`, role, status pill `<span class="status status--<status>">label</span>` + `<div class="mini">note</div>`, big tech or `<span class="mini">none</span>`, badges or none, schools or `n/a`, prior OSS or none, OSS label, latest + `<div class="mini">company.status</div>`, `<a href target="_blank" rel="noopener">hostname</a>` (use `hostOf` from `src/panel/card.ts`); empty: `<tr><td colspan="13" class="table__empty">No founders match these filters.</td></tr>`
  - `export function countText(n: number, sort: Sort): string` = `${n} founder${n === 1 ? '' : 's'} · sorted by ${label.toLowerCase()}`

- [ ] **Step 1: Write the failing tests**

`tests/state.test.ts` (append inside `describe('state')`):
```ts
it('toggleSort flips direction on the same key and resets on a new key', () => {
  expect(toggleSort(DEFAULT_SORT, 'name')).toEqual({ key: 'name', dir: -1 })
  expect(toggleSort({ key: 'name', dir: -1 }, 'company')).toEqual({ key: 'company', dir: 1 })
  expect(DEFAULT_STATE.sort).toEqual({ key: 'name', dir: 1 })
})
```

`tests/table.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { graph } from '../src/data'
import { CSV_HEADER, TABLE_COLUMNS, countText, csv, csvRow, sortFounders, tableHTML } from '../src/table/table'

const el = (html: string) => { const t = document.createElement('table'); t.innerHTML = html; return t }

describe('table', () => {
  it('13 columns in prototype order', () => {
    expect(TABLE_COLUMNS.map((c) => c.label)).toEqual(['Founder', 'Fund', 'Company', 'Path', 'Role', 'Status', 'Big tech', 'Badges', 'Schools', 'Prior OSS', 'OSS product', 'Company latest', 'Source'])
  })
  it('sorts case-insensitively, empty values first, ties by name, without mutating', () => {
    const rows = graph.founders
    const bySchool = sortFounders(rows, { key: 'schools', dir: 1 })
    const noSchool = rows.filter((f) => !f.schools.length).length
    expect(bySchool.slice(0, noSchool).every((f) => !f.schools.length)).toBe(true)
    expect(bySchool.slice(0, noSchool).map((f) => f.name)).toEqual(bySchool.slice(0, noSchool).map((f) => f.name).sort((a, b) => a.localeCompare(b)))
    expect(sortFounders(rows, { key: 'name', dir: -1 })[0].name).toBe(sortFounders(rows, { key: 'name', dir: 1 }).at(-1)!.name)
    expect(rows).toBe(graph.founders)
  })
  it('csv: 23-column header, every cell quoted, quotes doubled, CRLF rows', () => {
    expect(CSV_HEADER).toHaveLength(23)
    expect(CSV_HEADER[0]).toBe('Name')
    expect(CSV_HEADER[22]).toBe('Source')
    const f = { ...graph.founders[0], role: 'Co-founder; "CTO" until Dec 2025', schools: ['A, B'] }
    const text = csv([f])
    const lines = text.split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[0].split('","')).toHaveLength(23)
    expect(lines[1]).toContain('"Co-founder; ""CTO"" until Dec 2025"')
    expect(lines[1]).toContain('"A, B"')
    expect(csvRow(f)).toHaveLength(23)
    expect(csvRow(f)[9]).toBe(f.badges.includes('prior_open_source') ? 'yes' : 'no')
    expect(csv(graph.founders).split('\r\n')).toHaveLength(graph.founders.length + 1)
    expect(text).not.toContain('undefined')
  })
  it('tableHTML: sortable headers with aria-sort, focusable rows, selected row, empty state', () => {
    const t = el(tableHTML(graph.founders, 'f:dan-lorenc', { key: 'company', dir: -1 }))
    expect(t.querySelectorAll('th button[data-sort]')).toHaveLength(13)
    expect(t.querySelector('th[aria-sort="descending"] button')?.getAttribute('data-sort')).toBe('company')
    expect(t.querySelectorAll('th[aria-sort="none"]')).toHaveLength(12)
    expect(t.querySelectorAll('tbody tr.row[tabindex="0"][data-select]')).toHaveLength(graph.founders.length)
    expect(t.querySelector('tr.is-selected')?.getAttribute('data-select')).toBe('f:dan-lorenc')
    expect(t.querySelector('tr.is-selected td a')?.getAttribute('rel')).toBe('noopener')
    expect(t.querySelector('tr.is-selected .status')?.className).toContain('status--active')
    expect(el(tableHTML([], null, { key: 'name', dir: 1 })).querySelector('.table__empty')?.textContent).toBe('No founders match these filters.')
    expect(countText(1, { key: 'name', dir: 1 })).toBe('1 founder · sorted by founder')
    expect(countText(54, { key: 'last', dir: 1 })).toBe('54 founders · sorted by company latest')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/table.test.ts tests/state.test.ts`
Expected: table.test.ts fails to import `../src/table/table`; state test fails on `toggleSort` not exported.

- [ ] **Step 3: Implement `src/types.ts` `SortKey`, `src/state.ts` `Sort`/`DEFAULT_SORT`/`toggleSort`/`State.sort`, and `src/table/table.ts` per Interfaces**

The `.pdot` square variant is for Haystack founders. `hostOf` is imported from `src/panel/card.ts`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/table.test.ts tests/state.test.ts`
Expected: PASS; then `npx vitest run` all green (existing state tests still pass with the new `sort` field).

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/state.ts src/table/table.ts tests/table.test.ts tests/state.test.ts
git commit -m "table: add columns, sorting, CSV, and the table renderer"
```

---

### Task 2: Table card markup, styles, clipboard, and wiring

**Files:**
- Modify: `index.html` (replace the `#table-card` placeholder), `src/styles/components.css` (table styles, status pill, toast, csv box), `src/app.ts` (render, sort clicks, row keys, CSV copy and download)
- Create: `src/table/clipboard.ts`
- Test: `tests/shell.test.ts`, `tests/app.test.ts`, `tests/clipboard.test.ts`

**Interfaces:**
- Consumes: Task 1 exports; `swap` and the delegated click handler in `src/app.ts`; `toggleSort`.
- Produces:
  - Markup inside `#table-card`: `<div class="table__bar"><p class="table__count num" id="table-count"></p><div class="table__actions"><button type="button" class="btn btn--sm" id="csv-copy">…Copy table as CSV</button><button type="button" class="btn btn--sm" id="csv-download">…Download CSV</button></div></div><div class="table__scroll"><table class="table" id="founder-table"></table></div><textarea id="csv-box" class="csv-box" aria-label="CSV text" hidden></textarea>` plus, after `</main>`, `<div class="toast" id="toast" role="status" aria-live="polite"></div>`.
  - `export interface ClipboardLike { writeText(text: string): Promise<void> }`
  - `export async function copyText(text: string, clipboard: ClipboardLike | undefined, fallback: HTMLTextAreaElement): Promise<'copied' | 'fallback'>`: tries `clipboard.writeText`; on missing clipboard or rejection, un-hides `fallback`, sets its value, focuses and selects it, returns `'fallback'`.
  - `export function toast(el: HTMLElement, message: string, ms = 2200, timers: { set: typeof setTimeout; clear: typeof clearTimeout } = { set: setTimeout, clear: clearTimeout }): void` adds `.is-on`, removes it after `ms`, cancelling the previous timer.
  - `export function downloadText(doc: Document, filename: string, text: string): void` (anchor with `URL.createObjectURL(new Blob([text], { type: 'text/csv' }))`, click, revoke; no-op when `URL.createObjectURL` is missing).
  - Click contract additions in app.ts: `[data-sort]` → `store.set({ sort: toggleSort(sort, key) })`; `#csv-copy` → `copyText(csv(sortedRows), nav.clipboard, box)` then toast `Copied N rows as CSV` or `Select the text and copy it manually`; `#csv-download` → `downloadText(doc, 'founder-map.csv', text)`; keydown on `tr.row` Enter/Space → `ev.preventDefault()` and `store.set({ focus: id, pinned: true })`.
  - In `push`: `const rows = sortFounders([...matched], s.sort)`; `swap(doc.getElementById('founder-table'), tableHTML(rows, s.pinned ? s.focus : null, s.sort), cache)` (hover must not re-render the table: pass the focus only when pinned); `#table-count` text = `countText(rows.length, s.sort)`.
  - CSS: `.table__bar` (flex, space-between, padding 12px 16px, hairline bottom), `.table__count` 13px/600 with `small` muted, `.btn--sm` height 32, `.table__scroll` (overflow-x auto), `.table` (width 100%, min-width 960px, border-collapse collapse, 13px), `thead tr` background `var(--color-tableHead)`, `th` 11px/600 uppercase 0.06em muted padding 10px 12px (16px at both edges), `.th` reset button inheriting font, `.th__arrow` 10px, `td` padding 11px 12px hairline bottom, `.row` cursor pointer, `.row:hover` tableHead bg, `.row.is-selected` accentTint bg, `td.name` 500 nowrap with `.pdot` 8px, `.status` pill 22px high 12px/500 with `--status-*-bg/text`, `.table__empty` muted centered padding 28px, `.csv-box` fixed 16px/16px min(90vw,600px) x 200px, `.toast` fixed bottom 20px centered ink pill with surface text opacity 0 → `.is-on` opacity 1.
  - `.btn--sm` and the table bar reuse `.btn`.

- [ ] **Step 1: Write the failing tests**

`tests/clipboard.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { copyText, downloadText, toast } from '../src/table/clipboard'

describe('clipboard', () => {
  it('copies through the clipboard API when it works', async () => {
    const box = document.createElement('textarea'); box.hidden = true
    const writeText = vi.fn(() => Promise.resolve())
    expect(await copyText('a,b', { writeText }, box)).toBe('copied')
    expect(writeText).toHaveBeenCalledWith('a,b')
    expect(box.hidden).toBe(true)
  })
  it('falls back to a visible, selected textarea when the API is missing or rejects', async () => {
    const box = document.createElement('textarea'); box.hidden = true; document.body.append(box)
    expect(await copyText('a,b', undefined, box)).toBe('fallback')
    expect(box.hidden).toBe(false)
    expect(box.value).toBe('a,b')
    expect(document.activeElement).toBe(box)
    box.hidden = true
    expect(await copyText('x', { writeText: () => Promise.reject(new Error('denied')) }, box)).toBe('fallback')
    expect(box.hidden).toBe(false)
  })
  it('toast shows then hides, replacing an earlier timer', () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    toast(el, 'one'); toast(el, 'two')
    expect(el.textContent).toBe('two')
    expect(el.classList.contains('is-on')).toBe(true)
    vi.advanceTimersByTime(2300)
    expect(el.classList.contains('is-on')).toBe(false)
    vi.useRealTimers()
  })
  it('downloadText is a no-op without createObjectURL', () => {
    expect(() => downloadText(document, 'x.csv', 'a')).not.toThrow()
  })
})
```

`tests/shell.test.ts` (append a `describe('table shell')`):
```ts
it('table card has the bar, actions, scroll wrapper, csv box, and toast', () => {
  expect(document.querySelector('#table-card #table-count')).not.toBeNull()
  expect(document.querySelector('#table-card #csv-copy')?.textContent?.trim()).toBe('Copy table as CSV')
  expect(document.querySelector('#table-card #csv-download')?.textContent?.trim()).toBe('Download CSV')
  expect(document.querySelector('#table-card .table__scroll table#founder-table')).not.toBeNull()
  expect(document.querySelector('#csv-box')?.hasAttribute('hidden')).toBe(true)
  expect(document.querySelector('#toast')?.getAttribute('role')).toBe('status')
  expect(document.body.textContent).not.toMatch(/Table view arrives/)
})
```

`tests/app.test.ts` (append a `describe('table view')`; `boot` already ran in `beforeAll`):
```ts
it('renders the filtered rows, sorts on header click, selects on row click and Enter', () => {
  click('[data-view="table"]')
  expect(document.querySelectorAll('#founder-table tbody tr.row')).toHaveLength(graph.founders.length)
  expect(text('#table-count')).toBe(`${graph.founders.length} founders · sorted by founder`)
  click('#founder-table [data-sort="company"]')
  expect(q('#founder-table th[aria-sort="ascending"] button').getAttribute('data-sort')).toBe('company')
  click('#founder-table [data-sort="company"]')
  expect(q('#founder-table th[aria-sort="descending"] button').getAttribute('data-sort')).toBe('company')
  const first = q('#founder-table tbody tr.row')
  first.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  expect(q('#founder-table tr.is-selected').getAttribute('data-select')).toBe(first.getAttribute('data-select'))
  expect(text('#detail h2')).toBe(first.querySelector('td')!.textContent!.trim())
  click('#detail [data-close]')
  const second = document.querySelectorAll('#founder-table tbody tr.row')[1] as HTMLElement
  const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  second.dispatchEvent(ev)
  expect(ev.defaultPrevented).toBe(true)
  expect(q('#founder-table tr.is-selected').getAttribute('data-select')).toBe(second.getAttribute('data-select'))
  click('#detail [data-close]')
  click('[data-badge="big_tech_alum"]')
  expect(document.querySelectorAll('#founder-table tbody tr.row')).toHaveLength(graph.founders.filter((f) => f.badges.includes('big_tech_alum')).length)
  click('#clear-filters')
  click('[data-view="map"]')
})
it('copies the CSV of the sorted, filtered rows and toasts', async () => {
  const writes: string[] = []
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t: string) => { writes.push(t); return Promise.resolve() } }, configurable: true })
  click('#csv-copy')
  await new Promise((r) => setTimeout(r, 0))
  expect(writes[0].split('\r\n')).toHaveLength(graph.founders.length + 1)
  expect(writes[0].startsWith('"Name","Fund","Company"')).toBe(true)
  expect(text('#toast')).toBe(`Copied ${graph.founders.length} rows as CSV`)
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/clipboard.test.ts tests/shell.test.ts tests/app.test.ts`
Expected: clipboard import fails; shell test fails on missing `#table-count`; app test fails on zero rows.

- [ ] **Step 3: Implement the markup, `src/table/clipboard.ts`, the CSS, and the app wiring per Interfaces**

The SVG icons for the two buttons are the 14px copy and download glyphs from `Table.dc.html` lines 74-75 with `aria-hidden="true"`. Hover on the map must not re-render the table (pass `s.pinned ? s.focus : null`).

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/clipboard.test.ts tests/shell.test.ts tests/app.test.ts && npx vitest run && npx tsc --noEmit -p tsconfig.json`
Expected: all green, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add index.html src/styles/components.css src/app.ts src/table/clipboard.ts tests/clipboard.test.ts tests/shell.test.ts tests/app.test.ts
git commit -m "table: render the table card, sort headers, row selection, and CSV copy with a textarea fallback"
```

---

### Task 3: Hash sync, tab-list keys, and a selection announcer

**Files:**
- Create: `src/hash.ts`, `src/panel/tablist.ts`
- Modify: `src/app.ts`, `index.html` (`#announce` live region; drop `aria-live` from `#detail`; tabs get roving `tabindex`), `src/filters/drawer.ts` `syncControls` (tab `tabindex` 0/-1)
- Test: `tests/hash.test.ts`, `tests/tablist.test.ts`, `tests/app.test.ts`, `tests/shell.test.ts`

**Interfaces:**
- Produces:
  - `export const idToHash = (id: string): string` (`f:dan-lorenc` → `f-dan-lorenc`)
  - `export function hashToId(hash: string, has: (id: string) => boolean): string | null` (strips `#`, requires `[fcseo]-…` with length ≥ 3, maps the first char + `:` + rest, returns the id only when `has(id)`; never throws, including on `%` sequences: do not decode)
  - `export function tablistKey(key: string, index: number, count: number): number | null` (ArrowRight/ArrowLeft wrap, Home 0, End count-1, else null)
  - `export function announceText(node: AnyNode | null): string` (`Dan Lorenc selected`, `Selection cleared`)
  - app.ts: on boot, `const id = hashToId(win.location.hash, (i) => graph.byId.has(i)); if (id) store.set({ focus: id, pinned: true })`; `win.addEventListener('hashchange', …)` applying the same rule (an unknown hash with a pinned node clears it); a store subscriber `syncHash(s)` that on a pinned focus sets `location.hash` when different, and on a cleared pin with a non-empty hash calls `history.replaceState(null, '', pathname + search)`; keydown on `[role="tab"]` moves focus and selects the tab via `tablistKey`; `#announce` text = `announceText` on pin changes only.
  - index.html: `<p class="sr-only" id="announce" aria-live="polite"></p>` right after `#detail`'s opening section is NOT used; place it after `</aside>` inside `main`. `#detail` loses `aria-live`. Tabs: `tabindex="0"` on the selected tab, `tabindex="-1"` on the others, kept in sync by `syncControls`.

- [ ] **Step 1: Write the failing tests**

`tests/hash.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { graph } from '../src/data'
import { hashToId, idToHash } from '../src/hash'
const has = (id: string) => graph.byId.has(id)
describe('hash', () => {
  it('round-trips founder, company, and hub ids', () => {
    for (const id of ['f:dan-lorenc', 'c:temporal', 'e:google', 's:mit', 'o:kubernetes']) expect(hashToId('#' + idToHash(id), has)).toBe(id)
    expect(idToHash('f:dan-lorenc')).toBe('f-dan-lorenc')
  })
  it('rejects anything that names no node without throwing', () => {
    for (const h of ['', '#', '#x', '#f-', '#f-nobody', '#%E0', '#c-temporal-extra', '#f:dan-lorenc', '#-f-dan']) expect(hashToId(h, has)).toBeNull()
  })
})
```

`tests/tablist.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { announceText, tablistKey } from '../src/panel/tablist'
import { graph } from '../src/data'
describe('tablist', () => {
  it('arrow keys wrap, Home and End jump, other keys are ignored', () => {
    expect(tablistKey('ArrowRight', 2, 3)).toBe(0)
    expect(tablistKey('ArrowLeft', 0, 3)).toBe(2)
    expect(tablistKey('Home', 2, 3)).toBe(0)
    expect(tablistKey('End', 0, 3)).toBe(2)
    expect(tablistKey('Enter', 1, 3)).toBeNull()
  })
  it('announces the selected node by name', () => {
    expect(announceText(graph.byId.get('f:dan-lorenc')!)).toBe('Dan Lorenc selected')
    expect(announceText(null)).toBe('Selection cleared')
  })
})
```

`tests/shell.test.ts` (append):
```ts
it('announcer exists, detail is not live, and only the selected tab is in the tab order', () => {
  expect(document.querySelector('main #announce')?.getAttribute('aria-live')).toBe('polite')
  expect(document.querySelector('#detail')?.hasAttribute('aria-live')).toBe(false)
  expect([...document.querySelectorAll('#tabs [role="tab"]')].map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1'])
})
```

`tests/app.test.ts` (append `describe('hash and keyboard')`):
```ts
it('mirrors the pinned selection in the hash and clears it on close', () => {
  q('[data-id="c:temporal"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))
  expect(location.hash).toBe('#c-temporal')
  expect(text('#announce')).toBe('Temporal selected')
  click('#detail [data-close]')
  expect(location.hash).toBe('')
  expect(text('#announce')).toBe('Selection cleared')
})
it('follows hashchange, ignores unknown hashes, and hover does not touch the hash', () => {
  location.hash = '#f-dan-lorenc'
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  expect(text('#detail h2')).toBe('Dan Lorenc')
  location.hash = '#f-nobody'
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  expect(text('#detail h2')).toBe('Pick any dot or station')
  q('[data-id="c:temporal"]').dispatchEvent(new Event('pointerenter'))
  expect(location.hash).toBe('')
  q('[data-id="c:temporal"]').dispatchEvent(new Event('pointerleave'))
})
it('arrow keys move between tabs and select them', () => {
  const tabs = [...document.querySelectorAll<HTMLElement>('#tabs [role="tab"]')]
  tabs[0].focus()
  tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  expect(document.activeElement).toBe(tabs[1])
  expect(tabs[1].getAttribute('aria-selected')).toBe('true')
  expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '0', '-1'])
  tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
  expect(document.activeElement).toBe(tabs[2])
  tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  expect(document.activeElement).toBe(tabs[0])
})
```
Note: a fresh `boot` is not needed; the hash tests must run after the existing ones and leave `location.hash` empty and the card closed.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/hash.test.ts tests/tablist.test.ts tests/shell.test.ts tests/app.test.ts`
Expected: hash and tablist imports fail; shell fails on `#announce`; app fails on `location.hash` staying `''`.

- [ ] **Step 3: Implement `src/hash.ts`, `src/panel/tablist.ts`, the markup, `syncControls` tab tabindex, and the app wiring per Interfaces**

Boot-time hash selection happens before the first `push`. `syncHash` compares `win.location.hash` with `'#' + idToHash(id)` before assigning so hashchange does not loop.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/hash.test.ts tests/tablist.test.ts tests/shell.test.ts tests/app.test.ts && npx vitest run && npx tsc --noEmit -p tsconfig.json`
Expected: all green, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/hash.ts src/panel/tablist.ts src/app.ts index.html src/filters/drawer.ts tests/hash.test.ts tests/tablist.test.ts tests/shell.test.ts tests/app.test.ts
git commit -m "app: mirror the selection in the hash, add tab-list keys, and announce selections"
```

---

### Task 4: Dark theme contrast and reduced motion

**Files:**
- Modify: `design/tokens.json` (`dark.status`), `scripts/tokens.ts` (`Tokens.dark.status`, emit), `src/styles/tokens.css` (regenerate), `src/styles/components.css` (any literal color that does not swap in dark; the brand mark in `index.html` keeps its ink/white fills, it is a logo)
- Test: `tests/contrast.test.ts`, `tests/tokens.test.ts`

**Interfaces:**
- Produces: `dark.status` tokens `active { bg: "#123B2E", text: "#8EE0BF" }`, `role_changed { bg: "#3E2A10", text: "#F2C48A" }`, `left { bg: "#262B33", text: "#B4BCC7" }` (adjust until the contrast test passes); `tokensToCss` emits `--status-<k>-bg/text` inside both dark selectors.
- Shared test helper: `tests/helpers/contrast.ts` exporting `hex`, `luminance`, `contrast`, `mix` (move the copies out of `tests/tabs.test.ts`).

- [ ] **Step 1: Write the failing tests**

`tests/contrast.test.ts`:
```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrast, hex } from './helpers/contrast'
const t = JSON.parse(readFileSync(new URL('../design/tokens.json', import.meta.url), 'utf8'))
const themes = [
  { name: 'light', c: t.color, path: t.path, status: t.status },
  { name: 'dark', c: t.dark.color, path: t.dark.path, status: t.dark.status },
]
describe('contrast', () => {
  for (const th of themes) {
    it(`${th.name}: every text/background pair is at least 4.5:1`, () => {
      const pairs: [string, string, string][] = [
        ['ink on surface', th.c.ink, th.c.surface], ['ink on page', th.c.ink, th.c.page], ['ink on tableHead', th.c.ink, th.c.tableHead], ['ink on accentTint', th.c.ink, th.c.accentTint],
        ['muted on surface', th.c.muted, th.c.surface], ['muted on page', th.c.muted, th.c.page], ['muted on tableHead', th.c.muted, th.c.tableHead], ['muted on accentTint', th.c.muted, th.c.accentTint],
        ['accent on surface', th.c.accent, th.c.surface], ['accent on page', th.c.accent, th.c.page], ['surface on ink', th.c.surface, th.c.ink], ['surface on accent', th.c.surface, th.c.accent],
        ...Object.entries(th.status).map(([k, v]: [string, any]) => [`status ${k}`, v.text, v.bg] as [string, string, string]),
        ...Object.entries(th.path).map(([k, v]) => [`cluster label ${k} on surface`, v as string, th.c.surface] as [string, string, string]),
      ]
      for (const [label, fg, bg] of pairs) expect(contrast(hex(fg), hex(bg)), label).toBeGreaterThanOrEqual(4.5)
    })
  }
})
```
Note: cluster labels are path-colored 13px/700 text on the surface; if any dark path color fails that pair, darken the surface pair only via the label stroke token in CSS, never the path color (spec 7.1), and record a ruling.

`tests/tokens.test.ts` (append): `expect(css).toMatch(/:root\[data-theme="dark"\]\s*\{[^}]*--status-active-bg: #123B2E;/)` and the same inside the `prefers-color-scheme` block; plus `expect(css.indexOf(':root[data-theme="dark"]')).toBeLessThan(css.indexOf('@media (prefers-color-scheme: dark)'))` and that the media block targets `:root:not([data-theme="light"])`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/contrast.test.ts tests/tokens.test.ts tests/tabs.test.ts`
Expected: contrast test fails on `t.dark.status` undefined; tokens test fails on the missing dark status declarations.

- [ ] **Step 3: Add `dark.status` to tokens.json, extend `scripts/tokens.ts`, run `npm run tokens`, move the helper into `tests/helpers/contrast.ts`, and re-point `tests/tabs.test.ts` at it**

Then grep `src/styles/*.css` for literal hex colors; every one found becomes a token or a `var()`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/contrast.test.ts tests/tokens.test.ts tests/tabs.test.ts && npx vitest run`
Expected: all green. Report every pair's ratio in the ledger line (the test's labels), lowest first.

- [ ] **Step 5: Commit**

```bash
git add design/tokens.json scripts/tokens.ts src/styles/tokens.css src/styles/components.css tests/contrast.test.ts tests/tokens.test.ts tests/tabs.test.ts tests/helpers/contrast.ts
git commit -m "design: add dark status tokens and pin every text pair at 4.5:1 in both themes"
```

---

### Task 5: Phone layout (390px), zoom to selection, scroll into view

**Files:**
- Modify: `src/styles/components.css` (`@media (max-width: 640px)` block; 980px block additions), `src/map/map.ts` (`zoomTo`), `src/app.ts` (phone behaviors), `design/tokens.json` + `src/styles/tokens.css` (`space.tabHPhone: 46`, `space.closeBtnPhone: 44`, `space.rowMinH: 44`)
- Test: `tests/shell.test.ts`, `tests/map.test.ts`, `tests/app.test.ts`, `tests/tokens.test.ts`

**Interfaces:**
- Produces:
  - `MapView.zoomTo(id: string, scale?: number): void` (default scale 2.4; centers the node using `zoomIdentity.translate(cx - x*k, cy - y*k).scale(k)` where `cx, cy` are half the viewBox; transition `duration`).
  - app.ts: `const phone = win?.matchMedia?.('(max-width: 640px)')`, `const narrow = win?.matchMedia?.('(max-width: 980px)')`; a store subscriber watching `pinned && focus` transitions: when a pin starts or changes, `if (phone?.matches) map.zoomTo(id)`; `if (narrow?.matches) doc.getElementById('detail')?.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' })`. Hover never triggers either.
  - CSS at ≤980 (existing block) adds: `.select` height 44; `.card__close` 44x44; `.cluster-row` min-height 44; `.tab` height `--space-tabHPhone` (46); `.drawer` grid single column.
  - CSS at ≤640: `.toolbar { display: grid; grid-template-columns: 1fr auto; gap: 10px }`, `.search { grid-column: 1 / -1 }`, `#fund-seg { grid-column: 1 / -1; display: flex }`, `.seg button { flex: 1 1 0 }`, `#view-seg { display: flex; min-width: 0 }`, `.toolbar__spacer { display: none }`, `.btn { height: 46px }`, `.site-header__inner` stacks (`flex-direction: column; align-items: flex-start; gap: 6px`), `.main { gap: 16px }`, `.wrap { padding-inline: 16px }`, `.tabs .tab { flex: 1 1 0 }`, `.legend` gap 6px 14px.

- [ ] **Step 1: Write the failing tests**

`tests/map.test.ts` (append):
```ts
it('zoomTo centers a node at the given scale', () => {
  const { svg, map } = mount({ reduceMotion: true })
  map.zoomTo('f:dan-lorenc', 2)
  const n = graph.byId.get('f:dan-lorenc')!
  const tf = svg.querySelector('g.viewport')!.getAttribute('transform')!
  const [, tx, ty, k] = /translate\(([-\d.]+),([-\d.]+)\) scale\(([\d.]+)\)/.exec(tf)!.map(Number)
  expect(k).toBe(2)
  expect(tx).toBeCloseTo(550 - n.x * 2, 3)
  expect(ty).toBeCloseTo(420 - n.y * 2, 3)
})
```
(Check the viewport group's class in `map.ts` and use its real selector; with `reduceMotion` the transition duration is 0 so d3-transition applies the transform synchronously after `vi.useFakeTimers`? No: use `svg.transition` only when `duration > 0`; with duration 0 call `zoomBehavior.transform` directly so the test sees the attribute immediately.)

`tests/app.test.ts` (append `describe('phone behaviors')`): stub `window.matchMedia = (q) => ({ matches: q.includes('640') || q.includes('980'), addEventListener() {} })` BEFORE a second `boot` on a fresh document copy? Booting twice on the same document double-binds listeners. Instead create the second document with jsdom's `new JSDOM()`? Simplest: in this describe, call `boot(doc2)` where `doc2 = new DOMParser().parseFromString(indexHtml, 'text/html')`; `doc2.defaultView` is null in jsdom for parsed documents, so `boot` must read `win = doc.defaultView ?? window`. Then:
```ts
it('zooms to the pinned node and scrolls the card into view only on narrow screens', () => {
  const calls: string[] = []
  ;(window as any).matchMedia = (q: string) => ({ matches: true, media: q })
  const doc2 = new DOMParser().parseFromString(indexHtml, 'text/html')
  ;(doc2.getElementById('detail') as any).scrollIntoView = () => calls.push('scroll')
  boot(doc2)
  const node = doc2.querySelector('[data-id="f:dan-lorenc"]')!
  node.dispatchEvent(new Event('pointerenter'))
  expect(calls).toEqual([])
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  expect(calls).toEqual(['scroll'])
  expect(doc2.querySelector('#map g.viewport')!.getAttribute('transform')).toMatch(/scale\(2\.4\)/)
  ;(window as any).matchMedia = () => ({ matches: false })
})
```

`tests/shell.test.ts` (append): the 640px block exists; within it `.toolbar` has `grid-template-columns: 1fr auto`, `#fund-seg` spans `1 / -1`; the 980 block sizes `.card__close` to `var(--space-closeBtnPhone)`, `.cluster-row` `min-height: var(--space-rowMinH)`, `.select` to `var(--space-controlHPhone)`, `.tab` to `var(--space-tabHPhone)`. Use the `rules()` helper (walks `@media`); assert on `r.selector`/`r.body` pairs found inside the 640 block by scanning `css.slice(css.indexOf('@media (max-width: 640px)'))`.

`tests/tokens.test.ts`: `--space-tabHPhone: 46px`, `--space-closeBtnPhone: 44px`, `--space-rowMinH: 44px`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/map.test.ts tests/app.test.ts tests/shell.test.ts tests/tokens.test.ts`
Expected: `zoomTo` undefined; phone test fails on `calls` empty and no scale; shell/tokens fail on missing rules/tokens.

- [ ] **Step 3: Implement tokens, `zoomTo`, the app phone subscriber, and the CSS per Interfaces**

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/map.test.ts tests/app.test.ts tests/shell.test.ts tests/tokens.test.ts && npx vitest run && npx tsc --noEmit -p tsconfig.json`
Expected: all green, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add design/tokens.json src/styles/tokens.css src/styles/components.css src/map/map.ts src/app.ts tests/map.test.ts tests/app.test.ts tests/shell.test.ts tests/tokens.test.ts
git commit -m "design: phone layout at 390px with zoom-to-selection and 44px targets"
```

---

### Task 6: `scripts/layout.ts` (offline force simulation)

**Files:**
- Create: `scripts/layout.ts`
- Modify: `package.json` (`"layout": "tsx scripts/layout.ts"`, devDependencies `d3-force` + `@types/d3-force`)
- Test: `tests/layout.test.ts`

**Interfaces:**
- Consumes: `buildGraph`-independent inputs: `FounderRecord[]`, `CompanyRecord[]`; `hubRefs`, `slug`, `BIG_TECH` from `src/model.ts`; `hubRadius` from `src/map/geometry.ts`.
- Produces:
  - `export const ANCHORS: Record<PathKey, [number, number]>` = big_tech_engineer [290, 470], repeat_founder [580, 690], business_operator [870, 560], young_builder [800, 220], academic [410, 165]
  - `export function computeLayout(founders: FounderRecord[], companies: CompanyRecord[]): Layout`: builds founder/company/hub sim nodes exactly as the prototype lines 496-562 (founder target = anchor blended 26% toward the secondary anchor; initial spiral `i * 2.39996`, radius `14 + (i % 5) * 6`; companies and shared hubs start at the mean of their members with the cosine/sine jitter; forces link 30/62 with strengths 0.42 / `0.5 / max(2, deg)`, charge -75 / -55 / `-95 - deg * 4` with `distanceMax(250)`, x/y toward target 0.27 (founders) / 0.012 (hubs) / 0 (companies), collide 15 / 15 / `hubRadius + 13` with 2 iterations; 500 ticks; fit with margin 76 and `k = min(…, 1.45)`; one-off hubs placed 36px from their founder at the prototype's angle rule, clamped to 16px inside the box; every coordinate rounded to 0.1); returns `{ viewBox: [0, 0, 1100, 840], note, nodes }` with the note text from the current `data/layout.json` updated to say "scripts/layout.ts".
  - CLI (`main()` guarded like `scripts/tokens.ts`): reads `data/founders.json` and `data/companies.json`, writes `data/layout.json` with 1-space indentation (match the current file), prints the node count. `--out <path>` writes elsewhere (used by the test and by anyone previewing a change).

- [ ] **Step 1: Write the failing test**

`tests/layout.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { companies, founders, layout as shipped } from '../src/data'
import { ANCHORS, computeLayout } from '../scripts/layout'
import { hubRefs } from '../src/model'
describe('layout script', () => {
  const out = computeLayout(founders, companies)
  it('places every founder, company, and hub inside the viewBox', () => {
    const ids = new Set([...founders.map((f) => f.id), ...companies.map((c) => c.id), ...founders.flatMap((f) => hubRefs(f).map((r) => r.id))])
    expect(Object.keys(out.nodes).sort()).toEqual([...ids].sort())
    expect(Object.keys(out.nodes).sort()).toEqual(Object.keys(shipped.nodes).sort())
    for (const p of Object.values(out.nodes)) {
      expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(1100)
      expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(840)
      expect(p.x).toBe(Math.round(p.x * 10) / 10)
    }
    expect(out.viewBox).toEqual([0, 0, 1100, 840])
  })
  it('is deterministic and keeps each path cluster near its anchor', () => {
    expect(computeLayout(founders, companies)).toEqual(out)
    for (const [k, [ax, ay]] of Object.entries(ANCHORS)) {
      const fs = founders.filter((f) => f.path === k)
      const cx = fs.reduce((s, f) => s + out.nodes[f.id].x, 0) / fs.length
      const cy = fs.reduce((s, f) => s + out.nodes[f.id].y, 0) / fs.length
      expect(Math.hypot(cx - ax, cy - ay), k).toBeLessThan(160)
    }
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm i -D d3-force @types/d3-force && npx vitest run tests/layout.test.ts`
Expected: FAIL, cannot resolve `../scripts/layout`.

- [ ] **Step 3: Implement `scripts/layout.ts` per Interfaces and add the npm script**

Do not overwrite `data/layout.json` in this task: run `npx tsx scripts/layout.ts --out /private/tmp/claude-501/-Users-heejay/46eb2a56-76c7-4332-9b52-a15b4739945d/scratchpad/layout.json` and compare the cluster centroids with the shipped file in the ledger. The shipped positions stay (the About tab and the Chrome checks were made against them); regenerating is a data change for the user to trigger.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/layout.test.ts && npx vitest run && npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: all green; build output JS still well under 300 KB gzipped (d3-force is not imported by `src/`).

- [ ] **Step 5: Commit**

```bash
git add scripts/layout.ts package.json package-lock.json tests/layout.test.ts
git commit -m "scripts: add layout.ts to re-run the force simulation offline"
```

---

### Task 7: Deploy workflow, README, acceptance report, and Chrome verification

**Files:**
- Create: `.github/workflows/pages.yml`, `README.md`, `docs/acceptance.md`
- Modify: `vite.config.ts` (`base: process.env.BASE_PATH ?? '/'`), `tests/shell.test.ts` (README has no em dashes and names the three npm scripts)

- [ ] **Step 1: Write the failing test**

`tests/shell.test.ts` (append):
```ts
it('README documents the data model, adding a founder or fund, and regenerating the layout', () => {
  const md = read('README.md')
  for (const s of ['npm run validate', 'npm run layout', 'npm run build', 'founders.json', 'companies.json', 'layout.json', 'Add a founder', 'Add a fund']) expect(md).toContain(s)
  expect(md).not.toMatch(/—/)
})
```
Run: `npx vitest run tests/shell.test.ts` → Expected: FAIL (no README.md).

- [ ] **Step 2: Write `README.md`**

Sections: what it is (one paragraph, link to the spec), run it (`npm i`, `npm run dev`, `npm test`, `npm run build`), data model (the three files, id rules, derived badges and hubs, one table per file summarizing fields from spec section 4), Add a founder (edit `founders.json` with every field, company must exist, run `npm run validate`, run `npm run layout` because a new id needs a position, commit the source URL with the change), Add a fund (extend `Fund` in `src/types.ts`, `FUND_LABEL` in `src/model.ts`, the fund segmented control in `index.html`, the node shape rule in `src/map/map.ts` and the legend; then data), Regenerate the layout (`npm run layout`, when to run it, that positions are static at runtime), Deploy (GitHub Pages workflow: push to `main`, set Pages source to GitHub Actions; `BASE_PATH=/founder-map/` for a project site; Vercel: build command `npm run build`, output `dist`), Acceptance (link to `docs/acceptance.md`). No em dashes.

- [ ] **Step 3: Write `.github/workflows/pages.yml`** (actions/checkout v4, setup-node 22 with npm cache, `npm ci`, `BASE_PATH=/${{ github.event.repository.name }}/ npm run build`, upload-pages-artifact from `dist`, deploy-pages; permissions pages write, id-token write) and set `base` in `vite.config.ts`. Run: `BASE_PATH=/founder-map/ npx vite build && grep -c '/founder-map/assets' dist/index.html` → Expected: `1` or more.

- [ ] **Step 4: Chrome verification and `docs/acceptance.md`**

Dev server at `http://127.0.0.1:5173`. For each section 9 item record pass/fail with evidence (command output, screenshot id, or computed values):
1. `npm run validate` passes; counts match 5.1 and are computed (cite `tests/model.test.ts`).
2. Positions identical on refresh (compare `[data-id="f:dan-lorenc"]` transform across two loads).
3. Every section 6 feature on desktop and at 390px (use the iframe harness from the workspace at 390px: toolbar stacks, fund control full width, Map/Table + Filters row, map card, legend, card below the map, tabs full width; selecting a node zooms the map and scrolls the card).
4. Dan Lorenc: ring on his node, the nine neighbors at opacity 1, the rest dimmed (read `style.opacity` of each).
5. Big tech alum + Google: `10 of 54 founders · 6 of 24 companies` (desktop and table view row count 10).
6. Lighthouse accessibility: `npx vite preview --port 4173` then `npx lighthouse http://127.0.0.1:4173 --only-categories=accessibility --chrome-flags="--headless=new" --output=json --output-path=<scratchpad>/lh.json` and read `categories.accessibility.score` (expect 1); keyboard-only walkthrough in Chrome (Tab through toolbar, drawer, map nodes with Enter, tabs with arrows, table rows with Enter; record the stop sequence); dark theme: set `data-theme="dark"`, screenshot, and cite the contrast test.
7. Build size from `npm run build` (gzip figure).
Then write `docs/acceptance.md` with a table: item, result, evidence. Fix anything that fails with TDD and commit with the owning scope.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/acceptance.md .github/workflows/pages.yml vite.config.ts tests/shell.test.ts
git commit -m "docs: add README, acceptance report, and the Pages deploy workflow"
```
