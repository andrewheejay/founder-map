import { esc } from '../html'
import { PATHS, PATH_ORDER, type FounderNode, type Graph, type HubNode } from '../model'
import type { Filters, PathKey } from '../types'
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
