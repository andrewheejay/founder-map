# Founder Map

An interactive network map of the founders behind the Amplify Partners and Haystack portfolios, grouped by the career path that led them to start a company and linked through shared employers, schools, and open source projects. Built for VC-style due diligence: hover or tap a founder to see their ties, filter by path, badge, employer, school, vertical, status, or open source product, switch to a sortable table, and copy the filtered rows as CSV.

The full specification lives in [CLAUDE.md](CLAUDE.md). The working prototype and the approved design artboards are in `reference/` (not shipped).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest, jsdom
npm run validate   # schema and referential checks on data/*.json
npm run build      # validate, regenerate tokens.css, type-check, then vite build into dist/
npm run preview    # serve dist/ locally
```

Stack: Vite, TypeScript, and D3 v7 (`d3-selection`, `d3-zoom`, `d3-shape`, `d3-polygon`; `d3-force` only in the offline layout script). No framework, no backend. Styles are plain CSS driven by custom properties generated from `design/tokens.json` (`npm run tokens`, run automatically by the build).

## Project layout

```
data/        founders.json, companies.json, layout.json (the only source of truth for content)
design/      tokens.json (colors, type, radii, spacing, dark overrides)
scripts/     validate.ts, tokens.ts, layout.ts
src/
  app.ts       boot: store, renderers, every event handler
  model.ts     graph: hubs, links, neighbors, derived badges, search haystacks
  state.ts     filter, selection, view, tab, and sort state (pure reducers)
  hash.ts      selection <-> URL hash
  map/         svg map: hulls, links, nodes, labels, zoom
  table/       sortable table and CSV
  panel/       detail card variants and the Clusters, Insights, About tabs
  filters/     drawer, controls, active filter chips
  styles/      tokens.css (generated), base.css, components.css, map.css
tests/       vitest suites, one per module
docs/        implementation plans and the acceptance report
```

## Data model

Three JSON files under `data/`. Ids are slugs: lowercase, accents stripped, every run of non-alphanumerics replaced by `-`.

### companies.json

| field | type | notes |
|---|---|---|
| id | `c:<slug>` | slug of the name |
| name | string | |
| fund | `amplify` or `haystack` | |
| vertical | string | Developer Tools, AI & Cloud Infrastructure, Security & Observability, Data Infrastructure, or Fintech Infrastructure |
| founded | number | year |
| avgFounderAgeAtFounding | number or null | estimate; null when unknown |
| openSourceProduct | `yes`, `partial`, or `no` | open product, open tooling or standard with a commercial core, or closed |
| status | string | free text, for example "Active · outside CEO since 2024" |
| latest | string | latest public round or valuation |
| description | string | one sentence |

### founders.json

| field | type | notes |
|---|---|---|
| id | `f:<slug>` | slug of the name |
| name, shortLabel | string | shortLabel is the map label, usually the last name |
| company | string | must equal a `companies[].name` |
| path | enum | `big_tech_engineer`, `repeat_founder`, `business_operator`, `young_builder`, `academic` |
| secondaryPath | enum or null | the "also fits" path, drawn as a dashed stub |
| role | string | |
| status | `active`, `role_changed`, or `left` | relative to the founding role |
| statusNote | string or null | shown on the card and in the table when present |
| badges | array | subset of `prior_open_source`, `prior_exit`, `grad_degree`; `big_tech_alum` is derived, never stored |
| employers, schools, taughtAt, priorOpenSource | string[] | each distinct name becomes a hub node |
| edgeCase | boolean | true when no clean path fits; the card shows a "placement is tentative" note |
| bio | string | two sentences at most |
| source | url | one public source per founder |

### layout.json

`{ viewBox: [0, 0, 1100, 840], note, nodes: { "<id>": { x, y } } }` with one entry for every founder, company, and hub id. Hub ids are `e:<slug>` for employers, `s:<slug>` for schools (entries in `taughtAt` map to `s:` too), and `o:<slug>` for open source projects. Positions are static at runtime; nothing is simulated in the browser.

### Derived at load time (`src/model.ts`)

- Hubs: one node per distinct employer, school, or project name; `degree` is the number of founders tied to it; a hub is one-off when its degree is below 2 and it is not a project. One-off hubs are hidden unless the "One-off ties" layer is on.
- Links: founder to company, founder to each hub.
- `big_tech_alum`: any employer in Google, Facebook, Microsoft, Amazon, Apple, Twitter, Uber, Lyft, or Palantir.
- Search haystack per founder: name, company, vertical, role, path names, badge names, employers, schools, projects, bio, status note, status label, fund, and open source product label, lowercased.
- Every count in the UI (cluster sizes, drawer chip counts, the Insights bullets, the active row totals) is computed from these files.

## Add a founder

1. Append an object to `data/founders.json` with every field in the table above. The `company` must already exist in `companies.json` (add it there first if not), and `source` must be a public URL. Keep the bio to two sentences.
2. Run `npm run validate`. It checks unique ids, the slug rule, every enum, the company reference, and that every node id has a layout entry and vice versa. The new founder (and any new employer, school, or project) will fail the layout check until step 3.
3. Run `npm run layout` to rewrite `data/layout.json` with positions for the new ids. Every node moves a little when the simulation re-runs, so review the map once afterward.
4. Run `npm test` and commit the data change together with the source URL that supports it.

## Add a fund

The two funds are a closed enum, so a third one touches code as well as data:

1. `src/types.ts`: extend the `Fund` union.
2. `src/model.ts`: add the label to `FUND_LABEL`; `Cluster.counts` and the cluster rows in `src/panel/tabs.ts` assume two funds (Amplify · Haystack), so generalize them to iterate the funds.
3. `scripts/validate.ts`: add the fund to `FUNDS`.
4. `index.html`: add a button with `data-fund="<key>"` to the fund segmented control, and a legend entry for the new node shape.
5. `src/map/map.ts`: founders and companies are drawn as circles (Amplify) or rounded squares (Haystack); pick a third shape. The table's `.pdot` in `src/table/table.ts` and the member rows in `src/panel/card.ts` use the same circle-or-square rule.
6. `src/panel/tabs.ts`: the first Insights bullet compares the two funds' leading paths; extend it or keep it to the two largest funds.
7. Add the companies and founders to `data/`, then `npm run validate`, `npm run layout`, `npm test`.

## Regenerate the layout

`npm run layout` runs the prototype's force simulation offline (`scripts/layout.ts`: founders pulled toward their path anchor, 500 ticks, fitted into 1100 by 840 with a 76px margin) and rewrites `data/layout.json`. Run it only when ids change; the page itself never simulates. To preview without overwriting, pass an output path: `npx tsx scripts/layout.ts --out /tmp/layout.json`.

## Deploy

The site is static: `npm run build` writes `dist/`.

- GitHub Pages: `.github/workflows/pages.yml` builds on every push to `main` and deploys with the Pages actions. In the repository settings, set Pages "Source" to "GitHub Actions". The workflow sets `BASE_PATH=/<repo-name>/` so asset URLs work on a project site; for a user or organization site, or a custom domain, set `BASE_PATH=/`.
- Vercel: build command `npm run build`, output directory `dist`, no environment variables needed.

Add the deploy URL here once it exists.

## Acceptance

The section 9 checklist from the spec, with evidence for each item, is in [docs/acceptance.md](docs/acceptance.md).
