export type Fund = 'amplify' | 'haystack'
export type PathKey = 'big_tech_engineer' | 'repeat_founder' | 'business_operator' | 'young_builder' | 'academic'
export type StoredBadge = 'prior_open_source' | 'prior_exit' | 'grad_degree'
export type BadgeKey = StoredBadge | 'big_tech_alum'
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
  badges: StoredBadge[]
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
