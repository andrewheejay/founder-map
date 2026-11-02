export interface ClipboardLike {
  writeText(text: string): Promise<void>
}

/** Copy through the async clipboard API; when it is missing or refuses, show the text in a textarea, selected, for a manual copy. */
export async function copyText(text: string, clipboard: ClipboardLike | undefined, fallback: HTMLTextAreaElement): Promise<'copied' | 'fallback'> {
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text)
      return 'copied'
    } catch {
      /* fall through to the textarea */
    }
  }
  fallback.value = text
  fallback.hidden = false
  fallback.focus()
  fallback.select()
  return 'fallback'
}

const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>()

/** Show a short status message; a new message replaces the previous one and restarts its timer. */
export function toast(el: HTMLElement, message: string, ms = 2200): void {
  el.textContent = message
  el.classList.add('is-on')
  const prev = timers.get(el)
  if (prev !== undefined) clearTimeout(prev)
  timers.set(el, setTimeout(() => el.classList.remove('is-on'), ms))
}

/** Trigger a file download of `text`; a no-op where object URLs are unavailable (jsdom). */
export function downloadText(doc: Document, filename: string, text: string): void {
  const url = doc.defaultView?.URL
  if (!url || typeof url.createObjectURL !== 'function') return
  const href = url.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = doc.createElement('a')
  a.href = href
  a.download = filename
  doc.body.append(a)
  a.click()
  a.remove()
  url.revokeObjectURL(href)
}
