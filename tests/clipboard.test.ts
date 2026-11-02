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
  it('downloadText is a no-op without createObjectURL', () => {
    expect(() => downloadText(document, 'x.csv', 'a')).not.toThrow()
  })
})
