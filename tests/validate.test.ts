import { describe, expect, it } from 'vitest'
import { validateData } from '../scripts/validate'
import { companies, founders, layout } from '../src/data'

const clone = () => structuredClone({ f: founders as any[], c: companies as any[], l: layout as any })

describe('validateData', () => {
  it('accepts the shipped data', () => expect(validateData(founders, companies, layout)).toEqual([]))
  it('rejects non-array input without throwing', () => expect(validateData('x', [], {}).length).toBeGreaterThan(0))
  it('duplicate id', () => {
    const d = clone()
    d.f.push({ ...d.f[0] })
    expect(validateData(d.f, d.c, d.l).join()).toMatch(/duplicate id f:will-wilson/)
  })
  it('unknown company', () => {
    const d = clone()
    d.f[0].company = 'Nope'
    expect(validateData(d.f, d.c, d.l).join()).toMatch(/f:will-wilson.*Nope/)
  })
  it('accepts the Digital Biology vertical', () => {
    const d = clone()
    d.c[0].vertical = 'Digital Biology'
    expect(validateData(d.f, d.c, d.l)).toEqual([])
  })
  it('bad path enum', () => {
    const d = clone()
    d.f[0].path = 'hacker'
    expect(validateData(d.f, d.c, d.l).join()).toMatch(/f:will-wilson.*path/)
  })
  it('unknown background value', () => {
    const d = clone()
    d.f[0].background = ['big_tech_alum']
    expect(validateData(d.f, d.c, d.l).join()).toMatch(/f:will-wilson: background "big_tech_alum" is not one of/)
  })
  it('background must be an array (the old badges key is rejected)', () => {
    const d = clone()
    d.f[0].badges = d.f[0].background
    delete d.f[0].background
    expect(validateData(d.f, d.c, d.l).join()).toMatch(/f:will-wilson: background must be an array/)
  })
  it('empty bio and source', () => {
    const d = clone()
    d.f[0].bio = ''
    d.f[1].source = ''
    const e = validateData(d.f, d.c, d.l).join()
    expect(e).toMatch(/f:will-wilson.*bio/)
    expect(e).toMatch(/f:dave-scherer.*source/)
  })
  it('missing layout entry', () => {
    const d = clone()
    delete d.l.nodes['e:google']
    expect(validateData(d.f, d.c, d.l).join()).toMatch(/e:google/)
  })
  it('stale layout entry', () => {
    const d = clone()
    d.l.nodes['e:ghost'] = { x: 1, y: 1 }
    expect(validateData(d.f, d.c, d.l).join()).toMatch(/e:ghost/)
  })
  it('id must equal the slug of the name', () => {
    const d = clone()
    d.c[0].id = 'c:wrong'
    expect(validateData(d.f, d.c, d.l).join()).toMatch(/c:wrong/)
  })
  it('a hub listed twice for one founder', () => {
    const d = clone()
    d.f[0].employers.push(d.f[0].employers[0])
    expect(validateData(d.f, d.c, d.l).join()).toMatch(/f:will-wilson: employers lists ".+" twice/)
  })
  it('secondaryPath equal to path', () => {
    const d = clone()
    d.f[0].secondaryPath = d.f[0].path
    expect(validateData(d.f, d.c, d.l).join()).toMatch(/f:will-wilson: secondaryPath equals path/)
  })
})
