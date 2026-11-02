import { polygonContains } from 'd3-polygon'
import { describe, expect, it } from 'vitest'
import { altStub, clusterGeometry, fitTransform, hubRadius, nodeRadius } from '../src/map/geometry'

describe('geometry', () => {
  it('radii', () => {
    expect(hubRadius(1)).toBeCloseTo(5.9)
    expect(hubRadius(4)).toBeCloseTo(8.2)
    expect(nodeRadius({ kind: 'founder' } as any)).toBe(7)
    expect(nodeRadius({ kind: 'company' } as any)).toBe(5.5)
  })
  it('hull encloses founders with 26px padding', () => {
    const g = clusterGeometry([{ x: 300, y: 470 }, { x: 340, y: 500 }], 1100, 840)
    expect(g.hull.length).toBeGreaterThanOrEqual(3)
    expect(polygonContains(g.hull, [300, 470])).toBe(true)
    expect(Math.min(...g.hull.map((p) => p[0]))).toBeLessThanOrEqual(300 - 25)
  })
  it('one-founder cluster still has a hull and a label position', () => {
    const g = clusterGeometry([{ x: 870, y: 560 }], 1100, 840)
    expect(g.hull.length).toBeGreaterThanOrEqual(8)
    expect(Number.isFinite(g.lx0) && Number.isFinite(g.ly0)).toBe(true)
  })
  it('label sits outside the hull on the side away from center', () => {
    const left = clusterGeometry([{ x: 290, y: 470 }, { x: 330, y: 450 }], 1100, 840)
    expect(left.anchor).toBe('end')
    expect(left.lx0).toBeLessThan(Math.min(...left.hull.map((p) => p[0])))
    const right = clusterGeometry([{ x: 870, y: 560 }, { x: 900, y: 540 }], 1100, 840)
    expect(right.anchor).toBe('start')
    expect(right.lx0).toBeGreaterThan(Math.max(...right.hull.map((p) => p[0])))
    const below = clusterGeometry([{ x: 560, y: 690 }, { x: 600, y: 700 }], 1100, 840)
    expect(below.anchor).toBe('middle')
    expect(below.ly0).toBeGreaterThan(Math.max(...below.hull.map((p) => p[1])))
  })
  it('also-fits stub is capped at 70 and safe at zero length', () => {
    const near = (p: { x: number; y: number }, x: number, y: number) => {
      expect(p.x).toBeCloseTo(x)
      expect(p.y).toBeCloseTo(y)
    }
    near(altStub({ x: 0, y: 0 }, { x: 300, y: 0 }), 70, 0)
    near(altStub({ x: 0, y: 0 }, { x: 100, y: 0 }), 55, 0)
    near(altStub({ x: 5, y: 5 }, { x: 5, y: 5 }), 5, 5)
  })
  it('fitTransform centers one point at the max scale, fits a spread at the min, and pads a cluster', () => {
    expect(fitTransform([], 1100, 840)).toBeNull()
    const one = fitTransform([{ x: 100, y: 700 }], 1100, 840)!
    expect(one.k).toBe(2.4)
    expect(one.x).toBeCloseTo(550 - 100 * 2.4)
    expect(one.y).toBeCloseTo(420 - 700 * 2.4)
    const wide = fitTransform([{ x: 0, y: 0 }, { x: 1100, y: 840 }], 1100, 840)!
    expect(wide.k).toBeCloseTo(Math.min(1100 / 1220, 840 / 960))
    expect(wide.x).toBeCloseTo(550 - 550 * wide.k)
    const cluster = fitTransform([{ x: 200, y: 300 }, { x: 400, y: 300 }, { x: 300, y: 400 }], 1100, 840)!
    expect(cluster.k).toBe(2.4)
    expect(cluster.x).toBeCloseTo(550 - 300 * 2.4)
    expect(cluster.y).toBeCloseTo(420 - 350 * 2.4)
    expect(fitTransform([{ x: 0, y: 0 }, { x: 5000, y: 0 }], 1100, 840)!.k).toBe(0.8)
  })
})
