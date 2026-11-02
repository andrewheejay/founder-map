import { readFileSync, writeFileSync } from 'node:fs'

type Leaf = string | number
type Group = Record<string, Leaf | Record<string, Leaf>>

export interface Tokens {
  color: Group
  path: Group
  status: Group
  font: Group
  text: Group
  leading: Group
  tracking: Group
  weight: Group
  radius: Group
  space: Group
  map: Group
  dark: { color?: Group; path?: Group; status?: Group }
}

/** Groups whose bare numbers are pixel lengths. Everything else stays unitless or passes through as written. */
const PX_GROUPS = new Set(['text', 'radius', 'space'])
const LIGHT_GROUPS = ['color', 'path', 'status', 'font', 'text', 'leading', 'tracking', 'weight', 'radius', 'space', 'map'] as const

const format = (group: string, v: Leaf) => (typeof v === 'number' && PX_GROUPS.has(group) ? `${v}px` : String(v))

/** `--<group>-<key>` (keys verbatim); nested objects add one more `-<key>` level. */
function declarations(group: string, values: Group | undefined): string[] {
  const out: string[] = []
  for (const [key, v] of Object.entries(values ?? {})) {
    if (typeof v === 'object') for (const [k2, v2] of Object.entries(v)) out.push(`  --${group}-${key}-${k2}: ${format(group, v2)};`)
    else out.push(`  --${group}-${key}: ${format(group, v)};`)
  }
  return out
}

export function tokensToCss(t: Tokens): string {
  const light = LIGHT_GROUPS.flatMap((g) => declarations(g, t[g]))
  const dark = [...declarations('color', t.dark?.color), ...declarations('path', t.dark?.path), ...declarations('status', t.dark?.status), '  color-scheme: dark;']
  return [
    '/* generated from design/tokens.json by scripts/tokens.ts; do not edit */',
    ':root {',
    ...light,
    '  color-scheme: light;',
    '}',
    '',
    ':root[data-theme="dark"] {',
    ...dark,
    '}',
    '',
    '@media (prefers-color-scheme: dark) {',
    '  :root:not([data-theme="light"]) {',
    ...dark.map((l) => '  ' + l),
    '  }',
    '}',
    '',
  ].join('\n')
}

function main() {
  const src = new URL('../design/tokens.json', import.meta.url)
  const out = new URL('../src/styles/tokens.css', import.meta.url)
  const css = tokensToCss(JSON.parse(readFileSync(src, 'utf8')))
  writeFileSync(out, css)
  console.log(`wrote src/styles/tokens.css (${(css.match(/^\s*--/gm) ?? []).length} declarations)`)
}

if (process.argv[1] && /tokens\.ts$/.test(process.argv[1])) main()
