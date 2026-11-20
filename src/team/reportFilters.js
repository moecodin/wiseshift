import { dateKey, fromKey } from '../lib/dates.js'
import { grossPay, periodHours } from './paycheck.js'
import { scheduleOnly } from './format.js'

// Shared by the Reports page and the Export pop-up, so the download matches what the page shows.

export const MAX_DAYS = 92

// The date keys from one date to another, both included (nothing if they're backwards; cut short after MAX_DAYS).
export function daysBetween(start, end) {
  if (!start || !end || end < start) return []
  const out = []
  const d = fromKey(start)
  for (let i = 0; i < MAX_DAYS; i++) {
    const key = dateKey(d)
    out.push(key)
    if (key >= end) break
    d.setDate(d.getDate() + 1)
  }
  return out
}

// What a report can be narrowed to. A department is 'all', a staff group ('g:Kitchen') or a position ('p:Cook').
export const DEFAULT_FILTERS = { dept: 'all', picked: null, groupBy: 'none', approvedOnly: false, staffNo: false, hoursOnly: false }

export function departments(data) {
  const people = data.employees.filter((e) => !scheduleOnly(e))
  const groups = (data.settings?.groups ?? []).map((g) => g.name).filter((name) => people.some((e) => e.group === name))
  const positions = [...new Set(people.map((e) => e.position).filter(Boolean))].sort()
  return { groups, positions }
}

export function inDept(e, dept) {
  if (!dept || dept === 'all') return true
  if (dept.startsWith('g:')) return e.group === dept.slice(2)
  if (dept.startsWith('p:')) return e.position === dept.slice(2)
  return true
}

export const deptLabel = (dept) => (!dept || dept === 'all' ? 'Everyone' : dept.slice(2))

// The heading a person goes under when grouping.
export function groupOf(e, by) {
  if (by === 'group') return e.group || 'No group'
  if (by === 'position') return e.position || 'No position'
  return ''
}

// One row per person who clocks in, narrowed by the filters, with their hours over the days.
// "Approved only" counts finished, approved punches and nothing else.
export function reportRows(data, days, now, filters = DEFAULT_FILTERS) {
  const { dept, picked, groupBy, approvedOnly } = { ...DEFAULT_FILTERS, ...filters }
  const punches = approvedOnly ? data.punches.filter((p) => p.clockOut && p.approvedAt) : data.punches
  const rows = data.employees
    .filter((e) => !scheduleOnly(e) && inDept(e, dept) && (!picked || picked.includes(e.id)))
    .map((e) => {
      const hours = periodHours(punches, e.id, days, now)
      const rate = data.payById[e.id]?.hourlyRate ?? 0
      return { e, hours, rate, gross: e.payType === 'hourly' ? grossPay(hours, rate).gross : null }
    })
    .filter((r) => r.e.active || r.hours.total > 0)
  return rows.sort((a, b) => groupOf(a.e, groupBy).localeCompare(groupOf(b.e, groupBy)) || a.e.name.localeCompare(b.e.name))
}

// The rows split under their headings ([{ name: '', rows }] when not grouping).
export function groupRows(rows, by) {
  if (!by || by === 'none') return [{ name: '', rows }]
  return [...new Set(rows.map((r) => groupOf(r.e, by)))].map((name) => ({ name, rows: rows.filter((r) => groupOf(r.e, by) === name) }))
}

// Unapproved finished punches among the rows (counted from all punches, so "Approved only" can say what it left out).
export function unapprovedCount(data, rows, days) {
  const ids = new Set(rows.map((r) => r.e.id))
  return data.punches.filter((p) => ids.has(p.employeeId) && p.clockOut && !p.approvedAt && days.includes(dateKey(new Date(p.clockIn)))).length
}

const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
// Saves rows as a CSV file. The leading mark makes Excel read names with accents correctly.
export function downloadCsv(fileName, rows) {
  const text = `\uFEFF${rows.map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
