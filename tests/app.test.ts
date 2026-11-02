// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { boot } from '../src/app'
import { graph } from '../src/data'

const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T
const click = (sel: string) => q(sel).dispatchEvent(new MouseEvent('click', { bubbles: true }))
const text = (sel: string) => q(sel)?.textContent ?? ''

beforeAll(() => {
  document.documentElement.innerHTML = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '')
  ;(window as unknown as { matchMedia: () => { matches: boolean } }).matchMedia = () => ({ matches: false })
  boot(document)
})

describe('app', () => {
  it('opens the drawer, filters Big tech alum + Google to 10 of 54 and 6 of 24, removes and clears', () => {
    expect(q('#filters-drawer').hasAttribute('hidden')).toBe(true)
    click('#filters-btn')
    expect(q('#filters-drawer').hasAttribute('hidden')).toBe(false)
    expect(q('#filters-btn').getAttribute('aria-expanded')).toBe('true')
    click('[data-badge="big_tech_alum"]')
    click('[data-employer="Google"]')
    expect(text('#active-row .active__count')).toBe('10 of 54 founders · 6 of 24 companies')
    expect(text('#filters-count')).toBe('2')
    expect([...document.querySelectorAll('#map g.lbl.cluster text')].some((t) => /· \d+\/\d+$/.test(t.textContent ?? ''))).toBe(true)
    expect([...document.querySelectorAll('#map g.node.founder')].some((n) => (n as HTMLElement).style.opacity === '0.07')).toBe(true)
    expect(q('#clusters-list [data-cluster="big_tech_engineer"] .cluster-row__count').textContent).toMatch(/ of 20$/)
    click('[data-remove="employer:Google"]')
    expect(text('#active-row .active__count')).toMatch(/^25 of 54 founders/)
    click('#clear-filters')
    expect(q('#active-row').hasAttribute('hidden')).toBe(true)
    expect(q('#filters-count').hasAttribute('hidden')).toBe(true)
    expect(q('[data-badge="big_tech_alum"]').getAttribute('aria-pressed')).toBe('false')
  })
  it('selects Dan Lorenc from the map, closes from the card', () => {
    q('[data-id="f:dan-lorenc"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(text('#detail h2')).toBe('Dan Lorenc')
    expect(q('[data-id="f:dan-lorenc"]').classList.contains('pinned')).toBe(true)
    click('#detail [data-close]')
    expect(text('#detail h2')).toBe('Pick any dot or station')
    expect(q('[data-id="f:dan-lorenc"]').classList.contains('pinned')).toBe(false)
  })
  it('card follows the last hover and returns to default on leave', () => {
    const a = q('[data-id="f:dan-lorenc"]')
    const b = q('[data-id="c:temporal"]')
    a.dispatchEvent(new Event('pointerenter'))
    b.dispatchEvent(new Event('pointerenter'))
    expect(text('#detail h2')).toBe('Temporal')
    b.dispatchEvent(new Event('pointerleave'))
    expect(text('#detail h2')).toBe('Pick any dot or station')
  })
  it('search, selects, view toggle, cluster row, segment, hidden-node links, tabs', () => {
    const input = q<HTMLInputElement>('#map-search')
    input.value = 'lorenc'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(text('#active-row .active__count')).toBe('1 of 54 founders · 1 of 24 companies')
    expect(text('#active-row .achip')).toContain('“lorenc”')
    click('#clear-filters')
    expect(input.value).toBe('')
    const sel = q<HTMLSelectElement>('#sel-status')
    sel.value = 'left'
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    expect(text('#active-row')).toContain('Status')
    click('#clear-filters')
    click('[data-view="table"]')
    expect(q('#map-card').hasAttribute('hidden')).toBe(true)
    expect(q('#table-card').hasAttribute('hidden')).toBe(false)
    click('[data-view="map"]')
    expect(q('#map-card').hasAttribute('hidden')).toBe(false)
    click('[data-cluster="academic"]')
    expect(text('#detail h2')).toBe('Academic')
    expect(q('[data-cluster="academic"]').getAttribute('aria-pressed')).toBe('true')
    expect(q('[data-path="academic"]').getAttribute('aria-pressed')).toBe('true')
    click('[data-bp="prior_open_source:big_tech_engineer"]')
    expect([...document.querySelectorAll('#active-row .achip__cat')].map((c) => c.textContent)).toEqual(['Path', 'Badge'])
    click('[data-bp="prior_open_source:big_tech_engineer"]')
    expect(q('#active-row').hasAttribute('hidden')).toBe(true)
    const oneOff = graph.hubs.find((h) => h.oneOff)!
    q('#detail').innerHTML = `<button type="button" data-select="${oneOff.id}"></button>`
    click(`#detail [data-select="${oneOff.id}"]`)
    expect(text('#detail h2')).toBe(oneOff.name)
    click('#detail [data-close]')
    click('[data-layer="oneOff"]')
    expect(q('[data-layer="oneOff"]').getAttribute('aria-pressed')).toBe('true')
    expect(q(`[data-id="${oneOff.id}"]`).getAttribute('display')).toBeNull()
    click('[data-layer="oneOff"]')
    click('[data-tab="about"]')
    expect(q('#tab-about').hasAttribute('hidden')).toBe(false)
    expect(q('[data-tab="about"]').getAttribute('aria-selected')).toBe('true')
    click('[data-fund="haystack"]')
    expect(text('#active-row .active__count')).toMatch(/^\d+ of 54 founders · 12 of 24 companies$/)
    click('#clear-filters')
    expect(q('#insights-list li')).not.toBeNull()
  })
})
