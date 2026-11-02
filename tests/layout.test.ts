import { describe, expect, it } from 'vitest'
import { ANCHORS, DEFAULT_OUT, computeLayout } from '../scripts/layout'
import { companies, founders, layout as shipped } from '../src/data'
import { hubRefs } from '../src/model'

describe('layout script', () => {
  const out = computeLayout(founders, companies)
  it('places every founder, company, and hub inside the viewBox, rounded to 0.1', () => {
    const ids = new Set([...founders.map((f) => f.id), ...companies.map((c) => c.id), ...founders.flatMap((f) => hubRefs(f).map((r) => r.id))])
    expect(Object.keys(out.nodes).sort()).toEqual([...ids].sort())
    expect(Object.keys(out.nodes).sort()).toEqual(Object.keys(shipped.nodes).sort())
    for (const p of Object.values(out.nodes)) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(1100)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThanOrEqual(840)
      expect(p.x).toBe(Math.round(p.x * 10) / 10)
      expect(p.y).toBe(Math.round(p.y * 10) / 10)
    }
    expect(out.viewBox).toEqual([0, 0, 1100, 840])
    expect(out.note).toContain('scripts/layout.ts')
  })
  it('is deterministic and keeps each path cluster near its anchor', () => {
    expect(computeLayout(founders, companies)).toEqual(out)
    for (const [k, [ax, ay]] of Object.entries(ANCHORS)) {
      const fs = founders.filter((f) => f.path === k)
      const cx = fs.reduce((s, f) => s + out.nodes[f.id].x, 0) / fs.length
      const cy = fs.reduce((s, f) => s + out.nodes[f.id].y, 0) / fs.length
      expect(Math.hypot(cx - ax, cy - ay), k).toBeLessThan(160)
    }
  })
  it('default output path is a plain file path to data/layout.json', () => {
    expect(DEFAULT_OUT).toMatch(/\/data\/layout\.json$/)
    expect(DEFAULT_OUT.startsWith('/')).toBe(true)
    expect(DEFAULT_OUT).not.toContain('%')
  })
})
