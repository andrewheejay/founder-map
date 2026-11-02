# Founder Map Prompt 2 Implementation Plan (panel, filters, search)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the detail card with its five variants, the three tabs under it, the Filters drawer, the active filters row, the fund and view controls, and tokenized search, all driven by one store and matching the Main and Table artboards.

**Architecture:** Filter state and matching are pure functions (`src/state.ts`, `src/filters/match.ts`) tested in Node. Renderers return HTML strings from graph + state (`src/filters/*.ts`, `src/panel/*.ts`) and are tested in jsdom. One `boot(doc)` in `src/app.ts` owns the store, derives the matched set, pushes it to the map, swaps card and tab HTML only when it changes, and handles every click through data attributes, exactly like the prototype's single delegated listener. Static copy (About tab, drawer skeleton, tabs) lives in `index.html`.

**Tech Stack:** Vite 8, TypeScript 7, vitest 5 + jsdom, D3 modules already in place. No new dependencies.

**Spec:** `CLAUDE.md` sections 4 (derived fields), 5 (model), 6 (Toolbar, Filter drawer, Active filters row, Detail card, Tabs under the card), 7.4 (components), 7.7 (accessibility), 9 (acceptance). Behavior reference: `reference/founder-map-v4.html` lines 570–600 (matching), 749–795 (active row, clusters), 840–1003 (cards, badge rows, insights, controls), 1004–1050 (events). Pixel reference: `reference/design/Main.dc.html` lines 516–575 (card, tabs), `reference/design/Table.dc.html` lines 33–65 (toolbar with count badge, active chips).

## Global Constraints

- Data stays in `data/*.json`; never hard-code a founder or company fact in a component. Counts are computed.
- Every color, size, radius, and font value goes through a `--token` from `design/tokens.json` (regenerate with `npm run tokens`). No gradients, shadows, or emoji.
- Real `<button>`, `<a>`, `<input>` + `<label>`, `<select>` + `<label>`. `aria-pressed` on every toggle, `aria-selected` on tabs, `aria-expanded` + `aria-controls` on the Filters button, `aria-label` on icon-only buttons.
- No em dashes in UI copy (use commas, periods, parentheses, or the middle dot `·`).
- Hover (mouse) focuses a node and the card follows it; click pins; click again, Esc, close button, or empty canvas unpins (prototype behavior, unchanged from Prompt 1).
- Filtered-out founders drop to 0.07 on the map; cluster labels read `NAME · m/n` while any filter is active (already implemented in `createMap`; this plan feeds it `matched`, `filtersActive`, `pathFilter`).
- Big tech alum + Google must show 10 of 54 founders and 6 of 24 companies (spec 9). Selecting Dan Lorenc must reproduce `Main.dc.html`.
- Commit messages: imperative, one line, scope prefix (`filters:`, `panel:`, `app:`, `design:`). Run `npm test` and `npx tsc --noEmit` before each commit; the build chain `npm run build` runs validate, tokens, tsc, vite.
- Table view, hash sync, phone scroll-into-view, and dark contrast are Prompt 3. The View control is wired here but `#table-card` is only a shell.

## Review Focus

1. Search input with stray spaces, mixed case, and a token nothing contains (`"  Dan   LORENC zzz "`): tokens are trimmed and lowercased, every token must match, and the result is 0 founders with the row reading `0 of 54 founders · 0 of 24 companies` and cluster labels `· 0/n`. Test in Task 1 (`matchFounder`, `searchTokens`) and Task 3 (`activeRowHTML` zero counts).
2. A "Badges by path" segment clicked twice: the first click sets exactly {badge} + {path} and replaces any other path or badge filters; the second clears both; fund, search, selects, employers survive both clicks. Test in Task 1 (`toggleBadgePath`).
3. Removing one active chip keeps every other filter; Clear all resets fund, search, paths, badges, employers, and the four selects but never layers, selection, view, or tab. Test in Task 1 (`removeFilter`, `clearFilters`) and Task 6 (app).
4. Fast hover across nodes then leaving the map: the card shows the last hovered node and returns to the pinned node or the default card on leave, never a stale node. Test in Task 6 (app: pointerenter A, pointerenter B, pointerleave).
5. A card link that selects a node hidden by the layers (a one-off hub while "One-off ties" is off): the node is selected, its card renders, and nothing throws. Test in Task 6 (app).

---

## File structure

| File | Responsibility |
|---|---|
| `src/types.ts` (modify) | add `View`, `Tab`, `Filters` |
| `src/state.ts` (modify) | `State` gains `filters`, `view`, `tab`, `drawer`; `DEFAULT_FILTERS`; pure filter reducers |
| `src/filters/match.ts` (create) | `searchTokens`, `matchFounder`, `matchedFounders`, `matchedCompanies`, `activeFilterCount`, `activeChips` |
| `src/html.ts` (create) | `esc(s)` HTML escaping used by every renderer |
| `src/filters/drawer.ts` (create) | `drawerHTML(graph)` once at boot; `syncControls(root, state)` on every state change |
| `src/filters/active.ts` (create) | `activeRowHTML(chips, founders, companies, totals)` |
| `src/panel/card.ts` (create) | five card renderers + `detailHTML` dispatcher, `hostOf`, `talentOverlaps` |
| `src/panel/tabs.ts` (create) | `clustersHTML`, `badgeRowsHTML`, `insightsHTML` |
| `src/app.ts` (create) | `boot(doc)`: store, derived matched set, render pipeline, delegated events |
| `src/main.ts` (modify) | imports styles, calls `boot(document)` |
| `index.html` (modify) | drawer, active row, table shell, tabs with About copy |
| `design/tokens.json` + `src/styles/tokens.css` (modify) | `space.chipH 26`, `space.tabH 42`, `space.closeBtn 32`, `space.dlLabelW 88`, `text.chip 12`, `text.mini 12` |
| `src/styles/components.css` (modify) | drawer, chips, selects, active row, card parts, member list, tabs, cluster rows, badge bars, insights, about |
| `tests/filters.test.ts`, `tests/drawer.test.ts`, `tests/active.test.ts`, `tests/card.test.ts`, `tests/tabs.test.ts`, `tests/app.test.ts` (create); `tests/state.test.ts`, `tests/shell.test.ts` (extend) | |

### Data-attribute contract (renderers emit, `app.ts` listens)

| Attribute | Meaning | Value |
|---|---|---|
| `data-select` | select (pin) a node | node id |
| `data-close` | clear selection | none |
| `data-remove` | remove one active filter | `fund`, `q`, `path:<PathKey>`, `badge:<BadgeKey>`, `employer:<name>`, `school`, `vertical`, `status`, `oss` |
| `data-path`, `data-badge`, `data-employer` | toggle a drawer chip (also the hub card's "Filter to X alumni") | key or name |
| `data-cluster` | toggle a path from the Clusters list | PathKey |
| `data-bp` | badge-by-path segment | `<BadgeKey>:<PathKey>` |
| `data-oss` | company-level open source segment | `yes` / `partial` / `no` |
| `data-layer` | map layer chip | `companies` / `employers` / `schools` / `projects` / `oneOff` / `alt` |
| `data-fund` | fund segment | `all` / `amplify` / `haystack` |
| `data-view` | view segment | `map` / `table` |
| `data-tab` | tab button | `clusters` / `insights` / `about` |

Fixed ids: `#map-search`, `#fund-seg`, `#view-seg`, `#filters-btn`, `#filters-count`, `#filters-drawer`, `#sel-school`, `#sel-vertical`, `#sel-status`, `#sel-oss`, `#active-row`, `#clear-filters`, `#map-card`, `#table-card`, `#detail`, `#tabs`, `#tab-clusters`, `#tab-insights`, `#tab-about`, `#clusters-list`, `#badge-rows`, `#insights-list`.

---

### Task 1: Filter state, matching, and active chips

**Files:**
- Modify: `src/types.ts`, `src/state.ts`
- Create: `src/filters/match.ts`
- Test: `tests/filters.test.ts`, `tests/state.test.ts`

**Interfaces:**
- Consumes: `Graph`, `FounderNode`, `CompanyNode`, `PATH_ORDER`, `BADGE_ORDER`, `BIG_TECH`, `PATHS`, `BADGE_LABEL`, `FUND_LABEL`, `STATUS_LABEL`, `OSS_LABEL` from `src/model.ts`.
- Produces (`src/types.ts`):
  ```ts
  export type View = 'map' | 'table'
  export type Tab = 'clusters' | 'insights' | 'about'
  export interface Filters {
    fund: Fund | 'all'
    q: string
    paths: ReadonlySet<PathKey>
    badges: ReadonlySet<BadgeKey>
    employers: ReadonlySet<string>
    school: string
    vertical: string
    status: FounderStatus | ''
    oss: OssProduct | ''
  }
  ```
- Produces (`src/state.ts`): `State` = `{ focus; pinned; layers; filters: Filters; view: View; tab: Tab; drawer: boolean }`; `DEFAULT_FILTERS: Filters` (fund `'all'`, empty sets and strings); `DEFAULT_STATE: State`; pure reducers returning a new `Filters`: `togglePath(f, k: PathKey)`, `toggleBadge(f, k: BadgeKey)`, `toggleEmployer(f, name: string)`, `toggleBadgePath(f, badge: BadgeKey, path: PathKey)`, `toggleOss(f, v: OssProduct)`, `removeFilter(f, key: string)`, `clearFilters(): Filters`. Existing `createStore`, `hoverFocusAllowed`, `escapeClears`, `toggleSelect` unchanged.
- Produces (`src/filters/match.ts`): `searchTokens(q: string): string[]`; `matchFounder(f: FounderNode, filters: Filters): boolean`; `matchedFounders(graph: Graph, filters: Filters): Set<FounderNode>`; `matchedCompanies(graph: Graph, matched: Set<FounderNode>): CompanyNode[]`; `activeFilterCount(filters: Filters): number`; `interface Chip { category: string; label: string; remove: string }`; `activeChips(filters: Filters): Chip[]`.

Semantics (from the prototype `matchF`, `activeCount`, `renderActive`):
- fund: founder fund equals unless `'all'`. paths: founder path in set when set is non-empty. badges: every selected badge in `f.badges` (AND). employers: `f.bigTech` contains any selected (OR). school: founder has a `ties` entry with `hub.htype === 's'` and `hub.name === school` (covers taughtAt). vertical: `f.company.vertical`. status: `f.status`. oss: `f.company.openSourceProduct`. q: every token of `searchTokens(q)` is a substring of `f.haystack`.
- `activeFilterCount` = (fund !== all) + (q non-empty) + paths.size + badges.size + employers.size + school + vertical + status + oss, each select counting 1.
- `activeChips` order: fund (`Fund`, `FUND_LABEL`), search (`Search`, `“q”` with curly quotes), paths in `PATH_ORDER` (`Path`), badges in `BADGE_ORDER` (`Badge`), employers in `BIG_TECH` order (`Employer`), school (`School`), vertical (`Vertical`), status (`Status`, `STATUS_LABEL`), oss (`Open source`, `OSS_LABEL`). `remove` keys per the contract table.
- `toggleBadgePath`: `on = badges.has(badge) && paths.size === 1 && paths.has(path)`; result has empty badges and paths, then both added unless `on`; every other field unchanged. `toggleOss`: same value clears, otherwise sets. `clearFilters()` returns `DEFAULT_FILTERS`.

- [ ] **Step 1: Write the failing tests**

`tests/filters.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { graph } from '../src/data'
import { activeChips, activeFilterCount, matchFounder, matchedCompanies, matchedFounders, searchTokens } from '../src/filters/match'
import { DEFAULT_FILTERS } from '../src/state'
import type { Filters } from '../src/types'

const F = (p: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...p })
const lorenc = graph.byId.get('f:dan-lorenc')! as FounderNode

describe('filters', () => {
  it('tokenizes search: trimmed, lowercased, whitespace split', () => {
    expect(searchTokens('  Dan   LORENC ')).toEqual(['dan', 'lorenc'])
    expect(searchTokens('')).toEqual([])
  })
  it('every token must appear in the haystack', () => {
    expect(matchFounder(lorenc, F({ q: 'lorenc chainguard' }))).toBe(true)
    expect(matchFounder(lorenc, F({ q: '  Dan   LORENC zzz ' }))).toBe(false)
    expect(matchedFounders(graph, F({ q: 'zzzz' })).size).toBe(0)
    expect(matchedCompanies(graph, matchedFounders(graph, F({ q: 'zzzz' })))).toHaveLength(0)
  })
  it('fund, path, badge (all), employer (any), school, vertical, status, oss', () => {
    expect(matchFounder(lorenc, F({ fund: 'haystack' }))).toBe(false)
    expect(matchFounder(lorenc, F({ paths: new Set(['academic']) }))).toBe(false)
    expect(matchFounder(lorenc, F({ badges: new Set(['big_tech_alum', 'prior_exit']) }))).toBe(lorenc.badges.includes('prior_exit'))
    expect(matchFounder(lorenc, F({ employers: new Set(['Apple', 'Google']) }))).toBe(true)
    expect(matchFounder(lorenc, F({ school: 'MIT' }))).toBe(true)
    expect(matchFounder(lorenc, F({ school: 'Harvard' }))).toBe(false)
    expect(matchFounder(lorenc, F({ vertical: lorenc.company.vertical }))).toBe(true)
    expect(matchFounder(lorenc, F({ status: 'left' }))).toBe(lorenc.status === 'left')
    expect(matchFounder(lorenc, F({ oss: lorenc.company.openSourceProduct }))).toBe(true)
  })
  it('Big tech alum + Google shows 10 of 54 founders and 6 of 24 companies', () => {
    const m = matchedFounders(graph, F({ badges: new Set(['big_tech_alum']), employers: new Set(['Google']) }))
    expect(m.size).toBe(10)
    expect(matchedCompanies(graph, m)).toHaveLength(6)
  })
  it('counts active filters and lists chips in order with remove keys', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0)
    const f = F({ fund: 'amplify', q: 'x', paths: new Set(['academic']), badges: new Set(['big_tech_alum']), employers: new Set(['Google']), school: 'MIT', status: 'left', oss: 'yes' })
    expect(activeFilterCount(f)).toBe(8)
    expect(activeChips(F({ badges: new Set(['big_tech_alum']), employers: new Set(['Google']) }))).toEqual([
      { category: 'Badge', label: 'Big tech alum', remove: 'badge:big_tech_alum' },
      { category: 'Employer', label: 'Google', remove: 'employer:Google' },
    ])
    expect(activeChips(F({ q: 'ray' }))[0]).toEqual({ category: 'Search', label: '“ray”', remove: 'q' })
  })
})
```

Append to `tests/state.test.ts` (import `DEFAULT_FILTERS, clearFilters, removeFilter, toggleBadgePath, toggleOss, togglePath`):
```ts
  it('path, badge+path segment, oss, remove, clear', () => {
    const f0 = DEFAULT_FILTERS
    const f1 = togglePath(f0, 'academic')
    expect([...f1.paths]).toEqual(['academic'])
    expect(togglePath(f1, 'academic').paths.size).toBe(0)
    const seg = toggleBadgePath({ ...f1, fund: 'amplify', paths: new Set(['academic', 'repeat_founder']) }, 'prior_exit', 'repeat_founder')
    expect([...seg.badges]).toEqual(['prior_exit'])
    expect([...seg.paths]).toEqual(['repeat_founder'])
    expect(seg.fund).toBe('amplify')
    const off = toggleBadgePath(seg, 'prior_exit', 'repeat_founder')
    expect(off.badges.size + off.paths.size).toBe(0)
    expect(toggleOss(toggleOss(f0, 'yes'), 'yes').oss).toBe('')
    const many = { ...f0, fund: 'haystack' as const, q: 'a', employers: new Set(['Google', 'Uber']), school: 'MIT' }
    expect(removeFilter(many, 'employer:Google').employers.has('Uber')).toBe(true)
    expect(removeFilter(many, 'fund').fund).toBe('all')
    expect(removeFilter(many, 'school').school).toBe('')
    expect(clearFilters()).toEqual(DEFAULT_FILTERS)
  })
```
Update the three existing `tests/state.test.ts` calls that build a `State` literal to spread `DEFAULT_STATE` instead.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/filters.test.ts tests/state.test.ts`
Expected: FAIL, module `../src/filters/match` not found; `togglePath` not exported.

- [ ] **Step 3: Add the types and state reducers**

`src/types.ts`: `View`, `Tab`, `Filters` as in Interfaces. `src/state.ts`: extend `State`, add `DEFAULT_FILTERS`, `DEFAULT_STATE` (focus null, pinned false, `DEFAULT_LAYERS`, `DEFAULT_FILTERS`, view `'map'`, tab `'clusters'`, drawer false), and the reducers. Sets are copied, never mutated.

- [ ] **Step 4: Implement `src/filters/match.ts`**

Signatures from Interfaces. `matchedCompanies` keeps `graph.companies` order and includes a company when any member is in `matched`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/filters.test.ts tests/state.test.ts` then `npx tsc --noEmit`
Expected: PASS, tsc exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/state.ts src/filters/match.ts tests/filters.test.ts tests/state.test.ts
git commit -m "filters: add filter state, matching, and active chip derivation"
```

---

### Task 2: Markup, tokens, and styles for drawer, active row, tabs, table shell, and card parts

**Files:**
- Modify: `index.html`, `design/tokens.json`, `src/styles/tokens.css` (generated), `src/styles/components.css`
- Test: `tests/shell.test.ts`, `tests/tokens.test.ts` (one assertion)

**Interfaces:**
- Produces the fixed ids and the class names every renderer uses: `.drawer`, `.drawer__group`, `.drawer__title`, `.chip`, `.chip__dot`, `.chip__count`, `.chip--path`, `.chip--alt`, `.chip--badge`, `.select` (label + select), `.active`, `.achip`, `.achip__cat`, `.active__count`, `.linkbtn`, `.card__head`, `.card__close`, `.card__sub`, `.chips`, `.dl`, `.card__company`, `.card__company-name`, `.mini`, `.card__source`, `.card__status`, `.card__note`, `.members`, `.member`, `.member__dot`, `.member__dot--square`, `.member__name`, `.member__side`, `.tabs`, `.tab`, `.tabpanel`, `.tabpanel__head`, `.cluster-row`, `.cluster-row__dot`, `.cluster-row__name`, `.cluster-row__count`, `.cluster-row__def`, `.cluster-row__bar`, `.brow`, `.brow__label`, `.bbar`, `.bseg`, `.is-dim`, `.bnote`, `.insights`, `.about`.

Markup to add to `index.html` (copy exactly where structure matters):
- After `.toolbar`: `<section class="wrap drawer" id="filters-drawer" aria-label="Filters" hidden></section>` (groups rendered at boot by `drawerHTML`).
- Then `<div class="wrap active" id="active-row" hidden></div>`.
- Inside `main`, after `#map-card`: `<section class="card table-card" id="table-card" aria-label="Founders table" hidden><p class="body">Table view arrives in the next step.</p></section>`.
- Replace the `aside` contents with: the existing `#detail` card (unchanged default copy), then
  ```html
  <section class="card tabs-card" aria-label="Clusters, insights, and about">
    <div class="tabs" role="tablist" id="tabs">
      <button type="button" class="tab" role="tab" data-tab="clusters" aria-selected="true" aria-controls="tab-clusters">Clusters</button>
      <button type="button" class="tab" role="tab" data-tab="insights" aria-selected="false" aria-controls="tab-insights">Insights</button>
      <button type="button" class="tab" role="tab" data-tab="about" aria-selected="false" aria-controls="tab-about">About</button>
    </div>
    <div class="tabpanel" role="tabpanel" id="tab-clusters">
      <div class="tabpanel__head"><span>Path</span><span class="num">Amplify · Haystack</span></div>
      <div id="clusters-list"></div>
      <div class="tabpanel__head"><span>Badges by path</span><span>tap a segment to filter</span></div>
      <div id="badge-rows"></div>
    </div>
    <div class="tabpanel" role="tabpanel" id="tab-insights" hidden>
      <div class="tabpanel__head"><span>What the map shows</span></div>
      <ul class="insights" id="insights-list"></ul>
    </div>
    <div class="tabpanel about" role="tabpanel" id="tab-about" hidden>
      <div class="tabpanel__head"><span>How it is built</span></div>
      <p><b>Paths.</b> Each founder sits in one cluster for the main career path that led to this company, from public bios as of October 2026. A dashed stub points toward a second path that also fits.</p>
      <p><b>Open source is a badge, not a path.</b> Prior open source means the founder created or co-created a notable project before this company (Envoy, Ray, Vagrant). Open source product is a company attribute: whether the core product is open, partial (open tooling or standard, commercial core), or closed.</p>
      <p><b>Big tech</b> means Google, Facebook (Meta), Microsoft, Amazon, Apple, Twitter, Uber, Lyft, or Palantir. Big tech engineer is a path (years building inside a large company or agency, such as the NSA); Big tech alum is a badge (worked at one of the nine).</p>
      <p><b>Stations</b> are employers and schools shared by two or more founders, plus every prior open source project; turn on One-off ties in Filters for the rest. Valuations and rounds are the latest public figures. Full bios and sources live in <a href="https://claude.ai/code/artifact/619f117c-df06-44e8-abac-ee2e6b95b82d" target="_blank" rel="noopener">Amplify Portfolio: Founder Briefs</a>.</p>
    </div>
  </section>
  ```
- Add `<option value="">Any</option>` style selects only via `drawerHTML` (Task 3), not here.

Styles (values from the artboards; every literal goes through a token):
- `.drawer`: grid `repeat(auto-fit, minmax(200px, 1fr))`, gap 14px 24px, surface, hairline border, radius card, padding 16px 20px, margin-top 12px. `.drawer__title`: eyebrow style (11/600 uppercase 0.06em muted). `.drawer__group`: flex column gap 6px.
- `.chip`: inline-flex, height `--space-chipH`, padding 0 10px, gap 6px, hairline border, radius chip, surface, 12px/500 (`--text-chip`), `.chip__count` muted tabular, margin-left auto; `[aria-pressed="true"]`: ink background, surface text, ink border. `.chip__dot`: 8px circle `--c`. `.chip--path`: accentTint background, no border. `.chip--alt`: dashed hairline border. `.chip--badge`: default chip. Drawer chips are full-width (`width: 100%` inside `.drawer__group`); card chips are inline.
- `.select`: flex, gap 8px, hairline border, radius control, padding 0 10px, height `--space-controlH`; label 11/600 uppercase muted; select borderless, 13/500, flex 1.
- `.active`: flex wrap, gap 8px, 13px, margin-top 12px. `.achip`: inline-flex, height 30px, padding 0 4px 0 10px, hairline border, radius chip, surface, 12/500; `.achip__cat` muted + `&nbsp;`; its button 22px square, borderless, radius chip, 12px svg. `.active__count` muted margin-left 4px. `.linkbtn`: borderless, transparent, accent color, 13/500, height 30px, padding 0 8px.
- Card: `.card__head` flex space-between gap 12px; `.card__close` 32px square (`--space-closeBtn`), margin `-6px -6px 0 0`, borderless, radius control, muted, svg 16px. `.card__sub` 13px muted (role) with the company button in ink. `.chips` flex wrap gap 6px. `.dl` grid `--space-dlLabelW minmax(0,1fr)`, gap 8px 12px, 13px; `dt` label style (11/600 uppercase 0.06em muted, padding-top 2px); `dd` margin 0; buttons inside `.dl` use `.linkbtn--ink` (ink text, underline hairline). `.card__company` border-top hairline, padding-top 14px, flex column gap 4px; name 14/600; `.mini` 12px muted. `.card__source` 12px muted. `.card__status` 13px with `b`. `.card__note` 12px muted.
- `.members`: flex column, margin-top 8px. `.member`: grid `12px minmax(0,1fr) auto`, gap 8px, border-top hairline, padding 8px 0, text-align left, transparent, 13px; `.member__dot` 9px circle `--c`, `--square` radius 2px; `.member__name` 500; `.member__side` muted 12px nowrap.
- `.tabs-card`: overflow hidden, padding 0. `.tabs`: flex, border-bottom hairline, padding 0 8px. `.tab`: height `--space-tabH`, padding 0 12px, borderless, transparent, 13/500 muted, border-bottom 2px transparent, margin-bottom -1px; `[aria-selected="true"]` ink text + ink border-bottom. `.tabpanel`: padding 12px 16px 16px, flex column gap 8px. `.tabpanel__head`: flex space-between, 11/600 uppercase 0.06em muted, padding 6px 0.
- `.cluster-row`: grid `12px minmax(0,1fr) auto`, gap 2px 10px, align baseline, width 100%, text-align left, transparent, border 1px transparent, radius control, padding 8px 10px, border-bottom hairline (last none); `[aria-pressed="true"]` border-color `--c`, page background. `.cluster-row__dot` 10px circle `--c`; `__name` 13/600; `__count` 13px muted tabular; `__def` grid-column 2/4, 12px muted; `__bar` grid-column 2/4, flex, height 4px, radius 3px, hairline background, margin-top 5px; `i` block `--c`; `i.hay` opacity 0.42.
- `.brow`: grid `112px minmax(0,1fr)`, gap 4px 10px, align center, padding 6px 0, border-top hairline, 12px; `.brow__label` 600 with `small` block 11px muted 400. `.bbar`: flex, height 16px, radius 4px, overflow hidden, hairline background. `.bseg`: borderless, `--c` background, surface text, 11/600 tabular, grid place-items center, min-width 0; `[aria-pressed="true"]` outline 2px ink inset; `.is-dim` opacity 0.35. `.bnote` 12px muted, margin 6px 0 0.
- `.insights`: margin 0, padding-left 18px, flex column gap 9px, 13px/1.48. `.about p`: margin 0 0 8px, 12px muted 1.5; `.about a` ink.
- Phone block (`max-width: 980px`): `.chip`, `.achip` height `--space-controlHPhone`-8 is not needed; keep 26/30. Nothing else.

- [ ] **Step 1: Write the failing tests**

Append to `tests/shell.test.ts` `describe`:
```ts
  it('drawer, active row, table shell, and tabs are in the shell', () => {
    expect(document.querySelector('#filters-btn')?.getAttribute('aria-controls')).toBe('filters-drawer')
    expect(document.querySelector('#filters-drawer')?.hasAttribute('hidden')).toBe(true)
    expect(document.querySelector('#active-row')?.hasAttribute('hidden')).toBe(true)
    expect(document.querySelector('main #table-card')?.hasAttribute('hidden')).toBe(true)
    const tabs = [...document.querySelectorAll('#tabs [role="tab"]')]
    expect(tabs.map((t) => t.getAttribute('data-tab'))).toEqual(['clusters', 'insights', 'about'])
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false'])
    expect(tabs.every((t) => document.getElementById(t.getAttribute('aria-controls')!)?.getAttribute('role') === 'tabpanel')).toBe(true)
    expect(document.querySelector('#tab-about a[href*="claude.ai"]')).not.toBeNull()
    expect(document.querySelector('#tab-about')?.hasAttribute('hidden')).toBe(true)
  })
```
Append to `tests/tokens.test.ts`: `expect(css).toMatch(/--space-chipH: 26px/)` and `/--space-tabH: 42px/` against the generated `src/styles/tokens.css` (read the file as the existing test does).

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/shell.test.ts tests/tokens.test.ts`
Expected: FAIL on `#filters-drawer` null and missing tokens.

- [ ] **Step 3: Add tokens, regenerate, write markup and styles**

`design/tokens.json`: `space.chipH: 26`, `space.tabH: 42`, `space.closeBtn: 32`, `space.dlLabelW: 88`; `text.chip: 12`, `text.mini: 12`. Run `npm run tokens`. Edit `index.html` and `components.css` per the lists above.

- [ ] **Step 4: Run tests, type check, build**

Run: `npx vitest run` then `npm run build`
Expected: all pass; build succeeds with JS still under 300 KB gzipped.

- [ ] **Step 5: Commit**

```bash
git add index.html design/tokens.json src/styles/tokens.css src/styles/components.css tests/shell.test.ts tests/tokens.test.ts
git commit -m "design: drawer, active row, tabs, table shell markup and styles"
```

---

### Task 3: Drawer renderer, control sync, and active row

**Files:**
- Create: `src/html.ts`, `src/filters/drawer.ts`, `src/filters/active.ts`
- Test: `tests/drawer.test.ts`, `tests/active.test.ts`

**Interfaces:**
- Consumes: `Graph`, `State`, `Filters`, `DEFAULT_LAYERS`, label constants, `Chip`.
- Produces: `esc(s: unknown): string` (escapes `& < > " '`). `drawerHTML(graph: Graph): string`. `syncControls(root: ParentNode, s: State): void`. `activeRowHTML(chips: Chip[], founders: number, companies: number, totals: { founders: number; companies: number }): string`.

`drawerHTML` groups, in order, each `<div class="drawer__group"><h3 class="drawer__title">…</h3>…</div>`:
1. Path: for each `graph.clusters`: `<button type="button" class="chip" data-path="<key>" aria-pressed="false" style="--c: var(--path-<key>)"><span class="chip__dot"></span><name><span class="chip__count num"><founders.length></span></button>`.
2. Badges: `BADGE_ORDER` chips `data-badge`, count = founders whose `badges` include it.
3. Big tech employer: `BIG_TECH` order, `data-employer="<name>"`, count = founders whose `bigTech` includes it (0 allowed).
4. More: four `<label class="select"><span>School</span><select id="sel-school">…</select></label>`: school options `Any` + school hubs (`htype === 's'`) sorted by degree desc then name, text `Name (degree)`, value name; vertical options `Any` + distinct `company.vertical` in company order, text `Vertical (n founders)`; status options `Any` + `STATUS_LABEL` entries; open source options `Any` + `OSS_LABEL` entries. Ids `sel-school`, `sel-vertical`, `sel-status`, `sel-oss`.
5. Map layers: six chips `data-layer` in the order companies, employers, schools, projects, oneOff, alt with labels Companies, Employers, Schools, Prior open source, One-off ties, Also-fits stubs; `aria-pressed` from `DEFAULT_LAYERS`.

`syncControls(root, s)`: sets `aria-pressed` on every `[data-path]`, `[data-badge]`, `[data-employer]`, `[data-cluster]` (from `s.filters`), `[data-layer]` (from `s.layers`), `[data-fund]`, `[data-view]`; select values (`#sel-school` ← school, `#sel-vertical`, `#sel-status`, `#sel-oss`); `#map-search` value when it differs; `#filters-btn` `aria-expanded`; `#filters-drawer` hidden = `!s.drawer`; `#filters-count` text = count or hidden when 0; `#map-card` hidden when view is table and `#table-card` hidden when map; `[data-tab]` `aria-selected` and `#tab-<key>` hidden. Count comes from `activeFilterCount(s.filters)`.

`activeRowHTML`: returns `''` when `chips` is empty. Otherwise each chip: `<span class="achip"><span class="achip__cat"><category></span>&nbsp;<label><button type="button" data-remove="<remove>" aria-label="Remove filter <label>"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg></button></span>`, then `<span class="active__count"><b><founders></b> of <totals.founders> founders · <b><companies></b> of <totals.companies> companies</span><button type="button" class="linkbtn" id="clear-filters">Clear all</button>`.

- [ ] **Step 1: Write the failing tests**

`tests/drawer.test.ts` (jsdom):
```ts
const root = document.createElement('div')
root.innerHTML = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '')
root.querySelector('#filters-drawer')!.innerHTML = drawerHTML(graph)

it('renders path, badge, employer chips with counts, selects, and layer chips', () => {
  const paths = [...root.querySelectorAll('[data-path]')]
  expect(paths.map((b) => b.getAttribute('data-path'))).toEqual(PATH_ORDER)
  expect(paths.map((b) => b.querySelector('.chip__count')?.textContent)).toEqual(graph.clusters.map((c) => String(c.founders.length)))
  expect(root.querySelectorAll('[data-badge]')).toHaveLength(4)
  expect(root.querySelector('[data-badge="big_tech_alum"] .chip__count')?.textContent).toBe(String(graph.founders.filter((f) => f.badges.includes('big_tech_alum')).length))
  expect([...root.querySelectorAll('[data-employer]')].map((b) => b.getAttribute('data-employer'))).toEqual([...BIG_TECH])
  const schools = root.querySelectorAll('#sel-school option')
  expect(schools).toHaveLength(graph.hubs.filter((h) => h.htype === 's').length + 1)
  expect(schools[0].textContent).toBe('Any')
  expect(root.querySelectorAll('#sel-status option')).toHaveLength(4)
  expect(root.querySelectorAll('#sel-oss option')).toHaveLength(4)
  expect(root.querySelector('label[for], label.select select')).not.toBeNull()
  expect([...root.querySelectorAll('[data-layer]')].map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true', 'true', 'false', 'true'])
})
it('syncControls mirrors the state into every control', () => {
  const s: State = { ...DEFAULT_STATE, drawer: true, view: 'table', tab: 'about', filters: { ...DEFAULT_FILTERS, paths: new Set(['academic']), status: 'left', q: 'ray' } }
  syncControls(root, s)
  expect(root.querySelector('[data-path="academic"]')?.getAttribute('aria-pressed')).toBe('true')
  expect(root.querySelector('[data-path="big_tech_engineer"]')?.getAttribute('aria-pressed')).toBe('false')
  expect(root.querySelector('#filters-drawer')?.hasAttribute('hidden')).toBe(false)
  expect(root.querySelector('#filters-btn')?.getAttribute('aria-expanded')).toBe('true')
  expect(root.querySelector('#filters-count')?.textContent).toBe('3')
  expect((root.querySelector('#sel-status') as HTMLSelectElement).value).toBe('left')
  expect((root.querySelector('#map-search') as HTMLInputElement).value).toBe('ray')
  expect(root.querySelector('#map-card')?.hasAttribute('hidden')).toBe(true)
  expect(root.querySelector('#table-card')?.hasAttribute('hidden')).toBe(false)
  expect(root.querySelector('[data-tab="about"]')?.getAttribute('aria-selected')).toBe('true')
  expect(root.querySelector('#tab-about')?.hasAttribute('hidden')).toBe(false)
  expect(root.querySelector('#tab-clusters')?.hasAttribute('hidden')).toBe(true)
  syncControls(root, DEFAULT_STATE)
  expect(root.querySelector('#filters-count')?.hasAttribute('hidden')).toBe(true)
})
```
`tests/active.test.ts` (jsdom):
```ts
it('is empty without chips, otherwise chips with category, remove button, counts, and clear all', () => {
  expect(activeRowHTML([], 54, 24, { founders: 54, companies: 24 })).toBe('')
  const el = document.createElement('div')
  el.innerHTML = activeRowHTML([{ category: 'Badge', label: 'Big tech alum', remove: 'badge:big_tech_alum' }, { category: 'Employer', label: 'Google', remove: 'employer:Google' }], 10, 6, { founders: 54, companies: 24 })
  expect(el.querySelectorAll('.achip')).toHaveLength(2)
  expect(el.querySelector('.achip .achip__cat')?.textContent).toBe('Badge')
  expect(el.querySelector('[data-remove="employer:Google"]')?.getAttribute('aria-label')).toBe('Remove filter Google')
  expect(el.querySelector('.active__count')?.textContent).toBe('10 of 54 founders · 6 of 24 companies')
  expect(el.querySelector('#clear-filters')?.textContent).toBe('Clear all')
  el.innerHTML = activeRowHTML([{ category: 'Search', label: '“zzz”', remove: 'q' }], 0, 0, { founders: 54, companies: 24 })
  expect(el.querySelector('.active__count')?.textContent).toBe('0 of 54 founders · 0 of 24 companies')
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/drawer.test.ts tests/active.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `src/html.ts`, `src/filters/drawer.ts`, `src/filters/active.ts`**

- [ ] **Step 4: Run tests and tsc**

Run: `npx vitest run tests/drawer.test.ts tests/active.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/html.ts src/filters/drawer.ts src/filters/active.ts tests/drawer.test.ts tests/active.test.ts
git commit -m "filters: render the drawer, control states, and the active filters row"
```

---

### Task 4: Detail card variants

**Files:**
- Create: `src/panel/card.ts`
- Test: `tests/card.test.ts`

**Interfaces:**
- Consumes: `esc`, graph node types, `Cluster`, `Filters`, `State`, `PATHS`, `PATH_ORDER`, `BADGE_LABEL`, `BADGE_ORDER`, `BIG_TECH`, `FUND_LABEL`, `STATUS_LABEL`, `OSS_LABEL`, `HUB_TYPE_LABEL`.
- Produces: `hostOf(url: string): string` (hostname without `www.`, or the input when unparsable); `talentOverlaps(c: CompanyNode): { company: CompanyNode; hubs: string[] }[]` (companies sharing a non-one-off hub with any member, excluding `c`, sorted by hub count desc then name, top 6); `founderCardHTML(f: FounderNode): string`; `companyCardHTML(c: CompanyNode): string`; `hubCardHTML(h: HubNode, filters: Filters): string`; `clusterCardHTML(c: Cluster, matched: Set<FounderNode>, graph: Graph): string`; `defaultCardHTML(graph: Graph): string`; `detailHTML(node: AnyNode | null, s: State, graph: Graph, matched: Set<FounderNode>): string` (node → its card by kind; otherwise cluster card when `s.filters.paths.size === 1`, else default).

Shared pieces: `closeBtn = <button type="button" class="card__close" data-close aria-label="Close details"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg></button>`; `link(node) = <button type="button" class="linkbtn linkbtn--ink" data-select="<id>"><name></button>`; `memberRow(f, side) = <button type="button" class="member" data-select="<id>" style="--c: var(--path-<path>)"><span class="member__dot<fund haystack ? ' member__dot--square' : ''>"></span><span class="member__name"><name></span><span class="member__side"><side></span></button>`; members sort by `PATH_ORDER` index then name.

Founder card (artboard order): `<div class="card__head"><div><p class="eyebrow">Founder · <FUND_LABEL></p><h2 class="card-title"><name></h2><p class="card__sub"><role> · <link(company)></p></div><closeBtn></div>`; `<div class="chips">` path chip `<span class="chip chip--path" style="--c: var(--path-<key>)"><span class="chip__dot"></span><PATHS.name></span>`, also-fits chip `<span class="chip chip--alt" style="--c: …">Also fits: <name></span>` when `secondaryPath`, badge chips `<span class="chip chip--badge"><BADGE_LABEL></span>` in `BADGE_ORDER` for `f.badges`; `<p class="body"><bio></p>`; when `status !== 'active'`: `<p class="card__status"><b><STATUS_LABEL>.</b> <statusNote or ''></p>`; when `edgeCase`: `<p class="card__note">Edge case: no clean path fits, so this placement is tentative.</p>`; `<dl class="dl">` rows Worked at (e ties), School (s ties, append ` (taught)` for rel `Taught at`), Prior OSS (o ties), Co-founders (company members minus self), each row omitted when empty, values are `link()`s joined by `, `; company block `<div class="card__company"><div class="card__company-row"><p class="card__company-name"><link(company)></p><p class="mini"><vertical></p></div><p class="body"><latest></p><p class="mini">Founded <founded> · <status> · <OSS_LABEL></p></div>`; `<p class="card__source">Source: <a href="<source>" target="_blank" rel="noopener"><hostOf(source)></a></p>`.

Company card: eyebrow `Company · <FUND_LABEL> · <vertical>`; title; sub `Founded <founded>` + ` · founders about <avgFounderAgeAtFounding> at founding` when not null; `<p class="body"><description></p>`; dl rows Status, Latest, Open source (`OSS_LABEL`), Team (path chips `chip--path` for the distinct member paths in `PATH_ORDER`, plus `<p class="mini"><k> of <n> founders changed role or left</p>` when k > 0), Shares talent pools with (`link(company) <span class="mini">(<hubs joined by ", ">)</span>` per overlap, separated by `<br>`; row omitted when none); `<p class="eyebrow"><n> founders</p>` (`Founder` when 1); members with side = role with a leading `Co-founder, ` / `Co-founder; ` stripped, or `Co-founder` when that leaves nothing.

Hub card: eyebrow `<HUB_TYPE_LABEL>` + ` · one-off tie` when `oneOff` + ` · big tech` when `BIG_TECH` includes the name; title; sub `<degree> founder(s) across <p> path(s) and <c> compan(y|ies) · Amplify <a>, Haystack <h>`; when big tech: `<div class="chips"><button type="button" class="chip" data-employer="<name>" aria-pressed="<filters.employers.has(name)>">Filter to <name> alumni</button></div>`; members (side = company name).

Cluster card: eyebrow `Cluster`; title `<name>`; sub `<def>`; dl rows Founders (`Amplify <a>, Haystack <h>` + ` · <m> match the current filters` when `m !== founders.length`, m = members in `matched`), Shared ties (non-one-off hubs with ≥ 2 members in this path, sorted by that count desc, top 6, `link(hub) (<count>)`), Also fits here (founders whose `secondaryPath === key`, links); members = matched founders sorted by fund then name, side = company name.

Default card: eyebrow `Start here`, title `Pick any dot or station`, body copy as in `index.html`, then `<div class="chips">` with `<button type="button" class="chip" data-select="<id>"><name></button>` for ids `e:uber`, `s:harvard`, `c:temporal`, `f:matt-klein` that exist in `graph.byId`.

- [ ] **Step 1: Write the failing tests**

`tests/card.test.ts` (jsdom), using `const el = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return d }`:
```ts
const lorenc = graph.byId.get('f:dan-lorenc') as FounderNode
it('founder card matches the artboard structure for Dan Lorenc', () => {
  const d = el(founderCardHTML(lorenc))
  expect(d.querySelector('.eyebrow')?.textContent).toBe('Founder · Amplify')
  expect(d.querySelector('h2')?.textContent).toBe('Dan Lorenc')
  expect(d.querySelector('.card__sub [data-select]')?.getAttribute('data-select')).toBe('c:chainguard')
  expect(d.querySelector('.chip--path')?.textContent).toBe('Big tech engineer')
  expect([...d.querySelectorAll('.chip--badge')].map((c) => c.textContent)).toEqual(BADGE_ORDER.filter((b) => lorenc.badges.includes(b)).map((b) => BADGE_LABEL[b]))
  expect([...d.querySelectorAll('dt')].map((t) => t.textContent)).toEqual(['Worked at', 'School', 'Prior OSS', 'Co-founders'])
  const dd = [...d.querySelectorAll('dd')]
  expect([...dd[2].querySelectorAll('[data-select]')].map((b) => b.getAttribute('data-select'))).toEqual(['o:kubernetes', 'o:sigstore', 'o:slsa', 'o:tekton', 'o:distroless'])
  expect(dd[3].querySelectorAll('[data-select]')).toHaveLength(lorenc.company.members.length - 1)
  expect(d.querySelector('.card__company .mini')?.textContent).toBe(lorenc.company.vertical)
  expect(d.querySelector('.card__company')?.textContent).toContain(`Founded ${lorenc.company.founded} · ${lorenc.company.status} · ${OSS_LABEL[lorenc.company.openSourceProduct]}`)
  const a = d.querySelector('.card__source a')!
  expect(a.textContent).toBe(hostOf(lorenc.source))
  expect(a.getAttribute('rel')).toBe('noopener')
  expect(d.querySelector('[data-close]')?.getAttribute('aria-label')).toBe('Close details')
  expect(d.querySelector('.card__status')).toBeNull()
})
it('status note, also-fits chip, edge-case note appear only when set', () => {
  const moved = graph.founders.find((f) => f.status !== 'active')!
  expect(el(founderCardHTML(moved)).querySelector('.card__status')?.textContent).toContain(STATUS_LABEL[moved.status])
  const alt = graph.founders.find((f) => f.secondaryPath)!
  expect(el(founderCardHTML(alt)).querySelector('.chip--alt')?.textContent).toBe(`Also fits: ${PATHS[alt.secondaryPath!].name}`)
  const edge = graph.founders.find((f) => f.edgeCase)
  if (edge) expect(el(founderCardHTML(edge)).querySelector('.card__note')?.textContent).toContain('tentative')
})
it('company card: eyebrow, founded line, team paths, overlaps, members by path', () => {
  const c = lorenc.company
  const d = el(companyCardHTML(c))
  expect(d.querySelector('.eyebrow')?.textContent).toBe(`Company · Amplify · ${c.vertical}`)
  expect(d.querySelector('.card__sub')?.textContent).toBe(`Founded ${c.founded}` + (c.avgFounderAgeAtFounding ? ` · founders about ${c.avgFounderAgeAtFounding} at founding` : ''))
  expect([...d.querySelectorAll('dt')].map((t) => t.textContent).slice(0, 4)).toEqual(['Status', 'Latest', 'Open source', 'Team'])
  expect(d.querySelectorAll('.member')).toHaveLength(c.members.length)
  expect(talentOverlaps(c).length).toBeLessThanOrEqual(6)
  expect(talentOverlaps(c).every((o) => o.company !== c && o.hubs.length > 0)).toBe(true)
})
it('hub card: counts line and the alumni filter chip for big tech', () => {
  const g = graph.byId.get('e:google') as HubNode
  const paths = new Set(g.members.map((m) => m.path)).size
  const comps = new Set(g.members.map((m) => m.company)).size
  const amp = g.members.filter((m) => m.fund === 'amplify').length
  const d = el(hubCardHTML(g, { ...DEFAULT_FILTERS, employers: new Set(['Google']) }))
  expect(d.querySelector('.eyebrow')?.textContent).toBe('Employer · big tech')
  expect(d.querySelector('.card__sub')?.textContent).toBe(`${g.degree} founders across ${paths} paths and ${comps} companies · Amplify ${amp}, Haystack ${g.degree - amp}`)
  expect(d.querySelector('[data-employer="Google"]')?.getAttribute('aria-pressed')).toBe('true')
  expect(d.querySelectorAll('.member')).toHaveLength(g.degree)
  const mit = graph.byId.get('s:mit') as HubNode
  expect(el(hubCardHTML(mit, DEFAULT_FILTERS)).querySelector('[data-employer]')).toBeNull()
})
it('cluster card and default card', () => {
  const c = graph.clusters[0]
  const d = el(clusterCardHTML(c, new Set(graph.founders), graph))
  expect(d.querySelector('h2')?.textContent).toBe(c.name)
  expect(d.querySelector('dd')?.textContent).toBe(`Amplify ${c.counts.amplify}, Haystack ${c.counts.haystack}`)
  expect(d.querySelectorAll('.member')).toHaveLength(c.founders.length)
  const half = new Set(c.founders.slice(0, 3))
  expect(el(clusterCardHTML(c, half, graph)).querySelector('dd')?.textContent).toContain('3 match the current filters')
  const def = el(defaultCardHTML(graph))
  expect(def.querySelector('h2')?.textContent).toBe('Pick any dot or station')
  expect(def.querySelectorAll('.chips [data-select]')).toHaveLength(['e:uber', 's:harvard', 'c:temporal', 'f:matt-klein'].filter((id) => graph.byId.has(id)).length)
})
it('detailHTML dispatches by node, single path filter, or default', () => {
  expect(detailHTML(lorenc, DEFAULT_STATE, graph, new Set(graph.founders))).toContain('Dan Lorenc')
  const one = { ...DEFAULT_STATE, filters: { ...DEFAULT_FILTERS, paths: new Set(['academic']) } }
  expect(detailHTML(null, one, graph, new Set(graph.founders))).toContain('Academic')
  expect(detailHTML(null, DEFAULT_STATE, graph, new Set(graph.founders))).toContain('Pick any dot or station')
})
```

- [ ] **Step 2: Run to verify they fail** — `npx vitest run tests/card.test.ts` → module not found.

- [ ] **Step 3: Implement `src/panel/card.ts`**

- [ ] **Step 4: Run tests and tsc** — `npx vitest run tests/card.test.ts && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/panel/card.ts tests/card.test.ts
git commit -m "panel: founder, company, hub, cluster, and default cards"
```

---

### Task 5: Clusters, badges by path, and insights tabs

**Files:**
- Create: `src/panel/tabs.ts`
- Test: `tests/tabs.test.ts`

**Interfaces:**
- Consumes: `Graph`, `Filters`, `esc`, label constants, `link()` pattern from Task 4 (re-implement locally or export `link` from `card.ts`; export it).
- Produces: `clustersHTML(graph: Graph, matched: Set<FounderNode>, filtersActive: boolean, filters: Filters): string`; `badgeRowsHTML(graph: Graph, filters: Filters): string`; `insightsHTML(graph: Graph): string`.

`clustersHTML`: one `<button type="button" class="cluster-row" data-cluster="<key>" aria-pressed="<filters.paths.has(key)>" style="--c: var(--path-<key>)">` per cluster in `PATH_ORDER` containing `<span class="cluster-row__dot"></span><span class="cluster-row__name"><name></span><span class="cluster-row__count num"><count></span><span class="cluster-row__def"><def></span><span class="cluster-row__bar" aria-hidden="true"><i style="width: <amplify/maxN*100>%"></i><i class="hay" style="width: <haystack/maxN*100>%"></i></span>`; `count` = `${amplify} · ${haystack}` or, when `filtersActive`, `${a} · ${h} of ${n}` with a/h counted among `matched`; `maxN` = largest `founders.length`.

`badgeRowsHTML`: for each badge in `BADGE_ORDER`: `<div class="brow"><div class="brow__label"><label><small><n> founders</small></div><div class="bbar">` + one `<button type="button" class="bseg<is-dim>" data-bp="<badge>:<path>" aria-pressed="<on>" style="--c: var(--path-<path>); flex: <n>" title="<PATHS.name>: <n>"><n></button>` per path in `PATH_ORDER` with n > 0, where `on = badges.has(badge) && paths.size === 1 && paths.has(path)` and `is-dim` when `badges.has(badge) && paths.size > 0 && !paths.has(path)`; then the company row `<div class="brow"><div class="brow__label">Open source product<small>company level</small></div><div class="bbar">` with `data-oss="yes|partial|no"` segments, `aria-pressed = filters.oss === key`, `style="--c: var(--path-repeat_founder); opacity: 1|0.6|0.3; flex: <count>"`, `title="<OSS_LABEL>: <count> companies"`; then `<p class="bnote">Open source is a badge on top of a path. <b><top.n> of the <oss.length></b> founders with prior open source work are <top path name lowercased>s. Separately, <yes> of <companies> companies sell an open source product and <partial> are partially open.</p>`.

`insightsHTML`: six `<li>` in the prototype's wording with computed values and `link()` buttons: (1) `<b>Amplify leans on one path.</b> <A.n> of its <A.total> founders are <A path>s. Haystack's biggest group is <H path>s, <H.n> of <H.total>.` (2) `<b>Busiest stations:</b> <top 3 employer hubs by degree as link (degree)>. <big> of the <riders> founders who passed through them are big tech engineers, which is why that neighborhood is so dense.` (3) `<b>Shared by both funds:</b> <n> stations, led by <top 5 links>. This is where the two portfolios draw from the same talent.` (non-one-off hubs with members from both funds, by degree desc) (4) `<b>Most mixed stations:</b> <up to 4 links> each connect <k> different paths.` (5) `<b>Mixed teams:</b> <n> of <companies> companies pair founders from different paths, such as <3 links>.` (6) `<b>Founder turnover:</b> <n> of <founders> founders have changed role or left, including <links to status left>. Filter Status to see them.` Path names lowercased with an `s` appended as in the prototype.

- [ ] **Step 1: Write the failing tests**

`tests/tabs.test.ts` (jsdom):
```ts
it('cluster rows in path order with Amplify · Haystack counts and filtered counts', () => {
  const d = el(clustersHTML(graph, new Set(graph.founders), false, DEFAULT_FILTERS))
  const rows = [...d.querySelectorAll('.cluster-row')]
  expect(rows.map((r) => r.getAttribute('data-cluster'))).toEqual(PATH_ORDER)
  expect(rows.map((r) => r.querySelector('.cluster-row__count')?.textContent)).toEqual(graph.clusters.map((c) => `${c.counts.amplify} · ${c.counts.haystack}`))
  const maxN = Math.max(...graph.clusters.map((c) => c.founders.length))
  expect((rows[0].querySelector('.cluster-row__bar i') as HTMLElement).style.width).toBe(`${(graph.clusters[0].counts.amplify / maxN) * 100}%`)
  const some = new Set(graph.founders.filter((f) => f.fund === 'amplify'))
  const f = el(clustersHTML(graph, some, true, { ...DEFAULT_FILTERS, paths: new Set(['academic']) }))
  expect(f.querySelector('[data-cluster="academic"]')?.getAttribute('aria-pressed')).toBe('true')
  expect(f.querySelector('[data-cluster="big_tech_engineer"] .cluster-row__count')?.textContent).toBe(`${graph.clusters[0].counts.amplify} · 0 of ${graph.clusters[0].founders.length}`)
})
it('badge rows: segments sum to the badge count, pressed and dim states, company oss row', () => {
  const d = el(badgeRowsHTML(graph, { ...DEFAULT_FILTERS, badges: new Set(['prior_exit']), paths: new Set(['repeat_founder']) }))
  const rows = [...d.querySelectorAll('.brow')]
  expect(rows).toHaveLength(5)
  const exitSegs = [...rows[1].querySelectorAll('.bseg')]
  expect(exitSegs.reduce((n, b) => n + Number(b.textContent), 0)).toBe(graph.founders.filter((f) => f.badges.includes('prior_exit')).length)
  expect(rows[1].querySelector('[data-bp="prior_exit:repeat_founder"]')?.getAttribute('aria-pressed')).toBe('true')
  expect(exitSegs.filter((b) => b.classList.contains('is-dim')).length).toBe(exitSegs.length - 1)
  expect(rows[0].querySelector('[aria-pressed="true"]')).toBeNull()
  expect([...rows[4].querySelectorAll('[data-oss]')].map((b) => b.textContent)).toEqual(['yes', 'partial', 'no'].map((k) => String(graph.companies.filter((c) => c.openSourceProduct === k).length)))
  expect(d.querySelector('.bnote')?.textContent).toMatch(/^Open source is a badge on top of a path\. \d+ of the \d+ founders/)
})
it('insights: six bullets with computed values and node links', () => {
  const d = el(insightsHTML(graph))
  const items = [...d.querySelectorAll('li')]
  expect(items).toHaveLength(6)
  const busiest = graph.hubs.filter((h) => h.htype === 'e').sort((a, b) => b.degree - a.degree).slice(0, 3)
  expect([...items[1].querySelectorAll('[data-select]')].map((b) => b.getAttribute('data-select'))).toEqual(busiest.map((h) => h.id))
  const moved = graph.founders.filter((f) => f.status !== 'active').length
  expect(items[5].textContent).toContain(`${moved} of ${graph.founders.length} founders`)
  expect(d.textContent).not.toMatch(/—/)
})
```

- [ ] **Step 2: Run to verify they fail** — `npx vitest run tests/tabs.test.ts` → module not found.

- [ ] **Step 3: Implement `src/panel/tabs.ts`** (and export `link` from `src/panel/card.ts`).

- [ ] **Step 4: Run tests and tsc** — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/panel/card.ts src/panel/tabs.ts tests/tabs.test.ts
git commit -m "panel: clusters, badges by path, and insights tabs"
```

---

### Task 6: Wire everything through the store in `app.ts`

**Files:**
- Create: `src/app.ts`
- Modify: `src/main.ts` (styles + `boot(document)`), `src/map/map.ts` only if `relayout` needs exposing (it is already exported on `MapView`)
- Test: `tests/app.test.ts`

**Interfaces:**
- Consumes: everything above plus `createMap`, `MapInput`, `graph`.
- Produces: `boot(doc: Document): void`.

`boot(doc)`:
1. Stats line (move `renderStats` from `main.ts`).
2. `store = createStore(DEFAULT_STATE)`; `map = createMap(svg, graph, handlers, { reduceMotion: doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, fonts: doc.fonts })`. Handlers: `onHover(id, pointerType)` sets `focus` when `hoverFocusAllowed`; `onToggle(id)` → `toggleSelect`; `onCanvasClick` → clear.
3. Render once: `#filters-drawer`.innerHTML = `drawerHTML(graph)`; `#insights-list`.innerHTML = `insightsHTML(graph)`.
4. `push(s)`: `matched = matchedFounders(graph, s.filters)`; `active = activeFilterCount(s.filters) > 0`; `focusNode = s.focus ? graph.byId.get(s.focus) ?? null : null`; `map.update({ focus: focusNode, pinned: s.pinned, matched, layers: s.layers, filtersActive: active, pathFilter: s.filters.paths })`; `#detail`.innerHTML = `detailHTML(focusNode, s, graph, matched)` only when the string changed (keep `lastDetail`); `#active-row`.innerHTML = `activeRowHTML(activeChips(s.filters), matched.size, matchedCompanies(graph, matched).length, { founders: graph.founders.length, companies: graph.companies.length })` and `hidden = !active`; `#clusters-list` and `#badge-rows` innerHTML when changed; `syncControls(doc, s)`; when `s.view` changed from table to map call `map.relayout()`.
5. `store.subscribe(push)`; `push(store.get())`.
6. Events: `doc.addEventListener('click', …)` resolving, in this order, `closest('[data-close]')` → clear; `[data-select]` → `{ focus: id, pinned: true }`; `[data-remove]` → `removeFilter`; `[data-cluster]` → `togglePath`; `[data-path]`; `[data-badge]`; `[data-employer]`; `[data-bp]` → `toggleBadgePath`; `[data-oss]` → `toggleOss`; `[data-layer]` → flip `layers[key]`; `[data-fund]`; `[data-view]`; `[data-tab]`; `#filters-btn` → flip `drawer`; `#clear-filters` → `clearFilters()`. `#map-search` `input` → `filters.q`; the four selects `change` → their field. Escape (existing rule) and the three zoom buttons as in Prompt 1.

- [ ] **Step 1: Write the failing test**

`tests/app.test.ts` (jsdom):
```ts
// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { graph } from '../src/data'
import { boot } from '../src/app'

const q = <T extends Element>(sel: string) => document.querySelector(sel) as T
const click = (sel: string) => q<HTMLElement>(sel).dispatchEvent(new MouseEvent('click', { bubbles: true }))
const text = (sel: string) => q(sel)?.textContent ?? ''

beforeAll(() => {
  document.documentElement.innerHTML = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '')
  ;(window as any).matchMedia = () => ({ matches: false })
  boot(document)
})

describe('app', () => {
  it('opens the drawer, filters Big tech alum + Google to 10 of 54 and 6 of 24, removes and clears', () => {
    expect(q('#filters-drawer').hasAttribute('hidden')).toBe(true)
    click('#filters-btn')
    expect(q('#filters-drawer').hasAttribute('hidden')).toBe(false)
    expect(q('#filters-btn').getAttribute('aria-expanded')).toBe('true')
    click('[data-badge="big_tech_alum"]')
    click('[data-employer="Google"]')
    expect(text('#active-row .active__count')).toBe('10 of 54 founders · 6 of 24 companies')
    expect(text('#filters-count')).toBe('2')
    expect([...document.querySelectorAll('#map g.lbl.cluster text')].some((t) => /· \d+\/\d+$/.test(t.textContent ?? ''))).toBe(true)
    expect([...document.querySelectorAll('#map g.node.founder')].some((n) => (n as HTMLElement).style.opacity === '0.07')).toBe(true)
    click('[data-remove="employer:Google"]')
    expect(text('#active-row .active__count')).toMatch(/^25 of 54 founders/)
    click('#clear-filters')
    expect(q('#active-row').hasAttribute('hidden')).toBe(true)
    expect(q('#filters-count').hasAttribute('hidden')).toBe(true)
  })
  it('selects Dan Lorenc from the map, closes from the card', () => {
    q('[data-id="f:dan-lorenc"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(text('#detail h2')).toBe('Dan Lorenc')
    expect(q('[data-id="f:dan-lorenc"]').classList.contains('pinned')).toBe(true)
    click('#detail [data-close]')
    expect(text('#detail h2')).toBe('Pick any dot or station')
  })
  it('card follows the last hover and returns to default on leave', () => {
    const a = q('[data-id="f:dan-lorenc"]'), b = q('[data-id="c:temporal"]')
    a.dispatchEvent(new Event('pointerenter'))
    b.dispatchEvent(new Event('pointerenter'))
    expect(text('#detail h2')).toBe('Temporal')
    b.dispatchEvent(new Event('pointerleave'))
    expect(text('#detail h2')).toBe('Pick any dot or station')
  })
  it('search, selects, view toggle, cluster row, segment, and hidden-node links', () => {
    const input = q<HTMLInputElement>('#map-search')
    input.value = 'lorenc'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(text('#active-row .active__count')).toBe('1 of 54 founders · 1 of 24 companies')
    click('#clear-filters')
    const sel = q<HTMLSelectElement>('#sel-status')
    sel.value = 'left'
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    expect(text('#active-row')).toContain('Status')
    click('#clear-filters')
    click('[data-view="table"]')
    expect(q('#map-card').hasAttribute('hidden')).toBe(true)
    expect(q('#table-card').hasAttribute('hidden')).toBe(false)
    click('[data-view="map"]')
    expect(q('#map-card').hasAttribute('hidden')).toBe(false)
    click('[data-cluster="academic"]')
    expect(text('#detail h2')).toBe('Academic')
    expect(q('[data-cluster="academic"]').getAttribute('aria-pressed')).toBe('true')
    click('[data-bp="prior_open_source:big_tech_engineer"]')
    expect([...document.querySelectorAll('#active-row .achip__cat')].map((c) => c.textContent)).toEqual(['Path', 'Badge'])
    click('[data-bp="prior_open_source:big_tech_engineer"]')
    expect(q('#active-row').hasAttribute('hidden')).toBe(true)
    const oneOff = graph.hubs.find((h) => h.oneOff)!
    q('#detail').innerHTML = `<button data-select="${oneOff.id}"></button>`
    click(`#detail [data-select="${oneOff.id}"]`)
    expect(text('#detail h2')).toBe(oneOff.name)
    click('[data-tab="about"]')
    expect(q('#tab-about').hasAttribute('hidden')).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/app.test.ts` → `../src/app` not found.

- [ ] **Step 3: Implement `src/app.ts`; reduce `src/main.ts` to the four style imports plus `boot(document)`**

- [ ] **Step 4: Run everything** — `npx vitest run && npx tsc --noEmit && npm run build` → PASS, build under 300 KB gzipped.

- [ ] **Step 5: Commit**

```bash
git add src/app.ts src/main.ts tests/app.test.ts
git commit -m "app: wire search, filters, controls, cards, and tabs through the store"
```

---

### Task 7: Verify in Chrome against the artboards and acceptance items

**Files:** none unless a fix is needed (then TDD it as a follow-up commit with the scope that owns it).

- [ ] **Step 1:** Dev server at `http://127.0.0.1:5173`, light theme (`document.documentElement.dataset.theme = 'light'`), 1440 wide. Click Dan Lorenc: compare with `reference/design/Main.dc.html` lines 516–557 (eyebrow, name, role · Chainguard link, three chips, bio, four dl rows, company block, source line, close button). Record differences.
- [ ] **Step 2:** Filters → Big tech alum + Google: active row reads `10 of 54 founders · 6 of 24 companies` with two chips styled like `Table.dc.html` lines 60–65; Filters button shows `2`; cluster labels show `m/n`; dimmed founders at 0.07.
- [ ] **Step 3:** Tabs: Clusters rows with `13 · 7` style counts and bars; click a row → cluster card, row pressed; Badges by path segment toggles; Insights six bullets with working links; About text, no em dashes.
- [ ] **Step 4:** Search `ray` → active chip `Search “ray”`, matching founders; Esc inside the input does not clear a pinned node; Tab through the drawer chips and selects with visible focus rings.
- [ ] **Step 5:** Hub card for Google → "Filter to Google alumni" chip toggles the employer filter while the card stays. Default card chips select Uber, Harvard, Temporal, Matt Klein.
- [ ] **Step 6:** 900px: drawer groups stack, active row wraps, card below the map. Table view shows the shell.
- [ ] **Step 7:** Record results in the ledger; fix with TDD anything that deviates; commit.
