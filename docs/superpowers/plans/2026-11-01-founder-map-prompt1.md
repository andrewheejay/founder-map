# Founder Map, Prompt 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Founder Map repo (Vite + TypeScript + selective D3) with validated data, a tested graph model, generated design tokens, the approved page shell, and the interactive map (static layout, hulls, links, also-fits stubs, nodes, labels, cluster labels, zoom, focus/pin). Detail card, filters, search, and table are Prompt 2 and 3.

**Architecture:** The three JSON files are the only content. `src/model.ts` turns them into a typed graph (founders, companies, hubs, links, neighbor sets, clusters) with positions copied from `data/layout.json`. Cluster geometry and label placement are pure modules tested in Node; `src/map/map.ts` is the only D3/DOM module and renders from a `MapInput` (focus, pinned, matched set, layers). `index.html` carries the static shell; `src/main.ts` boots graph, store, and map.

**Tech Stack:** Vite 7, TypeScript 5 strict, `d3-selection`, `d3-zoom`, `d3-polygon`, `d3-shape`, `d3-transition`; vitest with jsdom for DOM tests; `tsx` to run scripts. No React, no CSS framework.

**Spec:** `CLAUDE.md` sections 3 to 8. Behavior reference: `reference/founder-map-v4.html` (functions `measure`, `candidates`, `rectFor`, `ov`, `placeLabels`, `render`, `applyScale`). Pixel reference: `reference/design/Main.dc.html`. Scope: `PROMPT.md`, Prompt 1.

## Global Constraints

- D3 imported module by module: `d3-selection`, `d3-zoom`, `d3-polygon`, `d3-shape`, plus `d3-transition` for the animated zoom buttons. Nothing else from D3.
- `data/*.json` ship exactly as provided. No founder or company fact in components; every count is computed.
- No force simulation at page load. Positions come from `data/layout.json`, viewBox `0 0 1100 840`, `preserveAspectRatio="xMidYMid meet"`.
- Tokens from section 7 exactly. No gradients, no drop shadows, no emoji. Path colors appear as dots, fills, hull tints, and cluster labels on white only.
- Real `<button>`, `<a>`, `<input>` + `<label>`; `aria-pressed` on toggles; `aria-label` on icon-only buttons and on every map node.
- Inter 400/500/600/700 from Google Fonts, fallback `system-ui`; base 14px / 1.45; numbers use `font-variant-numeric: tabular-nums`.
- Side column wraps under the map below 980px. Control height 40px on desktop, 44px below 980px.
- No em dashes in UI copy.
- Commits: imperative, one line, scope prefix (`build:`, `data:`, `model:`, `design:`, `map:`, `docs:`).
- Out of scope here: detail card variants, tabs, filter drawer, active filters row, search, table and CSV, hash sync, dark theme verification, phone polish, `scripts/layout.ts`, deploy.

## Review Focus

1. Inter loads after first paint, so label widths measured with the fallback font are wrong. Expect a re-measure and re-place once `document.fonts.ready` resolves. Test in Task 8.
2. `getBBox` missing or throwing (jsdom, detached SVG, hidden ancestor): the map still renders with fallback label sizes and never throws. Test in Task 8.
3. Touch: `pointerenter` with `pointerType === "touch"` must not set hover focus, and hover must never override a pinned node. Test in Task 9.
4. Degenerate geometry: a one-founder cluster still gets a hull and a label; an also-fits stub for a founder sitting exactly on the secondary cluster center must not divide by zero. Test in Task 6.
5. Stale `layout.json`: an id in the layout that no longer exists in the data, or a data node without a position, must fail `npm run validate` rather than render at `(undefined, undefined)`. Test in Task 3.

---

### Task 1: Repo scaffold and toolchain

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `index.html` (placeholder), `src/main.ts` (placeholder), `tests/smoke.test.ts`
- Keep: `CLAUDE.md`, `PROMPT.md`, `data/`, `reference/`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `preview`, `test`, `validate`, `tokens`. vitest picks up `tests/**/*.test.ts`. TS strict with `resolveJsonModule`.

- [ ] **Step 1: Write `package.json`**

`"type": "module"`. Scripts: `dev` = `vite`; `build` = `npm run validate && npm run tokens && tsc --noEmit && vite build`; `preview` = `vite preview`; `test` = `vitest run`; `validate` = `tsx scripts/validate.ts`; `tokens` = `tsx scripts/tokens.ts`. Dependencies: `d3-selection d3-zoom d3-polygon d3-shape d3-transition`. Dev dependencies: `vite typescript vitest jsdom tsx @types/d3-selection @types/d3-zoom @types/d3-polygon @types/d3-shape @types/d3-transition`.

- [ ] **Step 2: Write `tsconfig.json`**

`target ES2022`, `module ESNext`, `moduleResolution bundler`, `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `resolveJsonModule`, `isolatedModules`, `noEmit`, `skipLibCheck`, `types: ["vite/client"]`, `include: ["src", "scripts", "tests", "vite.config.ts"]`.

- [ ] **Step 3: Write `vite.config.ts`** using `defineConfig` from `vitest/config` with `test: { include: ["tests/**/*.test.ts"] }`.

- [ ] **Step 4: Write `.gitignore`** (`node_modules`, `dist`, `.DS_Store`, `*.local`), placeholder `index.html` that loads `/src/main.ts`, and `tests/smoke.test.ts` asserting `1 + 1 === 2`.

- [ ] **Step 5: Install and verify**

Run: `npm install && npm test && npx tsc --noEmit`
Expected: 1 test passed, tsc prints nothing.

- [ ] **Step 6: Commit** `build: scaffold vite, typescript, vitest`

---

### Task 2: Graph model

**Files:**
- Create: `src/types.ts`, `src/model.ts`, `src/data.ts`
- Test: `tests/model.test.ts`

**Interfaces:**
- Produces (`src/types.ts`): `Fund = 'amplify'|'haystack'`; `PathKey = 'big_tech_engineer'|'repeat_founder'|'business_operator'|'young_builder'|'academic'`; `StoredBadge = 'prior_open_source'|'prior_exit'|'grad_degree'`; `BadgeKey = StoredBadge|'big_tech_alum'`; `FounderStatus = 'active'|'role_changed'|'left'`; `OssProduct = 'yes'|'partial'|'no'`; `HubType = 'e'|'s'|'o'`; `CompanyRecord`, `FounderRecord` (fields exactly as CLAUDE.md section 4); `Layout = { viewBox: [number,number,number,number]; note?: string; nodes: Record<string,{x:number;y:number}> }`.
- Produces (`src/model.ts`):
  - `PATHS: Record<PathKey,{name:string;def:string}>` (labels and definitions from section 5.1), `PATH_ORDER: PathKey[]` in table order.
  - `BADGE_LABEL: Record<BadgeKey,string>` = Prior open source, Prior exit, Grad degree, Big tech alum. `BIG_TECH: readonly string[]` = Google, Facebook, Microsoft, Amazon, Apple, Twitter, Uber, Lyft, Palantir. `FUND_LABEL`, `STATUS_LABEL` (Still in founding role / Role changed / Left the company), `OSS_LABEL` (Open source product / Partially open / Closed product), `HUB_TYPE_LABEL` (Employer / School / Prior open source project), `REL_LABEL` = { e: 'Worked at', s: 'Studied at', S: 'Taught at', o: 'Built or contributed to' }.
  - `slug(s: string): string` = lowercase, NFD, strip `̀-ͯ`, non `[a-z0-9]+` to `-`, trim `-`.
  - `hubRefs(f: FounderRecord): { id: string; type: HubType; name: string; rel: string }[]` for employers (`e:`), schools (`s:`, Studied at), taughtAt (`s:`, Taught at), priorOpenSource (`o:`).
  - Node types: `CompanyNode { kind:'company'; id; name; fund; vertical; founded; avgFounderAgeAtFounding; openSourceProduct; status; latest; description; members: FounderNode[]; x; y }`; `HubNode { kind:'hub'; id; htype: HubType; name; members: FounderNode[]; degree; oneOff; x; y }`; `FounderNode { kind:'founder'; id; name; shortLabel; company: CompanyNode; fund; path; secondaryPath; role; status; statusNote; storedBadges: StoredBadge[]; badges: BadgeKey[]; employers; schools; taughtAt; priorOpenSource; bigTech: string[]; ties: { hub: HubNode; rel: string }[]; edgeCase; bio; source; haystack; x; y }`; `AnyNode = FounderNode|CompanyNode|HubNode`; `Link { source: FounderNode; target: CompanyNode|HubNode; kind: 'co'|HubType }`; `Cluster { key: PathKey; name; def; founders: FounderNode[]; counts: { amplify: number; haystack: number } }`.
  - `Graph { W: 1100; H: 840; founders; companies; hubs; links; all: AnyNode[] (hubs, then companies, then founders); byId: Map<string,AnyNode>; neighbors: Map<AnyNode,Set<AnyNode>>; clusters: Cluster[] (PATH_ORDER) }`.
  - `buildGraph(founders: FounderRecord[], companies: CompanyRecord[], layout: Layout): Graph`. Hubs: one per distinct id, `degree = members.length`, `oneOff = htype !== 'o' && degree < 2`. Links: one `co` per founder plus one per tie. `bigTech = employers.filter(in BIG_TECH)`; `badges = storedBadges + ['big_tech_alum' if bigTech.length]`. Haystack: name, company, vertical, role, path name, secondary path name, badge labels, employers, schools, projects, bio, statusNote, status label, fund label, OSS label, joined with ` | `, lowercased. Throws `Error` naming the id when a company is missing or a node has no layout entry.
- Produces (`src/data.ts`): `founders`, `companies`, `layout` (typed JSON imports) and `graph = buildGraph(...)`.

- [ ] **Step 1: Write the failing tests** in `tests/model.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { graph, layout } from '../src/data'
import { PATH_ORDER, slug } from '../src/model'

describe('model', () => {
  it('totals come from the data', () => {
    expect(graph.founders).toHaveLength(54)
    expect(graph.companies).toHaveLength(24)
    expect(graph.all).toHaveLength(Object.keys(layout.nodes).length)
  })
  it('per-path counts by fund match section 5.1', () => {
    const want: Record<string, [number, number]> = {
      big_tech_engineer: [13, 7], young_builder: [6, 9], repeat_founder: [6, 5], business_operator: [1, 3], academic: [4, 0],
    }
    for (const c of graph.clusters) expect([c.counts.amplify, c.counts.haystack], c.key).toEqual(want[c.key])
    expect(graph.clusters.map((c) => c.key)).toEqual(PATH_ORDER)
  })
  it('hubs: shared employers show, one-off employers hide, projects always show', () => {
    const google = graph.byId.get('e:google')!
    expect(google.kind === 'hub' && google.degree >= 2 && !google.oneOff).toBe(true)
    expect((graph.byId.get('e:visual-sciences') as any).oneOff).toBe(true)
    expect((graph.byId.get('o:trusted-data-format') as any).oneOff).toBe(false)
    expect((graph.byId.get('s:uc-berkeley') as any).members.map((m: any) => m.id)).toContain('f:ion-stoica')
  })
  it('every node carries a finite position from layout.json', () => {
    for (const n of graph.all) expect(Number.isFinite(n.x) && Number.isFinite(n.y), n.id).toBe(true)
  })
  it('derives big_tech_alum and never reads it from the data', () => {
    const lorenc = graph.byId.get('f:dan-lorenc') as any
    expect(lorenc.bigTech).toEqual(['Microsoft', 'Google'])
    expect(lorenc.badges).toContain('big_tech_alum')
    expect(lorenc.storedBadges).not.toContain('big_tech_alum')
    expect((graph.byId.get('f:will-bryk') as any).badges).not.toContain('big_tech_alum')
  })
  it('links and neighbor sets', () => {
    const lorenc = graph.byId.get('f:dan-lorenc')!
    const ids = [...graph.neighbors.get(lorenc)!].map((n) => n.id).sort()
    expect(ids).toEqual(['c:chainguard', 'e:google', 'e:microsoft', 'o:distroless', 'o:kubernetes', 'o:sigstore', 'o:slsa', 'o:tekton', 's:mit'])
    const ties = graph.founders.reduce((n, f) => n + f.ties.length, 0)
    expect(graph.links).toHaveLength(graph.founders.length + ties)
  })
  it('search haystack is lowercase and covers every field group', () => {
    const h = (graph.byId.get('f:dan-lorenc') as any).haystack as string
    for (const s of ['dan lorenc', 'chainguard', 'security & observability', 'co-founder, ceo', 'big tech engineer', 'big tech alum', 'sigstore', 'mit', 'still in founding role', 'amplify', 'partially open']) expect(h).toContain(s)
    expect(h).toBe(h.toLowerCase())
  })
  it('slug matches the ids in the data', () => {
    expect(slug('Søren Bramer Schmidt')).toBe('s-ren-bramer-schmidt')
    expect(slug('Univ. of Washington')).toBe('univ-of-washington')
    expect(slug('Émile Zola')).toBe('emile-zola')
    for (const f of graph.founders) expect(f.id).toBe('f:' + slug(f.name))
    for (const c of graph.companies) expect(c.id).toBe('c:' + slug(c.name))
  })
})
```

- [ ] **Step 2: Run** `npx vitest run tests/model.test.ts` → FAIL (cannot resolve `../src/data`).
- [ ] **Step 3: Implement** `src/types.ts`, `src/model.ts`, `src/data.ts` per Interfaces.
- [ ] **Step 4: Run** `npx vitest run tests/model.test.ts && npx tsc --noEmit` → all pass, no type errors.
- [ ] **Step 5: Commit** `model: build graph, hubs, links, neighbors, badges from data`

---

### Task 3: Data validator wired into the build

**Files:**
- Create: `scripts/validate.ts`
- Test: `tests/validate.test.ts`

**Interfaces:**
- Consumes: `slug`, `hubRefs`, `PATH_ORDER`, `BIG_TECH` from `src/model.ts`; record types from `src/types.ts`.
- Produces: `validateData(founders: unknown, companies: unknown, layout: unknown): string[]` (empty when valid; each error names the offending id or field). When run as a script it reads `data/*.json`, prints every error, exits 1 on any error, otherwise prints `data OK: <f> founders, <c> companies, <h> hubs, <n> positioned nodes` with computed numbers.

Checks: inputs are arrays / object; unique ids across founders, companies, and derived hubs; `id === 'f:'+slug(name)` and `'c:'+slug(name)`; every founder `company` exists; `fund`, `vertical` (five values from section 4), `openSourceProduct`, `path`, `secondaryPath` (enum or null), `status`, `badges` (subset of the three stored badges; `big_tech_alum` rejected) enums; `founded` is an integer; `avgFounderAgeAtFounding` number or null; non-empty `name`, `shortLabel`, `role`, `bio`, `description`, `latest`, `status`; `source` starts with `http`; `layout.viewBox` equals `[0,0,1100,840]`; every founder, company, and hub id has a layout entry with finite `x`, `y`; every layout id exists in the data.

- [ ] **Step 1: Write the failing tests** in `tests/validate.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { validateData } from '../scripts/validate'
import { companies, founders, layout } from '../src/data'

const clone = () => structuredClone({ f: founders as any[], c: companies as any[], l: layout as any })

describe('validateData', () => {
  it('accepts the shipped data', () => expect(validateData(founders, companies, layout)).toEqual([]))
  it('rejects non-array input without throwing', () => expect(validateData('x', [], {}).length).toBeGreaterThan(0))
  it('duplicate id', () => { const d = clone(); d.f.push({ ...d.f[0] }); expect(validateData(d.f, d.c, d.l).join()).toMatch(/duplicate id f:will-wilson/) })
  it('unknown company', () => { const d = clone(); d.f[0].company = 'Nope'; expect(validateData(d.f, d.c, d.l).join()).toMatch(/f:will-wilson.*Nope/) })
  it('bad path enum', () => { const d = clone(); d.f[0].path = 'hacker'; expect(validateData(d.f, d.c, d.l).join()).toMatch(/f:will-wilson.*path/) })
  it('stored big_tech_alum badge', () => { const d = clone(); d.f[0].badges = ['big_tech_alum']; expect(validateData(d.f, d.c, d.l).join()).toMatch(/big_tech_alum/) })
  it('empty bio and source', () => { const d = clone(); d.f[0].bio = ''; d.f[1].source = ''; const e = validateData(d.f, d.c, d.l).join(); expect(e).toMatch(/f:will-wilson.*bio/); expect(e).toMatch(/f:dave-scherer.*source/) })
  it('missing layout entry', () => { const d = clone(); delete d.l.nodes['e:google']; expect(validateData(d.f, d.c, d.l).join()).toMatch(/e:google/) })
  it('stale layout entry', () => { const d = clone(); d.l.nodes['e:ghost'] = { x: 1, y: 1 }; expect(validateData(d.f, d.c, d.l).join()).toMatch(/e:ghost/) })
  it('id must equal the slug of the name', () => { const d = clone(); d.c[0].id = 'c:wrong'; expect(validateData(d.f, d.c, d.l).join()).toMatch(/c:wrong/) })
})
```

- [ ] **Step 2: Run** `npx vitest run tests/validate.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** `scripts/validate.ts`. Guard the CLI with `if (process.argv[1] && /validate\.ts$/.test(process.argv[1])) main()`. Read files via `new URL('../data/founders.json', import.meta.url)`.
- [ ] **Step 4: Run** `npx vitest run tests/validate.test.ts` → PASS. Run `npm run validate` → prints `data OK: 54 founders, 24 companies, 93 hubs, 171 positioned nodes`, exit 0. Temporarily break `data/layout.json` (delete one node), run `npm run validate` → exit 1 naming the id; restore with `git checkout data/layout.json`.
- [ ] **Step 5: Commit** `data: validate schema, enums, references, and layout coverage`

---

### Task 4: Design tokens

**Files:**
- Create: `design/tokens.json`, `scripts/tokens.ts`, `src/styles/tokens.css` (generated, committed)
- Test: `tests/tokens.test.ts`

**Interfaces:**
- Produces: `tokensToCss(tokens: Tokens): string`. Variable naming is `--<group>-<key>` with keys verbatim: `color.*` → `--color-*`, `path.*` → `--path-*`, `status.<k>.<bg|text>` → `--status-<k>-<bg|text>`, `font.*`, `text.*` (px), `leading.*`, `tracking.*`, `weight.*`, `radius.*` (px), `space.*` (px), `map.*` (unitless). `dark.color.*` and `dark.path.*` are emitted twice: under `:root[data-theme="dark"]` and under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }`, each with `color-scheme: dark`. Output starts with a comment `/* generated from design/tokens.json by scripts/tokens.ts; do not edit */`.

`design/tokens.json` values (section 7):
- color: page #F4F5F7, surface #FFFFFF, ink #111418, muted #5B6471, hairline #E3E6EA, accent #2457D6, accentTint #EAF0FC, tableHead #F9FAFB, link #AEB6C0, hubStroke #2A313B
- path: big_tech_engineer #2457D6, repeat_founder #0E7C5B, business_operator #B8304A, young_builder #B45E0A, academic #6F3BB5
- status: active {bg #E3F3EC, text #0A5C44}, role_changed {bg #FBEEDC, text #7A3E05}, left {bg #F1F2F4, text #5B6471}
- dark.color: page #0F1216, surface #171B21, ink #E6E9EE, muted #99A2AE, hairline #2A3038, accent #6F95F6, link #6B7480; plus my picks pending the Prompt 3 contrast check: accentTint #1E2A44, tableHead #1C2128, hubStroke #C9D0D8
- dark.path: #6F95F6 / #3BBD8B / #EF6C89 / #F29A4B / #B489EC in PATH_ORDER
- font.sans: `Inter, system-ui, -apple-system, "Segoe UI", sans-serif`
- text: base 14, title 17, subtitle 12, cardTitle 20, eyebrow 11, body 13, label 11, control 13, tableCell 13, tableHead 11, legend 12, mapFounder 12.5, mapCompany 13, mapHub 10.5, mapCluster 13
- leading.base 1.45; tracking: title -0.01em, eyebrow 0.08em, label 0.06em, cluster 0.08em; weight: regular 400, medium 500, semibold 600, bold 700
- radius: card 12, control 8, segment 6, chip 999
- space: pageMax 1440, pagePad 32, headerH 64, gap 20, cardPad 20, controlH 40, controlHPhone 44, sideW 320, zoomBtn 36
- map: hullFillOpacity 0.06, hullStrokeOpacity 0.28, hullStrokeWidth 1.2, labelStroke 3.4, ringWidth 2.2, dimOpacity 0.32, filteredOpacity 0.07

- [ ] **Step 1: Write the failing tests** in `tests/tokens.test.ts`

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import tokens from '../design/tokens.json'
import { tokensToCss } from '../scripts/tokens'

const css = tokensToCss(tokens as any)
describe('tokens', () => {
  it('emits light tokens with the spec values', () => {
    for (const line of ['--color-accent: #2457D6;', '--color-muted: #5B6471;', '--path-big_tech_engineer: #2457D6;', '--path-young_builder: #B45E0A;', '--status-role_changed-bg: #FBEEDC;', '--radius-card: 12px;', '--space-controlH: 40px;', '--text-mapHub: 10.5px;', '--tracking-eyebrow: 0.08em;', '--map-hullFillOpacity: 0.06;']) expect(css).toContain(line)
  })
  it('emits dark overrides under both selectors', () => {
    expect(css).toMatch(/:root\[data-theme="dark"\]\s*\{[^}]*--color-page: #0F1216;/)
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{[^}]*--path-academic: #B489EC;/)
  })
  it('generated file is in sync with the source', () => {
    expect(readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')).toBe(css)
  })
})
```

- [ ] **Step 2: Run** `npx vitest run tests/tokens.test.ts` → FAIL.
- [ ] **Step 3: Implement** `design/tokens.json` and `scripts/tokens.ts` (same CLI guard pattern as Task 3; writes `src/styles/tokens.css`). Run `npm run tokens`.
- [ ] **Step 4: Run** `npx vitest run tests/tokens.test.ts` → PASS.
- [ ] **Step 5: Commit** `design: add tokens.json and generate tokens.css`

---

### Task 5: Page shell

**Files:**
- Create: `index.html` (replace placeholder), `src/styles/base.css`, `src/styles/components.css`
- Modify: `src/main.ts` (import the three stylesheets, fill `#stats`)
- Test: `tests/shell.test.ts`

**Interfaces:**
- Produces DOM ids used by later tasks: `#stats`, `#map-search`, `#fund-seg` (buttons `data-fund="all|amplify|haystack"`), `#view-seg` (`data-view="map|table"`), `#filters-btn` with `#filters-count`, `#map-card`, `svg#map` (`role="group"`, `aria-label="Founder network map"`), `#zoom-in`, `#zoom-out`, `#zoom-fit`, `ul.legend`, `aside.side`, `section#detail.card`.
- Markup (match `reference/design/Main.dc.html`, copy the look not the inline styles): `header.site-header` 64px white with hairline bottom, containing the 28px logo mark SVG from the artboard, `h1` "Founder Map" (17/600, tracking title), subtitle "Amplify Partners and Haystack portfolios, grouped by founder path" (12 muted), and `p#stats` (12 muted) on the right. `div.toolbar` (flex, wrap, gap 12, padding 16px 32px 0): search (flex 1 1 260px, max 340, 40px high, icon at left, visually hidden `<label for="map-search">`), fund segmented control (`role="group" aria-label="Fund"`, 3 buttons, `aria-pressed`), view segmented control (`aria-label="View"`, Map / Table), spacer, Filters button (funnel icon, hidden count pill). `main.main` (max 1440, padding 16px 32px 24px, flex wrap, gap 20): `section#map-card.card` (`flex: 999 1 560px`, white, hairline, radius 12, overflow hidden) with `div.map-stage` (position relative; the SVG; `div.zoombar` bottom 12px right 12px as one hairline-bordered 36px-wide group of three buttons with the artboard's plus / minus / fit icons, inner `border-top` separators) and the legend row (padding 10px 16px, hairline top, 12px muted: five path dots, divider, Amplify circle, Haystack square, Employer, School, Open source project, Also fits another path); `aside.side` (`flex: 1 1 320px`) with `section#detail.card` showing eyebrow "Start here", `h2` "Pick any dot or station", and the sentence "Colored dots are founders, placed by career path. Gray circles are the employers, schools, and projects they share."
- `components.css` includes `@media (max-width: 980px)` that sets `aside.side { flex-basis: 100% }` and control height `var(--space-controlHPhone)`.
- `base.css`: box-sizing reset, body uses tokens (page bg, ink, font-sans, 14px / 1.45), `button, input { font: inherit; color: inherit }`, `.sr-only`, `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px }`, `.num { font-variant-numeric: tabular-nums }`, `@media (prefers-reduced-motion: reduce) { * { transition: none !important } }`.
- `src/main.ts` fills `#stats` with `${founders} founders · ${companies} companies · ${shared} shared employers & schools · ${projects} open source projects`, where shared = hubs with `!oneOff && htype !== 'o'` and projects = hubs with `htype === 'o'` (54 · 24 · 23 · 13 with the shipped data).

- [ ] **Step 1: Write the failing tests** in `tests/shell.test.ts`

```ts
// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
document.documentElement.innerHTML = html.replace(/<script[^>]*><\/script>/g, '')

describe('page shell', () => {
  it('header, toolbar controls, main regions', () => {
    expect(document.querySelector('header h1')?.textContent).toBe('Founder Map')
    expect(document.querySelector('label[for="map-search"]')).not.toBeNull()
    expect(document.querySelector('input#map-search')?.getAttribute('type')).toBe('search')
    expect(document.querySelectorAll('#fund-seg button[aria-pressed]')).toHaveLength(3)
    expect(document.querySelectorAll('#view-seg button[aria-pressed]')).toHaveLength(2)
    expect(document.querySelector('#filters-btn')?.tagName).toBe('BUTTON')
    expect(document.querySelector('main #map-card svg#map')?.getAttribute('aria-label')).toBe('Founder network map')
    expect(['Zoom in', 'Zoom out', 'Fit map to view'].map((l) => document.querySelector(`#map-card button[aria-label="${l}"]`))).not.toContain(null)
    expect(document.querySelectorAll('#map-card .legend li')).toHaveLength(11)
    expect(document.querySelector('aside #detail h2')?.textContent).toBe('Pick any dot or station')
  })
  it('no em dashes in copy', () => expect(document.body.textContent).not.toMatch(/—/))
  it('stacks under 980px', () => {
    const css = readFileSync(new URL('../src/styles/components.css', import.meta.url), 'utf8')
    expect(css).toMatch(/@media \(max-width: 980px\)/)
  })
})
```

- [ ] **Step 2: Run** `npx vitest run tests/shell.test.ts` → FAIL.
- [ ] **Step 3: Implement** `index.html`, `base.css`, `components.css`, and the stats line in `main.ts`.
- [ ] **Step 4: Run** `npx vitest run tests/shell.test.ts` → PASS. Run `npm run dev` and open it in Chrome at 1440 wide next to `reference/design/Main.dc.html`: header, toolbar, map card, side card, and legend line up; narrow to 900px and confirm the side column drops below the map.
- [ ] **Step 5: Commit** `design: page shell, header, toolbar, two-column main`

---

### Task 6: Cluster geometry

**Files:**
- Create: `src/map/geometry.ts`
- Test: `tests/geometry.test.ts`

**Interfaces:**
- Consumes: `polygonHull` from `d3-polygon`.
- Produces: `hubRadius(degree: number): number` = `3.6 + sqrt(degree) * 2.3`; `nodeRadius(d: AnyNode): number` = founder 7, company 5.5, hub `hubRadius(d.degree)`; `HULL_PAD = 26`; `interface Pt { x: number; y: number }`; `interface ClusterGeometry { hull: [number, number][]; cx: number; cy: number; lx0: number; ly0: number; anchor: 'start'|'end'|'middle' }`; `clusterGeometry(founders: Pt[], W: number, H: number): ClusterGeometry` (12 points per founder on a circle of radius 26, `polygonHull`; `cx, cy` = mean; direction `(cx - W/2, cy - H/2)` normalized; `reach` = max projection of hull points on that direction; `lx0 = cx + dx * (reach + 24)`, `ly0 = cy + dy * (reach + 24) + 4`; anchor `start` if `dx > 0.35`, `end` if `dx < -0.35`, else `middle`); `altStub(from: Pt, to: Pt): Pt` (length `min(L * 0.55, 70)` along from→to; returns `from` when `L === 0`).

- [ ] **Step 1: Write the failing tests** in `tests/geometry.test.ts`

```ts
import { polygonContains } from 'd3-polygon'
import { describe, expect, it } from 'vitest'
import { altStub, clusterGeometry, hubRadius, nodeRadius } from '../src/map/geometry'

describe('geometry', () => {
  it('radii', () => {
    expect(hubRadius(1)).toBeCloseTo(5.9); expect(hubRadius(4)).toBeCloseTo(8.2)
    expect(nodeRadius({ kind: 'founder' } as any)).toBe(7); expect(nodeRadius({ kind: 'company' } as any)).toBe(5.5)
  })
  it('hull encloses founders with 26px padding', () => {
    const g = clusterGeometry([{ x: 300, y: 470 }, { x: 340, y: 500 }], 1100, 840)
    expect(g.hull.length).toBeGreaterThanOrEqual(3)
    expect(polygonContains(g.hull, [300, 470])).toBe(true)
    expect(Math.min(...g.hull.map((p) => p[0]))).toBeLessThanOrEqual(300 - 25)
  })
  it('one-founder cluster still has a hull and a label position', () => {
    const g = clusterGeometry([{ x: 870, y: 560 }], 1100, 840)
    expect(g.hull.length).toBeGreaterThanOrEqual(8)
    expect(Number.isFinite(g.lx0) && Number.isFinite(g.ly0)).toBe(true)
  })
  it('label sits outside the hull on the side away from center', () => {
    const left = clusterGeometry([{ x: 290, y: 470 }, { x: 330, y: 450 }], 1100, 840)
    expect(left.anchor).toBe('end'); expect(left.lx0).toBeLessThan(Math.min(...left.hull.map((p) => p[0])))
    const right = clusterGeometry([{ x: 870, y: 560 }, { x: 900, y: 540 }], 1100, 840)
    expect(right.anchor).toBe('start'); expect(right.lx0).toBeGreaterThan(Math.max(...right.hull.map((p) => p[0])))
    const below = clusterGeometry([{ x: 560, y: 690 }, { x: 600, y: 700 }], 1100, 840)
    expect(below.anchor).toBe('middle'); expect(below.ly0).toBeGreaterThan(Math.max(...below.hull.map((p) => p[1])))
  })
  it('also-fits stub is capped at 70 and safe at zero length', () => {
    expect(altStub({ x: 0, y: 0 }, { x: 300, y: 0 })).toEqual({ x: 70, y: 0 })
    expect(altStub({ x: 0, y: 0 }, { x: 100, y: 0 })).toEqual({ x: 55, y: 0 })
    expect(altStub({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 })
  })
})
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `src/map/geometry.ts`. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `map: cluster hulls, label anchors, also-fits stub geometry`

---

### Task 7: Label placement (port of `measure` / `candidates` / `rectFor` / `ov` / `placeLabels`)

**Files:**
- Create: `src/map/labels.ts`
- Test: `tests/labels.test.ts`

**Interfaces:**
- Produces: `type Anchor = 'start'|'end'|'middle'`; `interface Candidate { a: Anchor; dx: number; dy: number }`; `type Rect = [number, number, number, number]`; `interface LabelItem { id: string; kind: 'founder'|'company'|'hub'; x: number; y: number; r: number; degree: number; lw: number; lh: number; la: number }` (`r` = node radius, `lw/lh` = measured text box, `la` = ascent, i.e. `-bbox.y`); `candidates(d: LabelItem, cx: number): Candidate[]` (founder: R = 10, right `{start, R, mid}`, left `{end, -R, mid}`, below `{middle, 0, R + la - 1}`, above `{middle, 0, -R}`, ordered left-first when `d.x < cx` else right-first; `mid = la - lh/2`; company: r = 8, order above, below, right, left; hub: r = `hubRadius + 3`, order below, above, right, left, where right = `{start, r+1, mid}`, left = `{end, -r-1, mid}`, above = `{middle, 0, -r}`, below = `{middle, 0, r + la}`); `rectFor(d, c, s): Rect`; `overlapArea(a: Rect, b: Rect): number`; `interface Placement { c: Candidate; crowded: boolean }`; `placeLabels(items: LabelItem[], reserved: Rect[], k: number, bounds: { W: number; H: number }): Map<string, Placement>`. Algorithm exactly as the prototype: `s = 1/sqrt(k)`; obstacles are every item's node box with radius `r*s + 1.5`; `placed` starts as `reserved` (the cluster label boxes); order = hubs with degree ≥ 3 by degree desc, companies, founders, hubs with degree < 3; score = `index * 0.5` + overlap with every other obstacle + overlap with placed rects + `area` when `k <= 1.02` and the rect leaves `[2, W-2] x [2, H-2]`; `crowded = best > 0.18 * area + 2`; non-crowded rects are pushed to `placed`.

- [ ] **Step 1: Write the failing tests** in `tests/labels.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { candidates, overlapArea, placeLabels, rectFor, type LabelItem } from '../src/map/labels'

const item = (p: Partial<LabelItem>): LabelItem => ({ id: 'x', kind: 'founder', x: 0, y: 0, r: 7, degree: 0, lw: 40, lh: 14, la: 11, ...p })
const B = { W: 1100, H: 840 }

describe('labels', () => {
  it('founder candidates flip by side of center', () => {
    expect(candidates(item({ x: 100 }), 550)[0].a).toBe('end')
    expect(candidates(item({ x: 900 }), 550)[0].a).toBe('start')
    expect(candidates(item({ kind: 'company' }), 550)[0]).toEqual({ a: 'middle', dx: 0, dy: -8 })
    expect(candidates(item({ kind: 'hub', degree: 4 }), 550)[0].dy).toBeCloseTo(8.2 + 3 + 11)
  })
  it('rectFor and overlapArea', () => {
    expect(rectFor(item({ x: 100, y: 100 }), { a: 'start', dx: 10, dy: 4 }, 1)).toEqual([110, 93, 150, 107])
    expect(rectFor(item({ x: 100, y: 100 }), { a: 'end', dx: -10, dy: 4 }, 1)).toEqual([50, 93, 90, 107])
    expect(overlapArea([0, 0, 10, 10], [5, 5, 20, 20])).toBe(25)
    expect(overlapArea([0, 0, 10, 10], [10, 0, 20, 10])).toBe(0)
  })
  it('far-apart labels are all placed', () => {
    const out = placeLabels([item({ id: 'a', x: 100, y: 100 }), item({ id: 'b', x: 600, y: 600 })], [], 1, B)
    expect(out.get('a')!.crowded).toBe(false); expect(out.get('b')!.crowded).toBe(false)
  })
  it('a label boxed in by reserved rects is crowded', () => {
    const out = placeLabels([item({ id: 'a', x: 500, y: 500 })], [[400, 400, 600, 600]], 1, B)
    expect(out.get('a')!.crowded).toBe(true)
  })
  it('out-of-bounds candidates are penalized only near k = 1', () => {
    const edge = item({ id: 'a', x: 5, y: 400 })
    expect(placeLabels([edge], [], 1, B).get('a')!.c.a).toBe('start')
    expect(placeLabels([edge], [], 2, B).get('a')!.c.a).toBe('end')
  })
  it('big hubs are placed before founders', () => {
    const hub = item({ id: 'h', kind: 'hub', degree: 5, x: 300, y: 300, r: 8.7, lw: 60 })
    const f = item({ id: 'f', x: 300, y: 330 })
    const out = placeLabels([f, hub], [], 1, B)
    expect(out.get('h')!.c).toEqual(candidates(hub, 550)[0])
    expect(out.get('f')!.c).not.toEqual(candidates(f, 550)[0])
  })
})
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `src/map/labels.ts`. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `map: port greedy label placement from the prototype`

---

### Task 8: Map rendering

**Files:**
- Create: `src/map/map.ts`, `src/styles/map.css`
- Test: `tests/map.test.ts`

**Interfaces:**
- Consumes: `Graph` and node types (Task 2); `clusterGeometry`, `altStub`, `nodeRadius`, `hubRadius` (Task 6); `placeLabels`, `LabelItem`, `Rect` (Task 7); `Layers` (Task 9, defined here first as `src/state.ts` does not exist yet: put `Layers` in `src/types.ts`: `{ companies: boolean; employers: boolean; schools: boolean; projects: boolean; oneOff: boolean; alt: boolean }`). D3: `select` from `d3-selection`, `zoom, zoomIdentity` from `d3-zoom`, `line, curveCatmullRomClosed` from `d3-shape`, side-effect import `d3-transition`.
- Produces:
  - `interface MapInput { focus: AnyNode | null; pinned: boolean; matched: Set<FounderNode>; layers: Layers; filtersActive: boolean; pathFilter: Set<PathKey> }`
  - `interface MapHandlers { onHover(id: string | null, pointerType: string | undefined): void; onToggle(id: string): void; onCanvasClick(): void }`
  - `interface MapView { update(input: MapInput): void; relayout(): void; zoomIn(): void; zoomOut(): void; fit(): void }`
  - `createMap(svg: SVGSVGElement, graph: Graph, handlers: MapHandlers, opts?: { reduceMotion?: boolean; fontsReady?: Promise<unknown> }): MapView`
- Behavior:
  - SVG gets `viewBox="0 0 1100 840"`, `preserveAspectRatio="xMidYMid meet"`; one viewport `g` with child groups in order: hulls, links, alt stubs, nodes, labels (labels group also holds cluster labels).
  - Hulls: one `path.hull` per cluster, `style="--c: var(--path-<key>)"`, `d` from `line().curve(curveCatmullRomClosed.alpha(0.6))(hull)`.
  - Links: one `line.link.<kind>` per graph link at the endpoint positions.
  - Alt stubs: `g.alt` per founder with `secondaryPath`, dashed line from the founder to `altStub(founder, cluster center of secondaryPath)` and a `circle` r 2.6 at the end, colored by the secondary path.
  - Nodes: `g.node.<kind>[.<htype>]` with `data-id`, `tabindex="0"`, `role="button"`, `aria-label` (founder: `"<name>, <path name>, <company>, <fund>"`; company: `"<name>, <fund> company"`; hub: `"<name>, <hub type>, <n> founder(s)"`), `style="--c: var(--path-<key>)"` for founders. Children: `circle.halo` r = `nodeRadius + 4.5` (ring, shown when pinned); shape: founder Amplify `circle.shape` r 6.5, Haystack `rect.shape` 11.7 square rx 2 centered; company Amplify `circle.shape` r 5, Haystack `rect.shape` 9 square rx 1.5; hub `circle.shape` r `hubRadius`, school adds `circle.pip` r `max(2, hubRadius * 0.32)`, project hubs get class `o` (dashed stroke in CSS); `circle.hit` r `max(12, nodeRadius + 5)` transparent.
  - Labels: `g.lbl.<kind>` with a `text`: founder `shortLabel`, company `name`, hub `name.toUpperCase()`. Cluster labels: `g.lbl.cluster` with `text-anchor` from geometry; text `"<NAME> · <n>"`, or `"<NAME> · <m>/<n>"` when `filtersActive` (`m` = matched founders in that cluster).
  - `measure()`: for every label, reset anchor/x/y and read `getBBox()` inside try/catch; fallback `{ width: text.length * 6, height: 14, y: -11 }`. Cluster labels are measured with the widest form (`"<NAME> · <n>/<n>"`) then clamped: `start` → `lx = min(lx0, W - 10 - lw)`, `end` → `lx = max(lx0, 10 + lw)`, `middle` → clamp to `[10 + lw/2, W - 10 - lw/2]`; `ly = clamp(ly0, la + 8, H - 10)`.
  - `applyScale()`: `s = 1/sqrt(k)`; nodes and labels get `translate(x,y) scale(s)`; cluster labels `translate(lx,ly) scale(s)`; alt dots r `2.6 * s`.
  - `place()`: builds `LabelItem`s for shown nodes, reserved rects for the five cluster labels, calls `placeLabels`, writes `text-anchor`, `x`, `y` on each label text.
  - `relayout()` = `measure(); place(); apply last input`. Called on creation, after `fontsReady` resolves, and at zoom end.
  - `update(input)`: `shown(d)` = company → `layers.companies`; hub → `layers[employers|schools|projects by htype] && (!oneOff || layers.oneOff)`; founder → true. `matchedNode(d)` = founder in `matched`, company/hub with any member in `matched`. `E` = focus plus its neighbors when `focus`. Node and label opacity: not matched 0.07; focused and not in `E` 0.32; else 1. Labels hidden when crowded unless in `E`. Link opacity: source not matched 0.03; focused: touches focus 0.95 else 0.03; else base (`co` 0.45, others 0.24) times 1.6 capped at 1 when `filtersActive`. Links hidden when their target is hidden. Alt stubs hidden unless `layers.alt`; opacity not matched 0.04, focused in `E` 0.9 / else 0.05, default 0.6. Hull opacity: path on (`pathFilter` empty or has key) → focus ? 0.5 : 1, else 0.25. Cluster label: path on → focus ? 0.55 : 1, else 0.3. `pinned` class on the focused node when `pinned`.
  - Zoom: `zoom().scaleExtent([0.8, 5]).translateExtent([[-440, -336], [1540, 1176]])`, on `zoom` set viewport transform and `applyScale()` when `k` changes, on `end` call `relayout()`; disable `dblclick.zoom`. `zoomIn` = `scaleBy 1.5`, `zoomOut` = `scaleBy 1/1.5`, `fit` = `zoomIdentity`, each through `transition().duration(reduceMotion ? 0 : 260)`.
  - Events on nodes: `pointerenter` → `onHover(id, ev.pointerType)`; `pointerleave` → `onHover(null, ev.pointerType)`; `click` (stopPropagation) → `onToggle(id)`; `keydown` Enter or Space → `onToggle(id)`. Click on the SVG background → `onCanvasClick()`.
  - `map.css` (tokens only): hull fill/stroke via `--c` with `--map-hullFillOpacity`, `--map-hullStrokeOpacity`, `--map-hullStrokeWidth`, `vector-effect: non-scaling-stroke`; links `--color-link` 0.9 (co: `--color-ink` 1.3; o: dasharray `3 3`); alt line 1.4 dasharray `2 3`; founder shape fill `--c` with surface stroke 1.6; company shape fill ink; hub shape fill surface, stroke `--color-hubStroke` 1.6, `.o` dasharray `2.4 1.9`; halo stroke `--c` for founders and `--color-accent` otherwise, width `--map-ringWidth`, hidden unless `.pinned`; `.node:focus-visible .hit` stroke accent 2; label text `paint-order: stroke`, stroke surface `--map-labelStroke`, founder `--text-mapFounder`/600, company `--text-mapCompany`/700, hub `--text-mapHub`/600 uppercase tracking label fill muted, cluster `--text-mapCluster`/700 uppercase tracking cluster fill `--c`; `.lbl { pointer-events: none }`; transitions 0.15s on opacity.

- [ ] **Step 1: Write the failing tests** in `tests/map.test.ts`

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { graph } from '../src/data'
import { createMap, type MapInput } from '../src/map/map'
import type { FounderNode } from '../src/model'

const layers = { companies: true, employers: true, schools: true, projects: true, oneOff: false, alt: true }
const base = (): MapInput => ({ focus: null, pinned: false, matched: new Set(graph.founders), layers, filtersActive: false, pathFilter: new Set() })
const mount = (opts = {}) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement
  document.body.append(svg)
  const map = createMap(svg, graph, { onHover() {}, onToggle() {}, onCanvasClick() {} }, opts)
  map.update(base())
  return { svg, map }
}
const style = (svg: SVGSVGElement, id: string) => (svg.querySelector(`[data-id="${id}"]`) as HTMLElement).style.opacity

describe('map', () => {
  it('renders every node with an aria-label, five hulls, every link and stub', () => {
    const { svg } = mount()
    expect(svg.querySelectorAll('g.node[aria-label][tabindex="0"]')).toHaveLength(graph.all.length)
    expect(svg.querySelectorAll('path.hull')).toHaveLength(5)
    expect(svg.querySelectorAll('line.link')).toHaveLength(graph.links.length)
    expect(svg.querySelectorAll('g.alt')).toHaveLength(graph.founders.filter((f) => f.secondaryPath).length)
    expect(svg.getAttribute('viewBox')).toBe('0 0 1100 840')
  })
  it('shapes by fund and hub type', () => {
    const { svg } = mount()
    expect(svg.querySelector('[data-id="f:dan-lorenc"] circle.shape')?.getAttribute('r')).toBe('6.5')
    expect(svg.querySelector('[data-id="f:peter-edge"] rect.shape')).not.toBeNull()
    expect(svg.querySelector('[data-id="s:mit"] circle.pip')).not.toBeNull()
    expect(svg.querySelector('[data-id="o:ray"]')?.classList.contains('o')).toBe(true)
    expect(svg.querySelector('[data-id="e:google"] circle.shape')?.getAttribute('r')).toBe(String(3.6 + Math.sqrt((graph.byId.get('e:google') as any).degree) * 2.3))
  })
  it('focus keeps neighbors at 1, dims the rest to 0.32, and rings the pinned node', () => {
    const { svg, map } = mount()
    map.update({ ...base(), focus: graph.byId.get('f:dan-lorenc')!, pinned: true })
    for (const id of ['f:dan-lorenc', 'c:chainguard', 's:mit', 'e:google', 'e:microsoft', 'o:kubernetes', 'o:sigstore', 'o:slsa', 'o:tekton', 'o:distroless']) expect(style(svg, id), id).toBe('1')
    expect(style(svg, 'f:will-wilson')).toBe('0.32')
    expect(svg.querySelector('[data-id="f:dan-lorenc"]')?.classList.contains('pinned')).toBe(true)
    const links = [...svg.querySelectorAll('line.link')] as HTMLElement[]
    expect(links.some((l) => l.style.opacity === '0.95')).toBe(true)
    expect(links.filter((l) => l.style.opacity === '0.03').length).toBeGreaterThan(100)
  })
  it('filtered-out founders drop to 0.07 and layers hide node kinds', () => {
    const { svg, map } = mount()
    const matched = new Set(graph.founders.filter((f) => f.id !== 'f:will-wilson'))
    map.update({ ...base(), matched, filtersActive: true })
    expect(style(svg, 'f:will-wilson')).toBe('0.07')
    map.update({ ...base(), layers: { ...layers, companies: false } })
    expect((svg.querySelector('[data-id="c:chainguard"]') as HTMLElement).getAttribute('display')).toBe('none')
    expect((svg.querySelector('[data-id="e:visual-sciences"]') as HTMLElement).getAttribute('display')).toBe('none')
    map.update({ ...base(), layers: { ...layers, oneOff: true } })
    expect((svg.querySelector('[data-id="e:visual-sciences"]') as HTMLElement).getAttribute('display')).toBeNull()
  })
  it('cluster labels show counts, and matched/total when filters are active', () => {
    const { svg, map } = mount()
    const text = () => [...svg.querySelectorAll('g.lbl.cluster text')].map((t) => t.textContent)
    expect(text()).toContain('BIG TECH ENGINEER · 20')
    map.update({ ...base(), matched: new Set(graph.founders.filter((f) => f.fund === 'amplify')), filtersActive: true })
    expect(text()).toContain('BIG TECH ENGINEER · 13/20')
  })
  it('survives a missing getBBox and re-measures when fonts are ready', async () => {
    let ready!: () => void
    const { svg, map } = mount({ fontsReady: new Promise<void>((r) => (ready = r)) })
    expect([...svg.querySelectorAll('g.lbl.founder')].some((l) => l.getAttribute('display') !== 'none')).toBe(true)
    ;(SVGElement.prototype as any).getBBox = () => ({ x: 0, y: -11, width: 5000, height: 14 })
    ready()
    await new Promise((r) => setTimeout(r, 0))
    expect([...svg.querySelectorAll('g.lbl.founder')].every((l) => l.getAttribute('display') === 'none')).toBe(true)
    delete (SVGElement.prototype as any).getBBox
    void map
  })
})
```

- [ ] **Step 2: Run** `npx vitest run tests/map.test.ts` → FAIL.
- [ ] **Step 3: Implement** `src/map/map.ts` and `src/styles/map.css`; add `Layers` to `src/types.ts`.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → all pass.
- [ ] **Step 5: Commit** `map: render hulls, links, stubs, nodes, labels, cluster labels, zoom`

---

### Task 9: State, boot, and end-to-end verification

**Files:**
- Create: `src/state.ts`
- Modify: `src/main.ts`
- Test: `tests/state.test.ts`

**Interfaces:**
- Consumes: `createMap` (Task 8), `graph` (Task 2), `Layers` (`src/types.ts`).
- Produces (`src/state.ts`): `interface State { focus: string | null; pinned: boolean; layers: Layers }`; `DEFAULT_LAYERS` (all true except `oneOff: false`); `createStore(initial: State): { get(): State; set(patch: Partial<State>): void; subscribe(fn: (s: State) => void): () => void }` (subscribers run after every `set`); `hoverFocusAllowed(pointerType: string | undefined, pinned: boolean): boolean` (false for `'touch'` or when pinned); `escapeClears(activeTag: string | undefined): boolean` (false for `INPUT`, `SELECT`, `TEXTAREA`); `toggleSelect(s: State, id: string): Partial<State>` (`{ focus: null, pinned: false }` when `s.pinned && s.focus === id`, else `{ focus: id, pinned: true }`).
- `src/main.ts`: import the four stylesheets; fill `#stats`; create store with `DEFAULT_LAYERS`; `createMap(svg#map, graph, handlers, { reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, fontsReady: document.fonts?.ready })`; handlers: `onHover(id, pt)` → if `hoverFocusAllowed(pt, state.pinned)` set `focus: id`; `onToggle(id)` → `set(toggleSelect(state, id))`; `onCanvasClick()` → clear when focus or pinned; `keydown` Escape on `document` → clear when `escapeClears(document.activeElement?.tagName)`; zoom buttons → `zoomIn/zoomOut/fit`; `subscribe` → `map.update({ focus: byId.get(focus) ?? null, pinned, matched: new Set(graph.founders), layers, filtersActive: false, pathFilter: new Set() })`; initial update.

- [ ] **Step 1: Write the failing tests** in `tests/state.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYERS, createStore, escapeClears, hoverFocusAllowed, toggleSelect } from '../src/state'

describe('state', () => {
  it('store notifies subscribers with merged state', () => {
    const s = createStore({ focus: null, pinned: false, layers: DEFAULT_LAYERS })
    const seen: unknown[] = []; s.subscribe((v) => seen.push(v.focus))
    s.set({ focus: 'f:dan-lorenc' })
    expect(seen).toEqual(['f:dan-lorenc']); expect(s.get().pinned).toBe(false)
  })
  it('hover never overrides a pin and ignores touch', () => {
    expect(hoverFocusAllowed('mouse', false)).toBe(true)
    expect(hoverFocusAllowed('touch', false)).toBe(false)
    expect(hoverFocusAllowed('mouse', true)).toBe(false)
  })
  it('escape clears unless typing', () => {
    expect(escapeClears('BODY')).toBe(true); expect(escapeClears('INPUT')).toBe(false); expect(escapeClears('SELECT')).toBe(false); expect(escapeClears(undefined)).toBe(true)
  })
  it('toggle pins, and unpins the same node', () => {
    expect(toggleSelect({ focus: null, pinned: false, layers: DEFAULT_LAYERS }, 'a')).toEqual({ focus: 'a', pinned: true })
    expect(toggleSelect({ focus: 'a', pinned: true, layers: DEFAULT_LAYERS }, 'a')).toEqual({ focus: null, pinned: false })
    expect(toggleSelect({ focus: 'a', pinned: true, layers: DEFAULT_LAYERS }, 'b')).toEqual({ focus: 'b', pinned: true })
  })
})
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `src/state.ts` and finish `src/main.ts`. **Step 4: Run** `npm test && npx tsc --noEmit` → PASS.
- [ ] **Step 5: Full verification**

Run: `npm run validate && npm test && npm run build`
Expected: validate prints `data OK ...`; every test passes; `vite build` succeeds and reports the main JS chunk under 300 KB gzipped (expect well under 100 KB).

Run `npm run dev`, open in Chrome at 1440 wide, and check against `reference/design/Main.dc.html`: hulls, links, nodes, labels, and cluster labels appear at the artboard's positions; hovering a node dims the rest; clicking Dan Lorenc pins him with a blue ring and keeps Chainguard, MIT, Google, Microsoft, Kubernetes, Sigstore, SLSA, Tekton, Distroless at full opacity; clicking him again, pressing Esc, or clicking empty canvas unpins; the zoom buttons work and labels stay readable at 3x; narrowing to 900px stacks the side column; Tab reaches nodes and Enter pins.

- [ ] **Step 6: Commit** `map: wire focus, pin, keyboard, and zoom controls in main`
