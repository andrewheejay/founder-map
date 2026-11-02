// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { graph } from '../src/data'
import { hostOf } from '../src/panel/card'
import { CSV_HEADER, TABLE_COLUMNS, countText, csv, csvRow, sortFounders, tableHTML } from '../src/table/table'

const el = (html: string) => {
  const t = document.createElement('table')
  t.innerHTML = html
  return t
}

describe('table', () => {
  it('13 columns in prototype order', () => {
    expect(TABLE_COLUMNS.map((c) => c.label)).toEqual(['Founder', 'Fund', 'Company', 'Path', 'Role', 'Status', 'Big tech', 'Badges', 'Schools', 'Prior OSS', 'OSS product', 'Company latest', 'Source'])
  })
  it('sorts case-insensitively, empty values first, ties by name, without mutating', () => {
    const rows = graph.founders
    const bySchool = sortFounders(rows, { key: 'schools', dir: 1 })
    const noSchool = rows.filter((f) => !f.schools.length).length
    expect(noSchool).toBeGreaterThan(1)
    expect(bySchool.slice(0, noSchool).every((f) => !f.schools.length)).toBe(true)
    const names = bySchool.slice(0, noSchool).map((f) => f.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    expect(sortFounders(rows, { key: 'name', dir: -1 })[0].name).toBe(sortFounders(rows, { key: 'name', dir: 1 }).at(-1)!.name)
    expect(rows).toBe(graph.founders)
    expect(rows[0]).toBe(graph.founders[0])
  })
  it('csv: 23-column header, every cell quoted, quotes doubled, CRLF rows', () => {
    expect(CSV_HEADER).toHaveLength(23)
    expect(CSV_HEADER[0]).toBe('Name')
    expect(CSV_HEADER[22]).toBe('Source')
    const f = { ...graph.founders[0], role: 'Co-founder; "CTO" until Dec 2025', schools: ['A, B'] }
    const text = csv([f])
    const lines = text.split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[0].split('","')).toHaveLength(23)
    expect(lines[1]).toContain('"Co-founder; ""CTO"" until Dec 2025"')
    expect(lines[1]).toContain('"A, B"')
    expect(csvRow(f)).toHaveLength(23)
    expect(csvRow(f)[9]).toBe(f.badges.includes('prior_open_source') ? 'yes' : 'no')
    expect(csv(graph.founders).split('\r\n')).toHaveLength(graph.founders.length + 1)
    expect(text).not.toContain('undefined')
  })
  it('tableHTML: aria-sort only on the sorted header, clickable rows with a name button, selected row, empty state', () => {
    const t = el(tableHTML(graph.founders, 'f:dan-lorenc', { key: 'company', dir: -1 }))
    expect(t.querySelectorAll('th button[data-sort]')).toHaveLength(13)
    expect(t.querySelectorAll('th[aria-sort]')).toHaveLength(1)
    expect(t.querySelector('th[aria-sort="descending"] button')?.getAttribute('data-sort')).toBe('company')
    expect(t.querySelectorAll('tbody tr.row[data-select][data-toggle]')).toHaveLength(graph.founders.length)
    expect(t.querySelectorAll('tbody tr[tabindex]')).toHaveLength(0)
    expect(t.querySelectorAll('tbody button.rowbtn[data-row]')).toHaveLength(graph.founders.length)
    const sel = t.querySelector('tr.is-selected')!
    expect(sel.getAttribute('data-select')).toBe('f:dan-lorenc')
    expect(sel.getAttribute('aria-current')).toBe('true')
    expect(sel.querySelector('.rowbtn')?.getAttribute('aria-pressed')).toBe('true')
    expect(sel.querySelector('.rowbtn')?.textContent).toBe('Dan Lorenc')
    expect(t.querySelectorAll('tr[aria-current]')).toHaveLength(1)
    expect(t.querySelectorAll('.rowbtn[aria-pressed="false"]')).toHaveLength(graph.founders.length - 1)
    expect(sel.querySelector('td a')?.getAttribute('rel')).toBe('noopener')
    expect(sel.querySelector('.status')?.className).toContain('status--active')
    expect(el(tableHTML([], null, { key: 'name', dir: 1 })).querySelector('.table__empty')?.textContent).toBe('No founders match these filters.')
    expect(countText(1, { key: 'name', dir: 1 })).toBe('1 founder · sorted by founder')
    expect(countText(54, { key: 'last', dir: 1 })).toBe('54 founders · sorted by company latest')
  })
  it('sorts the Source column by the hostname it displays, and compares with one accent-insensitive collator', () => {
    const bySrc = sortFounders(graph.founders, { key: 'src', dir: 1 }).map((f) => hostOf(f.source))
    const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })
    expect(bySrc).toEqual([...bySrc].sort(collator.compare))
    const mk = (name: string) => ({ ...graph.founders[0], name })
    expect(sortFounders([mk('Eric'), mk('eve'), mk('Émile')], { key: 'name', dir: 1 }).map((f) => f.name)).toEqual(['Émile', 'Eric', 'eve'])
  })
})
