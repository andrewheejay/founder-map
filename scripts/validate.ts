import { readFileSync } from 'node:fs'
import { PATH_ORDER, hubRefs, slug } from '../src/model'
import type { CompanyRecord, FounderRecord } from '../src/types'

const FUNDS = ['amplify', 'haystack']
const VERTICALS = ['Developer Tools', 'AI & Cloud Infrastructure', 'Security & Observability', 'Data Infrastructure', 'Fintech Infrastructure']
const OSS = ['yes', 'partial', 'no']
const STATUSES = ['active', 'role_changed', 'left']
const STORED_BADGES = ['prior_open_source', 'prior_exit', 'grad_degree']
const VIEWBOX = [0, 0, 1100, 840]

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const isTextArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isText)
const list = (xs: readonly string[]) => xs.map((x) => `"${x}"`).join(', ')

/**
 * Schema and referential checks for the three data files.
 * Returns an empty array when everything is valid, otherwise one message per problem.
 */
export function validateData(founders: unknown, companies: unknown, layout: unknown): string[] {
  const errors: string[] = []
  const err = (m: string) => errors.push(m)

  if (!Array.isArray(founders)) err('founders.json must be an array')
  if (!Array.isArray(companies)) err('companies.json must be an array')
  if (!isRecord(layout) || !isRecord(layout.nodes)) err('layout.json must be an object with a "nodes" object')
  if (errors.length) return errors
  const foundersArr = founders as unknown[]
  const companiesArr = companies as unknown[]
  const layoutObj = layout as Record<string, unknown>
  const layoutNodes = layoutObj.nodes as Record<string, unknown>

  const seenIds = new Set<string>()
  const checkId = (id: unknown, prefix: string, name: unknown, label: string) => {
    if (!isText(id)) return err(`${label}: id is missing`)
    if (seenIds.has(id)) err(`duplicate id ${id}`)
    seenIds.add(id)
    if (isText(name) && id !== prefix + slug(name)) err(`${id}: id should be ${prefix + slug(name)} (slug of name)`)
  }
  const checkEnum = (id: string, field: string, value: unknown, allowed: readonly string[], nullable = false) => {
    if (nullable && value === null) return
    if (typeof value !== 'string' || !allowed.includes(value)) err(`${id}: ${field} ${JSON.stringify(value)} is not one of ${list(allowed)}${nullable ? ' or null' : ''}`)
  }
  const checkText = (id: string, field: string, value: unknown) => {
    if (!isText(value)) err(`${id}: ${field} is empty`)
  }

  const companyNames = new Set<string>()
  const companyRecords: CompanyRecord[] = []
  companiesArr.forEach((c, i) => {
    if (!isRecord(c)) return err(`companies[${i}] is not an object`)
    const id = isText(c.id) ? c.id : `companies[${i}]`
    checkId(c.id, 'c:', c.name, id)
    checkText(id, 'name', c.name)
    if (isText(c.name)) {
      if (companyNames.has(c.name)) err(`${id}: duplicate company name "${c.name}"`)
      companyNames.add(c.name)
    }
    checkEnum(id, 'fund', c.fund, FUNDS)
    checkEnum(id, 'vertical', c.vertical, VERTICALS)
    if (!Number.isInteger(c.founded)) err(`${id}: founded must be an integer year`)
    if (c.avgFounderAgeAtFounding !== null && typeof c.avgFounderAgeAtFounding !== 'number') err(`${id}: avgFounderAgeAtFounding must be a number or null`)
    checkEnum(id, 'openSourceProduct', c.openSourceProduct, OSS)
    checkText(id, 'status', c.status)
    checkText(id, 'latest', c.latest)
    checkText(id, 'description', c.description)
    companyRecords.push(c as unknown as CompanyRecord)
  })

  const hubIds = new Set<string>()
  foundersArr.forEach((f, i) => {
    if (!isRecord(f)) return err(`founders[${i}] is not an object`)
    const id = isText(f.id) ? f.id : `founders[${i}]`
    checkId(f.id, 'f:', f.name, id)
    checkText(id, 'name', f.name)
    checkText(id, 'shortLabel', f.shortLabel)
    if (!isText(f.company)) err(`${id}: company is empty`)
    else if (!companyNames.has(f.company)) err(`${id}: company "${f.company}" is not in companies.json`)
    checkEnum(id, 'path', f.path, PATH_ORDER)
    checkEnum(id, 'secondaryPath', f.secondaryPath, PATH_ORDER, true)
    checkText(id, 'role', f.role)
    checkEnum(id, 'status', f.status, STATUSES)
    if (f.statusNote !== null && typeof f.statusNote !== 'string') err(`${id}: statusNote must be a string or null`)
    if (!Array.isArray(f.badges)) err(`${id}: badges must be an array`)
    else
      for (const b of f.badges) {
        if (b === 'big_tech_alum') err(`${id}: badges contains "big_tech_alum", which is derived from employers and never stored`)
        else if (!STORED_BADGES.includes(b as string)) err(`${id}: badge ${JSON.stringify(b)} is not one of ${list(STORED_BADGES)}`)
      }
    for (const field of ['employers', 'schools', 'taughtAt', 'priorOpenSource']) if (!isTextArray(f[field])) err(`${id}: ${field} must be an array of non-empty strings`)
    if (typeof f.edgeCase !== 'boolean') err(`${id}: edgeCase must be true or false`)
    checkText(id, 'bio', f.bio)
    if (!isText(f.source) || !/^https?:\/\//.test(f.source)) err(`${id}: source must be an http(s) URL`)
    if (isTextArray(f.employers) && isTextArray(f.schools) && isTextArray(f.taughtAt) && isTextArray(f.priorOpenSource))
      for (const ref of hubRefs(f as unknown as FounderRecord)) hubIds.add(ref.id)
  })

  const vb = layoutObj.viewBox
  if (!Array.isArray(vb) || vb.length !== 4 || vb.some((v, i) => v !== VIEWBOX[i])) err(`layout.json viewBox must be [${VIEWBOX.join(', ')}]`)
  const dataIds = new Set<string>([...seenIds, ...hubIds])
  for (const id of dataIds) {
    const p = layoutNodes[id]
    if (!isRecord(p)) err(`layout.json has no position for ${id}`)
    else if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) err(`layout.json position for ${id} must have finite x and y`)
  }
  for (const id of Object.keys(layoutNodes)) if (!dataIds.has(id)) err(`layout.json has ${id}, which is not in the data (stale layout; re-run the layout script)`)

  return errors
}

function main() {
  const read = (file: string) => JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8'))
  const founders = read('founders.json')
  const companies = read('companies.json')
  const layout = read('layout.json')
  const errors = validateData(founders, companies, layout)
  if (errors.length) {
    for (const e of errors) console.error('  x ' + e)
    console.error(`\n${errors.length} data error${errors.length === 1 ? '' : 's'}`)
    process.exit(1)
  }
  const hubs = new Set((founders as FounderRecord[]).flatMap((f) => hubRefs(f).map((r) => r.id)))
  console.log(`data OK: ${founders.length} founders, ${companies.length} companies, ${hubs.size} hubs, ${Object.keys(layout.nodes).length} positioned nodes`)
}

if (process.argv[1] && /validate\.ts$/.test(process.argv[1])) main()
