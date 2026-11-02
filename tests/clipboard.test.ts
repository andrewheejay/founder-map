// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { copyText, downloadText, toast } from '../src/table/clipboard'

describe('clipboard', () => {
  it('copies through the clipboard API when it works', async () => {
    const box = document.createElement('textarea')
    box.hidden = true
    const writeText = vi.fn(() => Promise.resolve())
    expect(await copyText('a,b', { writeText }, box)).toBe('copied')
    expect(writeText).toHaveBeenCalledWith('a,b')
    expect(box.hidden).toBe(true)
  })
  it('falls back to a visible, selected textarea when the API is missing or rejects', async () => {
    const box = document.createElement('textarea')
    box.hidden = true
    document.body.append(box)
    expect(await copyText('a,b', undefined, box)).toBe('fallback')
    expect(box.hidden).toBe(false)
    expect(box.value).toBe('a,b')
    expect(document.activeElement).toBe(box)
    box.hidden = true
    expect(await copyText('x', { writeText: () => Promise.reject(new Error('denied')) }, box)).toBe('fallback')
    expect(box.hidden).toBe(false)
    expect(box.value).toBe('x')
  })
  it('toast shows then hides, replacing an earlier timer', () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    toast(el, 'one')
    toast(el, 'two')
    expect(el.textContent).toBe('two')
    expect(el.classList.contains('is-on')).toBe(true)
    vi.advanceTimersByTime(2300)
    expect(el.classList.contains('is-on')).toBe(false)
    vi.useRealTimers()
  })
  it('downloadText is a no-op when the window has no createObjectURL', () => {
    const doc = { defaultView: { URL: {} } } as unknown as Document
    expect(() => downloadText(doc, 'x.csv', 'a')).not.toThrow()
  })
  it('downloadText clicks a temporary download link and revokes the object URL', () => {
    const clicks: string[] = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(`${this.download}|${this.href}`)
    })
    const create = vi.fn(() => 'blob:fake')
    const revoke = vi.fn()
    Object.defineProperty(window.URL, 'createObjectURL', { value: create, configurable: true })
    Object.defineProperty(window.URL, 'revokeObjectURL', { value: revoke, configurable: true })
    downloadText(document, 'founder-map.csv', 'a,b')
    expect(clicks).toEqual(['founder-map.csv|blob:fake'])
    expect(create).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith('blob:fake')
    expect(document.querySelector('a[download]')).toBeNull()
    click.mockRestore()
  })
})
