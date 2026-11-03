import { describe, expect, it } from 'vitest'
import { graph, layout } from '../src/data'
import { PATH_ORDER, slug } from '../src/model'

describe('model', () => {
  it('totals come from the data', () => {
    expect(graph.founders).toHaveLength(81)
    expect(graph.companies).toHaveLength(36)
    expect(graph.all).toHaveLength(Object.keys(layout.nodes).length)
  })
  it('per-path counts by fund match section 5.1', () => {
    const want: Record<string, [number, number]> = {
      big_tech_engineer: [12, 16],
      young_builder: [7, 13],
      repeat_founder: [6, 17],
      business_operator: [1, 4],
      academic: [4, 1],
    }
    for (const c of graph.clusters) expect([c.counts.amplify, c.counts.haystack], c.key).toEqual(want[c.key])
    expect(graph.clusters.map((c) => c.key)).toEqual(PATH_ORDER)
  })
  it('hubs: shared employers show, one-off employers hide, projects always show', () => {
    const google = graph.byId.get('e:google')!
    expect(google.kind === 'hub' && google.degree >= 2 && !google.oneOff).toBe(true)
    expect((graph.byId.get('e:visual-sciences') as any).oneOff).toBe(true)
    expect((graph.byId.get('o:trusted-data-format') as any).oneOff).toBe(false)
    expect((graph.byId.get('s:uc-berkeley') as any).members.map((m: any) => m.id)).toContain('f:ion-stoica')
  })
  it('every node carries a finite position from layout.json', () => {
    for (const n of graph.all) expect(Number.isFinite(n.x) && Number.isFinite(n.y), n.id).toBe(true)
  })
  it('reads background from the data and derives the big tech employers', () => {
    const lorenc = graph.byId.get('f:dan-lorenc') as any
    expect(lorenc.bigTech).toEqual(['Microsoft', 'Google'])
    expect(lorenc.background).toEqual(['prior_open_source'])
    expect(lorenc).not.toHaveProperty('badges')
    expect(lorenc).not.toHaveProperty('storedBadges')
    expect((graph.byId.get('f:will-bryk') as any).bigTech).toEqual([])
  })
  it('links and neighbor sets', () => {
    const lorenc = graph.byId.get('f:dan-lorenc')!
    const ids = [...graph.neighbors.get(lorenc)!].map((n) => n.id).sort()
    expect(ids).toEqual(['c:chainguard', 'e:google', 'e:microsoft', 'o:distroless', 'o:kubernetes', 'o:sigstore', 'o:slsa', 'o:tekton', 's:mit'])
    const ties = graph.founders.reduce((n, f) => n + f.ties.length, 0)
    expect(graph.links).toHaveLength(graph.founders.length + ties)
  })
  it('search haystack is lowercase and covers every field group', () => {
    const h = (graph.byId.get('f:dan-lorenc') as any).haystack as string
    for (const s of ['dan lorenc', 'chainguard', 'security & observability', 'co-founder, ceo', 'big tech engineer', 'prior open source', 'sigstore', 'mit', 'still in founding role', 'amplify', 'partially open']) expect(h).toContain(s)
    expect(h).toBe(h.toLowerCase())
  })
  it('slug matches the ids in the data', () => {
    expect(slug('Søren Bramer Schmidt')).toBe('s-ren-bramer-schmidt')
    expect(slug('Univ. of Washington')).toBe('univ-of-washington')
    expect(slug('Émile Zola')).toBe('emile-zola')
    for (const f of graph.founders) expect(f.id).toBe('f:' + slug(f.name))
    for (const c of graph.companies) expect(c.id).toBe('c:' + slug(c.name))
  })
})
