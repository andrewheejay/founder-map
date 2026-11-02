import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import { graph } from './data'

const shared = graph.hubs.filter((h) => !h.oneOff && h.htype !== 'o').length
const projects = graph.hubs.filter((h) => h.htype === 'o').length
const stats = document.getElementById('stats')
if (stats) {
  stats.textContent = `${graph.founders.length} founders · ${graph.companies.length} companies · ${shared} shared employers & schools · ${projects} open source projects`
}
