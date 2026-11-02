import { esc } from '../html'
import { BADGE_LABEL, BADGE_ORDER, BIG_TECH, OSS_LABEL, STATUS_LABEL, type Graph } from '../model'
import { DEFAULT_LAYERS, type State } from '../state'
import type { Layers } from '../types'
import { activeFilterCount } from './match'

const LAYER_LABEL: Record<keyof Layers, string> = {
  companies: 'Companies',
  employers: 'Employers',
  schools: 'Schools',
  projects: 'Prior open source',
  oneOff: 'One-off ties',
  alt: 'Also-fits stubs',
}
const LAYER_ORDER: (keyof Layers)[] = ['companies', 'employers', 'schools', 'projects', 'oneOff', 'alt']

const chip = (attr: string, value: string, label: string, count: number | null, dot?: string, pressed = false): string =>
  `<button type="button" class="chip" ${attr}="${esc(value)}" aria-pressed="${pressed}"${dot ? ` style="--c: var(--path-${dot})"` : ''}>${dot ? '<span class="chip__dot"></span>' : ''}${esc(label)}${count === null ? '' : `<span class="chip__count num">${count}</span>`}</button>`

const group = (title: string, body: string): string => `<div class="drawer__group"><h3 class="drawer__title">${title}</h3>${body}</div>`

const select = (id: string, label: string, options: [string, string][]): string =>
  `<label class="select"><span>${label}</span><select id="${id}"><option value="">Any</option>${options.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select></label>`

/** The Filters drawer: path, badge, and big tech chips with counts, the four selects, and the map layer chips. */
export function drawerHTML(graph: Graph): string {
  const paths = graph.clusters.map((c) => chip('data-path', c.key, c.name, c.founders.length, c.key)).join('')
  const badges = BADGE_ORDER.map((b) => chip('data-badge', b, BADGE_LABEL[b], graph.founders.filter((f) => f.badges.includes(b)).length)).join('')
  const employers = BIG_TECH.map((e) => chip('data-employer', e, e, graph.founders.filter((f) => f.bigTech.includes(e)).length)).join('')
  const schools = graph.hubs
    .filter((h) => h.htype === 's')
    .sort((a, b) => b.degree - a.degree || a.name.localeCompare(b.name))
    .map((h): [string, string] => [h.name, `${h.name} (${h.degree})`])
  const verticals = [...new Set(graph.companies.map((c) => c.vertical))].map((v): [string, string] => [v, `${v} (${graph.founders.filter((f) => f.company.vertical === v).length})`])
  const statuses = (Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((k): [string, string] => [k, STATUS_LABEL[k]])
  const oss = (Object.keys(OSS_LABEL) as (keyof typeof OSS_LABEL)[]).map((k): [string, string] => [k, OSS_LABEL[k]])
  const more = select('sel-school', 'School', schools) + select('sel-vertical', 'Vertical', verticals) + select('sel-status', 'Status', statuses) + select('sel-oss', 'Open source', oss)
  const layers = LAYER_ORDER.map((k) => chip('data-layer', k, LAYER_LABEL[k], null, undefined, DEFAULT_LAYERS[k])).join('')
  return `<div class="drawer">${group('Path', paths)}${group('Badges', badges)}${group('Big tech employer', employers)}${group('More', more)}${group('Map layers', layers)}</div>`
}

const has = (set: ReadonlySet<string>, v: string): boolean => set.has(v)
const pressed = (root: ParentNode, selector: string, attr: string, on: (v: string) => boolean) => {
  for (const el of root.querySelectorAll<HTMLElement>(selector)) el.setAttribute('aria-pressed', String(on(el.getAttribute(attr) ?? '')))
}
const setValue = (root: ParentNode, id: string, v: string) => {
  const el = root.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)
  if (el && el.value !== v) el.value = v
}
const setHidden = (root: ParentNode, id: string, hidden: boolean) => {
  const el = root.querySelector<HTMLElement>(`#${id}`)
  if (el) el.hidden = hidden
}

/** Mirror the state into every toolbar, drawer, view, and tab control. */
export function syncControls(root: ParentNode, s: State): void {
  const f = s.filters
  pressed(root, '[data-path]', 'data-path', (v) => has(f.paths, v))
  pressed(root, '[data-cluster]', 'data-cluster', (v) => has(f.paths, v))
  pressed(root, '[data-badge]', 'data-badge', (v) => has(f.badges, v))
  pressed(root, '[data-employer]', 'data-employer', (v) => f.employers.has(v))
  pressed(root, '[data-layer]', 'data-layer', (v) => s.layers[v as keyof Layers])
  pressed(root, '[data-fund]', 'data-fund', (v) => v === f.fund)
  pressed(root, '[data-view]', 'data-view', (v) => v === s.view)
  setValue(root, 'sel-school', f.school)
  setValue(root, 'sel-vertical', f.vertical)
  setValue(root, 'sel-status', f.status)
  setValue(root, 'sel-oss', f.oss)
  setValue(root, 'map-search', f.q)
  const btn = root.querySelector<HTMLElement>('#filters-btn')
  if (btn) btn.setAttribute('aria-expanded', String(s.drawer))
  setHidden(root, 'filters-drawer', !s.drawer)
  const n = activeFilterCount(f)
  const count = root.querySelector<HTMLElement>('#filters-count')
  if (count) {
    count.textContent = n ? String(n) : ''
    count.hidden = n === 0
  }
  setHidden(root, 'map-card', s.view !== 'map')
  setHidden(root, 'table-card', s.view !== 'table')
  for (const t of root.querySelectorAll<HTMLElement>('[data-tab]')) {
    const on = t.getAttribute('data-tab') === s.tab
    t.setAttribute('aria-selected', String(on))
    t.setAttribute('tabindex', on ? '0' : '-1')
  }
  for (const k of ['clusters', 'insights', 'about']) setHidden(root, `tab-${k}`, k !== s.tab)
}
