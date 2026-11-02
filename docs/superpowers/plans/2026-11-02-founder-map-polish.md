# Founder Map Polish and Search Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every open review item from Prompts 1 to 3 and make the map zoom smoothly to fit the founders a search or filter matches.

**Architecture:** Small, test-first edits across the existing modules plus three new pure helpers: `fitTransform` (geometry), `mapNavKey` (map keyboard), and `src/tokens.ts` (opacities from `design/tokens.json`). `app.ts` tracks the matched set between pushes and asks the map to fit it; the map owns the transition. Table rows become click targets with a real button for keyboard users. Two tsconfig files separate browser and Node type environments.

**Tech Stack:** Vite 8, TypeScript 7, D3 (selection, zoom, transition, shape, polygon), vitest 5 + jsdom.

**Spec:** `docs/superpowers/specs/2026-11-02-polish-and-search-zoom-design.md` (amends `CLAUDE.md`; the design doc's Part B numbering is used below as "item N").

## Global Constraints

- Commit messages: imperative, one line, scope prefix (`map:`, `table:`, `app:`, `design:`, `docs:`, `scripts:`, `tests:`, `config:`).
- No em dashes in UI copy, docs, or aria text.
- Never edit `data/*.json` by hand (no data edits are expected; item 10 only adds checks the data already satisfies).
- No new runtime dependency. `tsc --noEmit -p tsconfig.json`, `tsc --noEmit -p tsconfig.node.json` (after Task 5), `npm test`, and `npm run build` green at the end.
- Hover never overrides a pinned node (unchanged).

## Review Focus

1. A search that matches founders at the map's edge: the fit transform must not leave them clipped (translateExtent clamping). Test in Task 10 (map test fits a founder near x < 100).
2. Typing letter by letter: each keystroke changes the matched set and must replace the running transition, never queue; hovering mid-transition must not restart it. Test in Task 10 (app test: hover after a fit leaves the transform unchanged).
3. Keyboard focus on a node that then gets hidden by a layer toggle: the tabindex=0 node must still exist (fallback to the leftmost visible). Test in Task 9.
4. Clicking a selected table row's Source link must open the link, not toggle the row. Test in Task 6 (existing Enter test kept, click guard kept).
5. The CSV panel's Close button and Esc must return focus to Copy, and Esc elsewhere must still clear the selection. Test in Task 7.

---

### Task 1: Filters: whitespace search, reducer purity, syncControls types

**Files:**
- Modify: `src/filters/match.ts` (activeFilterCount, activeChips)
- Modify: `src/filters/drawer.ts` (syncControls)
- Test: `tests/filters.test.ts`, `tests/state.test.ts`

**Interfaces:**
- Consumes: `searchTokens(q)` from `src/filters/match.ts`.
- Produces: nothing new; `activeFilterCount` and `activeChips` ignore whitespace-only `q`.

- [ ] **Step 1: Write the failing tests** (append inside the existing `describe` in `tests/filters.test.ts`):

```ts
  it('whitespace-only search is not an active filter and the chip label is trimmed', () => {
    expect(activeFilterCount(F({ q: '   ' }))).toBe(0)
    expect(activeChips(F({ q: '   ' }))).toEqual([])
    expect(activeChips(F({ q: '  ray ' }))).toEqual([{ category: 'Search', label: '“ray”', remove: 'q' }])
  })
```

And in `tests/state.test.ts` (new `it` inside `describe('state')`; this one is a regression guard and is expected to pass at once, ledger it as a characterization test):

```ts
  it('reducers never mutate their input sets', () => {
    const paths = new Set<PathKey>(['academic'])
    const badges = new Set<BadgeKey>(['prior_exit'])
    const employers = new Set(['Google'])
    const f = { ...DEFAULT_FILTERS, paths, badges, employers }
    togglePath(f, 'academic')
    toggleBadge(f, 'prior_exit')
    toggleEmployer(f, 'Google')
    toggleBadgePath(f, 'prior_exit', 'repeat_founder')
    removeFilter(f, 'path:academic')
    removeFilter(f, 'badge:prior_exit')
    removeFilter(f, 'employer:Google')
    expect([...paths]).toEqual(['academic'])
    expect([...badges]).toEqual(['prior_exit'])
    expect([...employers]).toEqual(['Google'])
    expect(f.paths).toBe(paths)
    expect(DEFAULT_FILTERS.paths.size).toBe(0)
  })
```
(import `toggleBadge`, `toggleEmployer` and the `PathKey`, `BadgeKey` types.)

- [ ] **Step 2: Run to verify the filters test fails**

Run: `npx vitest run tests/filters.test.ts tests/state.test.ts`
Expected: FAIL: `activeFilterCount` returns 1 for `'   '`; the state test passes.

- [ ] **Step 3: Implement** in `src/filters/match.ts`: `activeFilterCount` uses `(searchTokens(f.q).length ? 1 : 0)`; `activeChips` uses `const q = f.q.trim()` and pushes the Search chip only when `q` is non-empty, label `“${q}”`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/filters.test.ts tests/state.test.ts`
Expected: PASS.

- [ ] **Step 5: Remove the casts** in `src/filters/drawer.ts` `syncControls`: add `const has = (set: ReadonlySet<string>, v: string): boolean => set.has(v)` and use `has(f.paths, v)`, `has(f.badges, v)`; delete every `as never`.

Run: `npx tsc --noEmit -p tsconfig.json && grep -c 'as never' src/filters/drawer.ts`
Expected: tsc exits 0; grep prints `0` (exit 1 from grep is fine).

- [ ] **Step 6: Commit**

```bash
git add src/filters/match.ts src/filters/drawer.ts tests/filters.test.ts tests/state.test.ts
git commit -m "filters: ignore whitespace-only search, type the syncControls lookups, pin reducer purity"
```

---

### Task 2: UI: shared close icon, layer chip pressed argument, unknown id guard

**Files:**
- Modify: `src/html.ts`, `src/filters/active.ts`, `src/panel/card.ts`, `src/filters/drawer.ts` (chip), `src/app.ts`
- Test: `tests/active.test.ts`, `tests/card.test.ts`, `tests/app.test.ts`

**Interfaces:**
- Produces: `export const CROSS_ICON: string` in `src/html.ts` (the 24x24 close SVG, `aria-hidden="true"`).
- Produces: `chip(attr, value, label, count, dot?, pressed = false)` in `src/filters/drawer.ts` (module-private).
- Produces: in `src/app.ts` a module-private `select(id: string, toggle: boolean)` that ignores ids not in `graph.byId`; Task 6 reuses it for `data-row`.

- [ ] **Step 1: Write the failing tests.** `tests/active.test.ts`: import `CROSS_ICON` from `../src/html` and add `expect(el.innerHTML).toContain(CROSS_ICON)` after the aria-label assertion. `tests/card.test.ts`: import `CROSS_ICON` and add, in the Dan Lorenc test, `expect(founderCardHTML(lorenc)).toContain(CROSS_ICON)`. `tests/app.test.ts`, new `it` at the end of `describe('hash and keyboard')`:

```ts
  it('ignores a data-select whose id is not in the graph', () => {
    const about = q('#tab-about')
    about.insertAdjacentHTML('beforeend', '<button type="button" id="ghost" data-select="x:nobody">ghost</button>')
    click('#ghost')
    expect(location.hash).toBe('')
    expect(text('#detail h2')).toBe('Pick any dot or station')
    q('#ghost').remove()
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/active.test.ts tests/card.test.ts tests/app.test.ts`
Expected: FAIL: `CROSS_ICON` is not exported (import error in two files); the app test fails on `location.hash` being `#x-nobody`.

- [ ] **Step 3: Implement.** `src/html.ts`: export `CROSS_ICON`. `active.ts` and `card.ts`: delete the local `CROSS` and import `CROSS_ICON`. `drawer.ts`: add the `pressed` parameter to `chip` and build the layer chips with `chip('data-layer', k, LAYER_LABEL[k], null, undefined, DEFAULT_LAYERS[k])`, no `.replace`. `app.ts`: add `const select = (id: string, toggle: boolean) => { if (!hasNode(id)) return; store.set(toggle ? toggleSelect(store.get(), id) : { focus: id, pinned: true }) }` (move `hasNode` above it) and use `select(data(el, 'data-select'), false)` in the click handler and in the keydown row branch.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/active.test.ts tests/card.test.ts tests/app.test.ts tests/drawer.test.ts`
Expected: PASS (the drawer test still sees `['true','true','true','true','false','true']`).

- [ ] **Step 5: Commit**

```bash
git add src/html.ts src/filters/active.ts src/panel/card.ts src/filters/drawer.ts src/app.ts tests/active.test.ts tests/card.test.ts tests/app.test.ts
git commit -m "app: share the close icon, pass layer chip state as an argument, ignore unknown select ids"
```

---

### Task 3: Tabs: badge segment names and empty-graph guards

**Files:**
- Modify: `src/panel/tabs.ts`
- Test: `tests/tabs.test.ts`

**Interfaces:**
- Consumes: `buildGraph` from `src/model.ts` for a two-node fixture.
- Produces: segment `aria-label` text `"<Badge label>, <Path name>: <n> of <total> founders"`; OSS segments `"<OSS label>: <n> of <companies> companies"`.

- [ ] **Step 1: Write the failing tests** (append to `tests/tabs.test.ts`):

```ts
import { buildGraph } from '../src/model'
import type { CompanyRecord, FounderRecord, Layout } from '../src/types'

const tiny = buildGraph(
  [{ id: 'f:ann-lee', name: 'Ann Lee', shortLabel: 'A. Lee', company: 'Acme', path: 'academic', secondaryPath: null, role: 'CEO', status: 'active', statusNote: null, badges: [], employers: [], schools: [], taughtAt: [], priorOpenSource: [], edgeCase: false, bio: 'x', source: 'https://a.example' } satisfies FounderRecord],
  [{ id: 'c:acme', name: 'Acme', fund: 'amplify', vertical: 'Developer Tools', founded: 2020, avgFounderAgeAtFounding: null, openSourceProduct: 'no', status: 'Active', latest: 'Seed', description: 'd' } satisfies CompanyRecord],
  { viewBox: [0, 0, 1100, 840], nodes: { 'f:ann-lee': { x: 100, y: 100 }, 'c:acme': { x: 120, y: 120 } } } satisfies Layout,
)

describe('tabs on a graph with no hubs', () => {
  it('insights render six bullets with "none yet" instead of throwing', () => {
    const d = el(insightsHTML(tiny))
    const items = [...d.querySelectorAll('li')]
    expect(items).toHaveLength(6)
    expect(items[1].textContent).toContain('none yet')
    expect(items[3].textContent).toContain('none yet')
    expect(d.textContent).not.toMatch(/undefined|NaN/)
  })
  it('badge rows render for a graph with no badged founders', () => {
    const d = el(badgeRowsHTML(tiny, DEFAULT_FILTERS))
    expect(d.querySelectorAll('.brow')).toHaveLength(5)
    expect(d.querySelector('.bnote')?.textContent).not.toMatch(/undefined|NaN/)
  })
})

describe('badge segment names', () => {
  it('every segment has an aria-label naming the badge, path, and count', () => {
    const d = el(badgeRowsHTML(graph, DEFAULT_FILTERS))
    const seg = d.querySelector('[data-bp="prior_open_source:big_tech_engineer"]')!
    const total = graph.founders.filter((f) => f.badges.includes('prior_open_source')).length
    expect(seg.getAttribute('aria-label')).toBe(`Prior open source, Big tech engineer: ${seg.textContent} of ${total} founders`)
    const oss = d.querySelector('[data-oss="partial"]')!
    expect(oss.getAttribute('aria-label')).toBe(`Partially open: ${oss.textContent} of ${graph.companies.length} companies`)
    expect([...d.querySelectorAll('.bseg')].every((b) => b.getAttribute('aria-label'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/tabs.test.ts`
Expected: FAIL: insights throws reading `.members` of undefined; aria-label is null.

- [ ] **Step 3: Implement** in `src/panel/tabs.ts`: segment buttons get the `aria-label` above (escape with `esc`). In `insightsHTML`: `const none = 'none yet'`; busiest bullet uses `busiest.length ? busiest.map(...).join(', ') : none`; shared-by-both uses `both.length ? both.slice(0, 5).map(link).join(', ') : none`; most-mixed: when `multi.length === 0` the bullet is `<b>Most mixed stations:</b> none yet.`; mixed teams: `such as ...` only when `mixed.length`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/tabs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/panel/tabs.ts tests/tabs.test.ts
git commit -m "panel: name badge segments for assistive tech and guard insights on an empty graph"
```

---

### Task 4: Scripts and model polish: validator rules, layout path, label loop, opacity tokens

**Files:**
- Modify: `scripts/validate.ts`, `scripts/layout.ts`, `src/map/labels.ts`, `src/map/map.ts`
- Create: `src/tokens.ts`
- Test: `tests/validate.test.ts`, `tests/layout.test.ts`, `tests/map.test.ts`, `tests/labels.test.ts` (unchanged, must stay green)

**Interfaces:**
- Produces: `export const DEFAULT_OUT: string` in `scripts/layout.ts`.
- Produces: `src/tokens.ts` exporting `MAP_DIM_OPACITY` (0.32) and `MAP_FILTERED_OPACITY` (0.07) read from `design/tokens.json` `map.dimOpacity` / `map.filteredOpacity`.

- [ ] **Step 1: Write the failing tests.** `tests/validate.test.ts`:

```ts
  it('a hub listed twice for one founder', () => {
    const d = clone()
    d.f[0].employers.push(d.f[0].employers[0])
    expect(validateData(d.f, d.c, d.l).join()).toMatch(/f:will-wilson: employers lists ".+" twice/)
  })
  it('secondaryPath equal to path', () => {
    const d = clone()
    d.f[0].secondaryPath = d.f[0].path
    expect(validateData(d.f, d.c, d.l).join()).toMatch(/f:will-wilson: secondaryPath equals path/)
  })
```
`tests/layout.test.ts`: import `DEFAULT_OUT` and add
```ts
  it('default output path is a plain file path to data/layout.json', () => {
    expect(DEFAULT_OUT).toMatch(/\/data\/layout\.json$/)
    expect(DEFAULT_OUT.startsWith('/')).toBe(true)
    expect(DEFAULT_OUT).not.toContain('%')
  })
```
`tests/map.test.ts`: import `MAP_DIM_OPACITY, MAP_FILTERED_OPACITY` from `../src/tokens`, `readFileSync`/`resolve`, and add
```ts
  it('dim and filtered opacities come from design/tokens.json, not literals in map.ts', () => {
    const t = JSON.parse(readFileSync(resolve(process.cwd(), 'design/tokens.json'), 'utf8'))
    expect(MAP_DIM_OPACITY).toBe(t.map.dimOpacity)
    expect(MAP_FILTERED_OPACITY).toBe(t.map.filteredOpacity)
    const src = readFileSync(resolve(process.cwd(), 'src/map/map.ts'), 'utf8')
    expect(src).not.toMatch(/0\.32|0\.07/)
    expect(src).toContain('MAP_DIM_OPACITY')
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/validate.test.ts tests/layout.test.ts tests/map.test.ts`
Expected: FAIL: two validator messages missing; `DEFAULT_OUT` not exported; `../src/tokens` not found.

- [ ] **Step 3: Implement.** `validate.ts`: inside the founders loop, for each of the four list fields that is a text array, `const dup = xs.find((x, i) => xs.indexOf(x) !== i); if (dup) err(`${id}: ${field} lists "${dup}" twice`)`; after the secondaryPath enum check, `if (f.secondaryPath !== null && f.secondaryPath === f.path) err(`${id}: secondaryPath equals path`)`. `layout.ts`: `import { fileURLToPath } from 'node:url'`, `export const DEFAULT_OUT = fileURLToPath(new URL('../data/layout.json', import.meta.url))`, `main` uses it. `src/tokens.ts`: `import tokens from '../design/tokens.json'` and the two exports typed `number`. `map.ts`: import them and replace the literals in `opacity()`. `labels.ts`: replace `candidates(...).forEach((c, i) => ...)` with `const cs = candidates(d, W / 2); for (let i = 0; i < cs.length; i++) { ... }` and drop both `as` casts (`best` is then narrowed by the `if (!best) continue`); declare `let best: { c: Candidate; r: Rect } | null = null` as now.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/validate.test.ts tests/layout.test.ts tests/map.test.ts tests/labels.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS; tsc exits 0 (no unused-cast warnings; `grep -c ' as {' src/map/labels.ts` prints 0).

- [ ] **Step 5: Commit**

```bash
git add scripts/validate.ts scripts/layout.ts src/map/labels.ts src/map/map.ts src/tokens.ts tests/validate.test.ts tests/layout.test.ts tests/map.test.ts
git commit -m "scripts: reject duplicate hubs and self stubs, plain layout path; map: opacities from tokens"
```

---

### Task 5: Config and shell: tsconfig split, brand mark classes, README host, contrast pairs

**Files:**
- Modify: `tsconfig.json`, `package.json`, `index.html`, `src/styles/components.css`, `README.md`, `tests/contrast.test.ts`
- Create: `tsconfig.node.json`
- Test: `tests/shell.test.ts`, `tests/contrast.test.ts`

**Interfaces:**
- Produces: `tsconfig.json` (`include: ["src"]`, `types: ["vite/client"]`) and `tsconfig.node.json` (`extends ./tsconfig.json`, `types: ["vite/client", "node"]`, `include: ["src", "scripts", "tests", "vite.config.ts"]`); `build` script runs `tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json`.
- Produces: CSS classes `.brand__bg`, `.brand__line`, `.brand__node`, `.brand__dot`.

- [ ] **Step 1: Write the failing tests.** `tests/shell.test.ts`, new describe:

```ts
describe('type-check configs and brand mark', () => {
  it('browser code is checked without Node globals; scripts and tests get them from tsconfig.node.json', () => {
    const app = JSON.parse(read('tsconfig.json'))
    expect(app.compilerOptions.types).toEqual(['vite/client'])
    expect(app.include).toEqual(['src'])
    const node = JSON.parse(read('tsconfig.node.json'))
    expect(node.compilerOptions.types).toContain('node')
    expect(node.include).toEqual(expect.arrayContaining(['scripts', 'tests', 'vite.config.ts']))
    expect(JSON.parse(read('package.json')).scripts.build).toContain('tsc --noEmit -p tsconfig.node.json')
  })
  it('the brand mark takes its colors from tokens, not hex literals', () => {
    expect(document.querySelector('.brand svg')?.outerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
    const css = read('src/styles/components.css')
    const body = (selector: string) => rules(css).find((r) => r.selector === selector)?.body.replace(/\s+/g, ' ') ?? ''
    expect(body('.brand__bg')).toMatch(/fill: var\(--color-ink\)/)
    expect(body('.brand__line')).toMatch(/stroke: var\(--color-surface\)/)
    expect(body('.brand__dot')).toMatch(/fill: var\(--color-accent\)/)
  })
})
```
In the README test add `'http://localhost:5173'` to the list of required strings. In `tests/contrast.test.ts` add the pairs `['accent on accentTint', th.c.accent, th.c.accentTint]` and `['accent on tableHead', th.c.accent, th.c.tableHead]` (characterization; both pass today at 4.97 and above).

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/shell.test.ts tests/contrast.test.ts`
Expected: FAIL on the tsconfig assertions, the brand hex match, and the README string; contrast passes.

- [ ] **Step 3: Implement.** Write the two tsconfig files and the build script. `index.html`: the brand `<svg>` loses every `fill=`/`stroke=`/`stroke-width=`/`stroke-linecap=` attribute; `<rect class="brand__bg">`, `<path class="brand__line">`, the two white circles `class="brand__node"`, the blue circle `class="brand__dot"`. `components.css` (next to the `.brand` rules): `.brand__bg { fill: var(--color-ink); } .brand__line { fill: none; stroke: var(--color-surface); stroke-width: 1.6; stroke-linecap: round; } .brand__node { fill: var(--color-surface); } .brand__dot { fill: var(--color-accent); }`. README: `npm run dev        # http://localhost:5173`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/shell.test.ts tests/contrast.test.ts && npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p tsconfig.node.json`
Expected: PASS; both tsc runs exit 0.

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json tsconfig.node.json package.json index.html src/styles/components.css README.md tests/shell.test.ts tests/contrast.test.ts
git commit -m "config: split browser and Node type checks; design: themed brand mark; docs: localhost in README"
```

---

### Task 6: Table: hostname sort, one collator, aria-sort only on the sorted header, row buttons that toggle

**Files:**
- Modify: `src/table/table.ts`, `src/app.ts`, `src/styles/components.css`
- Test: `tests/table.test.ts`, `tests/app.test.ts`

**Interfaces:**
- Consumes: `select(id, toggle)` and `hasNode` from Task 2 (`src/app.ts`).
- Produces: row markup `<tr class="row[ is-selected]" data-select="<id>" data-toggle[ aria-current="true"]>` (no tabindex); name cell `<button type="button" class="rowbtn" data-row="<id>" aria-pressed="<true|false>">Name</button>` after the `.pdot`; only the sorted `<th>` carries `aria-sort`.
- Produces: `FOCUS_KEYS` in `src/app.ts` includes `'data-row'`; the click handler handles `[data-row]` before `[data-select]`; the keydown row branch is deleted.

- [ ] **Step 1: Write the failing tests.** Replace the `tableHTML` test in `tests/table.test.ts`:

```ts
  it('tableHTML: aria-sort only on the sorted header, clickable rows with a name button, selected row, empty state', () => {
    const t = el(tableHTML(graph.founders, 'f:dan-lorenc', { key: 'company', dir: -1 }))
    expect(t.querySelectorAll('th button[data-sort]')).toHaveLength(13)
    expect(t.querySelectorAll('th[aria-sort]')).toHaveLength(1)
    expect(t.querySelector('th[aria-sort="descending"] button')?.getAttribute('data-sort')).toBe('company')
    expect(t.querySelectorAll('tbody tr.row[data-select][data-toggle]')).toHaveLength(graph.founders.length)
    expect(t.querySelectorAll('tbody tr[tabindex]')).toHaveLength(0)
    expect(t.querySelectorAll('tbody button.rowbtn[data-row]')).toHaveLength(graph.founders.length)
    const sel = t.querySelector('tr.is-selected')!
    expect(sel.getAttribute('data-select')).toBe('f:dan-lorenc')
    expect(sel.getAttribute('aria-current')).toBe('true')
    expect(sel.querySelector('.rowbtn')?.getAttribute('aria-pressed')).toBe('true')
    expect(sel.querySelector('.rowbtn')?.textContent).toBe('Dan Lorenc')
    expect(t.querySelectorAll('tr[aria-current]')).toHaveLength(1)
    expect(t.querySelectorAll('.rowbtn[aria-pressed="false"]')).toHaveLength(graph.founders.length - 1)
    expect(sel.querySelector('td a')?.getAttribute('rel')).toBe('noopener')
    expect(sel.querySelector('.status')?.className).toContain('status--active')
    expect(el(tableHTML([], null, { key: 'name', dir: 1 })).querySelector('.table__empty')?.textContent).toBe('No founders match these filters.')
    expect(countText(1, { key: 'name', dir: 1 })).toBe('1 founder · sorted by founder')
    expect(countText(54, { key: 'last', dir: 1 })).toBe('54 founders · sorted by company latest')
  })
  it('sorts the Source column by the hostname it displays, and compares with one accent-insensitive collator', () => {
    const bySrc = sortFounders(graph.founders, { key: 'src', dir: 1 }).map((f) => hostOf(f.source))
    const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })
    expect(bySrc).toEqual([...bySrc].sort(collator.compare))
    const mk = (name: string) => ({ ...graph.founders[0], name })
    expect(sortFounders([mk('Eric'), mk('eve'), mk('Émile')], { key: 'name', dir: 1 }).map((f) => f.name)).toEqual(['Émile', 'Eric', 'eve'])
  })
```
(import `hostOf` from `../src/panel/card`.) In `tests/app.test.ts` replace the `renders the filtered rows...` test body's row part:

```ts
    const first = q('#founder-table tbody tr.row')
    first.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(q('#founder-table tr.is-selected').getAttribute('data-select')).toBe(first.getAttribute('data-select'))
    expect(text('#detail h2')).toBe(first.querySelector('.rowbtn')!.textContent)
    q('#founder-table tr.is-selected').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(document.querySelector('#founder-table tr.is-selected')).toBeNull()
    expect(text('#detail h2')).toBe('Pick any dot or station')
    const btn = document.querySelectorAll<HTMLElement>('#founder-table .rowbtn')[1]
    btn.focus()
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(q('#founder-table tr.is-selected').getAttribute('data-select')).toBe(btn.getAttribute('data-row'))
    expect(document.activeElement?.getAttribute('data-row')).toBe(btn.getAttribute('data-row'))
    expect(document.activeElement?.getAttribute('aria-pressed')).toBe('true')
    click('#detail [data-close]')
```
(keep the sort, filter, and clear parts; keep the Enter-on-Source-link test as is.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/table.test.ts tests/app.test.ts`
Expected: FAIL: 12 `aria-sort` headers, no `.rowbtn`, `Émile` sorts last, re-click does not clear.

- [ ] **Step 3: Implement.** `table.ts`: `src` column `get: (f) => hostOf(f.source)`; `const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })`; `sortFounders` comparator `(collator.compare(col.get(a), col.get(b)) || collator.compare(a.name, b.name)) * sort.dir`; header `aria-sort` attribute only when `on`; row and name cell markup per Interfaces (`cells(f, selected)`). `app.ts`: add `'data-row'` to `FOCUS_KEYS`; click handler `if ((el = hit('[data-row]'))) return select(data(el, 'data-row'), true)` before the `[data-select]` branch, which becomes `select(data(el, 'data-select'), el.hasAttribute('data-toggle'))`; delete the keydown `tr.row` branch and its comment. `components.css`: `.rowbtn { background: none; border: 0; padding: 0; font: inherit; color: inherit; cursor: pointer; text-align: left; }` (the global `:focus-visible` outline applies).

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/table.test.ts tests/app.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/table/table.ts src/app.ts src/styles/components.css tests/table.test.ts tests/app.test.ts
git commit -m "table: sort Source by hostname with one collator, aria-sort on the sorted header only, row name buttons that toggle"
```

---

### Task 7: Clipboard: CSV panel with Close, honest download tests

**Files:**
- Modify: `index.html`, `src/styles/components.css`, `src/app.ts`
- Test: `tests/clipboard.test.ts`, `tests/app.test.ts`, `tests/shell.test.ts`

**Interfaces:**
- Produces: `<div class="csv-fallback" id="csv-fallback" hidden>` wrapping `textarea#csv-box` (still `hidden`) and `<button type="button" class="btn btn--sm" id="csv-close">Close</button>`.
- Consumes: `copyText(text, clipboard, box)` unchanged; `app.ts` unhides the panel on `'fallback'`, hides panel and box on Close or on Esc while focus is inside the panel, then focuses `#csv-copy`.

- [ ] **Step 1: Write the failing tests.** `tests/shell.test.ts` (in `table shell`): `expect(document.querySelector('#csv-fallback[hidden] > #csv-box'))).not.toBeNull()` and `expect(document.querySelector('#csv-fallback > #csv-close')?.textContent?.trim()).toBe('Close')`. `tests/app.test.ts`, inside `describe('table view')` before the clipboard test:

```ts
  it('without a clipboard, Copy shows the CSV panel; Close and Esc hide it and return focus to Copy', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    click('[data-view="table"]')
    click('#csv-copy')
    await new Promise((r) => setTimeout(r, 0))
    expect(q('#csv-fallback').hasAttribute('hidden')).toBe(false)
    expect(q('#csv-box').hasAttribute('hidden')).toBe(false)
    expect(document.activeElement).toBe(q('#csv-box'))
    expect(text('#toast')).toBe('Select the text and copy it manually')
    click('#csv-close')
    expect(q('#csv-fallback').hasAttribute('hidden')).toBe(true)
    expect(document.activeElement).toBe(q('#csv-copy'))
    click('#csv-copy')
    await new Promise((r) => setTimeout(r, 0))
    q('#csv-box').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(q('#csv-fallback').hasAttribute('hidden')).toBe(true)
    expect(document.activeElement).toBe(q('#csv-copy'))
    click('[data-view="map"]')
  })
```
Replace the last test of `tests/clipboard.test.ts`:

```ts
  it('downloadText is a no-op when the window has no createObjectURL', () => {
    const doc = { defaultView: { URL: {} } } as unknown as Document
    expect(() => downloadText(doc, 'x.csv', 'a')).not.toThrow()
  })
  it('downloadText clicks a temporary download link and revokes the object URL', () => {
    const clicks: string[] = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(`${this.download}|${this.href}`)
    })
    const create = vi.fn(() => 'blob:fake')
    const revoke = vi.fn()
    Object.defineProperty(window.URL, 'createObjectURL', { value: create, configurable: true })
    Object.defineProperty(window.URL, 'revokeObjectURL', { value: revoke, configurable: true })
    downloadText(document, 'founder-map.csv', 'a,b')
    expect(clicks).toEqual(['founder-map.csv|blob:fake'])
    expect(create).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith('blob:fake')
    expect(document.querySelector('a[download]')).toBeNull()
    click.mockRestore()
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/clipboard.test.ts tests/app.test.ts tests/shell.test.ts 2>&1 | tail -30`
Expected: shell and app tests FAIL (`#csv-fallback` missing); the clipboard tests pass (they pin behavior and remove the jsdom "Not implemented: navigation" line; confirm that line is gone from the output).

- [ ] **Step 3: Implement.** `index.html` per Interfaces. `components.css`: `.csv-fallback { position: fixed; left: 16px; top: 16px; z-index: 20; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }`; `.csv-box` loses `position`, `left`, `top`, `z-index`. `app.ts`: `const csvPanel = doc.getElementById('csv-fallback')`; `const closeCsv = () => { if (csvPanel) csvPanel.hidden = true; const box = ...; if (box) box.hidden = true; doc.getElementById('csv-copy')?.focus() }`; in the `#csv-copy` branch, after `copyText` resolves with `'fallback'`, set `csvPanel.hidden = false` (before `say`); click `#csv-close` calls `closeCsv()`; the Escape branch becomes `if (csvPanel && !csvPanel.hidden && csvPanel.contains(doc.activeElement)) return closeCsv()`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/clipboard.test.ts tests/app.test.ts tests/shell.test.ts 2>&1 | tail -8`
Expected: PASS; no "Not implemented" line.

- [ ] **Step 5: Commit**

```bash
git add index.html src/styles/components.css src/app.ts tests/clipboard.test.ts tests/app.test.ts tests/shell.test.ts
git commit -m "table: give the CSV fallback a Close button; tests: exercise both download branches without jsdom noise"
```

---

### Task 8: Map: show the focused node through layer toggles; live reduced motion

**Files:**
- Modify: `src/map/map.ts`, `src/app.ts`
- Test: `tests/map.test.ts`, `tests/app.test.ts`

**Interfaces:**
- Produces: `MapView.setReduceMotion(on: boolean): void`; module-private `visible(d) = shown(d) || d === input.focus` used by `place()` and `render()` for nodes, labels, and links (`visible(l.target)`); `update()` calls `place()` when the focus node is not `shown`.
- Produces: `app.ts` keeps the media query object `rm` and defines `const reduceMotion = () => rm?.matches ?? false`; subscribes `rm.addEventListener('change', (e) => map.setReduceMotion(e.matches))`.

- [ ] **Step 1: Write the failing tests.** `tests/map.test.ts`:

```ts
  it('a one-off hub hidden by the layer is shown with its links and label while it is the focus', () => {
    const { svg, map } = mount()
    const h = graph.hubs.find((x) => x.oneOff)!
    const display = (sel: string) => svg.querySelector(sel)?.getAttribute('display') ?? null
    expect(display(`g.node[data-id="${h.id}"]`)).toBe('none')
    map.update({ ...base(), focus: h, pinned: true })
    expect(display(`g.node[data-id="${h.id}"]`)).toBeNull()
    expect(display(`g.lbl[data-id="${h.id}"]`)).toBeNull()
    const link = [...svg.querySelectorAll<SVGLineElement>('line.link')].find((l) => Number(l.getAttribute('x2')) === h.x && Number(l.getAttribute('y2')) === h.y)!
    expect(link.getAttribute('display')).toBeNull()
    map.update(base())
    expect(display(`g.node[data-id="${h.id}"]`)).toBe('none')
  })
  it('setReduceMotion(true) makes later zooms synchronous', () => {
    const { svg, map } = mount({ reduceMotion: false })
    map.setReduceMotion(true)
    map.zoomTo('f:dan-lorenc', 2)
    expect(svg.querySelector('g.viewport')!.getAttribute('transform')).toMatch(/scale\(2\)/)
  })
```
(Label groups need `data-id`: add `.attr('data-id', (d) => d.id)` to `lblSel` in the implementation.) `tests/app.test.ts`, in `describe('phone behaviors')`:

```ts
  it('follows a prefers-reduced-motion change after boot', () => {
    const listeners: ((e: { matches: boolean }) => void)[] = []
    const mm = (window as unknown as { matchMedia: unknown }).matchMedia
    ;(window as unknown as { matchMedia: unknown }).matchMedia = (query: string) => ({
      matches: !query.includes('reduced-motion'),
      media: query,
      addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.push(fn),
    })
    const doc3 = new DOMParser().parseFromString(indexHtml, 'text/html')
    ;(doc3.getElementById('detail') as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {}
    boot(doc3)
    expect(listeners).toHaveLength(1)
    listeners[0]({ matches: true })
    doc3.querySelector('[data-id="f:dan-lorenc"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(doc3.querySelector('#map g.viewport')!.getAttribute('transform')).toMatch(/scale\(2\.4\)/)
    ;(window as unknown as { matchMedia: unknown }).matchMedia = mm
    history.replaceState(null, '', location.pathname)
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/map.test.ts tests/app.test.ts`
Expected: FAIL: hidden hub stays `display="none"`; `setReduceMotion` is not a function; `listeners` is empty.

- [ ] **Step 3: Implement** per Interfaces. In `map.ts` replace `const duration = ...` with `let reduce = !!opts.reduceMotion` and `const ms = (base: number) => (reduce ? 0 : base)`; `go(t, base = 260)` uses `ms(base)`; `zoomIn`/`zoomOut` use `.duration(ms(260))`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/map.test.ts tests/app.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/map/map.ts src/app.ts tests/map.test.ts tests/app.test.ts
git commit -m "map: keep the focused node visible through layer toggles and follow reduced-motion changes live"
```

---

### Task 9: Map keyboard: roving tabindex, arrow navigation, focus preview

**Files:**
- Create: `src/map/nav.ts`
- Modify: `src/map/map.ts`, `CLAUDE.md` (section 6 Keyboard line), `docs/acceptance.md`
- Test: `tests/nav.test.ts` (new), `tests/map.test.ts`, `tests/app.test.ts`

**Interfaces:**
- Produces: `src/map/nav.ts`:
  ```ts
  export interface NavNode { id: string; x: number; y: number }
  /** Left/Right walk the nodes by x (ties by y, then id), Up/Down by y (ties by x, then id); Home/End are the leftmost/rightmost; clamped, no wrap. Null for any other key. */
  export function mapNavKey<T extends NavNode>(key: string, current: T, nodes: readonly T[]): T | null
  ```
- Produces in `map.ts`: `let roving: AnyNode | null`; `rovingNode()` = `roving` when visible, else the pinned focus, else the visible node with the smallest x (ties: smallest y); `render()` sets `tabindex` 0 on exactly that node and -1 on the rest; `update()` sets `roving = next.focus` when `next.pinned`; node `focus` event sets `roving`, re-applies tabindex, and calls `handlers.onHover(d.id, 'keyboard')`; node `blur` with a `relatedTarget` outside the svg calls `handlers.onHover(null, 'keyboard')`; node `keydown` with a nav key focuses the target node (`preventDefault`).

- [ ] **Step 1: Write the failing tests.** `tests/nav.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mapNavKey } from '../src/map/nav'

const n = (id: string, x: number, y: number) => ({ id, x, y })
const a = n('a', 0, 50), b = n('b', 10, 0), c = n('c', 20, 100), d = n('d', 20, 20)
const all = [c, a, d, b]

describe('mapNavKey', () => {
  it('Left and Right walk by x with ties by y then id, clamped at the ends', () => {
    expect(mapNavKey('ArrowRight', a, all)).toBe(b)
    expect(mapNavKey('ArrowRight', b, all)).toBe(d)
    expect(mapNavKey('ArrowRight', d, all)).toBe(c)
    expect(mapNavKey('ArrowRight', c, all)).toBe(c)
    expect(mapNavKey('ArrowLeft', a, all)).toBe(a)
    expect(mapNavKey('ArrowLeft', c, all)).toBe(d)
  })
  it('Up and Down walk by y; Home and End jump; other keys are null', () => {
    expect(mapNavKey('ArrowDown', b, all)).toBe(d)
    expect(mapNavKey('ArrowDown', d, all)).toBe(a)
    expect(mapNavKey('ArrowUp', b, all)).toBe(b)
    expect(mapNavKey('ArrowUp', c, all)).toBe(a)
    expect(mapNavKey('Home', c, all)).toBe(a)
    expect(mapNavKey('End', a, all)).toBe(c)
    expect(mapNavKey('Enter', a, all)).toBeNull()
    expect(mapNavKey('ArrowRight', n('zz', 5, 5), all)).toBeNull()
  })
})
```
`tests/map.test.ts`, new describe:

```ts
describe('map keyboard', () => {
  const tabbable = (svg: SVGSVGElement) => [...svg.querySelectorAll('g.node[tabindex="0"]')].map((n) => n.getAttribute('data-id'))
  it('exactly one node is in the Tab order: the leftmost visible node, then the pinned node', () => {
    const { svg, map } = mount()
    const visible = graph.all.filter((d) => (svg.querySelector(`g.node[data-id="${d.id}"]`) as HTMLElement).getAttribute('display') !== 'none')
    const leftmost = visible.reduce((p, d) => (d.x < p.x || (d.x === p.x && d.y < p.y) ? d : p))
    expect(tabbable(svg)).toEqual([leftmost.id])
    expect(svg.querySelectorAll('g.node[tabindex="-1"]')).toHaveLength(graph.all.length - 1)
    map.update({ ...base(), focus: graph.byId.get('f:dan-lorenc')!, pinned: true })
    expect(tabbable(svg)).toEqual(['f:dan-lorenc'])
  })
  it('arrow keys move focus between nodes, focus previews the node, and leaving the map clears the preview', () => {
    const hovers: (string | null)[] = []
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement
    document.body.append(svg)
    const map = createMap(svg, graph, { onHover: (id) => hovers.push(id), onToggle() {}, onCanvasClick() {} }, { reduceMotion: true })
    map.update(base())
    const first = svg.querySelector<SVGGElement>('g.node[tabindex="0"]')!
    first.focus()
    expect(document.activeElement).toBe(first)
    expect(hovers).toEqual([first.getAttribute('data-id')])
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    const second = document.activeElement as SVGGElement
    expect(second).not.toBe(first)
    expect(second.getAttribute('tabindex')).toBe('0')
    expect(first.getAttribute('tabindex')).toBe('-1')
    expect(Number(graph.byId.get(second.getAttribute('data-id')!)!.x)).toBeGreaterThanOrEqual(graph.byId.get(first.getAttribute('data-id')!)!.x)
    expect(hovers.at(-1)).toBe(second.getAttribute('data-id'))
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()
    expect(hovers.at(-1)).toBeNull()
    expect(tabbable(svg)).toEqual([second.getAttribute('data-id')])
    outside.remove()
  })
})
```
`tests/app.test.ts`, in `describe('hash and keyboard')`:

```ts
  it('the map is one Tab stop and keyboard focus previews a node in the card', () => {
    expect(document.querySelectorAll('#map g.node[tabindex="0"]')).toHaveLength(1)
    const node = q('[data-id="c:temporal"]')
    node.focus()
    expect(text('#detail h2')).toBe('Temporal')
    q('#zoom-in').focus()
    expect(text('#detail h2')).toBe('Pick any dot or station')
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/nav.test.ts tests/map.test.ts tests/app.test.ts`
Expected: FAIL: `../src/map/nav` not found; every node has `tabindex="0"`.

- [ ] **Step 3: Implement** `src/map/nav.ts` and the `map.ts` changes per Interfaces. The node selection keeps `role="button"` and `aria-label`; `tabindex` moves from the static attr to `render()`. The focus/blur handlers are attached with d3 `.on('focus', ...)` / `.on('blur', ...)` (typed `FocusEvent`).

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/nav.test.ts tests/map.test.ts tests/app.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS. If jsdom refuses to focus an SVG `<g>` (activeElement stays body), ledger it and set `tabindex` on the same elements through `setAttribute` plus a `focus()` call; jsdom treats any element with a tabindex attribute as focusable, so this is not expected.

- [ ] **Step 5: Amend the spec and the acceptance report.** `CLAUDE.md` section 6 Keyboard bullet becomes: `**Keyboard**: the map is one Tab stop; arrow keys move between nodes (Left/Right by position across, Up/Down by position down, Home/End to the ends), Enter/Space pins, and a focused node previews in the card like hover; Esc clears selection unless focus is in an input or select; visible focus rings everywhere.` `docs/acceptance.md`: drop the "Every map node is a tab stop" gap; the 6b row gets a trailing sentence: `Polish pass: the map is now one Tab stop with arrow-key navigation, and table rows select through a name button (re-verified in the browser, see docs/acceptance.md "Polish pass").`

- [ ] **Step 6: Commit**

```bash
git add src/map/nav.ts src/map/map.ts tests/nav.test.ts tests/map.test.ts tests/app.test.ts CLAUDE.md docs/acceptance.md
git commit -m "map: one Tab stop with arrow-key navigation and keyboard focus preview"
```

---

### Task 10: Search zoom: fit the matched founders

**Files:**
- Modify: `src/map/geometry.ts`, `src/map/map.ts`, `src/app.ts`, `CLAUDE.md` (section 6 Map bullet)
- Test: `tests/geometry.test.ts`, `tests/map.test.ts`, `tests/app.test.ts`

**Interfaces:**
- Produces: `export function fitTransform(points: readonly Pt[], W: number, H: number, pad = 60, minK = 0.8, maxK = 2.4): { k: number; x: number; y: number } | null` in `geometry.ts` (null for an empty list; `k = clamp(min(W / (bw + 2 pad), H / (bh + 2 pad)), minK, maxK)`; `x = W / 2 - cx * k`, `y = H / 2 - cy * k` with `(cx, cy)` the box center).
- Produces: `MapView.fitTo(points: readonly Pt[]): void` (420 ms, no-op when empty) and `MapView.fit(ms = 260)`.
- Produces in `app.ts`: `let lastMatchKey = ''`; in `push`, `const key = active ? [...matched].map((f) => f.id).sort().join() : ''`; when `key !== lastMatchKey`: store it, then `if (!active) map.fit(420); else if (matched.size) map.fitTo([...matched])`.

- [ ] **Step 1: Write the failing tests.** `tests/geometry.test.ts`:

```ts
  it('fitTransform centers one point at the max scale, fits a spread at the min, and pads a cluster', () => {
    expect(fitTransform([], 1100, 840)).toBeNull()
    const one = fitTransform([{ x: 100, y: 700 }], 1100, 840)!
    expect(one.k).toBe(2.4)
    expect(one.x).toBeCloseTo(550 - 100 * 2.4)
    expect(one.y).toBeCloseTo(420 - 700 * 2.4)
    const wide = fitTransform([{ x: 0, y: 0 }, { x: 1100, y: 840 }], 1100, 840)!
    expect(wide.k).toBeCloseTo(Math.min(1100 / 1220, 840 / 960))
    expect(wide.x).toBeCloseTo(550 - 550 * wide.k)
    const cluster = fitTransform([{ x: 200, y: 300 }, { x: 400, y: 300 }, { x: 300, y: 400 }], 1100, 840)!
    expect(cluster.k).toBe(2.4)
    expect(cluster.x).toBeCloseTo(550 - 300 * 2.4)
    expect(cluster.y).toBeCloseTo(420 - 350 * 2.4)
    expect(fitTransform([{ x: 0, y: 0 }, { x: 5000, y: 0 }], 1100, 840)!.k).toBe(0.8)
  })
```
`tests/map.test.ts`, in `describe('zoomTo')` (rename the describe to `'zoomTo and fitTo'`):

```ts
  it('fitTo fits the given points, including one near the left edge, and ignores an empty list', () => {
    const { svg, map } = mount({ reduceMotion: true })
    const edge = graph.founders.reduce((p, f) => (f.x < p.x ? f : p))
    expect(edge.x).toBeLessThan(150)
    map.fitTo([edge])
    const tf = () => svg.querySelector('g.viewport')!.getAttribute('transform')!
    const want = fitTransform([edge], graph.W, graph.H)!
    expect(tf()).toBe(`translate(${want.x},${want.y}) scale(${want.k})`)
    map.fitTo([])
    expect(tf()).toBe(`translate(${want.x},${want.y}) scale(${want.k})`)
    map.fit()
    expect(tf()).toBe('translate(0,0) scale(1)')
  })
```
`tests/app.test.ts`, new describe at the end:

```ts
describe('search zoom', () => {
  it('fits the matched founders when the match set changes, not on hover, and zooms back out when filters clear', () => {
    const mm = (window as unknown as { matchMedia: unknown }).matchMedia
    ;(window as unknown as { matchMedia: unknown }).matchMedia = (query: string) => ({ matches: query.includes('reduced-motion'), media: query, addEventListener() {} })
    const doc4 = new DOMParser().parseFromString(indexHtml, 'text/html')
    boot(doc4)
    const tf = () => doc4.querySelector('#map g.viewport')!.getAttribute('transform')
    expect(tf()).toBeNull()
    const input = doc4.getElementById('map-search') as HTMLInputElement
    const type = (v: string) => {
      input.value = v
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    type('microsoft')
    const matched = graph.founders.filter((f) => f.haystack.includes('microsoft'))
    expect(matched.length).toBeGreaterThan(1)
    const want = fitTransform(matched, graph.W, graph.H)!
    expect(tf()).toBe(`translate(${want.x},${want.y}) scale(${want.k})`)
    doc4.querySelector('[data-id="c:temporal"]')!.dispatchEvent(new Event('pointerenter'))
    expect(tf()).toBe(`translate(${want.x},${want.y}) scale(${want.k})`)
    type('zzzz no one')
    expect(tf()).toBe(`translate(${want.x},${want.y}) scale(${want.k})`)
    type('')
    expect(tf()).toBe('translate(0,0) scale(1)')
    ;(window as unknown as { matchMedia: unknown }).matchMedia = mm
  })
})
```
(import `fitTransform` from `../src/map/geometry` in both test files.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/geometry.test.ts tests/map.test.ts tests/app.test.ts`
Expected: FAIL: `fitTransform` not exported; `map.fitTo` not a function; the app transform stays null after typing.

- [ ] **Step 3: Implement** per Interfaces. In `map.ts`: `fitTo(points) { const t = fitTransform(points, W, H); if (t) go(zoomIdentity.translate(t.x, t.y).scale(t.k), 420) }`, `fit: (ms = 260) => go(zoomIdentity, ms)`. In `app.ts` the key tracking goes in `push` right after `matched` and `active` are computed. `CLAUDE.md` section 6 Map list gets a bullet: `- Searching or filtering zooms the map (420 ms, none under reduced motion) to fit the matched founders, at most 2.4x; clearing every filter zooms back to the whole map. Hover and selection never move the viewport on desktop.`

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/geometry.test.ts tests/map.test.ts tests/app.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS. If the app transform differs from `want` by the translateExtent clamp, that is Review Focus 1: widen the padding or the extent and ledger it.

- [ ] **Step 5: Commit**

```bash
git add src/map/geometry.ts src/map/map.ts src/app.ts tests/geometry.test.ts tests/map.test.ts tests/app.test.ts CLAUDE.md
git commit -m "map: zoom smoothly to fit the founders a search or filter matches"
```

---

### Task 11: Spec amendment, acceptance report, full verification in the browser

**Files:**
- Modify: `CLAUDE.md` (7.7), `docs/acceptance.md`
- Test: whole suite, both tsc configs, build, Lighthouse, browser walkthrough

- [ ] **Step 1: Amend `CLAUDE.md` 7.7:** replace `` `role="img"` + label on the SVG `` with `` `role="group"` + label on the SVG (not `img`: the img role hides the focusable node buttons from assistive technology) ``.

- [ ] **Step 2: Update `docs/acceptance.md`:** the "Known gaps" list drops the `role="img"` and tab-stop entries, keeps the hover line, and adds a "Polish pass (2026-11-02)" section listing: the 26 fixed items in one or two sentences each group, the four rulings from the design doc, and the browser re-verification below.

- [ ] **Step 3: Full verification**

Run: `npm test 2>&1 | tail -6 && npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p tsconfig.node.json && npm run build 2>&1 | tail -5`
Expected: all test files pass (count them, expect 23 files); both tsc exit 0; build prints the dist sizes with no warnings. Record the test count and bundle size in the acceptance section.

- [ ] **Step 4: Browser check** (dev server on 5173 is running): in Chrome, (a) type `microsoft` in the search and watch the map glide to the matching founders; clear it and watch it glide back; (b) Tab from the Filters button: one Tab lands on the map's leftmost node, ArrowRight moves across nodes with the card previewing each, Enter pins, Tab leaves to Zoom in; (c) Table view: click a row (selects), click it again (clears), Tab to a name button and press Enter; (d) dark theme: the brand mark inverts. Then Lighthouse accessibility (mobile and desktop) against `vite preview` on 4173: expect 1.00 on both. Record results in `docs/acceptance.md`.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/acceptance.md
git commit -m "docs: amend the SVG role in the spec and record the polish pass in the acceptance report"
```
