import { describe, expect, it } from 'vitest'
import { graph } from '../src/data'
import { announceText, tablistKey } from '../src/panel/tablist'

describe('tablist', () => {
  it('arrow keys wrap, Home and End jump, other keys are ignored', () => {
    expect(tablistKey('ArrowRight', 2, 3)).toBe(0)
    expect(tablistKey('ArrowRight', 0, 3)).toBe(1)
    expect(tablistKey('ArrowLeft', 0, 3)).toBe(2)
    expect(tablistKey('Home', 2, 3)).toBe(0)
    expect(tablistKey('End', 0, 3)).toBe(2)
    expect(tablistKey('Enter', 1, 3)).toBeNull()
  })
  it('announces the selected node by name', () => {
    expect(announceText(graph.byId.get('f:dan-lorenc')!)).toBe('Dan Lorenc selected')
    expect(announceText(null)).toBe('Selection cleared')
  })
})
