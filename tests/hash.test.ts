import { describe, expect, it } from 'vitest'
import { graph } from '../src/data'
import { hashToId, idToHash } from '../src/hash'

const has = (id: string) => graph.byId.has(id)

describe('hash', () => {
  it('round-trips founder, company, and hub ids', () => {
    for (const id of ['f:dan-lorenc', 'c:temporal', 'e:google', 's:mit', 'o:kubernetes']) expect(hashToId('#' + idToHash(id), has)).toBe(id)
    expect(idToHash('f:dan-lorenc')).toBe('f-dan-lorenc')
  })
  it('rejects anything that names no node without throwing', () => {
    for (const h of ['', '#', '#x', '#f-', '#f-nobody', '#%E0', '#c-temporal-extra', '#f:dan-lorenc', '#-f-dan']) expect(hashToId(h, has)).toBeNull()
  })
})
