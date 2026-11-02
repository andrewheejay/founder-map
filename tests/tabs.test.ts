// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { graph } from '../src/data'
import { PATH_ORDER, buildGraph } from '../src/model'
import { badgeRowsHTML, clustersHTML, insightsHTML } from '../src/panel/tabs'
import { DEFAULT_FILTERS } from '../src/state'
import type { CompanyRecord, FounderRecord, Layout } from '../src/types'
import { contrast, hex, mix } from './helpers/contrast'

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

describe('badge segment contrast', () => {
  it('tints partial, closed, and dimmed segments instead of fading them, and every 11px count keeps 4.5:1 in both themes', () => {
    const d = el(badgeRowsHTML(graph, { ...DEFAULT_FILTERS, badges: new Set(['prior_exit']), paths: new Set(['repeat_founder']) }))
    for (const b of d.querySelectorAll<HTMLElement>('.bseg')) expect(b.style.opacity).toBe('')
    expect(d.querySelector('[data-oss="partial"]')?.classList.contains('bseg--light')).toBe(true)
    expect(d.querySelector('[data-oss="no"]')?.classList.contains('bseg--faint')).toBe(true)
    const css = readFileSync(resolve(process.cwd(), 'src/styles/components.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const seg = css.match(/\.bseg[^{]*\{[^}]*\}/g) ?? []
    expect(seg.length).toBeGreaterThan(0)
    expect(seg.filter((r) => /opacity/.test(r))).toEqual([])
    const tinted = seg.filter((r) => /color-mix\(in srgb, var\(--c\) \d+%, var\(--color-surface\)\)/.test(r))
    expect(tinted.map((r) => r.split('{')[0].trim()).sort()).toEqual(['.bseg--faint', '.bseg--light', '.bseg.is-dim'])
    const t = JSON.parse(readFileSync(resolve(process.cwd(), 'design/tokens.json'), 'utf8'))
    const themes = [
      { name: 'light', ink: hex(t.color.ink), surface: hex(t.color.surface), path: t.path as Record<string, string> },
      { name: 'dark', ink: hex(t.dark.color.ink), surface: hex(t.dark.color.surface), path: t.dark.path as Record<string, string> },
    ]
    for (const th of themes)
      for (const p of PATH_ORDER) {
        const c = hex(th.path[p])
        expect(contrast(th.surface, c), `${th.name} ${p} full segment`).toBeGreaterThanOrEqual(4.5)
        for (const r of tinted) {
          expect(r).toMatch(/color: var\(--color-ink\)/)
          const pct = Number(/var\(--c\) (\d+)%/.exec(r)![1])
          expect(contrast(th.ink, mix(c, th.surface, pct / 100)), `${th.name} ${p} at ${pct}%`).toBeGreaterThanOrEqual(4.5)
        }
      }
  })
})

const tiny = buildGraph(
  [{ id: 'f:ann-lee', name: 'Ann Lee', shortLabel: 'A. Lee', company: 'Acme', path: 'academic', secondaryPath: null, role: 'CEO', status: 'active', statusNote: null, badges: [], employers: [], schools: [], taughtAt: [], priorOpenSource: [], edgeCase: false, bio: 'x', source: 'https://a.example' } satisfies FounderRecord],
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
  it('badge rows render for a graph with no badged founders', () => {
    const d = el(badgeRowsHTML(tiny, DEFAULT_FILTERS))
    expect(d.querySelectorAll('.brow')).toHaveLength(5)
    expect(d.querySelector('.bnote')?.textContent).not.toMatch(/undefined|NaN/)
  })
})

describe('badge segment names', () => {
  it('every segment has an aria-label naming the badge, path, and count', () => {
    const d = el(badgeRowsHTML(graph, DEFAULT_FILTERS))
    const seg = d.querySelector('[data-bp="prior_open_source:big_tech_engineer"]')!
    const total = graph.founders.filter((f) => f.badges.includes('prior_open_source')).length
    expect(seg.getAttribute('aria-label')).toBe(`Prior open source, Big tech engineer: ${seg.textContent} of ${total} founders`)
    const oss = d.querySelector('[data-oss="partial"]')!
    expect(oss.getAttribute('aria-label')).toBe(`Partially open: ${oss.textContent} of ${graph.companies.length} companies`)
    expect([...d.querySelectorAll('.bseg')].every((b) => b.getAttribute('aria-label'))).toBe(true)
  })
})
