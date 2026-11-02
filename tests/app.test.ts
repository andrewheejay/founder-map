// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { boot } from '../src/app'
import { graph } from '../src/data'

const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T
const click = (sel: string) => q(sel).dispatchEvent(new MouseEvent('click', { bubbles: true }))
const text = (sel: string) => q(sel)?.textContent ?? ''

const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '')

beforeAll(() => {
  document.documentElement.innerHTML = indexHtml
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

describe('focus retention across re-renders', () => {
  const focusClick = (sel: string) => {
    q(sel).focus()
    click(sel)
  }
  it('keeps focus on a cluster row and on a badge segment after toggling them', () => {
    focusClick('#clusters-list [data-cluster="academic"]')
    expect(q('#clusters-list [data-cluster="academic"]').getAttribute('aria-pressed')).toBe('true')
    expect(document.activeElement).toBe(q('#clusters-list [data-cluster="academic"]'))
    focusClick('#badge-rows [data-bp="prior_exit:repeat_founder"]')
    expect(q('#badge-rows [data-bp="prior_exit:repeat_founder"]').getAttribute('aria-pressed')).toBe('true')
    expect(document.activeElement).toBe(q('#badge-rows [data-bp="prior_exit:repeat_founder"]'))
  })
  it('sends focus to the Filters button when Clear all empties the row, and into the new card after a member link', () => {
    focusClick('#clear-filters')
    expect(q('#active-row').hasAttribute('hidden')).toBe(true)
    expect(document.activeElement).toBe(q('#filters-btn'))
    q('[data-id="e:google"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(text('#detail h2')).toBe('Google')
    focusClick('#detail [data-select^="f:"]')
    expect(text('#detail h2')).not.toBe('Google')
    expect(q('#detail').contains(document.activeElement)).toBe(true)
    click('#detail [data-close]')
  })
})

describe('table view', () => {
  it('Enter on the Source link inside a row opens the link instead of selecting the row', () => {
    click('[data-view="table"]')
    const link = q('#founder-table tbody tr.row a[href]')
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    link.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
    expect(document.querySelector('#founder-table tr.is-selected')).toBeNull()
    expect(text('#detail h2')).toBe('Pick any dot or station')
  })

  it('renders the filtered rows, sorts on header click, selects and clears on row clicks, name button keeps focus', () => {
    click('[data-view="table"]')
    expect(document.querySelectorAll('#founder-table tbody tr.row')).toHaveLength(graph.founders.length)
    expect(text('#table-count')).toBe(`${graph.founders.length} founders · sorted by founder`)
    click('#founder-table [data-sort="company"]')
    expect(q('#founder-table th[aria-sort="ascending"] button').getAttribute('data-sort')).toBe('company')
    click('#founder-table [data-sort="company"]')
    expect(q('#founder-table th[aria-sort="descending"] button').getAttribute('data-sort')).toBe('company')
    const first = q('#founder-table tbody tr.row')
    first.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(q('#founder-table tr.is-selected').getAttribute('data-select')).toBe(first.getAttribute('data-select'))
    expect(text('#detail h2')).toBe(first.querySelector('.rowbtn')!.textContent)
    q('#founder-table tr.is-selected').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(document.querySelector('#founder-table tr.is-selected')).toBeNull()
    expect(text('#detail h2')).toBe('Pick any dot or station')
    const btn = document.querySelectorAll<HTMLElement>('#founder-table .rowbtn')[1]
    btn.focus()
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(q('#founder-table tr.is-selected').getAttribute('data-select')).toBe(btn.getAttribute('data-row'))
    expect(document.activeElement?.getAttribute('data-row')).toBe(btn.getAttribute('data-row'))
    expect(document.activeElement?.getAttribute('aria-pressed')).toBe('true')
    click('#detail [data-close]')
    click('[data-badge="big_tech_alum"]')
    expect(document.querySelectorAll('#founder-table tbody tr.row')).toHaveLength(graph.founders.filter((f) => f.badges.includes('big_tech_alum')).length)
    click('#clear-filters')
    click('[data-view="map"]')
  })
  it('without a clipboard, Copy shows the CSV panel; Close and Esc hide it and return focus to Copy', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    click('[data-view="table"]')
    click('#csv-copy')
    await new Promise((r) => setTimeout(r, 0))
    expect(q('#csv-box').hasAttribute('hidden')).toBe(false)
    expect(document.activeElement).toBe(q('#csv-box'))
    expect(text('#toast')).toBe('Select the text and copy it manually')
    click('#csv-close')
    expect(q('#csv-box').hasAttribute('hidden')).toBe(true)
    expect(document.activeElement).toBe(q('#csv-copy'))
    click('#csv-copy')
    await new Promise((r) => setTimeout(r, 0))
    expect(q('#csv-box').hasAttribute('hidden')).toBe(false)
    q('#csv-box').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(q('#csv-box').hasAttribute('hidden')).toBe(true)
    expect(document.activeElement).toBe(q('#csv-copy'))
    click('[data-view="map"]')
  })
  it('copies the CSV of the sorted, filtered rows and toasts', async () => {
    const writes: string[] = []
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (t: string) => {
          writes.push(t)
          return Promise.resolve()
        },
      },
      configurable: true,
    })
    click('#csv-copy')
    await new Promise((r) => setTimeout(r, 0))
    expect(writes[0].split('\r\n')).toHaveLength(graph.founders.length + 1)
    expect(writes[0].startsWith('"Name","Fund","Company"')).toBe(true)
    expect(text('#toast')).toBe(`Copied ${graph.founders.length} rows as CSV`)
  })
})

describe('hash and keyboard', () => {
  it('mirrors the pinned selection in the hash and clears it on close', () => {
    q('[data-id="c:temporal"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(location.hash).toBe('#c-temporal')
    expect(text('#announce')).toBe('Temporal selected')
    click('#detail [data-close]')
    expect(location.hash).toBe('')
    expect(text('#announce')).toBe('Selection cleared')
  })
  it('follows hashchange, ignores unknown hashes, and hover does not touch the hash', () => {
    location.hash = '#f-dan-lorenc'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(text('#detail h2')).toBe('Dan Lorenc')
    location.hash = '#f-nobody'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(text('#detail h2')).toBe('Pick any dot or station')
    history.replaceState(null, '', location.pathname)
    q('[data-id="c:temporal"]').dispatchEvent(new Event('pointerenter'))
    expect(location.hash).toBe('')
    q('[data-id="c:temporal"]').dispatchEvent(new Event('pointerleave'))
  })
  it('arrow keys move between tabs and select them', () => {
    const tabs = [...document.querySelectorAll<HTMLElement>('#tabs [role="tab"]')]
    tabs[0].focus()
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(document.activeElement).toBe(tabs[1])
    expect(tabs[1].getAttribute('aria-selected')).toBe('true')
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '0', '-1'])
    tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(document.activeElement).toBe(tabs[2])
    tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(document.activeElement).toBe(tabs[0])
    expect(q('#tab-clusters').hasAttribute('hidden')).toBe(false)
  })
  it('ignores a data-select whose id is not in the graph', () => {
    const about = q('#tab-about')
    about.insertAdjacentHTML('beforeend', '<button type="button" id="ghost" data-select="x:nobody">ghost</button>')
    click('#ghost')
    expect(location.hash).toBe('')
    expect(text('#detail h2')).toBe('Pick any dot or station')
    q('#ghost').remove()
  })
})

describe('phone behaviors', () => {
  it('zooms to the pinned node and scrolls the card into view only on narrow screens, never on hover', () => {
    const calls: string[] = []
    const mm = (window as unknown as { matchMedia: unknown }).matchMedia
    ;(window as unknown as { matchMedia: unknown }).matchMedia = (q: string) => ({ matches: true, media: q })
    const doc2 = new DOMParser().parseFromString(indexHtml, 'text/html')
    ;(doc2.getElementById('detail') as unknown as { scrollIntoView: () => void }).scrollIntoView = () => calls.push('scroll')
    boot(doc2)
    const node = doc2.querySelector('[data-id="f:dan-lorenc"]')!
    node.dispatchEvent(new Event('pointerenter'))
    expect(calls).toEqual([])
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(calls).toEqual(['scroll'])
    expect(doc2.querySelector('#map g.viewport')!.getAttribute('transform')).toMatch(/scale\(2\.4\)/)
    ;(window as unknown as { matchMedia: unknown }).matchMedia = mm
    history.replaceState(null, '', location.pathname)
  })
})
