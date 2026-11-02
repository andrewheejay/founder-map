import { select } from 'd3-selection'
import { curveCatmullRomClosed, line } from 'd3-shape'
import 'd3-transition'
import { zoom, zoomIdentity, type D3ZoomEvent } from 'd3-zoom'
import { FUND_LABEL, HUB_TYPE_LABEL, PATHS, type AnyNode, type Cluster, type FounderNode, type Graph, type HubNode } from '../model'
import type { Layers, PathKey } from '../types'
import { altStub, clusterGeometry, hubRadius, nodeRadius, type ClusterGeometry, type Pt } from './geometry'
import { placeLabels, type LabelItem, type Placement, type Rect } from './labels'

export interface MapInput {
  focus: AnyNode | null
  pinned: boolean
  matched: Set<FounderNode>
  layers: Layers
  filtersActive: boolean
  pathFilter: Set<PathKey>
}

export interface MapHandlers {
  onHover(id: string | null, pointerType: string | undefined): void
  onToggle(id: string): void
  onCanvasClick(): void
}

export interface MapView {
  update(input: MapInput): void
  /** Re-measure and re-place labels (fonts loaded, zoom changed, layers changed). */
  relayout(): void
  zoomIn(): void
  zoomOut(): void
  fit(): void
}

export interface MapOptions {
  reduceMotion?: boolean
  fontsReady?: Promise<unknown>
}

interface ClusterView extends ClusterGeometry {
  cluster: Cluster
  lx: number
  ly: number
  lw: number
  lh: number
  la: number
}

interface Stub {
  f: FounderNode
  end: Pt
}

interface Measure {
  lw: number
  lh: number
  la: number
}

const ariaLabel = (d: AnyNode): string =>
  d.kind === 'founder'
    ? `${d.name}, ${PATHS[d.path].name}, ${d.company.name}, ${FUND_LABEL[d.fund]}`
    : d.kind === 'company'
      ? `${d.name}, ${FUND_LABEL[d.fund]} company`
      : `${d.name}, ${HUB_TYPE_LABEL[d.htype]}, ${d.degree} founder${d.degree === 1 ? '' : 's'}`

const labelText = (d: AnyNode): string => (d.kind === 'hub' ? d.name.toUpperCase() : d.kind === 'founder' ? d.shortLabel : d.name)

/** getBBox is unavailable in some environments (detached SVG, jsdom, hidden ancestors); fall back to a rough estimate. */
function textBox(t: SVGTextElement, text: string): Measure {
  try {
    const b = t.getBBox()
    return { lw: b.width, lh: b.height, la: -b.y }
  } catch {
    return { lw: text.length * 6, lh: 14, la: 11 }
  }
}

export function createMap(svgEl: SVGSVGElement, graph: Graph, handlers: MapHandlers, opts: MapOptions = {}): MapView {
  const { W, H } = graph
  const svg = select(svgEl).attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet')
  svg.selectAll('*').remove()
  const vp = svg.append('g').attr('class', 'viewport')
  const gHull = vp.append('g').attr('class', 'hulls')
  const gLink = vp.append('g').attr('class', 'links')
  const gAlt = vp.append('g').attr('class', 'stubs')
  const gNode = vp.append('g').attr('class', 'nodes')
  const gLbl = vp.append('g').attr('class', 'labels')

  let input: MapInput = {
    focus: null,
    pinned: false,
    matched: new Set(graph.founders),
    layers: { companies: true, employers: true, schools: true, projects: true, oneOff: false, alt: true },
    filtersActive: false,
    pathFilter: new Set(),
  }
  let k = 1
  const measures = new Map<string, Measure>()
  const placements = new Map<string, Placement>()

  /* ---------- static geometry ---------- */
  const clusters: ClusterView[] = graph.clusters.map((cluster) => {
    const g = clusterGeometry(cluster.founders, W, H)
    return { cluster, ...g, lx: g.lx0, ly: g.ly0, lw: 0, lh: 0, la: 0 }
  })
  const clusterByKey = new Map(clusters.map((c) => [c.cluster.key, c]))
  const stubs: Stub[] = graph.founders
    .filter((f) => f.secondaryPath)
    .map((f) => {
      const c = clusterByKey.get(f.secondaryPath!)!
      return { f, end: altStub(f, { x: c.cx, y: c.cy }) }
    })

  /* ---------- draw ---------- */
  const hullLine = line<[number, number]>().curve(curveCatmullRomClosed.alpha(0.6))
  const hullSel = gHull
    .selectAll<SVGPathElement, ClusterView>('path')
    .data(clusters)
    .join('path')
    .attr('class', 'hull')
    .attr('style', (c) => `--c: var(--path-${c.cluster.key})`)
    .attr('d', (c) => hullLine(c.hull))

  const linkSel = gLink
    .selectAll<SVGLineElement, Graph['links'][number]>('line')
    .data(graph.links)
    .join('line')
    .attr('class', (l) => `link ${l.kind}`)
    .attr('x1', (l) => l.source.x)
    .attr('y1', (l) => l.source.y)
    .attr('x2', (l) => l.target.x)
    .attr('y2', (l) => l.target.y)

  const altSel = gAlt
    .selectAll<SVGGElement, Stub>('g')
    .data(stubs)
    .join('g')
    .attr('class', 'alt')
    .attr('style', (s) => `--c: var(--path-${s.f.secondaryPath})`)
  altSel
    .append('line')
    .attr('x1', (s) => s.f.x)
    .attr('y1', (s) => s.f.y)
    .attr('x2', (s) => s.end.x)
    .attr('y2', (s) => s.end.y)
  const altDot = altSel
    .append('circle')
    .attr('cx', (s) => s.end.x)
    .attr('cy', (s) => s.end.y)
    .attr('r', 2.6)

  const nodeSel = gNode
    .selectAll<SVGGElement, AnyNode>('g')
    .data(graph.all, (d) => d.id)
    .join('g')
    .attr('class', (d) => `node ${d.kind}${d.kind === 'hub' ? ' ' + d.htype : ''}`)
    .attr('data-id', (d) => d.id)
    .attr('style', (d) => (d.kind === 'founder' ? `--c: var(--path-${d.path})` : null))
    .attr('tabindex', 0)
    .attr('role', 'button')
    .attr('aria-label', ariaLabel)
  nodeSel.each(function (d) {
    const g = select(this)
    g.append('circle').attr('class', 'halo').attr('r', nodeRadius(d) + 4.5)
    if (d.kind === 'hub') {
      const r = hubRadius(d.degree)
      g.append('circle').attr('class', 'shape').attr('r', r)
      if (d.htype === 's') g.append('circle').attr('class', 'pip').attr('r', Math.max(2, r * 0.32))
    } else {
      const r = d.kind === 'founder' ? 6.5 : 5
      if (d.fund === 'amplify') g.append('circle').attr('class', 'shape').attr('r', r)
      else
        g.append('rect')
          .attr('class', 'shape')
          .attr('x', -r * 0.9)
          .attr('y', -r * 0.9)
          .attr('width', r * 1.8)
          .attr('height', r * 1.8)
          .attr('rx', d.kind === 'founder' ? 2 : 1.5)
    }
    g.append('circle').attr('class', 'hit').attr('r', Math.max(12, nodeRadius(d) + 5))
  })

  const lblSel = gLbl
    .selectAll<SVGGElement, AnyNode>('g.lbl')
    .data(graph.all, (d) => d.id)
    .join('g')
    .attr('class', (d) => `lbl ${d.kind}`)
  lblSel.append('text').text(labelText)

  const clSel = gLbl
    .selectAll<SVGGElement, ClusterView>('g.cl')
    .data(clusters)
    .join('g')
    .attr('class', 'lbl cluster cl')
    .attr('style', (c) => `--c: var(--path-${c.cluster.key})`)
  const clText = clSel.append('text').attr('text-anchor', (c) => c.anchor)

  const clusterLabel = (c: ClusterView): string => {
    const name = c.cluster.name.toUpperCase()
    const n = c.cluster.founders.length
    if (!input.filtersActive) return `${name} · ${n}`
    const m = c.cluster.founders.filter((f) => input.matched.has(f)).length
    return `${name} · ${m}/${n}`
  }

  /* ---------- visibility ---------- */
  const hubLayerOn = (d: HubNode) => (d.htype === 'e' ? input.layers.employers : d.htype === 's' ? input.layers.schools : input.layers.projects)
  const shown = (d: AnyNode): boolean =>
    d.kind === 'company' ? input.layers.companies : d.kind === 'hub' ? hubLayerOn(d) && (!d.oneOff || input.layers.oneOff) : true

  /* ---------- scale, measure, place ---------- */
  function applyScale() {
    const s = 1 / Math.sqrt(k)
    const tf = (d: Pt) => `translate(${d.x},${d.y}) scale(${s})`
    nodeSel.attr('transform', tf)
    lblSel.attr('transform', tf)
    clSel.attr('transform', (c) => `translate(${c.lx},${c.ly}) scale(${s})`)
    altDot.attr('r', 2.6 * s)
  }

  function measure() {
    lblSel.attr('display', null)
    lblSel.each(function (d) {
      const t = this.firstChild as SVGTextElement
      t.setAttribute('text-anchor', 'start')
      t.setAttribute('x', '0')
      t.setAttribute('y', '0')
      measures.set(d.id, textBox(t, labelText(d)))
    })
    clSel.each(function (c) {
      const t = this.firstChild as SVGTextElement
      const n = c.cluster.founders.length
      const widest = `${c.cluster.name.toUpperCase()} · ${n}/${n}`
      t.textContent = widest
      Object.assign(c, textBox(t, widest))
      if (c.anchor === 'start') c.lx = Math.min(c.lx0, W - 10 - c.lw)
      else if (c.anchor === 'end') c.lx = Math.max(c.lx0, 10 + c.lw)
      else c.lx = Math.min(Math.max(c.lx0, 10 + c.lw / 2), W - 10 - c.lw / 2)
      c.ly = Math.min(Math.max(c.ly0, c.la + 8), H - 10)
    })
    clText.text(clusterLabel)
    applyScale()
  }

  function place() {
    const s = 1 / Math.sqrt(k)
    const items: LabelItem[] = graph.all.filter(shown).map((d) => ({
      id: d.id,
      kind: d.kind,
      x: d.x,
      y: d.y,
      r: nodeRadius(d),
      degree: d.kind === 'hub' ? d.degree : 0,
      ...(measures.get(d.id) ?? { lw: 0, lh: 0, la: 0 }),
    }))
    const reserved: Rect[] = clusters.map((c) => {
      const w = c.lw * s
      const h = c.lh * s
      const x0 = c.anchor === 'start' ? c.lx : c.anchor === 'end' ? c.lx - w : c.lx - w / 2
      return [x0, c.ly - c.la * s, x0 + w, c.ly - c.la * s + h]
    })
    placements.clear()
    for (const [id, p] of placeLabels(items, reserved, k, { W, H })) placements.set(id, p)
    lblSel.each(function (d) {
      const p = placements.get(d.id)
      if (!p) return
      const t = this.firstChild as SVGTextElement
      t.setAttribute('text-anchor', p.c.a)
      t.setAttribute('x', String(p.c.dx))
      t.setAttribute('y', String(p.c.dy))
    })
  }

  /* ---------- render ---------- */
  function render() {
    const { focus, pinned, matched, layers, filtersActive, pathFilter } = input
    const E = focus ? new Set<AnyNode>([focus, ...(graph.neighbors.get(focus) ?? [])]) : null
    const matchedNode = (d: AnyNode) => (d.kind === 'founder' ? matched.has(d) : d.members.some((m) => matched.has(m)))
    const opacity = (d: AnyNode) => (!matchedNode(d) ? 0.07 : E ? (E.has(d) ? 1 : 0.32) : 1)
    const crowded = (d: AnyNode) => placements.get(d.id)?.crowded ?? true

    nodeSel
      .attr('display', (d) => (shown(d) ? null : 'none'))
      .style('opacity', (d) => String(opacity(d)))
      .classed('pinned', (d) => pinned && focus === d)
    lblSel.attr('display', (d) => (shown(d) && (!crowded(d) || (E?.has(d) ?? false)) ? null : 'none')).style('opacity', (d) => String(opacity(d)))
    linkSel
      .attr('display', (l) => (shown(l.target) ? null : 'none'))
      .style('opacity', (l) => {
        if (!matched.has(l.source)) return '0.03'
        if (focus) return l.source === focus || l.target === focus ? '0.95' : '0.03'
        const base = l.kind === 'co' ? 0.45 : 0.24
        return String(filtersActive ? Math.min(1, base * 1.6) : base)
      })
    altSel.attr('display', layers.alt ? null : 'none').style('opacity', (s) => String(!matched.has(s.f) ? 0.04 : E ? (E.has(s.f) ? 0.9 : 0.05) : 0.6))
    const pathOn = (key: PathKey) => !pathFilter.size || pathFilter.has(key)
    hullSel.style('opacity', (c) => String(pathOn(c.cluster.key) ? (E ? 0.5 : 1) : 0.25))
    clSel.style('opacity', (c) => String(pathOn(c.cluster.key) ? (E ? 0.55 : 1) : 0.3))
    clText.text(clusterLabel)
  }

  function relayout() {
    measure()
    place()
    render()
  }

  /* ---------- zoom ---------- */
  const duration = opts.reduceMotion ? 0 : 260
  const zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.8, 5])
    .translateExtent([
      [-W * 0.4, -H * 0.4],
      [W * 1.4, H * 1.4],
    ])
    .on('zoom', (ev: D3ZoomEvent<SVGSVGElement, unknown>) => {
      vp.attr('transform', ev.transform.toString())
      if (ev.transform.k !== k) {
        k = ev.transform.k
        applyScale()
      }
    })
    .on('end', () => {
      place()
      render()
    })
  svg.call(zoomBehavior).on('dblclick.zoom', null)

  /* ---------- events ---------- */
  nodeSel
    .on('pointerenter', (ev: PointerEvent, d) => handlers.onHover(d.id, ev.pointerType))
    .on('pointerleave', (ev: PointerEvent) => handlers.onHover(null, ev.pointerType))
    .on('click', (ev: MouseEvent, d) => {
      ev.stopPropagation()
      handlers.onToggle(d.id)
    })
    .on('keydown', (ev: KeyboardEvent, d) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault()
        handlers.onToggle(d.id)
      }
    })
  svg.on('click', () => handlers.onCanvasClick())

  /* ---------- boot ---------- */
  applyScale()
  measure()
  place()
  render()
  opts.fontsReady?.then(relayout, () => undefined)

  return {
    update(next) {
      const layersChanged = next.layers !== input.layers
      input = next
      if (layersChanged) place()
      render()
    },
    relayout,
    zoomIn: () => svg.transition().duration(duration).call(zoomBehavior.scaleBy, 1.5),
    zoomOut: () => svg.transition().duration(duration).call(zoomBehavior.scaleBy, 1 / 1.5),
    fit: () => svg.transition().duration(duration).call(zoomBehavior.transform, zoomIdentity),
  }
}
