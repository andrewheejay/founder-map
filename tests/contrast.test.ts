import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrast, hex } from './helpers/contrast'

const t = JSON.parse(readFileSync(new URL('../design/tokens.json', import.meta.url), 'utf8'))
type Status = Record<string, { bg: string; text: string }>
const themes = [
  { name: 'light', c: t.color, path: t.path as Record<string, string>, status: t.status as Status },
  { name: 'dark', c: t.dark.color, path: t.dark.path as Record<string, string>, status: t.dark.status as Status },
]

describe('contrast', () => {
  for (const th of themes) {
    it(`${th.name}: every text/background pair is at least 4.5:1`, () => {
      expect(th.status).toBeDefined()
      const pairs: [string, string, string][] = [
        ['ink on surface', th.c.ink, th.c.surface],
        ['ink on page', th.c.ink, th.c.page],
        ['ink on tableHead', th.c.ink, th.c.tableHead],
        ['ink on accentTint', th.c.ink, th.c.accentTint],
        ['muted on surface', th.c.muted, th.c.surface],
        ['muted on page', th.c.muted, th.c.page],
        ['muted on tableHead', th.c.muted, th.c.tableHead],
        ['muted on accentTint', th.c.muted, th.c.accentTint],
        ['accent on surface', th.c.accent, th.c.surface],
        ['accent on page', th.c.accent, th.c.page],
        ['accent on accentTint', th.c.accent, th.c.accentTint],
        ['accent on tableHead', th.c.accent, th.c.tableHead],
        ['surface on ink', th.c.surface, th.c.ink],
        ['surface on accent', th.c.surface, th.c.accent],
        ...Object.entries(th.status).map(([k, v]) => [`status ${k}`, v.text, v.bg] as [string, string, string]),
        ...Object.entries(th.path).map(([k, v]) => [`cluster label ${k} on surface`, v, th.c.surface] as [string, string, string]),
      ]
      const ratios = pairs.map(([label, fg, bg]) => [label, Math.round(contrast(hex(fg), hex(bg)) * 100) / 100] as const)
      for (const [label, ratio] of ratios) expect(ratio, label).toBeGreaterThanOrEqual(4.5)
    })
  }
})
