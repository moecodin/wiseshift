import { decimalHours } from './paycheck.js'
import { scheduleOnly } from './format.js'
import { tr } from './i18n.js'

// The payroll CSV: one row per person for the dates picked, in the layout the business saved once
// (Settings → Business → Payroll export). Most payroll services (Gusto, QuickBooks, ADP, Paychex…) import this shape:
// who the person is, regular and overtime hours as decimals, and the pay period dates.

export const PAYROLL_COLUMNS = [
  { id: 'employeeId', label: 'Employee ID' },
  { id: 'fullName', label: 'Name' },
  { id: 'firstName', label: 'First name' },
  { id: 'lastName', label: 'Last name' },
  { id: 'regular', label: 'Regular Hours' },
  { id: 'overtime', label: 'Overtime Hours' },
  { id: 'total', label: 'Total Hours' },
  { id: 'periodStart', label: 'Period Start' },
  { id: 'periodEnd', label: 'Period End' },
  { id: 'department', label: 'Department' },
  { id: 'position', label: 'Position' },
  { id: 'rate', label: 'Hourly Rate' },
]
const ON_BY_DEFAULT = ['employeeId', 'fullName', 'regular', 'overtime', 'periodStart', 'periodEnd']

export const ID_SOURCES = [
  { id: 'payrollId', get label() { return tr('Payroll ID', 'ID de nómina') } },
  { id: 'staffNo', get label() { return tr('Staff no.', 'N.º de empleado') } },
  { id: 'email', get label() { return tr('Email', 'Correo') } },
  { id: 'name', get label() { return tr('Full name', 'Nombre completo') } },
]

// The saved layout filled in: every known column once, saved ones first in their saved order.
export function payrollLayout(saved) {
  const s = saved && typeof saved === 'object' ? saved : {}
  const kept = (Array.isArray(s.columns) ? s.columns : []).filter((c) => PAYROLL_COLUMNS.some((k) => k.id === c.id))
  const rest = PAYROLL_COLUMNS.filter((k) => !kept.some((c) => c.id === k.id)).map((k) => ({ id: k.id, on: !kept.length && ON_BY_DEFAULT.includes(k.id), label: k.label }))
  const columns = [...kept.map((c) => ({ id: c.id, on: Boolean(c.on), label: String(c.label || PAYROLL_COLUMNS.find((k) => k.id === c.id).label) })), ...rest]
  // Before anything is saved, the default columns come first in the usual order.
  if (!kept.length) columns.sort((a, b) => (ON_BY_DEFAULT.indexOf(a.id) + 1 || 99) - (ON_BY_DEFAULT.indexOf(b.id) + 1 || 99))
  return {
    idBy: ID_SOURCES.some((x) => x.id === s.idBy) ? s.idBy : 'payrollId',
    hours: s.hours === 'hm' ? 'hm' : 'decimal',
    dates: s.dates === 'iso' ? 'iso' : 'us',
    columns,
  }
}

const hm = (minutes) => `${Math.floor(minutes / 60)}:${String(Math.round(minutes % 60)).padStart(2, '0')}`
const usDate = (key) => { const [y, m, d] = key.split('-'); return `${m}/${d}/${y}` }

// Who the person is in the payroll file.
export function payrollIdOf(e, data, idBy) {
  if (idBy === 'staffNo') return e.staffNo ?? ''
  if (idBy === 'email') return e.email ?? ''
  if (idBy === 'name') return e.name
  return data.payById[e.id]?.payrollId ?? ''
}

// The header and one line per person. `rows` come from reportRows (so they follow the Reports filters).
export function payrollCsv(rows, days, data, layout) {
  const cols = layout.columns.filter((c) => c.on)
  const hours = (m) => (layout.hours === 'hm' ? hm(m) : decimalHours(m).toFixed(2))
  const date = (key) => (layout.dates === 'iso' ? key : usDate(key))
  const value = (c, r) => {
    const [first, ...rest] = r.e.name.trim().split(/\s+/)
    switch (c.id) {
      case 'employeeId': return payrollIdOf(r.e, data, layout.idBy)
      case 'fullName': return r.e.name
      case 'firstName': return first ?? ''
      case 'lastName': return rest.join(' ')
      case 'regular': return hours(r.hours.regular)
      case 'overtime': return hours(r.hours.overtime)
      case 'total': return hours(r.hours.total)
      case 'periodStart': return date(days[0])
      case 'periodEnd': return date(days.at(-1))
      case 'department': return r.e.group || ''
      case 'position': return r.e.position || ''
      case 'rate': return r.e.payType === 'hourly' ? (data.payById[r.e.id]?.hourlyRate ?? '') : ''
      default: return ''
    }
  }
  return [cols.map((c) => c.label), ...rows.filter((r) => !scheduleOnly(r.e)).map((r) => cols.map((c) => value(c, r)))]
}

// People in the file with no ID to match them by (only matters when the ID column is on).
export function missingIds(rows, data, layout) {
  if (!layout.columns.some((c) => c.id === 'employeeId' && c.on)) return []
  return rows.filter((r) => !String(payrollIdOf(r.e, data, layout.idBy) ?? '').trim()).map((r) => r.e.name)
}
