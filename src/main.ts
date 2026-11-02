import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/map.css'
import { graph } from './data'
import { createMap } from './map/map'
import { DEFAULT_STATE, createStore, escapeClears, hoverFocusAllowed, toggleSelect, type State } from './state'

function renderStats() {
  const shared = graph.hubs.filter((h) => !h.oneOff && h.htype !== 'o').length
  const projects = graph.hubs.filter((h) => h.htype === 'o').length
  const stats = document.getElementById('stats')
  if (stats) {
    stats.textContent = `${graph.founders.length} founders · ${graph.companies.length} companies · ${shared} shared employers & schools · ${projects} open source projects`
  }
}

function boot() {
  renderStats()
  const svg = document.getElementById('map') as SVGSVGElement | null
  if (!svg) return

  const store = createStore(DEFAULT_STATE)
  const clear = () => {
    const s = store.get()
    if (s.focus || s.pinned) store.set({ focus: null, pinned: false })
  }

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
      reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      fonts: document.fonts,
    },
  )

  const push = (s: State) =>
    map.update({
      focus: s.focus ? (graph.byId.get(s.focus) ?? null) : null,
      pinned: s.pinned,
      matched: new Set(graph.founders),
      layers: s.layers,
      filtersActive: false,
      pathFilter: new Set(),
    })
  store.subscribe(push)
  push(store.get())

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && escapeClears(document.activeElement?.tagName)) clear()
  })
  document.getElementById('zoom-in')?.addEventListener('click', () => map.zoomIn())
  document.getElementById('zoom-out')?.addEventListener('click', () => map.zoomOut())
  document.getElementById('zoom-fit')?.addEventListener('click', () => map.fit())
}

boot()
