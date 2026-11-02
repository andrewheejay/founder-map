/** `f:dan-lorenc` ↔ `#f-dan-lorenc`: the selection lives in the URL hash so a view can be shared. */
export const idToHash = (id: string): string => id.replace(':', '-')

/** The node id a hash names, or null when it names nothing. Never throws; nothing is URL-decoded. */
export function hashToId(hash: string, has: (id: string) => boolean): string | null {
  const m = hash.replace(/^#/, '')
  if (m.length < 3 || m[1] !== '-' || !/^[fcseo]$/.test(m[0])) return null
  const id = m[0] + ':' + m.slice(2)
  return has(id) ? id : null
}
