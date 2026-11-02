import type { Layers } from './types'

export interface State {
  /** id of the hovered or selected node */
  focus: string | null
  /** true when the focus was clicked (sticky), false when it only follows the pointer */
  pinned: boolean
  layers: Layers
}

export const DEFAULT_LAYERS: Layers = { companies: true, employers: true, schools: true, projects: true, oneOff: false, alt: true }

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
