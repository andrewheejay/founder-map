import { esc } from '../html'
import type { Chip } from './match'

const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>'

/** The active filters row: one removable chip per filter, the matched counts, and Clear all. Empty when nothing is active. */
export function activeRowHTML(chips: Chip[], founders: number, companies: number, totals: { founders: number; companies: number }): string {
  if (!chips.length) return ''
  const items = chips
    .map(
      (c) =>
        `<span class="achip"><span class="achip__cat">${esc(c.category)}</span>&nbsp;${esc(c.label)}<button type="button" data-remove="${esc(c.remove)}" aria-label="Remove filter ${esc(c.label)}">${CROSS}</button></span>`,
    )
    .join('')
  return `${items}<span class="active__count"><b>${founders}</b> of ${totals.founders} founders · <b>${companies}</b> of ${totals.companies} companies</span><button type="button" class="linkbtn" id="clear-filters">Clear all</button>`
}
