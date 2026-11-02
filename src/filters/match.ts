import { BADGE_LABEL, BADGE_ORDER, BIG_TECH, FUND_LABEL, OSS_LABEL, PATHS, PATH_ORDER, STATUS_LABEL, type CompanyNode, type FounderNode, type Graph } from '../model'
import type { Filters } from '../types'

/** Whitespace-separated, lowercased search tokens; every token must appear in a founder's haystack. */
export const searchTokens = (q: string): string[] => q.toLowerCase().split(/\s+/).filter(Boolean)

export function matchFounder(f: FounderNode, filters: Filters): boolean {
  if (filters.fund !== 'all' && f.fund !== filters.fund) return false
  if (filters.paths.size && !filters.paths.has(f.path)) return false
  for (const b of filters.badges) if (!f.badges.includes(b)) return false
  if (filters.employers.size && !f.bigTech.some((e) => filters.employers.has(e))) return false
  if (filters.school && !f.ties.some((t) => t.hub.htype === 's' && t.hub.name === filters.school)) return false
  if (filters.vertical && f.company.vertical !== filters.vertical) return false
  if (filters.status && f.status !== filters.status) return false
  if (filters.oss && f.company.openSourceProduct !== filters.oss) return false
  const tokens = searchTokens(filters.q)
  return tokens.every((t) => f.haystack.includes(t))
}

export const matchedFounders = (graph: Graph, filters: Filters): Set<FounderNode> => new Set(graph.founders.filter((f) => matchFounder(f, filters)))

/** Companies with at least one matched founder, in data order. */
export const matchedCompanies = (graph: Graph, matched: Set<FounderNode>): CompanyNode[] => graph.companies.filter((c) => c.members.some((m) => matched.has(m)))

export const activeFilterCount = (f: Filters): number =>
  (f.fund !== 'all' ? 1 : 0) + (f.q ? 1 : 0) + f.paths.size + f.badges.size + f.employers.size + (f.school ? 1 : 0) + (f.vertical ? 1 : 0) + (f.status ? 1 : 0) + (f.oss ? 1 : 0)

export interface Chip {
  category: string
  label: string
  /** key for the data-remove contract */
  remove: string
}

/** One chip per active filter, in toolbar order, with the key that removes it. */
export function activeChips(f: Filters): Chip[] {
  const chips: Chip[] = []
  if (f.fund !== 'all') chips.push({ category: 'Fund', label: FUND_LABEL[f.fund], remove: 'fund' })
  if (f.q) chips.push({ category: 'Search', label: `“${f.q}”`, remove: 'q' })
  for (const p of PATH_ORDER) if (f.paths.has(p)) chips.push({ category: 'Path', label: PATHS[p].name, remove: `path:${p}` })
  for (const b of BADGE_ORDER) if (f.badges.has(b)) chips.push({ category: 'Badge', label: BADGE_LABEL[b], remove: `badge:${b}` })
  for (const e of BIG_TECH) if (f.employers.has(e)) chips.push({ category: 'Employer', label: e, remove: `employer:${e}` })
  if (f.school) chips.push({ category: 'School', label: f.school, remove: 'school' })
  if (f.vertical) chips.push({ category: 'Vertical', label: f.vertical, remove: 'vertical' })
  if (f.status) chips.push({ category: 'Status', label: STATUS_LABEL[f.status], remove: 'status' })
  if (f.oss) chips.push({ category: 'Open source', label: OSS_LABEL[f.oss], remove: 'oss' })
  return chips
}
