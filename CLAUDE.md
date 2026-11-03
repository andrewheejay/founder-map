# Founder Map

An interactive network map of the founders behind Lenny Pruss's Amplify Partners portfolio and Semil Shah's Haystack portfolio, used for VC-style due diligence. Founders are grouped by the career path that led them to start a company and linked through shared employers, schools, and open source projects.

This file is the spec. Read it fully before writing code. The `reference/` folder holds the working prototype and the approved design; the `data/` folder holds the content.

## 1. What exists today (source material)

| What | Where | Use it for |
|---|---|---|
| Working prototype (single-file HTML, D3 v7, vanilla JS) | `reference/founder-map-v4.html` | Behavior reference. Every interaction listed in section 6 already works here. Read its JS before reimplementing anything. |
| Approved visual design (3 artboards) | `reference/design/Main.dc.html` (desktop map), `Table.dc.html` (desktop table), `Phone.dc.html` (390px phone) | Pixel reference for layout, spacing, type, color. These are static mockups; copy the look, not the markup. |
| Content | `data/founders.json`, `data/companies.json` | The only source of truth for people and companies. Never hard-code founder facts in components. |
| Precomputed positions | `data/layout.json` | Static x/y for every node in a 1100x840 coordinate space. Ship these; do not run a force simulation at page load. |
| Research doc (bios, sources, qualities scorecard) | Claude Docs "Amplify Portfolio: Founder Briefs" https://claude.ai/code/artifact/619f117c-df06-44e8-abac-ee2e6b95b82d | Background only. The map's About tab links to it. |
| Live prototype and design canvas | https://claude.ai/artifact/JfYh7274rxw7y99KJdopCP and https://claude.ai/artifact/ETWaG4FscbaiQYDU6QsYrr | Same content as the reference files, in case a fresh copy is needed. |

## 2. Goal and non-goals

**Goal.** Rebuild the prototype as a small, deployable web app with the approved design, data separated from code, and a stable (non-simulated) layout. Same features as the prototype, nothing removed.

**Non-goals for v1.** No backend, no auth, no scraping, no editing UI, no React unless there is a reason beyond preference. Keep it a static site.

## 3. Stack and repo layout

- Vite + TypeScript + D3 v7 (`d3-selection`, `d3-zoom`, `d3-polygon`, `d3-shape`; import only what is used).
- No CSS framework. Plain CSS with custom properties from `design/tokens.json`.
- Deploy target: Vercel or GitHub Pages (static output from `vite build`).

```
founder-map/
  CLAUDE.md                 this file
  index.html
  package.json
  data/
    founders.json           81 founders
    companies.json          36 companies
    layout.json             node positions, viewBox 0 0 1100 840
  design/
    tokens.json             colors, type, radii, spacing (section 5)
  scripts/
    layout.ts               re-runs the force simulation and rewrites data/layout.json (run only when data changes)
    validate.ts             schema + referential checks on the JSON (run in CI and before commits)
  src/
    main.ts                 boot, state, render loop
    model.ts                load JSON, build graph (hubs, links, neighbors), derive big tech employers and haystacks
    state.ts                filter/focus state and URL hash sync
    map/                    svg map: hulls, links, nodes, labels, zoom
    table/                  sortable table + CSV export
    panel/                  detail card (founder, company, hub, cluster, default) + tabs (Clusters, Insights, About)
    filters/                toolbar, drawer, active chips
    styles/                 tokens.css (generated from tokens.json), base.css, components.css
  reference/                prototype + design artboards (read-only, not shipped)
```

## 4. Data model

### companies.json (array)

| field | type | notes |
|---|---|---|
| id | `c:<slug>` | slug = lowercase, accents stripped, non-alphanumerics to `-` |
| name | string | |
| fund | `amplify` \| `haystack` | |
| vertical | string | one of: Developer Tools, AI & Cloud Infrastructure, Security & Observability, Data Infrastructure, Fintech Infrastructure |
| founded | number | year |
| avgFounderAgeAtFounding | number \| null | estimated; null when unknown |
| openSourceProduct | `yes` \| `partial` \| `no` | company attribute, see section 5.3 |
| status | string | free text, e.g. "Active · outside CEO since 2024" |
| latest | string | latest public round or valuation |
| description | string | one sentence |

### founders.json (array)

| field | type | notes |
|---|---|---|
| id | `f:<slug>` | |
| name, shortLabel | string | shortLabel is the map label (usually last name) |
| company | string | must match a `companies[].name` |
| path | enum | `big_tech_engineer` \| `repeat_founder` \| `business_operator` \| `young_builder` \| `academic` |
| secondaryPath | enum \| null | "also fits" path, drawn as a dashed stub |
| role | string | |
| status | `active` \| `role_changed` \| `left` | relative to the founding role |
| statusNote | string \| null | shown when status is not active |
| background | array | subset of `prior_open_source`, `prior_exit`, `grad_degree`. Big tech employment is never stored here: it is read from employers (see 5.2). |
| employers, schools, taughtAt, priorOpenSource | string[] | these become hub nodes |
| edgeCase | boolean | true when no clean path fits; show the "placement is tentative" note |
| bio | string | two sentences max |
| source | url | one public source per founder |

### layout.json

`{ viewBox: [0,0,1100,840], nodes: { "<id>": {x, y} } }` for every founder, company, and hub id. Hub ids are `e:<slug>` (employer), `s:<slug>` (school; `taughtAt` entries also map to `s:`), `o:<slug>` (open source project).

### Derived at load time (model.ts)

- **Hubs**: one node per distinct employer / school / project name. `degree` = number of founders tied to it. `oneOff` = degree < 2 and type is not `o` (every open source project is always shown).
- **Links**: founder to company (`co`), founder to each hub (`e`, `s`, `o`).
- **bigTech** per founder: the employers that are in BIG_TECH = Google, Facebook, Microsoft, Amazon, Apple, Twitter, Uber, Lyft, Palantir. Drives the Big tech employer filter and the table's Big tech column; there is no separate "alum" flag.
- **Search haystack** per founder: name, company, vertical, role, path name, secondary path name, background names, employers, schools, projects, bio, statusNote, status label, fund, open source product label, all lowercased and joined.

### validate.ts must check

Unique ids; every founder's company exists; path enums; every node id has a layout entry and vice versa; status enum; background enum; no empty bio or source. Fail the build on any error.

## 5. The model behind the map (do not change without updating the About tab)

### 5.1 Paths (one per founder, drawn as colored clusters)

| key | label | definition shown in UI |
|---|---|---|
| big_tech_engineer | Big tech engineer | Years building infrastructure inside a large tech company or agency. |
| repeat_founder | Repeat founder | A company they started before is their main credential. |
| business_operator | Business operator | Came from finance, consulting, policy, or investing. |
| young_builder | Young builder | Started within a few years of school or a first startup job. |
| academic | Academic | Came out of a PhD lab or a professorship. |

Display order is the table order above. Current counts (Amplify · Haystack): Big tech engineer 12 · 16, Young builder 7 · 13, Repeat founder 6 · 17, Business operator 1 · 4, Academic 4 · 1. Total 81 founders, 36 companies. Keep these numbers computed from data, never typed in.

### 5.2 Background (zero or more facts per founder)

Prior open source, Prior exit, Grad degree. These are plain yes/no facts on top of a path, filtered like any other attribute and shown as a "Background" row in the founder card and a "Background" column in the table. Prior open source is a background fact, not a path. Big tech employment is not a background fact: the Big tech employer group filters by the nine employers directly (the 2026-11-02 "background" change removed the derived Big tech alum chip, the card chips, and the "Badges by path" bars).

### 5.3 Company attribute

`openSourceProduct`: yes (open product), partial (open tooling or standard, commercial core), no (closed). Shown in the company block and filterable.

### 5.4 Hubs (the gray "stations")

Employers and schools shared by two or more founders, plus every prior open source project. One-off ties are hidden unless the "One-off ties" layer is on.

## 6. Features (all exist in the prototype; keep every one)

**Toolbar (one row, wraps on narrow screens)**
1. Search input. Tokenized: every whitespace-separated token must appear in the founder's haystack.
2. Fund segmented control: Both funds / Amplify / Haystack.
3. View segmented control: Map / Table.
4. Filters button with a count pill of active filters; toggles a drawer that is open on load.

**Filter drawer** (grid of groups): Path (5 chips with counts), Background (3 chips with counts), Big tech employer (9 chips with counts), More (selects: School, Vertical, Status, Open source product), Map layers (Companies, Employers, Schools, Open source projects, One-off ties, Also-fits stubs).

**Active filters row**: one removable chip per active filter, then "N of 81 founders · M of 36 companies", then Clear all. Hidden when nothing is active.

**Map**
- SVG with viewBox `0 0 1100 840`, `preserveAspectRatio xMidYMid meet`, positions from layout.json.
- Layers back to front: path hulls (polygon hull around each path's founders with 26px padding, Catmull-Rom closed curve), links, also-fits stubs, nodes, labels, cluster labels.
- Node shapes: founder = filled circle (Amplify) or rounded square (Haystack) in the path color; company = small ink circle (Amplify) or square (Haystack); hub = hollow circle with ink stroke, radius `3.6 + sqrt(degree) * 2.3`; school hubs get a center pip; open source project hubs have a dashed stroke.
- Cluster label per path: `BIG TECH ENGINEER · 20`, placed outside the hull on the side away from center; with filters active it reads `· 13/20`.
- Hover (mouse) or tap (touch) focuses a node: the node and its neighbors stay at full opacity, everything else drops to 0.32 (nodes, labels) and links not touching the focus drop to near zero. Click pins; click again, Esc, the close button, or clicking empty canvas unpins. Pinned node gets a 2.2px ring in its path color.
- Filtered-out nodes drop to 0.07 opacity; their links to 0.03.
- Labels: founders show shortLabel; companies show name (bold); hubs show NAME in uppercase, small, muted. Labels use a white paint-order stroke (3.4px). Greedy placement that avoids node and label overlaps (4 candidate positions per founder label, 4 per company/hub); crowded labels are hidden unless they are neighbors of the focused node. Scale labels and node sizes by `1/sqrt(zoom)` so they stay readable when zoomed.
- Zoom and pan with d3-zoom (scale 0.8 to 5), buttons for +, −, Fit, stacked bottom-right.
- Searching or filtering zooms the map (420 ms, none under reduced motion) to fit the matched founders, at most 2.4x; clearing every filter zooms back to the whole map. Hover and selection never move the viewport on desktop.
- Legend row under the map: five path colors, Amplify (circle), Haystack (square), Employer, School, Open source project, Also fits another path.

**Detail card** (right column on desktop, below the map on phones), one of:
- Founder: eyebrow `FOUNDER · AMPLIFY`, name, role · company (link), path chip (tinted, with color dot) + also-fits chip (dashed), bio, status note when not active, edge-case note, definition list: Background (only when the founder has any), Worked at, School, Prior OSS, Co-founders (the ties clickable), Company block (latest round, status, open source product), Source (hostname, opens in new tab).
- Company: eyebrow with fund and vertical, name, "Founded YYYY · founders about N at founding", description, Status / Latest / Open source / Team (paths present) / Shares talent pools with (top 6 companies sharing hubs, with the hub names), then member list sorted by path.
- Hub: type (and "big tech" when applicable), name, "N founders across P paths and C companies · Amplify a, Haystack h", a "Filter to <Employer> alumni" chip for big tech employers, member list.
- Cluster (when exactly one path filter is active and nothing is focused): name, definition, counts, shared ties, also-fits-here list, members.
- Otherwise the card is hidden (no placeholder); the side column starts with the tabs.

**Tabs under the card**: Clusters (five rows with color, name, Amplify · Haystack counts, definition, and a two-tone bar; clicking toggles that path filter), Insights (six computed bullets: fund lean, busiest stations, shared by both funds, most mixed stations, mixed teams, founder turnover), About (methodology text from the prototype).

**Table view**: columns Founder, Fund, Company (+vertical), Path (+also fits), Role, Status (+note), Big tech, Background, Schools, Prior OSS, OSS product, Company latest (+status), Source. Sortable by any column (click header toggles direction). Row click selects the founder. "Copy table as CSV" copies the filtered rows with the prototype's `csv()` header minus its Big tech alum column (22 columns); fall back to a visible textarea when the clipboard API is unavailable. Wide table scrolls horizontally inside its card.

**URL**: selection is mirrored in the hash (`#f-dan-lorenc`, `#c-temporal`, `#e-google`); loading a hash selects that node. (Optional v1.1: encode filters in the query string.)

**Keyboard**: the map is one Tab stop; arrow keys move between nodes (Left/Right by position across, Up/Down by position down, Home/End to the ends), Enter/Space pins, and a focused node previews in the card like hover; Esc clears selection unless focus is in an input or select; visible focus rings everywhere.

## 7. Design spec (from the approved canvas)

Put these in `design/tokens.json` and generate `tokens.css`. Values are the light theme; see 7.6 for dark.

### 7.1 Color

| token | value | use |
|---|---|---|
| page | #F4F5F7 | page background |
| surface | #FFFFFF | cards, header, controls |
| ink | #111418 | text, active segmented control, company nodes |
| muted | #5B6471 | secondary text, hub labels (6.0:1 on white) |
| hairline | #E3E6EA | all borders |
| accent | #2457D6 | links, selection ring, focus ring |
| accentTint | #EAF0FC | selected table row, path chip background |
| tableHead | #F9FAFB | table header background |
| link (map edges) | #AEB6C0 | |
| hubStroke | #2A313B | |
| path.big_tech_engineer | #2457D6 | |
| path.repeat_founder | #0E7C5B | |
| path.business_operator | #B8304A | |
| path.young_builder | #B45E0A | |
| path.academic | #6F3BB5 | |
| status.active | bg #E3F3EC, text #0A5C44 | |
| status.role_changed | bg #FBEEDC, text #7A3E05 | |
| status.left | bg #F1F2F4, text #5B6471 | |

Rules: path colors are used as dots, fills, and hull tints, never as text on tinted backgrounds (orange fails contrast). Hulls: fill-opacity 0.06, stroke-opacity 0.28, stroke 1.2. No gradients, no drop shadows, no emoji.

### 7.2 Type

Inter (Google Fonts, weights 400/500/600/700), fallback system-ui. Base 14px / 1.45.
- Page title 17px/600, letter-spacing -0.01em; subtitle 12px muted.
- Card title (founder name) 20px/600; eyebrow 11px/600 uppercase, letter-spacing 0.08em, muted.
- Body and definition values 13px; definition labels 11px/600 uppercase 0.06em muted.
- Controls 13px/500. Table cells 13px; table headers 11px/600 uppercase 0.06em.
- Map: founder labels 12.5px/600, company labels 13px/700, hub labels 10.5px/600 uppercase 0.06em muted, cluster labels 13px/700 uppercase 0.08em in the path color.
- Numbers use `font-variant-numeric: tabular-nums`.

### 7.3 Shape and spacing

Cards radius 12, controls radius 8, inner segmented buttons 6, chips 999. 1px hairline borders everywhere, no shadows. Page max-width 1440 with 32px side padding; header 64px tall, white, hairline bottom. Main area: map card `flex: 999 1 560px` + side column 320px, gap 20; the side column wraps below the map under 980px. Control height 40 on desktop, 44 on phones (44px minimum touch targets). Card padding 20.

### 7.4 Components (match the artboards)

- Segmented control: white, hairline, 3px padding; active button = ink background, white text.
- Filters button: white with hairline; count pill = ink pill with white 11px text.
- Active filter chips: white pill with hairline, muted category prefix ("Background", "Employer"), an × button inside.
- Path chip in the card: accentTint background, 8px color dot, ink text.
- Clusters list: rows separated by hairlines, color dot + name left, `13 · 7` right in muted tabular numerals.
- Zoom controls: three 36px buttons stacked, white, hairline, bottom-right of the map card.
- Legend: 12px muted row under the map inside the card, separated by a hairline.

### 7.5 Phone (390px)

Single column. Header, search, full-width fund control, Map/Table + Filters row, map card (zoom to the selection on select), legend, detail card, clusters. No fake status bar. On select, scroll the detail card into view.

### 7.6 Dark theme

Required (the prototype has one; the canvas shows light only). Use `prefers-color-scheme` with a `data-theme` override. Starting tokens: page #0F1216, surface #171B21, ink #E6E9EE, muted #99A2AE, hairline #2A3038, accent #6F95F6, link edges #6B7480, paths #6F95F6 / #3BBD8B / #EF6C89 / #F29A4B / #B489EC. Check every text/background pair for 4.5:1 before shipping.

### 7.7 Accessibility

Real `<button>`, `<a>`, `<input>` + `<label>`; `aria-pressed` on toggles, `aria-selected` on tabs, `aria-label` on icon-only buttons and on every map node; `role="group"` + label on the SVG (not `img`: the img role hides the focusable node buttons from assistive technology); `prefers-reduced-motion` disables transitions; text contrast 4.5:1 including the 11px labels.

## 8. Build order

1. Scaffold Vite + TS. Copy `data/` and write `scripts/validate.ts`; wire it to `npm run validate` and the build.
2. `model.ts`: load JSON, build hubs/links/neighbors, derive big tech employers and haystacks. Unit-test the derived counts against section 5.1.
3. Tokens: `design/tokens.json` to `tokens.css`. Base layout: header, toolbar, two-column main, phone stacking.
4. Map with static positions, hulls, links, nodes, labels (port the placement algorithm from the prototype's `placeLabels()`), zoom, focus/pin behavior.
5. Detail card variants and tabs.
6. Filters (drawer, chips, selects, layers) and the active row; search.
7. Table view and CSV.
8. Hash sync, keyboard, dark theme, reduced motion.
9. `scripts/layout.ts` (the prototype's simulation, run offline) so positions can be regenerated when data changes.
10. Deploy. Add the deploy URL to the README.

## 9. Acceptance checklist

- [ ] `npm run validate` passes; counts match section 5.1 and are computed, not typed.
- [ ] Map loads with identical positions on every refresh; no simulation at runtime.
- [ ] Every feature in section 6 works on desktop and at 390px.
- [ ] Selecting Dan Lorenc reproduces `reference/design/Main.dc.html`: ring on his node, neighbors (Chainguard, MIT, Google, Microsoft, Kubernetes, Sigstore, SLSA, Tekton, Distroless) at full opacity, rest dimmed.
- [ ] Filtering Google shows 12 of 81 founders, 8 of 36 companies (10 of 54 and 6 of 24 in the prototype's `Table.dc.html`, where the pin was Big tech alum + Google; the Astro and Okteto founders added two Google alumni).
- [ ] Lighthouse accessibility 100; keyboard-only walkthrough works; dark theme passes contrast.
- [ ] Production build under 300 KB JS gzipped (D3 imported selectively).

## 10. Conventions

- Commit messages: imperative, one line, scope prefix (`map:`, `data:`, `panel:`).
- Never edit `data/*.json` by hand without re-running `validate` and, if ids changed, `layout`.
- Facts about a founder change only with a source URL in the same commit.
- No em dashes in UI copy; use commas, periods, or parentheses.
