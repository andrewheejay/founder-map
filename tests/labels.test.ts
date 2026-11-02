import { describe, expect, it } from 'vitest'
import { candidates, overlapArea, placeLabels, rectFor, type LabelItem } from '../src/map/labels'

const item = (p: Partial<LabelItem>): LabelItem => ({ id: 'x', kind: 'founder', x: 0, y: 0, r: 7, degree: 0, lw: 40, lh: 14, la: 11, ...p })
const B = { W: 1100, H: 840 }

describe('labels', () => {
  it('founder candidates flip by side of center', () => {
    expect(candidates(item({ x: 100 }), 550)[0].a).toBe('end')
    expect(candidates(item({ x: 900 }), 550)[0].a).toBe('start')
    expect(candidates(item({ kind: 'company' }), 550)[0]).toEqual({ a: 'middle', dx: 0, dy: -8 })
    expect(candidates(item({ kind: 'hub', degree: 4 }), 550)[0].dy).toBeCloseTo(8.2 + 3 + 11)
  })
  it('rectFor and overlapArea', () => {
    expect(rectFor(item({ x: 100, y: 100 }), { a: 'start', dx: 10, dy: 4 }, 1)).toEqual([110, 93, 150, 107])
    expect(rectFor(item({ x: 100, y: 100 }), { a: 'end', dx: -10, dy: 4 }, 1)).toEqual([50, 93, 90, 107])
    expect(overlapArea([0, 0, 10, 10], [5, 5, 20, 20])).toBe(25)
    expect(overlapArea([0, 0, 10, 10], [10, 0, 20, 10])).toBe(0)
  })
  it('far-apart labels are all placed', () => {
    const out = placeLabels([item({ id: 'a', x: 100, y: 100 }), item({ id: 'b', x: 600, y: 600 })], [], 1, B)
    expect(out.get('a')!.crowded).toBe(false)
    expect(out.get('b')!.crowded).toBe(false)
  })
  it('a label boxed in by reserved rects is crowded', () => {
    const out = placeLabels([item({ id: 'a', x: 500, y: 500 })], [[400, 400, 600, 600]], 1, B)
    expect(out.get('a')!.crowded).toBe(true)
  })
  it('out-of-bounds candidates are penalized only near k = 1', () => {
    const edge = item({ id: 'a', x: 5, y: 400 })
    expect(placeLabels([edge], [], 1, B).get('a')!.c.a).toBe('start')
    expect(placeLabels([edge], [], 2, B).get('a')!.c.a).toBe('end')
  })
  it('big hubs are placed before founders', () => {
    const hub = item({ id: 'h', kind: 'hub', degree: 5, x: 300, y: 300, r: 8.7, lw: 60 })
    const f = item({ id: 'f', x: 345, y: 318 })
    const out = placeLabels([f, hub], [], 1, B)
    expect(out.get('h')!.c).toEqual(candidates(hub, 550)[0])
    expect(out.get('f')!.c).not.toEqual(candidates(f, 550)[0])
  })
})
