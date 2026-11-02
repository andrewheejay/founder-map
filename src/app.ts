import { graph } from './data'
import { activeRowHTML } from './filters/active'
import { drawerHTML, syncControls } from './filters/drawer'
import { activeChips, activeFilterCount, matchedCompanies, matchedFounders } from './filters/match'
import { hashToId, idToHash } from './hash'
import { createMap } from './map/map'
import { detailHTML } from './panel/card'
import { announceText, tablistKey } from './panel/tablist'
import { badgeRowsHTML, clustersHTML, insightsHTML } from './panel/tabs'
import { copyText, downloadText, toast } from './table/clipboard'
import { countText, csv, sortFounders, tableHTML } from './table/table'
import {
  DEFAULT_STATE,
  clearFilters,
  createStore,
  escapeClears,
  hoverFocusAllowed,
  removeFilter,
  toggleBadge,
  toggleBadgePath,
  toggleEmployer,
  toggleOss,
  togglePath,
  toggleSelect,
  toggleSort,
  type State,
} from './state'
import type { BadgeKey, Fund, Layers, OssProduct, PathKey, SortKey, Tab, View } from './types'

function renderStats(doc: Document) {
  const shared = graph.hubs.filter((h) => !h.oneOff && h.htype !== 'o').length
  const projects = graph.hubs.filter((h) => h.htype === 'o').length
  const stats = doc.getElementById('stats')
  if (stats) stats.textContent = `${graph.founders.length} founders · ${graph.companies.length} companies · ${shared} shared employers & schools · ${projects} open source projects`
}

const FOCUS_KEYS = ['data-select', 'data-remove', 'data-close', 'data-cluster', 'data-bp', 'data-oss', 'data-employer', 'data-path', 'data-badge', 'data-sort']
const FOCUSABLE = 'button:not([disabled]), a[href], input, select, [tabindex]:not([tabindex="-1"])'

/** The attribute selector that identifies a control across re-renders, or null when it carries no data key. */
function focusKey(el: Element): string | null {
  for (const k of FOCUS_KEYS) {
    const v = el.getAttribute(k)
    if (v !== null) return `[${k}="${v.replace(/["\\]/g, '\\$&')}"]`
  }
  return null
}

/**
 * Swap an element's HTML only when it changed, so focus and scroll position survive unrelated updates.
 * When keyboard focus was inside, put it back on the same control in the new markup, else on the first
 * control, else on the fallback, so a toggle or Clear all never drops focus to the body.
 */
function swap(el: HTMLElement | null, html: string, cache: Map<HTMLElement, string>, fallback: HTMLElement | null = null) {
  if (!el || cache.get(el) === html) return
  const doc = el.ownerDocument
  const active = doc.activeElement
  const key = active && active !== doc.body && el.contains(active) ? (focusKey(active) ?? '') : null
  el.innerHTML = html
  cache.set(el, html)
  if (key === null) return
  const next = (key && el.querySelector<HTMLElement>(key)) || (el.closest('[hidden]') ? null : el.querySelector<HTMLElement>(FOCUSABLE)) || fallback
  next?.focus()
}

/** Boot the app against a document: store, map, renderers, and every event handler. */
export function boot(doc: Document): void {
  renderStats(doc)
  const svg = doc.getElementById('map') as SVGSVGElement | null
  if (!svg) return
  const win = doc.defaultView ?? (typeof window !== 'undefined' ? window : null)
  const store = createStore(DEFAULT_STATE)
  const setFilters = (next: (f: State['filters']) => State['filters']) => store.set({ filters: next(store.get().filters) })
  const clear = () => {
    const s = store.get()
    if (s.focus || s.pinned) store.set({ focus: null, pinned: false })
  }

  const reduceMotion = win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const phone = win?.matchMedia?.('(max-width: 640px)')
  const narrow = win?.matchMedia?.('(max-width: 980px)')
  const map = createMap(
    svg,
    graph,
    {
      onHover(id, pointerType) {
        const s = store.get()
        if (!hoverFocusAllowed(pointerType, s.pinned)) return
        if (s.focus !== id) store.set({ focus: id })
      },
      onToggle(id) {
        store.set(toggleSelect(store.get(), id))
      },
      onCanvasClick: clear,
    },
    {
      reduceMotion,
      fonts: doc.fonts,
    },
  )

  const drawer = doc.getElementById('filters-drawer')
  if (drawer) drawer.innerHTML = drawerHTML(graph)
  const insights = doc.getElementById('insights-list')
  if (insights) insights.innerHTML = insightsHTML(graph)

  const cache = new Map<HTMLElement, string>()
  const totals = { founders: graph.founders.length, companies: graph.companies.length }
  let lastView: View = store.get().view
  const push = (s: State) => {
    const matched = matchedFounders(graph, s.filters)
    const active = activeFilterCount(s.filters) > 0
    const focusNode = s.focus ? (graph.byId.get(s.focus) ?? null) : null
    map.update({ focus: focusNode, pinned: s.pinned, matched, layers: s.layers, filtersActive: active, pathFilter: s.filters.paths })
    swap(doc.getElementById('detail'), detailHTML(focusNode, s, graph, matched), cache)
    const row = doc.getElementById('active-row')
    if (row) row.hidden = !active
    swap(row, activeRowHTML(activeChips(s.filters), matched.size, matchedCompanies(graph, matched).length, totals), cache, doc.getElementById('filters-btn'))
    swap(doc.getElementById('clusters-list'), clustersHTML(graph, matched, active, s.filters), cache)
    swap(doc.getElementById('badge-rows'), badgeRowsHTML(graph, s.filters), cache)
    const rows = sortFounders([...matched], s.sort)
    swap(doc.getElementById('founder-table'), tableHTML(rows, s.pinned ? s.focus : null, s.sort), cache)
    const count = doc.getElementById('table-count')
    if (count) count.textContent = countText(rows.length, s.sort)
    syncControls(doc, s)
    if (s.view === 'map' && lastView !== 'map') map.relayout()
    lastView = s.view
  }
  const hasNode = (id: string) => graph.byId.has(id)
  const fromHash = hashToId(win?.location.hash ?? '', hasNode)
  if (fromHash) store.set({ focus: fromHash, pinned: true })

  // Mirror the pinned selection in the hash and the live region; hover never touches either.
  let lastPinned: string | null = null
  const onPinChange = (s: State) => {
    const id = s.pinned ? s.focus : null
    if (id === lastPinned) return
    lastPinned = id
    const announce = doc.getElementById('announce')
    if (announce) announce.textContent = announceText(id ? (graph.byId.get(id) ?? null) : null)
    if (id) {
      // Phone: zoom the map to the selection; narrow screens: bring the card (below the map) into view.
      if (phone?.matches) map.zoomTo(id)
      const detail = doc.getElementById('detail')
      if (narrow?.matches && typeof detail?.scrollIntoView === 'function') detail.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' })
    }
    if (!win) return
    if (id) {
      const h = '#' + idToHash(id)
      if (win.location.hash !== h) win.location.hash = h
    } else if (win.location.hash) win.history.replaceState(null, '', win.location.pathname + win.location.search)
  }
  store.subscribe(push)
  store.subscribe(onPinChange)
  push(store.get())
  onPinChange(store.get())
  win?.addEventListener('hashchange', () => {
    const id = hashToId(win.location.hash, hasNode)
    const s = store.get()
    if (id) {
      if (s.focus !== id || !s.pinned) store.set({ focus: id, pinned: true })
    } else if (s.pinned) store.set({ focus: null, pinned: false })
  })

  const sortedRows = () => {
    const s = store.get()
    return sortFounders([...matchedFounders(graph, s.filters)], s.sort)
  }
  const toastEl = doc.getElementById('toast')
  const say = (message: string) => {
    if (toastEl) toast(toastEl, message)
  }

  doc.addEventListener('click', (ev) => {
    const t = ev.target as Element | null
    if (!t) return
    const hit = (sel: string) => t.closest<HTMLElement>(sel)
    const data = (el: HTMLElement, name: string) => el.getAttribute(name) ?? ''
    let el: HTMLElement | null
    if (hit('a[href]')) return
    if (hit('[data-close]')) return clear()
    if ((el = hit('[data-sort]'))) return store.set({ sort: toggleSort(store.get().sort, data(el, 'data-sort') as SortKey) })
    if (hit('#csv-copy')) {
      const rows = sortedRows()
      const box = doc.getElementById('csv-box') as HTMLTextAreaElement | null
      if (!box) return
      void copyText(csv(rows), win?.navigator.clipboard, box).then((r) =>
        say(r === 'copied' ? `Copied ${rows.length} row${rows.length === 1 ? '' : 's'} as CSV` : 'Select the text and copy it manually'),
      )
      return
    }
    if (hit('#csv-download')) {
      downloadText(doc, 'founder-map.csv', csv(sortedRows()))
      return say('Downloaded founder-map.csv')
    }
    if ((el = hit('[data-select]'))) return store.set({ focus: data(el, 'data-select'), pinned: true })
    if ((el = hit('[data-remove]'))) return setFilters((f) => removeFilter(f, data(el!, 'data-remove')))
    if ((el = hit('[data-cluster]'))) return setFilters((f) => togglePath(f, data(el!, 'data-cluster') as PathKey))
    if ((el = hit('[data-path]'))) return setFilters((f) => togglePath(f, data(el!, 'data-path') as PathKey))
    if ((el = hit('[data-badge]'))) return setFilters((f) => toggleBadge(f, data(el!, 'data-badge') as BadgeKey))
    if ((el = hit('[data-employer]'))) return setFilters((f) => toggleEmployer(f, data(el!, 'data-employer')))
    if ((el = hit('[data-bp]'))) {
      const [badge, path] = data(el, 'data-bp').split(':')
      return setFilters((f) => toggleBadgePath(f, badge as BadgeKey, path as PathKey))
    }
    if ((el = hit('[data-oss]'))) return setFilters((f) => toggleOss(f, data(el!, 'data-oss') as OssProduct))
    if ((el = hit('[data-layer]'))) {
      const key = data(el, 'data-layer') as keyof Layers
      const layers = store.get().layers
      return store.set({ layers: { ...layers, [key]: !layers[key] } })
    }
    if ((el = hit('[data-fund]'))) return setFilters((f) => ({ ...f, fund: data(el!, 'data-fund') as Fund | 'all' }))
    if ((el = hit('[data-view]'))) return store.set({ view: data(el, 'data-view') as View })
    if ((el = hit('[data-tab]'))) return store.set({ tab: data(el, 'data-tab') as Tab })
    if (hit('#filters-btn')) return store.set({ drawer: !store.get().drawer })
    if (hit('#clear-filters')) return store.set({ filters: clearFilters() })
  })

  doc.getElementById('map-search')?.addEventListener('input', (ev) => setFilters((f) => ({ ...f, q: (ev.target as HTMLInputElement).value })))
  const onSelect = (id: string, apply: (f: State['filters'], v: string) => State['filters']) =>
    doc.getElementById(id)?.addEventListener('change', (ev) => setFilters((f) => apply(f, (ev.target as HTMLSelectElement).value)))
  onSelect('sel-school', (f, v) => ({ ...f, school: v }))
  onSelect('sel-vertical', (f, v) => ({ ...f, vertical: v }))
  onSelect('sel-status', (f, v) => ({ ...f, status: v as State['filters']['status'] }))
  onSelect('sel-oss', (f, v) => ({ ...f, oss: v as State['filters']['oss'] }))

  doc.addEventListener('keydown', (ev) => {
    const target = ev.target as Element | null
    const tab = target?.closest?.<HTMLElement>('#tabs [role="tab"][data-tab]')
    if (tab) {
      const tabs = [...doc.querySelectorAll<HTMLElement>('#tabs [role="tab"]')]
      const next = tablistKey(ev.key, tabs.indexOf(tab), tabs.length)
      if (next !== null) {
        ev.preventDefault()
        tabs[next].focus()
        return store.set({ tab: tabs[next].getAttribute('data-tab') as Tab })
      }
    }
    const row = target?.closest?.<HTMLElement>('tr.row[data-select]')
    if (row && (ev.key === 'Enter' || ev.key === ' ')) {
      ev.preventDefault()
      return store.set({ focus: row.getAttribute('data-select'), pinned: true })
    }
    if (ev.key !== 'Escape') return
    const box = doc.getElementById('csv-box') as HTMLTextAreaElement | null
    if (box && !box.hidden && doc.activeElement === box) {
      box.hidden = true
      doc.getElementById('csv-copy')?.focus()
      return
    }
    if (escapeClears(doc.activeElement?.tagName)) clear()
  })
  doc.getElementById('zoom-in')?.addEventListener('click', () => map.zoomIn())
  doc.getElementById('zoom-out')?.addEventListener('click', () => map.zoomOut())
  doc.getElementById('zoom-fit')?.addEventListener('click', () => map.fit())
}
