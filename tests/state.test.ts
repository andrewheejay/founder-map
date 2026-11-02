import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYERS, createStore, escapeClears, hoverFocusAllowed, toggleSelect } from '../src/state'

describe('state', () => {
  it('store notifies subscribers with merged state', () => {
    const s = createStore({ focus: null, pinned: false, layers: DEFAULT_LAYERS })
    const seen: unknown[] = []
    s.subscribe((v) => seen.push(v.focus))
    s.set({ focus: 'f:dan-lorenc' })
    expect(seen).toEqual(['f:dan-lorenc'])
    expect(s.get().pinned).toBe(false)
  })
  it('hover never overrides a pin and ignores touch', () => {
    expect(hoverFocusAllowed('mouse', false)).toBe(true)
    expect(hoverFocusAllowed('touch', false)).toBe(false)
    expect(hoverFocusAllowed('mouse', true)).toBe(false)
  })
  it('escape clears unless typing', () => {
    expect(escapeClears('BODY')).toBe(true)
    expect(escapeClears('INPUT')).toBe(false)
    expect(escapeClears('SELECT')).toBe(false)
    expect(escapeClears(undefined)).toBe(true)
  })
  it('toggle pins, and unpins the same node', () => {
    expect(toggleSelect({ focus: null, pinned: false, layers: DEFAULT_LAYERS }, 'a')).toEqual({ focus: 'a', pinned: true })
    expect(toggleSelect({ focus: 'a', pinned: true, layers: DEFAULT_LAYERS }, 'a')).toEqual({ focus: null, pinned: false })
    expect(toggleSelect({ focus: 'a', pinned: true, layers: DEFAULT_LAYERS }, 'b')).toEqual({ focus: 'b', pinned: true })
  })
})
