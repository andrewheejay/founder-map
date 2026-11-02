// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { graph } from '../src/data'
import { drawerHTML, syncControls } from '../src/filters/drawer'
import { BIG_TECH, PATH_ORDER } from '../src/model'
import { DEFAULT_FILTERS, DEFAULT_STATE, type State } from '../src/state'

const root = document.createElement('div')
root.innerHTML = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '')
root.querySelector('#filters-drawer')!.innerHTML = drawerHTML(graph)

describe('drawer', () => {
  it('renders path, badge, employer chips with counts, selects, and layer chips', () => {
    const paths = [...root.querySelectorAll('[data-path]')]
    expect(paths.map((b) => b.getAttribute('data-path'))).toEqual(PATH_ORDER)
    expect(paths.map((b) => b.querySelector('.chip__count')?.textContent)).toEqual(graph.clusters.map((c) => String(c.founders.length)))
    expect(root.querySelectorAll('[data-badge]')).toHaveLength(4)
    expect(root.querySelector('[data-badge="big_tech_alum"] .chip__count')?.textContent).toBe(String(graph.founders.filter((f) => f.badges.includes('big_tech_alum')).length))
    expect([...root.querySelectorAll('[data-employer]')].map((b) => b.getAttribute('data-employer'))).toEqual([...BIG_TECH])
    const schools = root.querySelectorAll('#sel-school option')
    expect(schools).toHaveLength(graph.hubs.filter((h) => h.htype === 's').length + 1)
    expect(schools[0].textContent).toBe('Any')
    expect(root.querySelectorAll('#sel-status option')).toHaveLength(4)
    expect(root.querySelectorAll('#sel-oss option')).toHaveLength(4)
    expect(root.querySelectorAll('label.select > select')).toHaveLength(4)
    expect([...root.querySelectorAll('[data-layer]')].map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true', 'true', 'false', 'true'])
    expect(root.querySelectorAll('[data-path], [data-badge], [data-employer], [data-layer]')).toHaveLength(24)
    expect([...root.querySelectorAll('#filters-drawer button')].every((b) => b.getAttribute('type') === 'button')).toBe(true)
  })
  it('syncControls mirrors the state into every control', () => {
    const s: State = { ...DEFAULT_STATE, drawer: true, view: 'table', tab: 'about', filters: { ...DEFAULT_FILTERS, paths: new Set(['academic']), status: 'left', q: 'ray' } }
    syncControls(root, s)
    expect(root.querySelector('[data-path="academic"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(root.querySelector('[data-path="big_tech_engineer"]')?.getAttribute('aria-pressed')).toBe('false')
    expect(root.querySelector('#filters-drawer')?.hasAttribute('hidden')).toBe(false)
    expect(root.querySelector('#filters-btn')?.getAttribute('aria-expanded')).toBe('true')
    expect(root.querySelector('#filters-count')?.textContent).toBe('3')
    expect(root.querySelector('#filters-count')?.hasAttribute('hidden')).toBe(false)
    expect((root.querySelector('#sel-status') as HTMLSelectElement).value).toBe('left')
    expect((root.querySelector('#map-search') as HTMLInputElement).value).toBe('ray')
    expect(root.querySelector('#map-card')?.hasAttribute('hidden')).toBe(true)
    expect(root.querySelector('#table-card')?.hasAttribute('hidden')).toBe(false)
    expect(root.querySelector('[data-view="table"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(root.querySelector('[data-tab="about"]')?.getAttribute('aria-selected')).toBe('true')
    expect(root.querySelector('#tab-about')?.hasAttribute('hidden')).toBe(false)
    expect(root.querySelector('#tab-clusters')?.hasAttribute('hidden')).toBe(true)
    syncControls(root, DEFAULT_STATE)
    expect(root.querySelector('#filters-count')?.hasAttribute('hidden')).toBe(true)
    expect(root.querySelector('#filters-drawer')?.hasAttribute('hidden')).toBe(false)
    expect(root.querySelector('#filters-btn')?.getAttribute('aria-expanded')).toBe('true')
    syncControls(root, { ...DEFAULT_STATE, drawer: false })
    expect(root.querySelector('#filters-drawer')?.hasAttribute('hidden')).toBe(true)
    syncControls(root, DEFAULT_STATE)
    expect(root.querySelector('#map-card')?.hasAttribute('hidden')).toBe(false)
    expect((root.querySelector('#sel-status') as HTMLSelectElement).value).toBe('')
  })
})
