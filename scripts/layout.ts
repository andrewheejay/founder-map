import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force'
import { hubRadius } from '../src/map/geometry'
import { hubRefs } from '../src/model'
import type { CompanyRecord, FounderRecord, HubType, Layout, PathKey } from '../src/types'

/**
 * Offline port of the prototype's force layout (reference/founder-map-v4.html, "Layout" section):
 * founders are pulled toward their path anchor (26% toward a secondary path), companies and shared
 * hubs float between their members, 500 ticks, then everything is fitted into the 1100x840 box.
 * One-off hubs are not simulated; they sit 36px from their only founder, fanned by angle.
 */
export const ANCHORS: Record<PathKey, [number, number]> = {
  big_tech_engineer: [290, 470],
  repeat_founder: [580, 690],
  business_operator: [870, 560],
  young_builder: [800, 220],
  academic: [410, 165],
}

const W = 1100
const H = 840
const CX = W / 2
const CY = H / 2
const MARGIN = 76
const MAX_FIT = 1.45
const TICKS = 500

interface SimNode extends SimulationNodeDatum {
  id: string
  kind: 'founder' | 'company' | 'hub'
  x: number
  y: number
  tx: number
  ty: number
  deg: number
  path?: PathKey
  htype?: HubType
  oneOff: boolean
  members: SimNode[]
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  source: SimNode
  target: SimNode
  kind: 'co' | HubType
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const round1 = (v: number) => Math.round(v * 10) / 10
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function computeLayout(founders: FounderRecord[], companies: CompanyRecord[]): Layout {
  const node = (id: string, kind: SimNode['kind'], extra: Partial<SimNode> = {}): SimNode => ({ id, kind, x: 0, y: 0, tx: CX, ty: CY, deg: 0, oneOff: false, members: [], ...extra })
  const companyByName = new Map(companies.map((c) => [c.name, node(c.id, 'company')]))
  const hubs = new Map<string, SimNode>()
  const links: SimLink[] = []

  const founderNodes = founders.map((f, i) => {
    const a = ANCHORS[f.path]
    const s = f.secondaryPath ? ANCHORS[f.secondaryPath] : null
    const w = s ? 0.26 : 0
    const tx = a[0] * (1 - w) + (s ? s[0] * w : 0)
    const ty = a[1] * (1 - w) + (s ? s[1] * w : 0)
    const ang = i * 2.39996
    const r = 14 + (i % 5) * 6
    const company = companyByName.get(f.company)
    if (!company) throw new Error(`${f.id}: unknown company "${f.company}"`)
    const n = node(f.id, 'founder', { tx, ty, x: tx + Math.cos(ang) * r, y: ty + Math.sin(ang) * r, path: f.path })
    company.members.push(n)
    links.push({ source: n, target: company, kind: 'co' })
    for (const ref of hubRefs(f)) {
      let h = hubs.get(ref.id)
      if (!h) {
        h = node(ref.id, 'hub', { htype: ref.type })
        hubs.set(ref.id, h)
      }
      if (!h.members.includes(n)) h.members.push(n)
      links.push({ source: n, target: h, kind: ref.type })
    }
    return n
  })

  for (const h of hubs.values()) {
    h.deg = h.members.length
    h.oneOff = h.htype !== 'o' && h.deg < 2
  }
  const companyNodes = companies.map((c) => companyByName.get(c.name)!)
  companyNodes.forEach((c, i) => {
    c.x = mean(c.members.map((m) => m.x)) + Math.cos(i) * 8
    c.y = mean(c.members.map((m) => m.y)) + Math.sin(i) * 8
  })
  const simHubs = [...hubs.values()].filter((h) => !h.oneOff)
  simHubs.forEach((h, i) => {
    h.x = mean(h.members.map((m) => m.x)) + Math.cos(i * 1.7) * 10
    h.y = mean(h.members.map((m) => m.y)) + Math.sin(i * 1.7) * 10
  })

  const simNodes = [...founderNodes, ...companyNodes, ...simHubs]
  const simLinks = links.filter((l) => !l.target.oneOff)
  const sim = forceSimulation<SimNode>(simNodes)
    .force(
      'link',
      forceLink<SimNode, SimLink>(simLinks)
        .distance((l) => (l.kind === 'co' ? 30 : 62))
        .strength((l) => (l.kind === 'co' ? 0.42 : 0.5 / Math.max(2, l.target.deg))),
    )
    .force(
      'charge',
      forceManyBody<SimNode>()
        .strength((d) => (d.kind === 'founder' ? -75 : d.kind === 'company' ? -55 : -95 - d.deg * 4))
        .distanceMax(250),
    )
    .force('x', forceX<SimNode>((d) => (d.kind === 'founder' ? d.tx : CX)).strength((d) => (d.kind === 'founder' ? 0.27 : d.kind === 'hub' ? 0.012 : 0)))
    .force('y', forceY<SimNode>((d) => (d.kind === 'founder' ? d.ty : CY)).strength((d) => (d.kind === 'founder' ? 0.27 : d.kind === 'hub' ? 0.012 : 0)))
    .force('collide', forceCollide<SimNode>((d) => (d.kind === 'founder' ? 15 : d.kind === 'company' ? 15 : hubRadius(d.deg) + 13)).iterations(2))
    .stop()
  for (let i = 0; i < TICKS; i++) sim.tick()

  const xs = simNodes.map((d) => d.x)
  const ys = simNodes.map((d) => d.y)
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  const k = Math.min((W - 2 * MARGIN) / (x1 - x0 || 1), (H - 2 * MARGIN) / (y1 - y0 || 1), MAX_FIT)
  const ox = (W - (x1 - x0) * k) / 2
  const oy = (H - (y1 - y0) * k) / 2
  for (const d of simNodes) {
    d.x = ox + (d.x - x0) * k
    d.y = oy + (d.y - y0) * k
  }

  const centroid = new Map<PathKey, [number, number]>()
  for (const key of Object.keys(ANCHORS) as PathKey[]) {
    const fs = founderNodes.filter((f) => f.path === key)
    centroid.set(key, [mean(fs.map((f) => f.x)), mean(fs.map((f) => f.y))])
  }
  const perFounder = new Map<SimNode, number>()
  for (const h of hubs.values()) {
    if (!h.oneOff) continue
    const f = h.members[0]
    const n = perFounder.get(f) ?? 0
    perFounder.set(f, n + 1)
    const [cx, cy] = centroid.get(f.path!)!
    let dx = f.x - cx
    let dy = f.y - cy
    if (Math.hypot(dx, dy) < 4) {
      dx = f.x - CX
      dy = f.y - CY
    }
    const ang = Math.atan2(dy, dx) + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 0.62
    h.x = clamp(f.x + Math.cos(ang) * 36, 16, W - 16)
    h.y = clamp(f.y + Math.sin(ang) * 36, 16, H - 16)
  }

  const nodes: Layout['nodes'] = {}
  for (const d of [...founderNodes, ...companyNodes, ...hubs.values()]) nodes[d.id] = { x: round1(d.x), y: round1(d.y) }
  return {
    viewBox: [0, 0, W, H],
    note: `Positions from scripts/layout.ts (D3 forceSimulation, ${TICKS} ticks, then fit to ${W}x${H} with ${MARGIN}px margin). Ship these as static positions; run "npm run layout" only when data changes.`,
    nodes,
  }
}

/** Where `npm run layout` writes without --out. */
export const DEFAULT_OUT = fileURLToPath(new URL('../data/layout.json', import.meta.url))

function main() {
  const args = process.argv.slice(2)
  const outIndex = args.indexOf('--out')
  const out = outIndex >= 0 ? args[outIndex + 1] : DEFAULT_OUT
  const read = (name: string) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8'))
  const layout = computeLayout(read('founders.json') as FounderRecord[], read('companies.json') as CompanyRecord[])
  writeFileSync(out, JSON.stringify(layout, null, 1) + '\n')
  console.log(`wrote ${out} (${Object.keys(layout.nodes).length} nodes)`)
}

if (process.argv[1] && /layout\.ts$/.test(process.argv[1])) main()
