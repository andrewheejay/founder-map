import type { BackgroundKey, CompanyRecord, FounderRecord, FounderStatus, Fund, HubType, Layout, OssProduct, PathKey } from './types'

export const PATHS: Record<PathKey, { name: string; def: string }> = {
  big_tech_engineer: { name: 'Big tech engineer', def: 'Years building infrastructure inside a large tech company or agency.' },
  repeat_founder: { name: 'Repeat founder', def: 'A company they started before is their main credential.' },
  business_operator: { name: 'Business operator', def: 'Came from finance, consulting, policy, or investing.' },
  young_builder: { name: 'Young builder', def: 'Started within a few years of school or a first startup job.' },
  academic: { name: 'Academic', def: 'Came out of a PhD lab or a professorship.' },
}
export const PATH_ORDER: PathKey[] = ['big_tech_engineer', 'repeat_founder', 'business_operator', 'young_builder', 'academic']

export const BACKGROUND_LABEL: Record<BackgroundKey, string> = {
  prior_open_source: 'Prior open source',
  prior_exit: 'Prior exit',
  grad_degree: 'Grad degree',
}
export const BACKGROUND_ORDER: BackgroundKey[] = ['prior_open_source', 'prior_exit', 'grad_degree']
export const BIG_TECH: readonly string[] = ['Google', 'Facebook', 'Microsoft', 'Amazon', 'Apple', 'Twitter', 'Uber', 'Lyft', 'Palantir']
export const FUND_LABEL: Record<Fund, string> = { amplify: 'Amplify', haystack: 'Haystack' }
export const STATUS_LABEL: Record<FounderStatus, string> = { active: 'Still in founding role', role_changed: 'Role changed', left: 'Left the company' }
export const OSS_LABEL: Record<OssProduct, string> = { yes: 'Open source product', partial: 'Partially open', no: 'Closed product' }
export const HUB_TYPE_LABEL: Record<HubType, string> = { e: 'Employer', s: 'School', o: 'Prior open source project' }
export const REL_LABEL = { e: 'Worked at', s: 'Studied at', S: 'Taught at', o: 'Built or contributed to' } as const
export type Relation = (typeof REL_LABEL)[keyof typeof REL_LABEL]

/** lowercase, accents stripped, non-alphanumerics to "-" (same rule the ids in data/ were made with). */
export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface HubRef {
  id: string
  type: HubType
  name: string
  rel: Relation
}

/** The hub ids a founder record points at: employers (e:), schools and taughtAt (s:), prior open source (o:). */
export function hubRefs(f: FounderRecord): HubRef[] {
  const refs: HubRef[] = []
  for (const n of f.employers) refs.push({ id: 'e:' + slug(n), type: 'e', name: n, rel: REL_LABEL.e })
  for (const n of f.schools) refs.push({ id: 's:' + slug(n), type: 's', name: n, rel: REL_LABEL.s })
  for (const n of f.taughtAt) refs.push({ id: 's:' + slug(n), type: 's', name: n, rel: REL_LABEL.S })
  for (const n of f.priorOpenSource) refs.push({ id: 'o:' + slug(n), type: 'o', name: n, rel: REL_LABEL.o })
  return refs
}

export interface CompanyNode {
  kind: 'company'
  id: string
  name: string
  fund: Fund
  vertical: string
  founded: number
  avgFounderAgeAtFounding: number | null
  openSourceProduct: OssProduct
  status: string
  latest: string
  description: string
  members: FounderNode[]
  x: number
  y: number
}

export interface HubNode {
  kind: 'hub'
  id: string
  htype: HubType
  name: string
  members: FounderNode[]
  degree: number
  oneOff: boolean
  x: number
  y: number
}

export interface Tie {
  hub: HubNode
  rel: Relation
}

export interface FounderNode {
  kind: 'founder'
  id: string
  name: string
  shortLabel: string
  company: CompanyNode
  fund: Fund
  path: PathKey
  secondaryPath: PathKey | null
  role: string
  status: FounderStatus
  statusNote: string | null
  background: BackgroundKey[]
  employers: string[]
  schools: string[]
  taughtAt: string[]
  priorOpenSource: string[]
  bigTech: string[]
  ties: Tie[]
  edgeCase: boolean
  bio: string
  source: string
  haystack: string
  x: number
  y: number
}

export type AnyNode = FounderNode | CompanyNode | HubNode

export interface Link {
  source: FounderNode
  target: CompanyNode | HubNode
  kind: 'co' | HubType
}

export interface Cluster {
  key: PathKey
  name: string
  def: string
  founders: FounderNode[]
  counts: { amplify: number; haystack: number }
}

export interface Graph {
  W: number
  H: number
  founders: FounderNode[]
  companies: CompanyNode[]
  hubs: HubNode[]
  links: Link[]
  /** hubs, then companies, then founders (draw order: founders on top) */
  all: AnyNode[]
  byId: Map<string, AnyNode>
  neighbors: Map<AnyNode, Set<AnyNode>>
  clusters: Cluster[]
}

export function buildGraph(founders: FounderRecord[], companies: CompanyRecord[], layout: Layout): Graph {
  const pos = (id: string) => {
    const p = layout.nodes[id]
    if (!p) throw new Error(`no layout position for ${id}`)
    return { x: p.x, y: p.y }
  }

  const companyNodes: CompanyNode[] = companies.map((c) => ({ kind: 'company', ...c, members: [], ...pos(c.id) }))
  const companyByName = new Map(companyNodes.map((c) => [c.name, c]))
  const hubMap = new Map<string, HubNode>()

  const founderNodes: FounderNode[] = founders.map((f) => {
    const company = companyByName.get(f.company)
    if (!company) throw new Error(`${f.id}: unknown company "${f.company}"`)
    const ties: Tie[] = hubRefs(f).map((ref) => {
      let hub = hubMap.get(ref.id)
      if (!hub) {
        hub = { kind: 'hub', id: ref.id, htype: ref.type, name: ref.name, members: [], degree: 0, oneOff: false, ...pos(ref.id) }
        hubMap.set(ref.id, hub)
      }
      return { hub, rel: ref.rel }
    })
    const bigTech = f.employers.filter((e) => BIG_TECH.includes(e))
    const node: FounderNode = {
      kind: 'founder',
      id: f.id,
      name: f.name,
      shortLabel: f.shortLabel,
      company,
      fund: company.fund,
      path: f.path,
      secondaryPath: f.secondaryPath,
      role: f.role,
      status: f.status,
      statusNote: f.statusNote,
      background: [...f.background],
      employers: [...f.employers],
      schools: [...f.schools],
      taughtAt: [...f.taughtAt],
      priorOpenSource: [...f.priorOpenSource],
      bigTech,
      ties,
      edgeCase: f.edgeCase,
      bio: f.bio,
      source: f.source,
      haystack: '',
      ...pos(f.id),
    }
    node.haystack = [
      node.name,
      company.name,
      company.vertical,
      node.role,
      PATHS[node.path].name,
      node.secondaryPath ? PATHS[node.secondaryPath].name : '',
      node.background.map((b) => BACKGROUND_LABEL[b]).join(' '),
      node.employers.join(' '),
      [...node.schools, ...node.taughtAt].join(' '),
      node.priorOpenSource.join(' '),
      node.bio,
      node.statusNote ?? '',
      STATUS_LABEL[node.status],
      FUND_LABEL[node.fund],
      OSS_LABEL[company.openSourceProduct],
    ]
      .join(' | ')
      .toLowerCase()
    company.members.push(node)
    for (const t of ties) if (!t.hub.members.includes(node)) t.hub.members.push(node)
    return node
  })

  const hubs = [...hubMap.values()]
  for (const h of hubs) {
    h.degree = h.members.length
    h.oneOff = h.htype !== 'o' && h.degree < 2
  }

  const links: Link[] = []
  for (const f of founderNodes) {
    links.push({ source: f, target: f.company, kind: 'co' })
    for (const t of f.ties) links.push({ source: f, target: t.hub, kind: t.hub.htype })
  }

  const all: AnyNode[] = [...hubs, ...companyNodes, ...founderNodes]
  const byId = new Map(all.map((n) => [n.id, n]))
  const neighbors = new Map<AnyNode, Set<AnyNode>>(all.map((n) => [n, new Set<AnyNode>()]))
  for (const l of links) {
    neighbors.get(l.source)!.add(l.target)
    neighbors.get(l.target)!.add(l.source)
  }

  const clusters: Cluster[] = PATH_ORDER.map((key) => {
    const fs = founderNodes.filter((f) => f.path === key)
    return {
      key,
      ...PATHS[key],
      founders: fs,
      counts: { amplify: fs.filter((f) => f.fund === 'amplify').length, haystack: fs.filter((f) => f.fund === 'haystack').length },
    }
  })

  const [, , W, H] = layout.viewBox
  return { W, H, founders: founderNodes, companies: companyNodes, hubs, links, all, byId, neighbors, clusters }
}
