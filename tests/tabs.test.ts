// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { graph } from '../src/data'
import { PATH_ORDER } from '../src/model'
import { badgeRowsHTML, clustersHTML, insightsHTML } from '../src/panel/tabs'
import { DEFAULT_FILTERS } from '../src/state'

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
  it('badge rows: segments sum to the badge count, pressed and dim states, company oss row', () => {
    const d = el(badgeRowsHTML(graph, { ...DEFAULT_FILTERS, badges: new Set(['prior_exit']), paths: new Set(['repeat_founder']) }))
    const rows = [...d.querySelectorAll('.brow')]
    expect(rows).toHaveLength(5)
    const exitSegs = [...rows[1].querySelectorAll('.bseg')]
    expect(exitSegs.reduce((n, b) => n + Number(b.textContent), 0)).toBe(graph.founders.filter((f) => f.badges.includes('prior_exit')).length)
    expect(rows[1].querySelector('[data-bp="prior_exit:repeat_founder"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(exitSegs.filter((b) => b.classList.contains('is-dim')).length).toBe(exitSegs.length - 1)
    expect(rows[0].querySelector('[aria-pressed="true"]')).toBeNull()
    expect(rows[0].querySelectorAll('.is-dim')).toHaveLength(0)
    expect([...rows[4].querySelectorAll('[data-oss]')].map((b) => b.textContent)).toEqual(['yes', 'partial', 'no'].map((k) => String(graph.companies.filter((c) => c.openSourceProduct === k).length)))
    expect(d.querySelector('.bnote')?.textContent).toMatch(/^Open source is a badge on top of a path\. \d+ of the \d+ founders/)
    const pressedOss = el(badgeRowsHTML(graph, { ...DEFAULT_FILTERS, oss: 'partial' }))
    expect(pressedOss.querySelector('[data-oss="partial"]')?.getAttribute('aria-pressed')).toBe('true')
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
