// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { graph } from '../src/data'
import { PATH_ORDER, buildGraph } from '../src/model'
import { clustersHTML, insightsHTML } from '../src/panel/tabs'
import { DEFAULT_FILTERS } from '../src/state'
import type { CompanyRecord, FounderRecord, Layout } from '../src/types'

const el = (html: string) => {
  const d = document.createElement('div')
  d.innerHTML = html
  return d
}

describe('tabs', () => {
  it('cluster rows in path order with Amplify · Haystack counts and filtered counts', () => {
    const d = el(clustersHTML(graph, new Set(graph.founders), false, DEFAULT_FILTERS))
    const rows = [...d.querySelectorAll('.cluster-row')]
    expect(rows.map((r) => r.getAttribute('data-cluster'))).toEqual(PATH_ORDER)
    expect(rows.map((r) => r.querySelector('.cluster-row__count')?.textContent)).toEqual(graph.clusters.map((c) => `${c.counts.amplify} · ${c.counts.haystack}`))
    expect(rows.map((r) => r.querySelector('.cluster-row__def')?.textContent)).toEqual(graph.clusters.map((c) => c.def))
    const maxN = Math.max(...graph.clusters.map((c) => c.founders.length))
    expect((rows[0].querySelector('.cluster-row__bar i') as HTMLElement).style.width).toBe(`${(graph.clusters[0].counts.amplify / maxN) * 100}%`)
    expect(rows.every((r) => r.getAttribute('aria-pressed') === 'false')).toBe(true)
    const some = new Set(graph.founders.filter((f) => f.fund === 'amplify'))
    const f = el(clustersHTML(graph, some, true, { ...DEFAULT_FILTERS, paths: new Set(['academic']) }))
    expect(f.querySelector('[data-cluster="academic"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(f.querySelector('[data-cluster="big_tech_engineer"] .cluster-row__count')?.textContent).toBe(`${graph.clusters[0].counts.amplify} · 0 of ${graph.clusters[0].founders.length}`)
  })
  it('insights: six bullets with computed values and node links', () => {
    const d = el(insightsHTML(graph))
    const items = [...d.querySelectorAll('li')]
    expect(items).toHaveLength(6)
    expect(items[0].textContent).toMatch(/^Amplify leans on one path\. \d+ of its \d+ founders are /)
    const busiest = graph.hubs.filter((h) => h.htype === 'e').sort((a, b) => b.degree - a.degree).slice(0, 3)
    expect([...items[1].querySelectorAll('[data-select]')].map((b) => b.getAttribute('data-select'))).toEqual(busiest.map((h) => h.id))
    const moved = graph.founders.filter((f) => f.status !== 'active').length
    expect(items[5].textContent).toContain(`${moved} of ${graph.founders.length} founders`)
    expect(d.textContent).not.toMatch(/—/)
  })
})

const tiny = buildGraph(
  [{ id: 'f:ann-lee', name: 'Ann Lee', shortLabel: 'A. Lee', company: 'Acme', path: 'academic', secondaryPath: null, role: 'CEO', status: 'active', statusNote: null, background: [], employers: [], schools: [], taughtAt: [], priorOpenSource: [], edgeCase: false, bio: 'x', source: 'https://a.example' } satisfies FounderRecord],
  [{ id: 'c:acme', name: 'Acme', fund: 'amplify', vertical: 'Developer Tools', founded: 2020, avgFounderAgeAtFounding: null, openSourceProduct: 'no', status: 'Active', latest: 'Seed', description: 'd' } satisfies CompanyRecord],
  { viewBox: [0, 0, 1100, 840], nodes: { 'f:ann-lee': { x: 100, y: 100 }, 'c:acme': { x: 120, y: 120 } } } satisfies Layout,
)

describe('tabs on a graph with no hubs', () => {
  it('insights render six bullets with "none yet" instead of throwing', () => {
    const d = el(insightsHTML(tiny))
    const items = [...d.querySelectorAll('li')]
    expect(items).toHaveLength(6)
    expect(items[1].textContent).toContain('none yet')
    expect(items[3].textContent).toContain('none yet')
    expect(d.textContent).not.toMatch(/undefined|NaN/)
  })
})
