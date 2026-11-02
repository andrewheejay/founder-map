import { esc } from '../html'
import { BADGE_LABEL, BADGE_ORDER, OSS_LABEL, PATHS, PATH_ORDER, type FounderNode, type Graph, type HubNode } from '../model'
import type { Filters, OssProduct, PathKey } from '../types'
import { link } from './card'

/** The Clusters list: one row per path with Amplify · Haystack counts (or matched counts while filtering) and a two-tone bar. */
export function clustersHTML(graph: Graph, matched: Set<FounderNode>, filtersActive: boolean, filters: Filters): string {
  const maxN = Math.max(...graph.clusters.map((c) => c.founders.length))
  return graph.clusters
    .map((c) => {
      const a = c.founders.filter((f) => f.fund === 'amplify' && matched.has(f)).length
      const h = c.founders.filter((f) => f.fund === 'haystack' && matched.has(f)).length
      const count = filtersActive ? `${a} · ${h} of ${c.founders.length}` : `${c.counts.amplify} · ${c.counts.haystack}`
      return (
        `<button type="button" class="cluster-row" data-cluster="${c.key}" aria-pressed="${filters.paths.has(c.key)}" style="--c: var(--path-${c.key})">` +
        `<span class="cluster-row__dot"></span><span class="cluster-row__name">${esc(c.name)}</span><span class="cluster-row__count num">${count}</span>` +
        `<span class="cluster-row__def">${esc(c.def)}</span>` +
        `<span class="cluster-row__bar" aria-hidden="true"><i style="width: ${(c.counts.amplify / maxN) * 100}%"></i><i class="hay" style="width: ${(c.counts.haystack / maxN) * 100}%"></i></span></button>`
      )
    })
    .join('')
}

const lowerPlural = (k: PathKey): string => PATHS[k].name.toLowerCase() + 's'

/** Stacked bars: founders per path for each badge, then the company-level open source product row, then a note. */
export function badgeRowsHTML(graph: Graph, filters: Filters): string {
  const rows = BADGE_ORDER.map((b) => {
    const fs = graph.founders.filter((f) => f.badges.includes(b))
    const segs = PATH_ORDER.map((p) => ({ p, n: fs.filter((f) => f.path === p).length })).filter((s) => s.n)
    const bar = segs
      .map((s) => {
        const on = filters.badges.has(b) && filters.paths.size === 1 && filters.paths.has(s.p)
        const dim = filters.badges.has(b) && filters.paths.size > 0 && !filters.paths.has(s.p)
        const name = `${BADGE_LABEL[b]}, ${PATHS[s.p].name}: ${s.n} of ${fs.length} founders`
        return `<button type="button" class="bseg${dim ? ' is-dim' : ''}" data-bp="${b}:${s.p}" aria-pressed="${on}" aria-label="${esc(name)}" style="--c: var(--path-${s.p}); flex: ${s.n}" title="${esc(PATHS[s.p].name)}: ${s.n}">${s.n}</button>`
      })
      .join('')
    return `<div class="brow"><div class="brow__label">${esc(BADGE_LABEL[b])}<small>${fs.length} founders</small></div><div class="bbar">${bar}</div></div>`
  })
  const ossKeys: OssProduct[] = ['yes', 'partial', 'no']
  const count = (k: OssProduct) => graph.companies.filter((c) => c.openSourceProduct === k).length
  const ossBar = ossKeys
    .map((k, i) => `<button type="button" class="bseg${['', ' bseg--light', ' bseg--faint'][i]}" data-oss="${k}" aria-pressed="${filters.oss === k}" aria-label="${OSS_LABEL[k]}: ${count(k)} of ${graph.companies.length} companies" style="--c: var(--path-repeat_founder); flex: ${count(k)}" title="${OSS_LABEL[k]}: ${count(k)} companies">${count(k)}</button>`)
    .join('')
  rows.push(`<div class="brow"><div class="brow__label">Open source product<small>company level</small></div><div class="bbar">${ossBar}</div></div>`)
  const oss = graph.founders.filter((f) => f.badges.includes('prior_open_source'))
  const top = PATH_ORDER.map((p) => ({ p, n: oss.filter((f) => f.path === p).length })).sort((a, b) => b.n - a.n)[0]
  const note = `<p class="bnote">Open source is a badge on top of a path. <b>${top.n} of the ${oss.length}</b> founders with prior open source work are ${lowerPlural(top.p)}. Separately, ${count('yes')} of ${graph.companies.length} companies sell an open source product and ${count('partial')} are partially open.</p>`
  return rows.join('') + note
}

/** Six computed observations with links into the map. */
export function insightsHTML(graph: Graph): string {
  const top = (fund: FounderNode['fund']) => {
    const fs = graph.founders.filter((f) => f.fund === fund)
    const k = PATH_ORDER.slice().sort((a, b) => fs.filter((f) => f.path === b).length - fs.filter((f) => f.path === a).length)[0]
    return { k, n: fs.filter((f) => f.path === k).length, total: fs.length }
  }
  const A = top('amplify'), H = top('haystack')
  const busiest = graph.hubs.filter((h) => h.htype === 'e').sort((a, b) => b.degree - a.degree).slice(0, 3)
  const riders = new Set<FounderNode>()
  for (const h of busiest) for (const m of h.members) riders.add(m)
  const big = [...riders].filter((m) => m.path === 'big_tech_engineer').length
  const shared = graph.hubs.filter((h) => !h.oneOff)
  const both = shared.filter((h) => h.members.some((m) => m.fund === 'amplify') && h.members.some((m) => m.fund === 'haystack')).sort((a, b) => b.degree - a.degree)
  const mixedness = (h: HubNode) => new Set(h.members.map((m) => m.path)).size
  const multi = shared.slice().sort((a, b) => mixedness(b) - mixedness(a) || b.degree - a.degree)
  const most = multi.filter((h) => mixedness(h) === mixedness(multi[0]))
  const mixed = graph.companies.filter((c) => new Set(c.members.map((m) => m.path)).size > 1)
  const moved = graph.founders.filter((f) => f.status !== 'active')
  const left = moved.filter((f) => f.status === 'left')
  const none = 'none yet'
  const items = [
    `<b>Amplify leans on one path.</b> ${A.n} of its ${A.total} founders are ${lowerPlural(A.k)}. Haystack's biggest group is ${lowerPlural(H.k)}, ${H.n} of ${H.total}.`,
    `<b>Busiest stations:</b> ${busiest.length ? busiest.map((h) => `${link(h)} (${h.degree})`).join(', ') : none}. ${big} of the ${riders.size} founders who passed through them are big tech engineers, which is why that neighborhood is so dense.`,
    `<b>Shared by both funds:</b> ${both.length} stations, led by ${both.length ? both.slice(0, 5).map(link).join(', ') : none}. This is where the two portfolios draw from the same talent.`,
    multi.length ? `<b>Most mixed stations:</b> ${most.slice(0, 4).map(link).join(', ')} each connect ${mixedness(multi[0])} different paths.` : `<b>Most mixed stations:</b> ${none}.`,
    `<b>Mixed teams:</b> ${mixed.length} of ${graph.companies.length} companies pair founders from different paths${mixed.length ? `, such as ${mixed.slice(0, 3).map(link).join(', ')}` : ''}.`,
    `<b>Founder turnover:</b> ${moved.length} of ${graph.founders.length} founders have changed role or left${left.length ? `, including ${left.map(link).join(', ')}` : ''}. Filter Status to see them.`,
  ]
  return items.map((s) => `<li>${s}</li>`).join('')
}
