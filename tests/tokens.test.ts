import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import tokens from '../design/tokens.json'
import { tokensToCss } from '../scripts/tokens'

const css = tokensToCss(tokens as any)

describe('tokens', () => {
  it('emits light tokens with the spec values', () => {
    for (const line of [
      '--color-accent: #2457D6;',
      '--color-muted: #5B6471;',
      '--path-big_tech_engineer: #2457D6;',
      '--path-young_builder: #B45E0A;',
      '--status-role_changed-bg: #FBEEDC;',
      '--radius-card: 12px;',
      '--space-controlH: 40px;',
      '--text-mapHub: 10.5px;',
      '--tracking-eyebrow: 0.08em;',
      '--map-hullFillOpacity: 0.06;',
    ])
      expect(css).toContain(line)
  })
  it('emits dark overrides under both selectors', () => {
    expect(css).toMatch(/:root\[data-theme="dark"\]\s*\{[^}]*--color-page: #0F1216;/)
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{[^}]*--path-academic: #B489EC;/)
  })
  it('emits dark status tokens in both dark blocks, after the light block', () => {
    expect(css).toMatch(/:root\[data-theme="dark"\]\s*\{[^}]*--status-active-bg: #123B2E;/)
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{[^}]*--status-left-text: #B4BCC7;/)
    expect(css.indexOf(':root {')).toBeLessThan(css.indexOf(':root[data-theme="dark"]'))
    expect(css.indexOf(':root[data-theme="dark"]')).toBeLessThan(css.indexOf('@media (prefers-color-scheme: dark)'))
  })
  it('generated file is in sync with the source', () => {
    expect(readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')).toBe(css)
  })
  it('emits the Prompt 2 sizing tokens', () => {
    const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
    expect(css).toMatch(/--space-chipH: 26px/)
    expect(css).toMatch(/--space-tabH: 42px/)
    expect(css).toMatch(/--space-closeBtn: 32px/)
    expect(css).toMatch(/--space-dlLabelW: 96px/)
    expect(css).toMatch(/--text-chip: 12px/)
  })
})
