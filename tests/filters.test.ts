import { describe, expect, it } from 'vitest'
import { graph } from '../src/data'
import { activeChips, activeFilterCount, matchFounder, matchedCompanies, matchedFounders, searchTokens } from '../src/filters/match'
import type { FounderNode } from '../src/model'
import { DEFAULT_FILTERS } from '../src/state'
import type { Filters } from '../src/types'

const F = (p: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...p })
const lorenc = graph.byId.get('f:dan-lorenc') as FounderNode

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
