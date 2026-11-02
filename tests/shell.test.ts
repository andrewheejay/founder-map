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
})
