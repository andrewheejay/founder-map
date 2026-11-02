import companiesJson from '../data/companies.json'
import foundersJson from '../data/founders.json'
import layoutJson from '../data/layout.json'
import { buildGraph } from './model'
import type { CompanyRecord, FounderRecord, Layout } from './types'

export const founders = foundersJson as FounderRecord[]
export const companies = companiesJson as CompanyRecord[]
export const layout = layoutJson as Layout

/** The graph every view renders from. Built once at module load from the three JSON files. */
export const graph = buildGraph(founders, companies, layout)
