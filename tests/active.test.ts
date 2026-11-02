// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { activeRowHTML } from '../src/filters/active'

describe('active filters row', () => {
  it('is empty without chips, otherwise chips with category, remove button, counts, and clear all', () => {
    expect(activeRowHTML([], 54, 24, { founders: 54, companies: 24 })).toBe('')
    const el = document.createElement('div')
    el.innerHTML = activeRowHTML(
      [
        { category: 'Badge', label: 'Big tech alum', remove: 'badge:big_tech_alum' },
        { category: 'Employer', label: 'Google', remove: 'employer:Google' },
      ],
      10,
      6,
      { founders: 54, companies: 24 },
    )
    expect(el.querySelectorAll('.achip')).toHaveLength(2)
    expect(el.querySelector('.achip .achip__cat')?.textContent).toBe('Badge')
    expect(el.querySelector('[data-remove="employer:Google"]')?.getAttribute('aria-label')).toBe('Remove filter Google')
    expect(el.querySelector('.active__count')?.textContent).toBe('10 of 54 founders · 6 of 24 companies')
    expect(el.querySelector('#clear-filters')?.textContent).toBe('Clear all')
    el.innerHTML = activeRowHTML([{ category: 'Search', label: '“zzz”', remove: 'q' }], 0, 0, { founders: 54, companies: 24 })
    expect(el.querySelector('.active__count')?.textContent).toBe('0 of 54 founders · 0 of 24 companies')
  })
})
