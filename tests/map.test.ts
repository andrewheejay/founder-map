// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { graph } from '../src/data'
import { createMap, type MapInput } from '../src/map/map'

const layers = { companies: true, employers: true, schools: true, projects: true, oneOff: false, alt: true }
const base = (): MapInput => ({ focus: null, pinned: false, matched: new Set(graph.founders), layers, filtersActive: false, pathFilter: new Set() })
const mount = (opts = {}) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement
  document.body.append(svg)
  const map = createMap(svg, graph, { onHover() {}, onToggle() {}, onCanvasClick() {} }, opts)
  map.update(base())
  return { svg, map }
}
const style = (svg: SVGSVGElement, id: string) => (svg.querySelector(`[data-id="${id}"]`) as HTMLElement).style.opacity

describe('map', () => {
  it('renders every node with an aria-label, five hulls, every link and stub', () => {
    const { svg } = mount()
    expect(svg.querySelectorAll('g.node[aria-label][tabindex="0"]')).toHaveLength(graph.all.length)
    expect(svg.querySelectorAll('path.hull')).toHaveLength(5)
    expect(svg.querySelectorAll('line.link')).toHaveLength(graph.links.length)
    expect(svg.querySelectorAll('g.alt')).toHaveLength(graph.founders.filter((f) => f.secondaryPath).length)
    expect(svg.getAttribute('viewBox')).toBe('0 0 1100 840')
  })
  it('shapes by fund and hub type', () => {
    const { svg } = mount()
    expect(svg.querySelector('[data-id="f:dan-lorenc"] circle.shape')?.getAttribute('r')).toBe('6.5')
    expect(svg.querySelector('[data-id="f:peter-edge"] rect.shape')).not.toBeNull()
    expect(svg.querySelector('[data-id="s:mit"] circle.pip')).not.toBeNull()
    expect(svg.querySelector('[data-id="o:ray"]')?.classList.contains('o')).toBe(true)
    expect(svg.querySelector('[data-id="e:google"] circle.shape')?.getAttribute('r')).toBe(String(3.6 + Math.sqrt((graph.byId.get('e:google') as any).degree) * 2.3))
  })
  it('focus keeps neighbors at 1, dims the rest to 0.32, and rings the pinned node', () => {
    const { svg, map } = mount()
    map.update({ ...base(), focus: graph.byId.get('f:dan-lorenc')!, pinned: true })
    for (const id of ['f:dan-lorenc', 'c:chainguard', 's:mit', 'e:google', 'e:microsoft', 'o:kubernetes', 'o:sigstore', 'o:slsa', 'o:tekton', 'o:distroless']) expect(style(svg, id), id).toBe('1')
    expect(style(svg, 'f:will-wilson')).toBe('0.32')
    expect(svg.querySelector('[data-id="f:dan-lorenc"]')?.classList.contains('pinned')).toBe(true)
    const links = [...svg.querySelectorAll('line.link')] as HTMLElement[]
    expect(links.some((l) => l.style.opacity === '0.95')).toBe(true)
    expect(links.filter((l) => l.style.opacity === '0.03').length).toBeGreaterThan(100)
  })
  it('filtered-out founders drop to 0.07 and layers hide node kinds', () => {
    const { svg, map } = mount()
    const matched = new Set(graph.founders.filter((f) => f.id !== 'f:will-wilson'))
    map.update({ ...base(), matched, filtersActive: true })
    expect(style(svg, 'f:will-wilson')).toBe('0.07')
    map.update({ ...base(), layers: { ...layers, companies: false } })
    expect((svg.querySelector('[data-id="c:chainguard"]') as HTMLElement).getAttribute('display')).toBe('none')
    expect((svg.querySelector('[data-id="e:visual-sciences"]') as HTMLElement).getAttribute('display')).toBe('none')
    map.update({ ...base(), layers: { ...layers, oneOff: true } })
    expect((svg.querySelector('[data-id="e:visual-sciences"]') as HTMLElement).getAttribute('display')).toBeNull()
  })
  it('cluster labels show counts, and matched/total when filters are active', () => {
    const { svg, map } = mount()
    const text = () => [...svg.querySelectorAll('g.lbl.cluster text')].map((t) => t.textContent)
    expect(text()).toContain('BIG TECH ENGINEER · 20')
    map.update({ ...base(), matched: new Set(graph.founders.filter((f) => f.fund === 'amplify')), filtersActive: true })
    expect(text()).toContain('BIG TECH ENGINEER · 13/20')
  })
  it('survives a missing getBBox and re-measures when fonts are ready', async () => {
    let ready!: () => void
    const { svg, map } = mount({ fontsReady: new Promise<void>((r) => (ready = r)) })
    expect([...svg.querySelectorAll('g.lbl.founder')].some((l) => l.getAttribute('display') !== 'none')).toBe(true)
    ;(SVGElement.prototype as any).getBBox = () => ({ x: 0, y: -11, width: 5000, height: 14 })
    ready()
    await new Promise((r) => setTimeout(r, 0))
    expect([...svg.querySelectorAll('g.lbl.founder')].every((l) => l.getAttribute('display') === 'none')).toBe(true)
    delete (SVGElement.prototype as any).getBBox
    void map
  })
})
