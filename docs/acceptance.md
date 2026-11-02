# Acceptance report (spec section 9)

Checked 2026-11-02 on commit range 23f254f..HEAD (Prompt 3 branch) with Chrome 1440x704 for desktop, a same-origin 390px iframe for the phone layout (the browser extension cannot resize the window), Lighthouse 13.6.0 against `vite preview` of the production build, and the vitest suite (21 files, 114 tests, all green).

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | `npm run validate` passes; counts match section 5.1 and are computed | PASS | `npm run validate` prints `data OK: 54 founders, 24 companies, 93 hubs, 171 positioned nodes`. `tests/model.test.ts` asserts the cluster counts from the data files: Big tech engineer 13 · 7, Young builder 6 · 9, Repeat founder 6 · 5, Business operator 1 · 3, Academic 4 · 0, total 54 and 24. Every number in the UI (header stats, drawer chip counts 20/11/4/15/4, cluster labels, active row totals, Insights bullets) is rendered from `buildGraph`; no count is a literal in `src/` or `index.html`. |
| 2 | Identical positions on every refresh; no runtime simulation | PASS | All 171 node transforms were captured, the page was reloaded, and 0 of 171 differed (`f:dan-lorenc` at `translate(270.9,446.1)` both times). `grep -rn "d3-force\|forceSimulation" src/` finds nothing; `d3-force` is a devDependency used only by `scripts/layout.ts`. |
| 3 | Every section 6 feature works on desktop and at 390px | PASS | 46-step scripted walkthrough (real DOM events) run on the desktop page and again inside the 390px iframe; per-feature results below. Plus 13 phone-only checks (section 7.5) below. |
| 4 | Selecting Dan Lorenc reproduces Main.dc.html | PASS | After pinning `f:dan-lorenc`: Chainguard, MIT, Google, Microsoft, Kubernetes, Sigstore, SLSA, Tekton, Distroless all at opacity 1; the other 104 visible nodes all at 0.32; link opacities are 1 and 0.95 for touching links and 0.03 for the rest; the node carries `.pinned`, which shows the `.halo` ring in the path color at `--map-ringWidth` (2.2px). Screenshot zoom confirmed the ring on Lorenc with the nine neighbors lit. |
| 5 | Big tech alum + Google shows 10 of 54 founders, 6 of 24 companies | PASS | Active row reads `Badge Big tech alum · Employer Google · 10 of 54 founders · 6 of 24 companies`; map opacity histogram founders `{1: 10, 0.07: 44}`, companies `{1: 6, 0.07: 18}`; Table view shows 10 rows (Will Wilson, Dan Lorenc, Matt Moore, Kim Lewandowski, Ville Aikas, Scott Nichols, David Crawshaw, Beyang Liu, Maxim Fateev, Eli Schleifer). |
| 6a | Lighthouse accessibility 100 | PASS | Lighthouse 13.6.0, `--only-categories=accessibility`, headless Chrome: mobile emulation (412px) score 1.00, desktop preset (1350px) score 1.00, 27 audits passed, none failing. The first run scored 0.97 (`target-size` on the Badges-by-path bar segments, 16px tall and 13 to 26px wide); fixed in ee1a863 by the 24px `targetMin` token. |
| 6b | Keyboard-only walkthrough | PASS | Real Tab presses: search, Both funds, Amplify, Haystack, Map, Table, Filters, then the first map node (FoundationDB) with a 2px accent focus stroke on its hit area (`:focus-visible` matches). Enter pins it (card "FoundationDB", hash `#e-foundationdb`, focus kept on the node). With the Clusters tab focused, ArrowRight moves focus and selection to Insights (roving tabindex 0/-1). In Table view, Enter on a focused row selects it (card "Alexander Gallego", hash `#f-alexander-gallego`, page did not scroll, focus stays on the row). Escape clears the selection, empties the hash, and restores the default card. Buttons use the global 2px accent outline. |
| 6c | Dark theme passes contrast | PASS | `tests/contrast.test.ts` checks every text/background pair from `design/tokens.json` in both themes at 4.5:1 or better, including the 11px labels and status pills; lowest ratios are 4.62 (light, Young builder label) and 5.53 (dark, muted on accentTint). Rendered dark theme verified in Chrome via `data-theme="dark"`: page #0F1216, surface #171B21, ink #E6E9EE, muted #99A2AE, map labels in muted; screenshot of the Dan Lorenc card taken. |
| 7 | Production build under 300 KB JS gzipped | PASS | `npm run build`: `dist/assets/index-*.js` 139.22 kB, gzip 44.76 kB; CSS 24.24 kB, gzip 5.16 kB. D3 is imported per module (`d3-selection`, `d3-zoom`, `d3-shape`, `d3-polygon`). |

## Section 6 feature walkthrough

Both columns come from the same scripted walkthrough (`.superpowers` workspace, not shipped), which drives the page with real `click`, `input`, `change`, `pointerenter`, and `keydown` events and reads the DOM afterwards. "Desktop" is the 1440px page, "Phone" the 390px iframe.

| Feature | Desktop | Phone | Evidence |
|---|---|---|---|
| Search, tokenized | PASS | PASS | `google mit` matches 1 of 54 founders, 1 of 24 companies (Dan Lorenc). |
| Fund segmented control | PASS | PASS | Amplify: `aria-pressed=true`, 30 of 54 founders · 12 of 24 companies. |
| View segmented control | PASS | PASS | Table: `#table-card` shown, `#map-card` hidden, 54 rows. |
| Filters button with count badge, drawer toggle | PASS | PASS | `aria-expanded` flips, drawer shown; badge reads 1 after one filter and 2 after a badge-by-path segment. |
| Drawer groups and chips | PASS | PASS | Groups Path, Badges, Big tech employer, More, Map layers; 5 path chips (20/11/4/15/4), 4 badge chips, 9 big tech chips, 4 selects, 6 layer chips. |
| Active filters row and Clear all | PASS | PASS | One removable chip per filter; `Path Academic · 4 of 54 founders · 1 of 24 companies`; removing the chip hides the row; Clear all hides the row and the badge. |
| Selects (School, Vertical, Status, Open source) | PASS | PASS | Status = Left the company: 4 of 54 founders · 3 of 24 companies. |
| Map layer chips | PASS | PASS | Employers off: visible employer hubs 57 to 0 and the chip's `aria-pressed` false. |
| SVG viewBox and aspect | PASS | PASS | `0 0 1100 840`, `xMidYMid meet`; layer groups in order viewport, hulls, links, stubs, nodes, labels. |
| Node shapes and counts | PASS | PASS | 54 founders, 24 companies, 93 hubs; every node has `tabindex=0`, `role=button`, and an aria-label such as "Dan Lorenc, Big tech engineer, Chainguard, Amplify". |
| Cluster labels | PASS | PASS | `BIG TECH ENGINEER · 20` at rest; with Academic filtered: `ACADEMIC · 4/4`, `BIG TECH ENGINEER · 0/20`, and so on for all five. |
| Hover focus (mouse) | PASS | PASS | After the 150ms transition, non-neighbors sit at 0.32 and neighbors at 1. On the phone run the first sample was taken while a node was still pinned (hover is ignored while pinned, by design); re-run unpinned: Matt Klein 0.32, Harvard 0.32, Chainguard 1, Dan Lorenc 1. |
| Click pins, ring, hash | PASS | PASS | `.pinned` on the node, card "Dan Lorenc", hash `#f-dan-lorenc`. |
| Esc, close button, empty canvas click unpin | PASS | PASS | Each clears `.pinned`, the hash, and restores "Pick any dot or station". |
| Filtered-out opacity | PASS | PASS | 0.07 for nodes, 0.03 for their links (see item 5). |
| Zoom buttons | PASS | PASS | Zoom in changes the transform to `scale(1.5)`; Fit restores. On the phone, select also zooms to the node at scale 2.4. |
| Legend | PASS | PASS | 11 entries: five paths, Amplify, Haystack, Employer, School, Open source project, Also fits another path. |
| Founder card | PASS | PASS | Eyebrow "Founder · Amplify", Chainguard link, path and badge chips, bio, Worked at / School / Prior OSS / Co-founders lists, company block "$356M Series D at $3.5B, Apr 2025 · Founded 2021 · Active · Partially open", Source link opens in a new tab. |
| Company card | PASS | PASS | "Company · Amplify · AI & Cloud Infrastructure", Founded line, Shares talent pools with, member list. |
| Hub card and alumni chip | PASS | PASS | "Employer · big tech" for Uber, "N founders across ..." line, "Filter to Uber alumni" chip applies the employer filter (7 of 54 founders · 3 of 24 companies). |
| Cluster card | PASS | PASS | With only the Academic path filter active and nothing focused the card shows the Academic definition and members. |
| Default card example chips | PASS | PASS | Uber, Harvard, Temporal, Matt Klein chips select their nodes. |
| Clusters tab | PASS | PASS | 5 rows; clicking Repeat founder toggles that path filter (11 of 54 founders · 9 of 24 companies). |
| Badges by path | PASS | PASS | 13 segments; clicking `prior_open_source:big_tech_engineer` sets badge + path (badge count 2). |
| Insights tab | PASS | PASS | 6 computed bullets (fund lean, busiest stations, shared by both funds, most mixed, mixed teams, turnover). |
| About tab | PASS | PASS | Panel shown with the methodology text. |
| Table columns and sorting | PASS | PASS | 13 headers Founder through Source; clicking Founder flips to descending (Alexander Gallego to Will Wilson, `aria-sort=descending`); clicking Company sorts by company (Antithesis first, `aria-sort=ascending` on Company only). |
| Row click selects | PASS | PASS | Row gets `.is-selected`, card and hash follow. |
| Copy table as CSV | PASS | PASS | With a clipboard: 23 header columns, 55 lines (header + 54 rows), toast "Copied 54 rows as CSV". Without one: the textarea is shown, filled (20 kB), focused and selected, toast "Select the text and copy it manually"; Esc hides it. |
| Wide table scrolls inside its card | PASS | PASS | `overflow-x: auto`; 1563px table inside a 1033px card on desktop and a 356px card on the phone. |
| URL hash | PASS | PASS | Setting `#c-temporal` selects Temporal; `#x-nope` is ignored without an error; close clears the hash with `replaceState`. |
| Keyboard on nodes and rows | PASS | PASS | Enter and Space pin a focused node; Esc inside the search input keeps the selection; see item 6b for the Tab walk. |

## Phone layout (section 7.5) at 390px

| Check | Result | Evidence |
|---|---|---|
| Single column | PASS | Header top 0, toolbar 123, map card 309, detail 756, clusters 988; map and detail cards are the same width and left edge. |
| Search and fund control full width, Map/Table + Filters on one row | PASS | Search 340px, fund control 358px on its own row; view control and Filters button tops 248 and 247. |
| No fake status bar | PASS | No status bar element in the DOM. |
| Legend under the map inside the card | PASS | Legend top equals the SVG bottom (630). |
| Zoom to selection on select | PASS | Transform goes to `scale(2.4)` centred on the node. |
| Detail card scrolled into view | PASS | `scrollIntoView` with `block: nearest` (auto when reduced motion); the detail card lies inside the 3200px-tall harness viewport so no scroll was needed. |
| 44px targets | PASS | Close button 44x44, tabs 46, Filters 46, drawer chips 44, drawer selects now fill their 44px label (was 18px; fixed test-first on this branch), table rows 115. |
| Drawer single column | PASS | `grid-template-columns` is one track (316px). |
| Table card scrolls | PASS | 1563px scroll width in a 356px client width; card 358px wide. |
| No horizontal page overflow | PASS | `documentElement.scrollWidth` 390. |

## Known gaps (deferred, not failures of section 9)

- The map SVG uses `role="group"` rather than the spec's `role="img"` because it contains 171 focusable buttons; `role="img"` would hide them from assistive technology (Prompt 1 ruling).
- Hover never focuses on touch pointers or while a node is pinned (by design); tap focuses instead.
- Every map node is a tab stop, so reaching the zoom buttons by keyboard takes one Tab per node.
