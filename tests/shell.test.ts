// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const html = read('index.html')
document.documentElement.innerHTML = html.replace(/<script[^>]*><\/script>/g, '')

/** Flatten a stylesheet into {selector, body} pairs, descending into @media blocks. */
function rules(css: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = []
  const walk = (text: string) => {
    let j = 0
    while (j < text.length) {
      const open = text.indexOf('{', j)
      if (open < 0) break
      const selector = text.slice(j, open).trim()
      let depth = 1
      let k = open + 1
      while (k < text.length && depth > 0) {
        if (text[k] === '{') depth++
        else if (text[k] === '}') depth--
        k++
      }
      const body = text.slice(open + 1, k - 1)
      if (selector.startsWith('@media')) walk(body)
      else if (!selector.startsWith('@')) out.push({ selector, body })
      j = k
    }
  }
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ''))
  return out
}

describe('page shell', () => {
  it('header, toolbar controls, main regions', () => {
    expect(document.querySelector('header h1')?.textContent).toBe('Founder Map')
    expect(document.querySelector('label[for="map-search"]')).not.toBeNull()
    expect(document.querySelector('input#map-search')?.getAttribute('type')).toBe('search')
    expect(document.querySelectorAll('#fund-seg button[aria-pressed]')).toHaveLength(3)
    expect(document.querySelectorAll('#view-seg button[aria-pressed]')).toHaveLength(2)
    expect(document.querySelector('#filters-btn')?.tagName).toBe('BUTTON')
    expect(document.querySelector('main #map-card svg#map')?.getAttribute('aria-label')).toBe('Founder network map')
    expect(['Zoom in', 'Zoom out', 'Fit map to view'].map((l) => document.querySelector(`#map-card button[aria-label="${l}"]`))).not.toContain(null)
    expect(document.querySelectorAll('#map-card .legend li')).toHaveLength(11)
    expect(document.querySelector('aside #detail h2')?.textContent).toBe('Pick any dot or station')
  })
  it('no em dashes in copy', () => expect(document.body.textContent).not.toMatch(/—/))
  it('stacks under 980px', () => {
    expect(read('src/styles/components.css')).toMatch(/@media \(max-width: 980px\)/)
  })
  it('[hidden] wins over component display rules', () => {
    // #filters-count is `hidden` until filters are active; .btn__count sets display, so base.css must force [hidden] off.
    const hiddenRule = rules(read('src/styles/base.css')).find((r) => r.selector === '[hidden]')
    expect(hiddenRule?.body.replace(/\s+/g, ' ')).toMatch(/display: none !important/)
  })
  it('only the zoombar and button icon rules size the zoom icons', () => {
    // The map svg sizing rule (width 100%, min-height) must not reach the icon svgs inside the zoom buttons.
    const icon = document.querySelector('#zoom-in svg')!
    const sizing = rules(read('src/styles/components.css')).filter((r) => /(^|[\s;])(min-height|max-height|height|width)\s*:/.test(r.body))
    const matching = sizing
      .filter((r) => {
        try {
          return icon.matches(r.selector)
        } catch {
          return false
        }
      })
      .map((r) => r.selector)
    expect(matching.length).toBeGreaterThan(0)
    expect(matching.filter((s) => !/zoombar|\.btn/.test(s))).toEqual([])
  })
  it('drawer, active row, table shell, and tabs are in the shell', () => {
    expect(document.querySelector('#filters-btn')?.getAttribute('aria-controls')).toBe('filters-drawer')
    expect(document.querySelector('#filters-drawer')?.hasAttribute('hidden')).toBe(true)
    expect(document.querySelector('#active-row')?.hasAttribute('hidden')).toBe(true)
    expect(document.querySelector('main #table-card')?.hasAttribute('hidden')).toBe(true)
    const tabs = [...document.querySelectorAll('#tabs [role="tab"]')]
    expect(tabs.map((t) => t.getAttribute('data-tab'))).toEqual(['clusters', 'insights', 'about'])
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false'])
    expect(tabs.every((t) => document.getElementById(t.getAttribute('aria-controls')!)?.getAttribute('role') === 'tabpanel')).toBe(true)
    expect(document.querySelector('#tab-about a[href*="claude.ai"]')).not.toBeNull()
    expect(document.querySelector('#tab-about')?.hasAttribute('hidden')).toBe(true)
  })
})

describe('filters button', () => {
  it('gets an ink border while the count badge is showing', () => {
    // Table.dc.html draws the Filters button with an ink border once filters are active.
    const btn = document.querySelector('#filters-btn')!
    const count = document.querySelector('#filters-count')!
    const inkBorder = rules(read('src/styles/components.css')).filter((r) => /border-color:\s*var\(--color-ink\)/.test(r.body))
    const matching = () => inkBorder.filter((r) => btn.matches(r.selector)).map((r) => r.selector)
    expect(count.hasAttribute('hidden')).toBe(true)
    expect(matching()).toEqual([])
    count.removeAttribute('hidden')
    expect(matching().length).toBeGreaterThan(0)
    count.setAttribute('hidden', '')
  })
})

describe('table shell', () => {
  it('table card has the bar, actions, scroll wrapper, csv box, and toast', () => {
    expect(document.querySelector('#table-card #table-count')).not.toBeNull()
    expect(document.querySelector('#table-card #csv-copy')?.textContent?.trim()).toBe('Copy table as CSV')
    expect(document.querySelector('#table-card #csv-download')?.textContent?.trim()).toBe('Download CSV')
    expect(document.querySelector('#table-card .table__scroll table#founder-table')).not.toBeNull()
    expect(document.querySelector('#csv-box')?.hasAttribute('hidden')).toBe(true)
    expect(document.querySelector('#toast')?.getAttribute('role')).toBe('status')
    expect(document.body.textContent).not.toMatch(/Table view arrives/)
  })
  it('the table keeps a wide minimum so 13 columns do not wrap into tall rows', () => {
    const rule = rules(read('src/styles/components.css')).find((r) => r.selector === '.table')
    expect(rule?.body.replace(/\s+/g, ' ')).toMatch(/min-width: 1280px/)
  })
})

describe('announcer and tab order', () => {
  it('announcer exists, detail is not live, and only the selected tab is in the tab order', () => {
    expect(document.querySelector('main #announce')?.getAttribute('aria-live')).toBe('polite')
    expect(document.querySelector('#detail')?.hasAttribute('aria-live')).toBe(false)
    expect([...document.querySelectorAll('#tabs [role="tab"]')].map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1'])
  })
})

/** The body of one @media block (brace-matched), so rules inside it can be checked apart from the base rules. */
function mediaBlock(css: string, query: string): string {
  const start = css.indexOf(`@media ${query}`)
  if (start < 0) return ''
  const open = css.indexOf('{', start)
  let depth = 1
  let k = open + 1
  while (k < css.length && depth > 0) {
    if (css[k] === '{') depth++
    else if (css[k] === '}') depth--
    k++
  }
  return css.slice(open + 1, k - 1)
}

describe('phone layout', () => {
  const css = read('src/styles/components.css')
  const body = (block: string, selector: string) => rules(block).find((r) => r.selector.split(',').map((x) => x.trim()).includes(selector))?.body.replace(/\s+/g, ' ') ?? ''
  it('under 980px the selects, close button, cluster rows, and tabs grow to touch size', () => {
    const b = mediaBlock(css, '(max-width: 980px)')
    expect(body(b, '.select')).toMatch(/height: var\(--space-controlHPhone\)/)
    expect(body(b, '.card__close')).toMatch(/width: var\(--space-closeBtnPhone\)/)
    expect(body(b, '.cluster-row')).toMatch(/min-height: var\(--space-rowMinH\)/)
    expect(body(b, '.tab')).toMatch(/height: var\(--space-tabHPhone\)/)
  })
  it('the narrow-screen blocks come after every base component rule so their sizes win the cascade', () => {
    const i980 = css.indexOf('@media (max-width: 980px)')
    for (const sel of ['.card__close {', '.select {', '.cluster-row {', '.tab {', '.btn {', '.search input {']) expect(css.lastIndexOf('\n' + sel), sel).toBeLessThan(i980)
    expect(i980).toBeLessThan(css.indexOf('@media (max-width: 640px)'))
  })
  it('under 640px the toolbar becomes a two-column grid with the search and fund control full width', () => {
    const b = mediaBlock(css, '(max-width: 640px)')
    expect(body(b, '.toolbar')).toMatch(/grid-template-columns: 1fr auto/)
    expect(body(b, '.search')).toMatch(/grid-column: 1 \/ -1/)
    expect(body(b, '#fund-seg')).toMatch(/grid-column: 1 \/ -1/)
    expect(body(b, '.seg button')).toMatch(/flex: 1 1 0/)
    expect(body(b, '.toolbar__spacer')).toMatch(/display: none/)
    expect(body(b, '.drawer')).toMatch(/grid-template-columns: 1fr/)
    expect(body(b, '.tab')).toMatch(/flex: 1 1 0/)
    expect(body(b, '.drawer .chip')).toMatch(/min-height: var\(--space-controlHPhone\)/)
  })
})

describe('badge bar target size', () => {
  it('badge bar segments are at least 24px tall and wide (WCAG 2.5.8, Lighthouse target-size)', () => {
    const css = read('src/styles/components.css')
    const body = (selector: string) => rules(css).find((r) => r.selector === selector)?.body.replace(/\s+/g, ' ') ?? ''
    expect(body('.bbar')).toMatch(/height: var\(--space-targetMin\)/)
    expect(body('.bseg')).toMatch(/min-width: var\(--space-targetMin\)/)
  })
})
