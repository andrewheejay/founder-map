// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { graph } from '../src/data'
import { fitTransform } from '../src/map/geometry'
import { createMap, type MapInput } from '../src/map/map'
import { MAP_DIM_OPACITY, MAP_FILTERED_OPACITY } from '../src/tokens'

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
  afterEach(() => {
    delete (SVGElement.prototype as any).getBBox
  })
  it('renders every node with an aria-label, five hulls, every link and stub', () => {
    const { svg } = mount()
    expect(svg.querySelectorAll('g.node[aria-label][role="button"][tabindex]')).toHaveLength(graph.all.length)
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
    const { svg, map } = mount({ fonts: { ready: new Promise<void>((r) => (ready = r)) } })
    expect([...svg.querySelectorAll('g.lbl.founder')].some((l) => l.getAttribute('display') !== 'none')).toBe(true)
    ;(SVGElement.prototype as any).getBBox = () => ({ x: 0, y: -11, width: 5000, height: 14 })
    ready()
    await new Promise((r) => setTimeout(r, 0))
    expect([...svg.querySelectorAll('g.lbl.founder')].every((l) => l.getAttribute('display') === 'none')).toBe(true)
    void map
  })
  it('reads fonts.ready only after the first measurement and re-measures on loadingdone', () => {
    // Reading document.fonts.ready before measuring can capture an already-resolved promise; the loads that
    // measuring triggers then never re-place the labels. The listener covers stylesheets that arrive later.
    let bboxCalls = 0
    let callsWhenReadyRead = -1
    ;(SVGElement.prototype as any).getBBox = () => {
      bboxCalls++
      return { x: 0, y: -11, width: 10, height: 14 }
    }
    const listeners: Record<string, () => void> = {}
    const fonts = {
      get ready() {
        callsWhenReadyRead = bboxCalls
        return new Promise<void>(() => undefined)
      },
      addEventListener(type: 'loadingdone', fn: () => void) {
        listeners[type] = fn
      },
    }
    const { svg } = mount({ fonts })
    expect(callsWhenReadyRead).toBeGreaterThan(0)
    expect([...svg.querySelectorAll('g.lbl.founder')].some((l) => l.getAttribute('display') !== 'none')).toBe(true)
    ;(SVGElement.prototype as any).getBBox = () => ({ x: 0, y: -11, width: 5000, height: 14 })
    listeners.loadingdone()
    expect([...svg.querySelectorAll('g.lbl.founder')].every((l) => l.getAttribute('display') === 'none')).toBe(true)
  })
  it('treats an empty getBBox as a failed measurement', () => {
    // Chromium returns a 0x0 rect for text inside a hidden ancestor instead of throwing.
    const shown = (svg: SVGSVGElement) => [...svg.querySelectorAll('g.lbl')].map((l) => l.getAttribute('display'))
    const estimated = shown(mount().svg)
    ;(SVGElement.prototype as any).getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 })
    expect(shown(mount().svg)).toEqual(estimated)
    ;(SVGElement.prototype as any).getBBox = () => ({ x: 0, y: -11, width: 10, height: 14 })
    const { svg, map } = mount()
    const measured = shown(svg)
    expect(measured).not.toEqual(estimated)
    ;(SVGElement.prototype as any).getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 })
    map.relayout()
    expect(shown(svg)).toEqual(measured)
  })
  it('dim and filtered opacities come from design/tokens.json, not literals in map.ts', () => {
    const t = JSON.parse(readFileSync(resolve(process.cwd(), 'design/tokens.json'), 'utf8'))
    expect(MAP_DIM_OPACITY).toBe(t.map.dimOpacity)
    expect(MAP_FILTERED_OPACITY).toBe(t.map.filteredOpacity)
    const src = readFileSync(resolve(process.cwd(), 'src/map/map.ts'), 'utf8')
    expect(src).not.toMatch(/[?:] 0\.(32|07)\b/)
    expect(src).toContain('MAP_DIM_OPACITY')
  })
  it('a one-off hub hidden by the layer is shown with its links and label while it is the focus', () => {
    const { svg, map } = mount()
    const h = graph.hubs.find((x) => x.oneOff)!
    const display = (sel: string) => svg.querySelector(sel)?.getAttribute('display') ?? null
    expect(display(`g.node[data-id="${h.id}"]`)).toBe('none')
    map.update({ ...base(), focus: h, pinned: true })
    expect(display(`g.node[data-id="${h.id}"]`)).toBeNull()
    expect(display(`g.lbl[data-id="${h.id}"]`)).toBeNull()
    const link = [...svg.querySelectorAll<SVGLineElement>('line.link')].find((l) => Number(l.getAttribute('x2')) === h.x && Number(l.getAttribute('y2')) === h.y)!
    expect(link.getAttribute('display')).toBeNull()
    map.update(base())
    expect(display(`g.node[data-id="${h.id}"]`)).toBe('none')
  })
  it('setReduceMotion(true) makes later zooms synchronous', () => {
    const { svg, map } = mount({ reduceMotion: false })
    map.setReduceMotion(true)
    map.zoomTo('f:dan-lorenc', 2)
    expect(svg.querySelector('g.viewport')!.getAttribute('transform')).toMatch(/scale\(2\)/)
  })
})

describe('zoomTo and fitTo', () => {
  it('centers a node at the given scale', () => {
    const { svg, map } = mount({ reduceMotion: true })
    map.zoomTo('f:dan-lorenc', 2)
    const n = graph.byId.get('f:dan-lorenc')!
    const tf = svg.querySelector('g.viewport')!.getAttribute('transform')!
    const m = /translate\(([-\d.]+),([-\d.]+)\) scale\(([\d.]+)\)/.exec(tf)!
    expect(Number(m[3])).toBe(2)
    expect(Number(m[1])).toBeCloseTo(550 - n.x * 2, 3)
    expect(Number(m[2])).toBeCloseTo(420 - n.y * 2, 3)
    expect(() => map.zoomTo('f:nobody')).not.toThrow()
  })
  it('fitTo fits the given points, including one near the left edge, and ignores an empty list', () => {
    const { svg, map } = mount({ reduceMotion: true })
    const edge = graph.all.reduce((p, f) => (f.x < p.x ? f : p))
    expect(edge.x).toBeLessThan(200)
    map.fitTo([edge])
    const tf = () => svg.querySelector('g.viewport')!.getAttribute('transform')!
    const want = fitTransform([edge], graph.W, graph.H)!
    expect(tf()).toBe(`translate(${want.x},${want.y}) scale(${want.k})`)
    map.fitTo([])
    expect(tf()).toBe(`translate(${want.x},${want.y}) scale(${want.k})`)
    map.fit()
    expect(tf()).toBe('translate(0,0) scale(1)')
  })
})

describe('map keyboard', () => {
  const tabbable = (svg: SVGSVGElement) => [...svg.querySelectorAll('g.node[tabindex="0"]')].map((n) => n.getAttribute('data-id'))
  it('exactly one node is in the Tab order: the leftmost visible node, then the pinned node', () => {
    const { svg, map } = mount()
    const visible = graph.all.filter((d) => (svg.querySelector(`g.node[data-id="${d.id}"]`) as HTMLElement).getAttribute('display') !== 'none')
    const leftmost = visible.reduce((p, d) => (d.x < p.x || (d.x === p.x && d.y < p.y) ? d : p))
    expect(tabbable(svg)).toEqual([leftmost.id])
    expect(svg.querySelectorAll('g.node[tabindex="-1"]')).toHaveLength(graph.all.length - 1)
    map.update({ ...base(), focus: graph.byId.get('f:dan-lorenc')!, pinned: true })
    expect(tabbable(svg)).toEqual(['f:dan-lorenc'])
  })
  it('arrow keys move focus between nodes, focus previews the node, and leaving the map clears the preview', () => {
    const hovers: (string | null)[] = []
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement
    document.body.append(svg)
    const map = createMap(svg, graph, { onHover: (id) => hovers.push(id), onToggle() {}, onCanvasClick() {} }, { reduceMotion: true })
    map.update(base())
    const first = svg.querySelector<SVGGElement>('g.node[tabindex="0"]')!
    first.focus()
    expect(document.activeElement).toBe(first)
    expect(hovers).toEqual([first.getAttribute('data-id')])
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    const second = document.activeElement as SVGGElement
    expect(second).not.toBe(first)
    expect(second.getAttribute('tabindex')).toBe('0')
    expect(first.getAttribute('tabindex')).toBe('-1')
    expect(Number(graph.byId.get(second.getAttribute('data-id')!)!.x)).toBeGreaterThanOrEqual(graph.byId.get(first.getAttribute('data-id')!)!.x)
    expect(hovers.at(-1)).toBe(second.getAttribute('data-id'))
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()
    expect(hovers.at(-1)).toBeNull()
    expect(tabbable(svg)).toEqual([second.getAttribute('data-id')])
    outside.remove()
  })
})
