import { esc } from '../html'
import {
  BADGE_LABEL,
  BADGE_ORDER,
  BIG_TECH,
  FUND_LABEL,
  HUB_TYPE_LABEL,
  OSS_LABEL,
  PATHS,
  PATH_ORDER,
  REL_LABEL,
  STATUS_LABEL,
  type AnyNode,
  type Cluster,
  type CompanyNode,
  type FounderNode,
  type Graph,
  type HubNode,
  type Tie,
} from '../model'
import type { State } from '../state'
import type { Filters, PathKey } from '../types'

const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>'
const closeBtn = `<button type="button" class="card__close" data-close aria-label="Close details">${CROSS}</button>`

/** An inline button that selects a node. */
export const link = (n: AnyNode): string => `<button type="button" class="linkbtn linkbtn--ink" data-select="${esc(n.id)}">${esc(n.name)}</button>`

const pathChip = (k: PathKey): string => `<span class="chip chip--path" style="--c: var(--path-${k})"><span class="chip__dot"></span>${esc(PATHS[k].name)}</span>`

const byPath = (a: FounderNode, b: FounderNode): number => PATH_ORDER.indexOf(a.path) - PATH_ORDER.indexOf(b.path) || a.name.localeCompare(b.name)

const memberRow = (f: FounderNode, side: string): string =>
  `<button type="button" class="member" data-select="${esc(f.id)}" style="--c: var(--path-${f.path})"><span class="member__dot${f.fund === 'haystack' ? ' member__dot--square' : ''}"></span><span class="member__name">${esc(f.name)}</span><span class="member__side">${esc(side)}</span></button>`

const members = (rows: string[]): string => `<div class="members">${rows.join('')}</div>`

const head = (eyebrow: string, title: string, sub: string, close = true): string =>
  `<div class="card__head"><div><p class="eyebrow">${eyebrow}</p><h2 class="card-title">${esc(title)}</h2><p class="card__sub">${sub}</p></div>${close ? closeBtn : ''}</div>`

const dl = (rows: [string, string][]): string => `<dl class="dl">${rows.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')}</dl>`

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** Hostname of a source URL without a leading www., or the raw string when it is not a URL. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Companies that share a non-one-off hub with this company's founders, most shared hubs first, top 6. */
export function talentOverlaps(c: CompanyNode): { company: CompanyNode; hubs: string[] }[] {
  const map = new Map<CompanyNode, Set<string>>()
  for (const m of c.members)
    for (const t of m.ties) {
      if (t.hub.oneOff) continue
      for (const o of t.hub.members) {
        if (o.company === c) continue
        const set = map.get(o.company) ?? new Set<string>()
        set.add(t.hub.name)
        map.set(o.company, set)
      }
    }
  return [...map.entries()]
    .map(([company, hubs]) => ({ company, hubs: [...hubs] }))
    .sort((a, b) => b.hubs.length - a.hubs.length || a.company.name.localeCompare(b.company.name))
    .slice(0, 6)
}

export function founderCardHTML(f: FounderNode): string {
  const tie = (t: Tie) => link(t.hub) + (t.rel === REL_LABEL.S ? ' (taught)' : '')
  const ties = (type: string) => f.ties.filter((t) => t.hub.htype === type).map(tie)
  const cofounders = f.company.members.filter((m) => m !== f)
  const rows: [string, string][] = []
  const e = ties('e'), s = ties('s'), o = ties('o')
  if (e.length) rows.push(['Worked at', e.join(', ')])
  if (s.length) rows.push(['School', s.join(', ')])
  if (o.length) rows.push(['Prior OSS', o.join(', ')])
  if (cofounders.length) rows.push(['Co-founders', cofounders.map(link).join(', ')])
  const chips =
    pathChip(f.path) +
    (f.secondaryPath ? `<span class="chip chip--alt" style="--c: var(--path-${f.secondaryPath})">Also fits: ${esc(PATHS[f.secondaryPath].name)}</span>` : '') +
    BADGE_ORDER.filter((b) => f.badges.includes(b))
      .map((b) => `<span class="chip chip--badge">${esc(BADGE_LABEL[b])}</span>`)
      .join('')
  const c = f.company
  return (
    head(`Founder · ${FUND_LABEL[f.fund]}`, f.name, `${esc(f.role)} · ${link(c)}`) +
    `<div class="chips">${chips}</div>` +
    `<p class="body">${esc(f.bio)}</p>` +
    (f.status !== 'active' ? `<p class="card__status"><b>${STATUS_LABEL[f.status]}.</b> ${esc(f.statusNote ?? '')}</p>` : '') +
    (f.edgeCase ? '<p class="card__note">Edge case: no clean path fits, so this placement is tentative.</p>' : '') +
    (rows.length ? dl(rows) : '') +
    `<div class="card__company"><div class="card__company-row"><p class="card__company-name">${link(c)}</p><p class="mini">${esc(c.vertical)}</p></div><p class="body">${esc(c.latest)}</p><p class="mini">Founded ${c.founded} · ${esc(c.status)} · ${OSS_LABEL[c.openSourceProduct]}</p></div>` +
    `<p class="card__source">Source: <a href="${esc(f.source)}" target="_blank" rel="noopener">${esc(hostOf(f.source))}</a></p>`
  )
}

export function companyCardHTML(c: CompanyNode): string {
  const paths = PATH_ORDER.filter((k) => c.members.some((m) => m.path === k))
  const moved = c.members.filter((m) => m.status !== 'active').length
  const overlaps = talentOverlaps(c)
  const rows: [string, string][] = [
    ['Status', esc(c.status)],
    ['Latest', esc(c.latest)],
    ['Open source', OSS_LABEL[c.openSourceProduct]],
    ['Team', `<div class="chips">${paths.map(pathChip).join('')}</div>` + (moved ? `<p class="mini">${moved} of ${c.members.length} founders changed role or left</p>` : '')],
  ]
  if (overlaps.length) rows.push(['Shares talent pools with', overlaps.map((o) => `${link(o.company)} <span class="mini">(${esc(o.hubs.join(', '))})</span>`).join('<br>')])
  const side = (m: FounderNode) => m.role.replace(/^Co-founder[,;]?\s*/, '') || 'Co-founder'
  return (
    head(`Company · ${FUND_LABEL[c.fund]} · ${esc(c.vertical)}`, c.name, `Founded ${c.founded}${c.avgFounderAgeAtFounding ? ` · founders about ${c.avgFounderAgeAtFounding} at founding` : ''}`) +
    `<p class="body">${esc(c.description)}</p>` +
    dl(rows) +
    `<p class="eyebrow">${c.members.length === 1 ? 'Founder' : `${c.members.length} founders`}</p>` +
    members(c.members.slice().sort(byPath).map((m) => memberRow(m, side(m))))
  )
}

export function hubCardHTML(h: HubNode, filters: Filters): string {
  const paths = new Set(h.members.map((m) => m.path)).size
  const comps = new Set(h.members.map((m) => m.company)).size
  const amp = h.members.filter((m) => m.fund === 'amplify').length
  const bigTech = BIG_TECH.includes(h.name)
  const eyebrow = HUB_TYPE_LABEL[h.htype] + (h.oneOff ? ' · one-off tie' : '') + (bigTech ? ' · big tech' : '')
  const sub = `${plural(h.degree, 'founder', 'founders')} across ${plural(paths, 'path', 'paths')} and ${plural(comps, 'company', 'companies')} · Amplify ${amp}, Haystack ${h.degree - amp}`
  return (
    head(eyebrow, h.name, sub) +
    (bigTech ? `<div class="chips"><button type="button" class="chip" data-employer="${esc(h.name)}" aria-pressed="${filters.employers.has(h.name)}">Filter to ${esc(h.name)} alumni</button></div>` : '') +
    members(h.members.slice().sort(byPath).map((m) => memberRow(m, m.company.name)))
  )
}

export function clusterCardHTML(c: Cluster, matched: Set<FounderNode>, graph: Graph): string {
  const mem = c.founders.filter((f) => matched.has(f))
  const shared = graph.hubs
    .filter((h) => !h.oneOff)
    .map((h) => ({ h, n: h.members.filter((m) => m.path === c.key).length }))
    .filter((x) => x.n >= 2)
    .sort((a, b) => b.n - a.n || a.h.name.localeCompare(b.h.name))
    .slice(0, 6)
  const inbound = graph.founders.filter((f) => f.secondaryPath === c.key)
  const rows: [string, string][] = [['Founders', `Amplify ${c.counts.amplify}, Haystack ${c.counts.haystack}${mem.length !== c.founders.length ? ` · ${mem.length} match the current filters` : ''}`]]
  if (shared.length) rows.push(['Shared ties', shared.map((x) => `${link(x.h)} (${x.n})`).join(', ')])
  if (inbound.length) rows.push(['Also fits here', inbound.map(link).join(', ')])
  const sorted = mem.slice().sort((a, b) => a.fund.localeCompare(b.fund) || a.name.localeCompare(b.name))
  return head('Cluster', c.name, esc(c.def), false) + dl(rows) + members(sorted.map((m) => memberRow(m, m.company.name)))
}

const EXAMPLES = ['e:uber', 's:harvard', 'c:temporal', 'f:matt-klein']

export function defaultCardHTML(graph: Graph): string {
  const tries = EXAMPLES.map((id) => graph.byId.get(id)).filter((n): n is AnyNode => !!n)
  return (
    '<p class="eyebrow">Start here</p><h2 class="card-title">Pick any dot or station</h2>' +
    '<p class="body">Colored dots are founders, placed by career path. Gray circles are the employers, schools, and projects they share. Hover or tap one to see its ties.</p>' +
    `<div class="chips">${tries.map((n) => `<button type="button" class="chip" data-select="${esc(n.id)}">${esc(n.name)}</button>`).join('')}</div>`
  )
}

/** The card for the focused node; with no focus, the cluster card when exactly one path is filtered, else the default card. */
export function detailHTML(node: AnyNode | null, s: State, graph: Graph, matched: Set<FounderNode>): string {
  if (node) return node.kind === 'founder' ? founderCardHTML(node) : node.kind === 'company' ? companyCardHTML(node) : hubCardHTML(node, s.filters)
  if (s.filters.paths.size === 1) {
    const key = [...s.filters.paths][0]
    const cluster = graph.clusters.find((c) => c.key === key)
    if (cluster) return clusterCardHTML(cluster, matched, graph)
  }
  return defaultCardHTML(graph)
}
