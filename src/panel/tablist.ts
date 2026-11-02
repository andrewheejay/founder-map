import type { AnyNode } from '../model'

/** Roving focus for a horizontal tab list: the index to move to, or null when the key is not a tab-list key. */
export function tablistKey(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % count
    case 'ArrowLeft':
      return (index - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

/** What the live region says when a node is pinned or the selection is cleared. */
export const announceText = (node: AnyNode | null): string => (node ? `${node.name} selected` : 'Selection cleared')
