const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** Escape a value for insertion into HTML text or attribute values. */
export const esc = (s: unknown): string => String(s).replace(/[&<>"']/g, (c) => ESC[c])

/** The 24x24 close (x) icon used by removable chips and the card close button. */
export const CROSS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>'
