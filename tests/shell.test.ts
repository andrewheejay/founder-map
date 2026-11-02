// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
document.documentElement.innerHTML = html.replace(/<script[^>]*><\/script>/g, '')

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
    const css = readFileSync(resolve(process.cwd(), 'src/styles/components.css'), 'utf8')
    expect(css).toMatch(/@media \(max-width: 980px\)/)
  })
})
