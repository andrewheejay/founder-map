# Claude Code kickoff prompt

Setup first: create an empty repo, drop the contents of this handoff folder into it (`CLAUDE.md`, `data/`, `reference/`), open it in Claude Code, then paste the prompt below. Expect to run it in two or three sessions; the follow-up prompts are at the bottom.

---

## Prompt 1: scaffold, data, model, layout

```
Read CLAUDE.md completely before doing anything. It is the spec for this project.
Then read reference/founder-map-v4.html end to end (it is the working prototype
you are rebuilding) and open the three artboards in reference/design/ to see the
approved look.

Build steps 1 through 4 of section 8 (Build order):

1. Scaffold Vite + TypeScript. No React, no CSS framework. Import D3 modules
   individually, not the whole bundle.
2. Keep data/ exactly as provided and write scripts/validate.ts per section 4.
   Wire it into `npm run validate` and make the build fail if it fails.
3. Write src/model.ts: load the three JSON files, build hubs, links, and
   neighbor sets, derive the big_tech_alum badge and the search haystack.
   Add a test that asserts the per-path counts in section 5.1 and the totals
   (54 founders, 24 companies).
4. Create design/tokens.json from section 7 and generate src/styles/tokens.css
   from it. Build the page shell: header, toolbar, two-column main that stacks
   under 980px, matching reference/design/Main.dc.html.
5. Render the map with static positions from data/layout.json: hulls, links,
   also-fits stubs, nodes, labels, cluster labels, zoom controls, and the
   focus/pin behavior described in section 6. Port the label placement
   algorithm from the prototype's measure() and placeLabels() functions rather
   than inventing a new one.

Constraints:
- Do not run a force simulation at page load. Positions come from layout.json.
- Do not hard-code any founder or company fact in components.
- Match the tokens in section 7 exactly; do not add gradients, shadows, or emoji.
- Real <button>, <a>, <input> + <label> elements; aria-pressed on toggles;
  aria-label on every map node.

When done: run validate and the tests, start the dev server, and tell me
which parts of sections 6 and 7 are implemented and which are still pending.
Do not start on the detail card, filters, or table yet.
```

## Prompt 2: panel, filters, search

```
Continue from CLAUDE.md. Implement the detail card and tabs (section 6, "Detail
card" and "Tabs under the card") with all five card variants, then the toolbar
filters: the Filters drawer, the active filters row with counts and Clear all,
the fund and view segmented controls, and tokenized search. Keep the look of
reference/design/Main.dc.html for the card and reference/design/Table.dc.html
for the active filter chips.

Verify against the acceptance checklist: selecting Dan Lorenc must reproduce
Main.dc.html (ring on his node, his neighbors at full opacity, everything else
dimmed), and filtering Big tech alum + Google must show 10 of 54 founders and
6 of 24 companies.
```

## Prompt 3: table, URL, dark theme, deploy

```
Continue from CLAUDE.md. Implement the Table view with sorting and the Copy
table as CSV button (same 23 columns as the prototype's csv() function), hash
sync for selection, keyboard support, the dark theme from section 7.6 with
contrast checked, prefers-reduced-motion, and the 390px phone layout from
reference/design/Phone.dc.html. Add scripts/layout.ts that re-runs the
prototype's simulation offline and rewrites data/layout.json. Then go through
every item in section 9 and report pass/fail with evidence. Finish with a
README that explains the data model, how to add a founder or a fund, and how
to regenerate the layout.
```

## Useful follow-ups

- "Add a third fund: here is a list of companies and founders. Extend data/, re-run validate and layout, and update the fund control to handle N funds."
- "Encode active filters in the query string so a filtered view can be shared as a link."
- "Add a 'last verified' date per founder source and show it in the card."
