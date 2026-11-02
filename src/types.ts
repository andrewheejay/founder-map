export type Fund = 'amplify' | 'haystack'
export type PathKey = 'big_tech_engineer' | 'repeat_founder' | 'business_operator' | 'young_builder' | 'academic'
/** Background facts stored per founder; big tech employment is not one of them (filter by employer instead). */
export type BackgroundKey = 'prior_open_source' | 'prior_exit' | 'grad_degree'
export type FounderStatus = 'active' | 'role_changed' | 'left'
export type OssProduct = 'yes' | 'partial' | 'no'
export type HubType = 'e' | 's' | 'o'

/** One entry of data/companies.json. */
export interface CompanyRecord {
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
}

/** One entry of data/founders.json. */
export interface FounderRecord {
  id: string
  name: string
  shortLabel: string
  company: string
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
  edgeCase: boolean
  bio: string
  source: string
}

/** data/layout.json: static positions for every founder, company, and hub id. */
export interface Layout {
  viewBox: [number, number, number, number]
  note?: string
  nodes: Record<string, { x: number; y: number }>
}

/** Map layer toggles (the "Map layers" group of the filter drawer). */
export interface Layers {
  companies: boolean
  employers: boolean
  schools: boolean
  projects: boolean
  oneOff: boolean
  alt: boolean
}

export type View = 'map' | 'table'
export type Tab = 'clusters' | 'insights' | 'about'

/** Toolbar, drawer, and search state. Sets are treated as immutable: reducers return new sets. */
export interface Filters {
  fund: Fund | 'all'
  q: string
  paths: ReadonlySet<PathKey>
  background: ReadonlySet<BackgroundKey>
  employers: ReadonlySet<string>
  school: string
  vertical: string
  status: FounderStatus | ''
  oss: OssProduct | ''
}

/** Table sort keys, one per column of src/table/table.ts TABLE_COLUMNS. */
export type SortKey = 'name' | 'fund' | 'company' | 'path' | 'role' | 'status' | 'bigtech' | 'background' | 'schools' | 'projects' | 'ossp' | 'last' | 'src'
