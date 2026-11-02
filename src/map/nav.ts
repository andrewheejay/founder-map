export interface NavNode {
  id: string
  x: number
  y: number
}

const byX = <T extends NavNode>(a: T, b: T) => a.x - b.x || a.y - b.y || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
const byY = <T extends NavNode>(a: T, b: T) => a.y - b.y || a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * Roving focus on the map. Left/Right walk the nodes by x (ties by y, then id), Up/Down by y (ties by x,
 * then id); Home/End are the leftmost/rightmost. Clamped, no wrap. Null for any other key or when
 * `current` is not one of `nodes`.
 */
export function mapNavKey<T extends NavNode>(key: string, current: T, nodes: readonly T[]): T | null {
  if (!nodes.includes(current)) return null
  const step = (sorted: T[], delta: number) => sorted[Math.min(sorted.length - 1, Math.max(0, sorted.indexOf(current) + delta))]
  switch (key) {
    case 'ArrowRight':
      return step([...nodes].sort(byX), 1)
    case 'ArrowLeft':
      return step([...nodes].sort(byX), -1)
    case 'ArrowDown':
      return step([...nodes].sort(byY), 1)
    case 'ArrowUp':
      return step([...nodes].sort(byY), -1)
    case 'Home':
      return [...nodes].sort(byX)[0]
    case 'End':
      return [...nodes].sort(byX).at(-1) ?? null
    default:
      return null
  }
}
