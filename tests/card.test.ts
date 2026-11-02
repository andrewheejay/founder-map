// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { graph } from '../src/data'
import { CROSS_ICON } from '../src/html'
import { OSS_LABEL, PATHS, STATUS_LABEL, type FounderNode, type HubNode } from '../src/model'
import { clusterCardHTML, companyCardHTML, detailHTML, founderCardHTML, hostOf, hubCardHTML, talentOverlaps } from '../src/panel/card'
import { DEFAULT_FILTERS, DEFAULT_STATE } from '../src/state'

const el = (html: string) => {
  const d = document.createElement('div')
  d.innerHTML = html
  return d
}
const lorenc = graph.byId.get('f:dan-lorenc') as FounderNode

describe('detail card', () => {
  it('founder card matches the artboard structure for Dan Lorenc', () => {
    const d = el(founderCardHTML(lorenc))
    expect(d.querySelector('.eyebrow')?.textContent).toBe('Founder · Amplify')
    expect(d.querySelector('h2')?.textContent).toBe('Dan Lorenc')
    expect(founderCardHTML(lorenc)).toContain(CROSS_ICON)
    expect(d.querySelector('.card__sub [data-select]')?.getAttribute('data-select')).toBe('c:chainguard')
    expect(d.querySelector('.chip--path')?.textContent).toBe('Big tech engineer')
    expect(d.querySelectorAll('.chips .chip')).toHaveLength(1)
    expect(d.querySelector('.chip--badge')).toBeNull()
    expect([...d.querySelectorAll('dt')].map((t) => t.textContent)).toEqual(['Background', 'Worked at', 'School', 'Prior OSS', 'Co-founders'])
    const dd = [...d.querySelectorAll('dd')]
    expect(dd[0].textContent).toBe('Prior open source')
    expect([...dd[3].querySelectorAll('[data-select]')].map((b) => b.getAttribute('data-select'))).toEqual(['o:kubernetes', 'o:sigstore', 'o:slsa', 'o:tekton', 'o:distroless'])
    expect(dd[4].querySelectorAll('[data-select]')).toHaveLength(lorenc.company.members.length - 1)
    const plain = graph.founders.find((f) => !f.background.length)!
    expect([...el(founderCardHTML(plain)).querySelectorAll('dt')].map((t) => t.textContent)).not.toContain('Background')
    const full = { ...lorenc, background: ['grad_degree', 'prior_exit', 'prior_open_source'] as FounderNode['background'] }
    expect(el(founderCardHTML(full)).querySelector('dd')?.textContent).toBe('Prior open source, Prior exit, Grad degree')
    expect(d.querySelector('.card__company .mini')?.textContent).toBe(lorenc.company.vertical)
    expect(d.querySelector('.card__company')?.textContent).toContain(`Founded ${lorenc.company.founded} · ${lorenc.company.status} · ${OSS_LABEL[lorenc.company.openSourceProduct]}`)
    const a = d.querySelector('.card__source a')!
    expect(a.textContent).toBe(hostOf(lorenc.source))
    expect(a.getAttribute('rel')).toBe('noopener')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(d.querySelector('[data-close]')?.getAttribute('aria-label')).toBe('Close details')
    expect(d.querySelector('.card__status')).toBeNull()
    expect(hostOf('https://www.example.com/a/b')).toBe('example.com')
    expect(hostOf('not a url')).toBe('not a url')
  })
  it('status note, also-fits chip, edge-case note appear only when set', () => {
    const moved = graph.founders.find((f) => f.status !== 'active')!
    expect(el(founderCardHTML(moved)).querySelector('.card__status')?.textContent).toContain(STATUS_LABEL[moved.status])
    const alt = graph.founders.find((f) => f.secondaryPath)!
    expect(el(founderCardHTML(alt)).querySelector('.chip--alt')?.textContent).toBe(`Also fits: ${PATHS[alt.secondaryPath!].name}`)
    expect(el(founderCardHTML(lorenc)).querySelector('.chip--alt')).toBeNull()
    const edge = graph.founders.find((f) => f.edgeCase)
    if (edge) expect(el(founderCardHTML(edge)).querySelector('.card__note')?.textContent).toContain('tentative')
    expect(el(founderCardHTML(lorenc)).querySelector('.card__note')).toBeNull()
  })
  it('company card: eyebrow, founded line, team paths, overlaps, members by path', () => {
    const c = lorenc.company
    const d = el(companyCardHTML(c))
    expect(d.querySelector('.eyebrow')?.textContent).toBe(`Company · Amplify · ${c.vertical}`)
    expect(d.querySelector('.card__sub')?.textContent).toBe(`Founded ${c.founded}` + (c.avgFounderAgeAtFounding ? ` · founders about ${c.avgFounderAgeAtFounding} at founding` : ''))
    expect([...d.querySelectorAll('dt')].map((t) => t.textContent).slice(0, 4)).toEqual(['Status', 'Latest', 'Open source', 'Team'])
    expect(d.querySelectorAll('.member')).toHaveLength(c.members.length)
    expect(d.querySelector('[data-close]')).not.toBeNull()
    const ov = talentOverlaps(c)
    expect(ov.length).toBeLessThanOrEqual(6)
    expect(ov.every((o) => o.company !== c && o.hubs.length > 0)).toBe(true)
    expect(d.querySelectorAll('dd')[4]?.querySelectorAll('[data-select]')).toHaveLength(ov.length)
  })
  it('hub card: counts line and the alumni filter chip for big tech', () => {
    const g = graph.byId.get('e:google') as HubNode
    const paths = new Set(g.members.map((m) => m.path)).size
    const comps = new Set(g.members.map((m) => m.company)).size
    const amp = g.members.filter((m) => m.fund === 'amplify').length
    const d = el(hubCardHTML(g, { ...DEFAULT_FILTERS, employers: new Set(['Google']) }))
    expect(d.querySelector('.eyebrow')?.textContent).toBe('Employer · big tech')
    expect(d.querySelector('.card__sub')?.textContent).toBe(`${g.degree} founders across ${paths} paths and ${comps} companies · Amplify ${amp}, Haystack ${g.degree - amp}`)
    expect(d.querySelector('[data-employer="Google"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(d.querySelector('[data-employer="Google"]')?.textContent).toBe('Filter to Google alumni')
    expect(d.querySelectorAll('.member')).toHaveLength(g.degree)
    const mit = graph.byId.get('s:mit') as HubNode
    expect(el(hubCardHTML(mit, DEFAULT_FILTERS)).querySelector('[data-employer]')).toBeNull()
    expect(el(hubCardHTML(mit, DEFAULT_FILTERS)).querySelector('.eyebrow')?.textContent).toBe('School')
    const one = graph.hubs.find((h) => h.oneOff)!
    expect(el(hubCardHTML(one, DEFAULT_FILTERS)).querySelector('.eyebrow')?.textContent).toContain('one-off tie')
  })
  it('cluster card', () => {
    const c = graph.clusters[0]
    const d = el(clusterCardHTML(c, new Set(graph.founders), graph))
    expect(d.querySelector('h2')?.textContent).toBe(c.name)
    expect(d.querySelector('.card__sub')?.textContent).toBe(c.def)
    expect(d.querySelector('dd')?.textContent).toBe(`Amplify ${c.counts.amplify}, Haystack ${c.counts.haystack}`)
    expect(d.querySelectorAll('.member')).toHaveLength(c.founders.length)
    expect(d.querySelector('[data-close]')).toBeNull()
    const half = new Set(c.founders.slice(0, 3))
    expect(el(clusterCardHTML(c, half, graph)).querySelector('dd')?.textContent).toContain('3 match the current filters')
    expect(el(clusterCardHTML(c, half, graph)).querySelectorAll('.member')).toHaveLength(3)
  })
  it('detailHTML dispatches by node or single path filter, and is empty otherwise', () => {
    expect(detailHTML(lorenc, DEFAULT_STATE, graph, new Set(graph.founders))).toContain('Dan Lorenc')
    const one = { ...DEFAULT_STATE, filters: { ...DEFAULT_FILTERS, paths: new Set(['academic' as const]) } }
    expect(detailHTML(null, one, graph, new Set(graph.founders))).toContain('Academic')
    expect(detailHTML(null, DEFAULT_STATE, graph, new Set(graph.founders))).toBe('')
  })
})

describe('founder card status note', () => {
  it('shows the note on an active founder too (prototype parity)', () => {
    const d = el(founderCardHTML({ ...lorenc, statusNote: 'Stayed CTO through the deal.' }))
    expect(d.querySelector('.card__status')?.textContent).toBe(`${STATUS_LABEL.active}. Stayed CTO through the deal.`)
    expect(el(founderCardHTML({ ...lorenc, statusNote: null })).querySelector('.card__status')).toBeNull()
  })
})
