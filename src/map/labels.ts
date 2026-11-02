import { hubRadius } from './geometry'

export type Anchor = 'start' | 'end' | 'middle'

export interface Candidate {
  a: Anchor
  dx: number
  dy: number
}

/** [x0, y0, x1, y1] in viewBox units */
export type Rect = [number, number, number, number]

export interface LabelItem {
  id: string
  kind: 'founder' | 'company' | 'hub'
  x: number
  y: number
  /** node radius */
  r: number
  degree: number
  /** measured text box: width, height, and ascent (-bbox.y) */
  lw: number
  lh: number
  la: number
}

export interface Placement {
  c: Candidate
  crowded: boolean
}

/** Candidate label offsets, best first. Founders prefer the side away from the map center. */
export function candidates(d: LabelItem, cx: number): Candidate[] {
  const mid = d.la - d.lh / 2
  if (d.kind === 'founder') {
    const R = 10
    const m: Record<string, Candidate> = {
      r: { a: 'start', dx: R, dy: mid },
      l: { a: 'end', dx: -R, dy: mid },
      b: { a: 'middle', dx: 0, dy: R + d.la - 1 },
      t: { a: 'middle', dx: 0, dy: -R },
    }
    return (d.x < cx ? ['l', 'r', 'b', 't'] : ['r', 'l', 'b', 't']).map((k) => m[k])
  }
  const r = d.kind === 'company' ? 8 : hubRadius(d.degree) + 3
  const above: Candidate = { a: 'middle', dx: 0, dy: -r }
  const below: Candidate = { a: 'middle', dx: 0, dy: r + d.la }
  const sides: Candidate[] = [
    { a: 'start', dx: r + 1, dy: mid },
    { a: 'end', dx: -r - 1, dy: mid },
  ]
  return d.kind === 'company' ? [above, below, ...sides] : [below, above, ...sides]
}

/** The box a label occupies for candidate `c` at label scale `s` (= 1 / sqrt(zoom)). */
export function rectFor(d: Pick<LabelItem, 'x' | 'y' | 'lw' | 'lh' | 'la'>, c: Candidate, s: number): Rect {
  const w = d.lw * s
  const h = d.lh * s
  const bx = d.x + c.dx * s
  const by = d.y + c.dy * s
  const x0 = c.a === 'start' ? bx : c.a === 'end' ? bx - w : bx - w / 2
  const y0 = by - d.la * s
  return [x0, y0, x0 + w, y0 + h]
}

export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0])
  if (w <= 0) return 0
  const h = Math.min(a[3], b[3]) - Math.max(a[1], b[1])
  return h > 0 ? w * h : 0
}

/**
 * Greedy placement ported from the prototype: big hubs first, then companies, founders, small hubs.
 * Each label takes the candidate with the least overlap against node boxes, already placed labels,
 * and (near zoom 1) the viewBox edge. A label whose best slot still overlaps too much is "crowded".
 */
export function placeLabels(items: LabelItem[], reserved: Rect[], k: number, bounds: { W: number; H: number }): Map<string, Placement> {
  const { W, H } = bounds
  const s = 1 / Math.sqrt(k)
  const obstacles = items.map((d) => {
    const r = d.r * s + 1.5
    return { o: d, r: [d.x - r, d.y - r, d.x + r, d.y + r] as Rect }
  })
  const placed: Rect[] = [...reserved]
  const order = [
    ...items.filter((d) => d.kind === 'hub' && d.degree >= 3).sort((a, b) => b.degree - a.degree),
    ...items.filter((d) => d.kind === 'company'),
    ...items.filter((d) => d.kind === 'founder'),
    ...items.filter((d) => d.kind === 'hub' && d.degree < 3),
  ]
  const checkBounds = k <= 1.02
  const out = new Map<string, Placement>()
  for (const d of order) {
    const area = d.lw * d.lh * s * s
    let best: { c: Candidate; r: Rect } | null = null
    let bestScore = Infinity
    const cs = candidates(d, W / 2)
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i]
      const r = rectFor(d, c, s)
      let score = i * 0.5
      for (const ob of obstacles) if (ob.o !== d) score += overlapArea(r, ob.r)
      for (const p of placed) score += overlapArea(r, p)
      if (checkBounds && (r[0] < 2 || r[1] < 2 || r[2] > W - 2 || r[3] > H - 2)) score += area
      if (score < bestScore) {
        bestScore = score
        best = { c, r }
      }
    }
    if (!best) continue
    const crowded = bestScore > 0.18 * area + 2
    out.set(d.id, { c: best.c, crowded })
    if (!crowded) placed.push(best.r)
  }
  return out
}
