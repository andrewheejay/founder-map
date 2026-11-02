import { describe, expect, it } from 'vitest'
import { mapNavKey } from '../src/map/nav'

const n = (id: string, x: number, y: number) => ({ id, x, y })
const a = n('a', 0, 50), b = n('b', 10, 0), c = n('c', 20, 100), d = n('d', 20, 20)
const all = [c, a, d, b]

describe('mapNavKey', () => {
  it('Left and Right walk by x with ties by y then id, clamped at the ends', () => {
    expect(mapNavKey('ArrowRight', a, all)).toBe(b)
    expect(mapNavKey('ArrowRight', b, all)).toBe(d)
    expect(mapNavKey('ArrowRight', d, all)).toBe(c)
    expect(mapNavKey('ArrowRight', c, all)).toBe(c)
    expect(mapNavKey('ArrowLeft', a, all)).toBe(a)
    expect(mapNavKey('ArrowLeft', c, all)).toBe(d)
  })
  it('Up and Down walk by y; Home and End jump; other keys are null', () => {
    expect(mapNavKey('ArrowDown', b, all)).toBe(d)
    expect(mapNavKey('ArrowDown', d, all)).toBe(a)
    expect(mapNavKey('ArrowUp', b, all)).toBe(b)
    expect(mapNavKey('ArrowUp', c, all)).toBe(a)
    expect(mapNavKey('Home', c, all)).toBe(a)
    expect(mapNavKey('End', a, all)).toBe(c)
    expect(mapNavKey('Enter', a, all)).toBeNull()
    expect(mapNavKey('ArrowRight', n('zz', 5, 5), all)).toBeNull()
  })
})
