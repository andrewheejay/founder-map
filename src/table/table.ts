import { esc } from '../html'
import { BADGE_LABEL, BADGE_ORDER, FUND_LABEL, OSS_LABEL, PATHS, STATUS_LABEL, type FounderNode } from '../model'
import { hostOf } from '../panel/card'
import type { Sort } from '../state'
import type { SortKey } from '../types'

export interface Column {
  key: SortKey
  label: string
  get(f: FounderNode): string
}

const join = (xs: readonly string[]) => xs.join(', ')
const badgeLabels = (f: FounderNode) => BADGE_ORDER.filter((b) => f.badges.includes(b)).map((b) => BADGE_LABEL[b])

/** The 13 table columns in the prototype's order; `get` is the sort value and the plain-text cell. */
export const TABLE_COLUMNS: Column[] = [
  { key: 'name', label: 'Founder', get: (f) => f.name },
  { key: 'fund', label: 'Fund', get: (f) => FUND_LABEL[f.fund] },
  { key: 'company', label: 'Company', get: (f) => f.company.name },
  { key: 'path', label: 'Path', get: (f) => PATHS[f.path].name },
  { key: 'role', label: 'Role', get: (f) => f.role },
  { key: 'status', label: 'Status', get: (f) => STATUS_LABEL[f.status] },
  { key: 'bigtech', label: 'Big tech', get: (f) => join(f.bigTech) },
  { key: 'badges', label: 'Badges', get: (f) => join(badgeLabels(f)) },
  { key: 'schools', label: 'Schools', get: (f) => join(f.schools) },
  { key: 'projects', label: 'Prior OSS', get: (f) => join(f.priorOpenSource) },
  { key: 'ossp', label: 'OSS product', get: (f) => OSS_LABEL[f.company.openSourceProduct] },
  { key: 'last', label: 'Company latest', get: (f) => f.company.latest },
  { key: 'src', label: 'Source', get: (f) => f.source },
]

const column = (key: SortKey): Column => TABLE_COLUMNS.find((c) => c.key === key) ?? TABLE_COLUMNS[0]

/** Case-insensitive sort by the column's text, ties by founder name, reversed when dir is -1. Never mutates. */
export function sortFounders(rows: FounderNode[], sort: Sort): FounderNode[] {
  const col = column(sort.key)
  return [...rows].sort((a, b) => {
    const va = col.get(a).toLowerCase()
    const vb = col.get(b).toLowerCase()
    return (va < vb ? -1 : va > vb ? 1 : a.name.localeCompare(b.name)) * sort.dir
  })
}

/** The prototype's 23 CSV columns, verbatim. */
export const CSV_HEADER: readonly string[] = [
  'Name', 'Fund', 'Company', 'Vertical', 'Role', 'Status', 'Status note', 'Path', 'Also fits',
  'Prior open source', 'Prior exit', 'Grad degree', 'Big tech alum', 'Big tech employers', 'All employers',
  'Schools', 'Prior OSS projects', 'Company founded', 'Company latest round', 'Company status', 'Company open source',
  'Est. founder age at founding', 'Source',
]

const yn = (b: boolean) => (b ? 'yes' : 'no')

export function csvRow(f: FounderNode): (string | number)[] {
  const c = f.company
  return [
    f.name, FUND_LABEL[f.fund], c.name, c.vertical, f.role, STATUS_LABEL[f.status], f.statusNote ?? '',
    PATHS[f.path].name, f.secondaryPath ? PATHS[f.secondaryPath].name : '',
    yn(f.badges.includes('prior_open_source')), yn(f.badges.includes('prior_exit')), yn(f.badges.includes('grad_degree')), yn(f.badges.includes('big_tech_alum')),
    f.bigTech.join('; '), f.employers.join('; '), f.schools.join('; '), f.priorOpenSource.join('; '),
    c.founded, c.latest, c.status, OSS_LABEL[c.openSourceProduct], c.avgFounderAgeAtFounding ?? '', f.source,
  ]
}

const quote = (v: string | number) => '"' + String(v).replace(/"/g, '""') + '"'

/** Header plus one row per founder, every cell quoted, CRLF line ends (Excel-friendly). */
export const csv = (rows: FounderNode[]): string => [[...CSV_HEADER], ...rows.map(csvRow)].map((r) => r.map(quote).join(',')).join('\r\n')

const mini = (s: string) => `<div class="mini">${esc(s)}</div>`
const orNone = (s: string, none = 'none') => (s ? esc(s) : `<span class="mini">${none}</span>`)

function cells(f: FounderNode): string {
  const c = f.company
  return [
    `<td class="name"><span class="pdot${f.fund === 'haystack' ? ' pdot--square' : ''}" style="--c: var(--path-${f.path})"></span>${esc(f.name)}</td>`,
    `<td class="nowrap">${FUND_LABEL[f.fund]}</td>`,
    `<td>${esc(c.name)}${mini(c.vertical)}</td>`,
    `<td>${esc(PATHS[f.path].name)}${f.secondaryPath ? mini('also ' + PATHS[f.secondaryPath].name) : ''}</td>`,
    `<td>${esc(f.role)}</td>`,
    `<td><span class="status status--${f.status}">${STATUS_LABEL[f.status]}</span>${f.statusNote ? mini(f.statusNote) : ''}</td>`,
    `<td>${orNone(join(f.bigTech))}</td>`,
    `<td>${orNone(join(badgeLabels(f)))}</td>`,
    `<td>${orNone(join(f.schools), 'n/a')}</td>`,
    `<td>${orNone(join(f.priorOpenSource))}</td>`,
    `<td>${OSS_LABEL[c.openSourceProduct]}</td>`,
    `<td>${esc(c.latest)}${mini(c.status)}</td>`,
    `<td><a href="${esc(f.source)}" target="_blank" rel="noopener">${esc(hostOf(f.source))}</a></td>`,
  ].join('')
}

/** thead + tbody for the founders table: sortable headers with aria-sort, focusable rows, the selected row marked. */
export function tableHTML(rows: FounderNode[], focus: string | null, sort: Sort): string {
  const head = TABLE_COLUMNS.map((c) => {
    const on = c.key === sort.key
    const ariaSort = on ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'
    const arrow = on ? (sort.dir > 0 ? '▲' : '▼') : ''
    return `<th scope="col" aria-sort="${ariaSort}"><button type="button" class="th${on ? ' is-on' : ''}" data-sort="${c.key}">${c.label}<span class="th__arrow" aria-hidden="true">${arrow}</span></button></th>`
  }).join('')
  const body = rows.length
    ? rows.map((f) => `<tr class="row${f.id === focus ? ' is-selected' : ''}" data-select="${f.id}" tabindex="0">${cells(f)}</tr>`).join('')
    : `<tr><td colspan="${TABLE_COLUMNS.length}" class="table__empty">No founders match these filters.</td></tr>`
  return `<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`
}

export const countText = (n: number, sort: Sort): string => `${n} founder${n === 1 ? '' : 's'} · sorted by ${column(sort.key).label.toLowerCase()}`
