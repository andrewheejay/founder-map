import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, DEFAULT_STATE, clearFilters, createStore, escapeClears, hoverFocusAllowed, removeFilter, toggleBadgePath, toggleOss, togglePath, toggleSelect } from '../src/state'
import { DEFAULT_SORT, toggleSort } from '../src/state'

describe('state', () => {
  it('store notifies subscribers with merged state', () => {
    const s = createStore(DEFAULT_STATE)
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
    expect(toggleSelect(DEFAULT_STATE, 'a')).toEqual({ focus: 'a', pinned: true })
    expect(toggleSelect({ ...DEFAULT_STATE, focus: 'a', pinned: true }, 'a')).toEqual({ focus: null, pinned: false })
    expect(toggleSelect({ ...DEFAULT_STATE, focus: 'a', pinned: true }, 'b')).toEqual({ focus: 'b', pinned: true })
  })
  it('path, badge+path segment, oss, remove, clear', () => {
    const f0 = DEFAULT_FILTERS
    const f1 = togglePath(f0, 'academic')
    expect([...f1.paths]).toEqual(['academic'])
    expect(togglePath(f1, 'academic').paths.size).toBe(0)
    const seg = toggleBadgePath({ ...f1, fund: 'amplify', paths: new Set(['academic', 'repeat_founder']) }, 'prior_exit', 'repeat_founder')
    expect([...seg.badges]).toEqual(['prior_exit'])
    expect([...seg.paths]).toEqual(['repeat_founder'])
    expect(seg.fund).toBe('amplify')
    const off = toggleBadgePath(seg, 'prior_exit', 'repeat_founder')
    expect(off.badges.size + off.paths.size).toBe(0)
    expect(toggleOss(toggleOss(f0, 'yes'), 'yes').oss).toBe('')
    const many = { ...f0, fund: 'haystack' as const, q: 'a', employers: new Set(['Google', 'Uber']), school: 'MIT' }
    expect(removeFilter(many, 'employer:Google').employers.has('Uber')).toBe(true)
    expect(removeFilter(many, 'fund').fund).toBe('all')
    expect(removeFilter(many, 'school').school).toBe('')
    expect(clearFilters()).toEqual(DEFAULT_FILTERS)
  })
})

describe('sort state', () => {
  it('toggleSort flips direction on the same key and resets on a new key', () => {
    expect(toggleSort(DEFAULT_SORT, 'name')).toEqual({ key: 'name', dir: -1 })
    expect(toggleSort({ key: 'name', dir: -1 }, 'company')).toEqual({ key: 'company', dir: 1 })
    expect(DEFAULT_STATE.sort).toEqual({ key: 'name', dir: 1 })
  })
})
