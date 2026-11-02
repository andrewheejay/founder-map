import type { BadgeKey, Filters, Layers, OssProduct, PathKey, SortKey, Tab, View } from './types'

export interface State {
  /** id of the hovered or selected node */
  focus: string | null
  /** true when the focus was clicked (sticky), false when it only follows the pointer */
  pinned: boolean
  layers: Layers
  filters: Filters
  view: View
  tab: Tab
  drawer: boolean
  sort: Sort
}

/** Table sort: the column key and direction (1 ascending, -1 descending). */
export interface Sort {
  key: SortKey
  dir: 1 | -1
}

export const DEFAULT_SORT: Sort = { key: 'name', dir: 1 }

export const DEFAULT_LAYERS: Layers = { companies: true, employers: true, schools: true, projects: true, oneOff: false, alt: true }

export const DEFAULT_FILTERS: Filters = {
  fund: 'all',
  q: '',
  paths: new Set(),
  badges: new Set(),
  employers: new Set(),
  school: '',
  vertical: '',
  status: '',
  oss: '',
}

export const DEFAULT_STATE: State = { focus: null, pinned: false, layers: DEFAULT_LAYERS, filters: DEFAULT_FILTERS, view: 'map', tab: 'clusters', drawer: false, sort: DEFAULT_SORT }

export interface Store {
  get(): State
  set(patch: Partial<State>): void
  subscribe(fn: (s: State) => void): () => void
}

export function createStore(initial: State): Store {
  let state = initial
  const subscribers = new Set<(s: State) => void>()
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch }
      for (const fn of subscribers) fn(state)
    },
    subscribe(fn) {
      subscribers.add(fn)
      return () => {
        subscribers.delete(fn)
      }
    },
  }
}

/** Hover follows the mouse only: touch taps select instead, and a pinned node keeps its focus. */
export const hoverFocusAllowed = (pointerType: string | undefined, pinned: boolean): boolean => pointerType !== 'touch' && !pinned

const TYPING_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA'])

/** Esc clears the selection unless the user is typing in a form control. */
export const escapeClears = (activeTag: string | undefined): boolean => !activeTag || !TYPING_TAGS.has(activeTag)

/** Click pins a node; clicking the pinned node again clears it. */
export const toggleSelect = (s: State, id: string): Partial<State> => (s.pinned && s.focus === id ? { focus: null, pinned: false } : { focus: id, pinned: true })

/* ---------- filter reducers (pure) ---------- */

function toggled<T>(set: ReadonlySet<T>, v: T): Set<T> {
  const next = new Set(set)
  if (next.has(v)) next.delete(v)
  else next.add(v)
  return next
}

export const togglePath = (f: Filters, k: PathKey): Filters => ({ ...f, paths: toggled(f.paths, k) })
export const toggleBadge = (f: Filters, k: BadgeKey): Filters => ({ ...f, badges: toggled(f.badges, k) })
export const toggleEmployer = (f: Filters, name: string): Filters => ({ ...f, employers: toggled(f.employers, name) })

/** A "Badges by path" segment: selects exactly that badge and path, or clears both when already exactly selected. */
export function toggleBadgePath(f: Filters, badge: BadgeKey, path: PathKey): Filters {
  const on = f.badges.has(badge) && f.paths.size === 1 && f.paths.has(path)
  return { ...f, badges: new Set(on ? [] : [badge]), paths: new Set(on ? [] : [path]) }
}

export const toggleOss = (f: Filters, v: OssProduct): Filters => ({ ...f, oss: f.oss === v ? '' : v })

/** Remove one active filter by its chip key (see the data-remove contract). */
export function removeFilter(f: Filters, key: string): Filters {
  const i = key.indexOf(':')
  const kind = i < 0 ? key : key.slice(0, i)
  const value = i < 0 ? '' : key.slice(i + 1)
  switch (kind) {
    case 'fund':
      return { ...f, fund: 'all' }
    case 'q':
      return { ...f, q: '' }
    case 'path':
      return { ...f, paths: new Set([...f.paths].filter((p) => p !== value)) }
    case 'badge':
      return { ...f, badges: new Set([...f.badges].filter((b) => b !== value)) }
    case 'employer':
      return { ...f, employers: new Set([...f.employers].filter((e) => e !== value)) }
    case 'school':
      return { ...f, school: '' }
    case 'vertical':
      return { ...f, vertical: '' }
    case 'status':
      return { ...f, status: '' }
    case 'oss':
      return { ...f, oss: '' }
    default:
      return f
  }
}

export const clearFilters = (): Filters => DEFAULT_FILTERS

/** Clicking the active column header flips the direction; any other header sorts ascending by it. */
export const toggleSort = (s: Sort, key: SortKey): Sort => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 })
