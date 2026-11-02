const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** Escape a value for insertion into HTML text or attribute values. */
export const esc = (s: unknown): string => String(s).replace(/[&<>"']/g, (c) => ESC[c])
