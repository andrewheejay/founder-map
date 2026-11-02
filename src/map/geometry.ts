import { polygonHull } from 'd3-polygon'
import type { AnyNode } from '../model'

/** Padding around each founder when building a path hull, in viewBox units. */
export const HULL_PAD = 26

export const hubRadius = (degree: number): number => 3.6 + Math.sqrt(degree) * 2.3

export const nodeRadius = (d: AnyNode): number => (d.kind === 'founder' ? 7 : d.kind === 'company' ? 5.5 : hubRadius(d.degree))

export interface Pt {
  x: number
  y: number
}

export type Anchor = 'start' | 'end' | 'middle'

export interface ClusterGeometry {
  hull: [number, number][]
  cx: number
  cy: number
  /** Unclamped label position, outside the hull on the side away from the map center. */
  lx0: number
  ly0: number
  anchor: Anchor
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

export function clusterGeometry(founders: Pt[], W: number, H: number): ClusterGeometry {
  if (!founders.length) return { hull: [], cx: W / 2, cy: H / 2, lx0: W / 2, ly0: H / 2, anchor: 'middle' }
  const pts: [number, number][] = []
  for (const f of founders) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      pts.push([f.x + Math.cos(a) * HULL_PAD, f.y + Math.sin(a) * HULL_PAD])
    }
  }
  const hull = polygonHull(pts) ?? pts
  const cx = mean(founders.map((f) => f.x))
  const cy = mean(founders.map((f) => f.y))
  let dx = cx - W / 2
  let dy = cy - H / 2
  const len = Math.hypot(dx, dy) || 1
  dx /= len
  dy /= len
  const reach = Math.max(...hull.map((p) => (p[0] - cx) * dx + (p[1] - cy) * dy))
  return {
    hull,
    cx,
    cy,
    lx0: cx + dx * (reach + 24),
    ly0: cy + dy * (reach + 24) + 4,
    anchor: dx > 0.35 ? 'start' : dx < -0.35 ? 'end' : 'middle',
  }
}

/** End point of the dashed "also fits" stub: from the founder toward the secondary cluster center, at most 70 units. */
export function altStub(from: Pt, to: Pt): Pt {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const L = Math.hypot(dx, dy)
  if (!L) return { x: from.x, y: from.y }
  const len = Math.min(L * 0.55, 70)
  return { x: from.x + (dx / L) * len, y: from.y + (dy / L) * len }
}

/**
 * The zoom transform that fits `points` in a W x H viewBox with `pad` units around their bounding box,
 * scale clamped to [minK, maxK] (one point sits at maxK). Null for an empty list.
 */
export function fitTransform(points: readonly Pt[], W: number, H: number, pad = 60, minK = 0.8, maxK = 2.4): { k: number; x: number; y: number } | null {
  if (!points.length) return null
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of points) {
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }
  const k = Math.min(maxK, Math.max(minK, Math.min(W / (x1 - x0 + 2 * pad), H / (y1 - y0 + 2 * pad))))
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  return { k, x: W / 2 - cx * k, y: H / 2 - cy * k }
}
