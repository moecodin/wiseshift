import { dateKey } from '../lib/dates.js'
import { decimalHours, formatHours, punchMinutes, shiftMinutes } from './paycheck.js'
import { dayLabel, money, shiftTimes } from './format.js'
import { shiftFor } from './review.js'
import { useFeatures } from './features.js'
import PrintWeeks, { shortMinutes } from './PrintWeeks.jsx'
import { DEFAULT_FILTERS, downloadCsv, groupOf, groupRows, inDept, reportRows } from './reportFilters.js'

// The other Reports (managers): Scheduled hours, Scheduled vs worked, and By role. They use the same filter bar as the
// Timesheet. Only published shifts count as scheduled (drafts are still being worked on).

const sumOf = (list, fn) => list.reduce((sum, r) => sum + fn(r), 0)
const signed = (minutes) => `${minutes > 0 ? '+' : minutes < 0 ? '−' : ''}${formatHours(Math.abs(minutes))}`

// Everyone in the filters who has a schedule (schedule-only people included), with their published shifts in the days.
function scheduleRows(data, days, filters) {
  const { dept, picked, groupBy } = { ...DEFAULT_FILTERS, ...filters }
  const shifts = data.shifts.filter((s) => s.published && days.includes(s.date))
  return data.employees
    .filter((e) => inDept(e, dept) && (!picked || picked.includes(e.id)))
    .map((e) => {
      const mine = shifts.filter((s) => s.employeeId === e.id).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
      return { e, shifts: mine, minutes: sumOf(mine, shiftMinutes), byDay: days.map((d) => mine.filter((s) => s.date === d)) }
    })
    .filter((r) => r.e.active || r.shifts.length)
    .sort((a, b) => groupOf(a.e, groupBy).localeCompare(groupOf(b.e, groupBy)) || a.e.name.localeCompare(b.e.name))
}

function CsvButton({ name, rows }) {
  return <button type="button" className="btn btn-outline-secondary btn-sm desk-only" onClick={() => downloadCsv(name, rows)}>Download CSV</button>
}

// Hours scheduled: one line per person, each day's shifts, and the totals.
export function ScheduledReport({ data, days, filters }) {
  const { groupBy, staffNo, hoursOnly } = { ...DEFAULT_FILTERS, ...filters }
  const rows = scheduleRows(data, days, filters)
  const sections = groupRows(rows, groupBy)
  const span = 3 + (staffNo ? 1 : 0) + days.length
  const csv = [
    ['Employee', ...(staffNo ? ['Staff no.'] : []), 'Position', 'Shifts', 'Scheduled hours', ...days],
    ...rows.map((r) => [r.e.name, ...(staffNo ? [r.e.staffNo ?? ''] : []), r.e.position, r.shifts.length, decimalHours(r.minutes), ...r.byDay.map((list) => list.map(shiftTimes).join(' / '))]),
  ]
  return (
    <div className="rp-report">
      <div className="ts-print-head"><b>Hours scheduled</b><span>{dayLabel(days[0])} to {dayLabel(days.at(-1))}</span></div>
      <PrintWeeks days={days} sections={sections} staffNo={staffNo}
        day={(r, i) => ({ lines: hoursOnly ? [] : r.byDay[i].map((s) => `${shortMinutes(s.start)}–${shortMinutes(s.end)}`), minutes: sumOf(r.byDay[i], shiftMinutes) })} />
      <div className="rp-report-head"><p className="tm-muted mb-0">Published shifts only. {rows.length} {rows.length === 1 ? 'person' : 'people'} · {formatHours(sumOf(rows, (r) => r.minutes))} hrs scheduled</p><CsvButton name={`wiseshift-scheduled-${days[0]}-to-${days.at(-1)}.csv`} rows={csv} /></div>
      <div className="tm-gridwrap ts-table screen-only">
        <table className={`tm-sheet ${hoursOnly ? 'ts-hours-only' : ''}`}>
          <thead>
            <tr>
              <th scope="col">Name</th>
              {staffNo && <th scope="col">No.</th>}
              <th scope="col">Shifts</th>
              <th scope="col">Hours</th>
              {days.map((d) => <th key={d} scope="col">{dayLabel(d)}</th>)}
            </tr>
          </thead>
          {sections.map((sec) => (
            <tbody key={sec.name || 'all'}>
              {sec.name && <tr className="ts-group"><th scope="rowgroup" colSpan={span}>{sec.name} <small>{sec.rows.length} {sec.rows.length === 1 ? 'person' : 'people'}</small></th></tr>}
              {sec.rows.map((r) => (
                <tr key={r.e.id}>
                  <th scope="row">{r.e.name}</th>
                  {staffNo && <td className="ts-no">{r.e.staffNo ?? '—'}</td>}
                  <td>{r.shifts.length}</td>
                  <td><b>{formatHours(r.minutes)}</b></td>
                  {r.byDay.map((list, i) => (
                    <td key={days[i]} className="tm-cell">
                      {!hoursOnly && list.map((s) => <div key={s.id}>{shiftTimes(s)}</div>)}
                      {list.length > 0 && <b>{formatHours(sumOf(list, shiftMinutes))}</b>}
                    </td>
                  ))}
                </tr>
              ))}
              {sec.name && (
                <tr className="ts-subtotal">
                  <th scope="row">Subtotal</th>
                  {staffNo && <td />}
                  <td>{sumOf(sec.rows, (r) => r.shifts.length)}</td>
                  <td><b>{formatHours(sumOf(sec.rows, (r) => r.minutes))}</b></td>
                  {days.map((d, i) => <td key={d}>{formatHours(sumOf(sec.rows, (r) => sumOf(r.byDay[i], shiftMinutes)))}</td>)}
                </tr>
              )}
            </tbody>
          ))}
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {staffNo && <td />}
              <td>{sumOf(rows, (r) => r.shifts.length)}</td>
              <td><b>{formatHours(sumOf(rows, (r) => r.minutes))}</b></td>
              {days.map((d, i) => <td key={d}>{formatHours(sumOf(rows, (r) => sumOf(r.byDay[i], shiftMinutes)))}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
      {rows.length === 0 && <p className="tm-muted mt-2">Nobody matches these filters.</p>}
    </div>
  )
}

// Scheduled vs worked: for each person, the hours on the schedule, the hours clocked and the difference.
export function VarianceReport({ data, days, now, filters }) {
  const { groupBy, staffNo } = { ...DEFAULT_FILTERS, ...filters }
  const worked = new Map(reportRows(data, days, now, filters).map((r) => [r.e.id, r.hours.total]))
  const rows = scheduleRows(data, days, filters)
    .map((r) => ({ ...r, worked: worked.get(r.e.id) ?? 0 }))
    .filter((r) => r.minutes || r.worked)
  const sections = groupRows(rows, groupBy)
  const span = 4 + (staffNo ? 1 : 0)
  const csv = [
    ['Employee', ...(staffNo ? ['Staff no.'] : []), 'Position', 'Scheduled hours', 'Worked hours', 'Difference'],
    ...rows.map((r) => [r.e.name, ...(staffNo ? [r.e.staffNo ?? ''] : []), r.e.position, decimalHours(r.minutes), decimalHours(r.worked), decimalHours(r.worked - r.minutes)]),
  ]
  const line = (r) => {
    const diff = r.worked - r.minutes
    const far = Math.abs(diff) >= 60 // an hour or more off the schedule
    return (
      <tr key={r.e.id}>
        <th scope="row">{r.e.name}</th>
        {staffNo && <td className="ts-no">{r.e.staffNo ?? '—'}</td>}
        <td>{formatHours(r.minutes)}</td>
        <td><b>{formatHours(r.worked)}</b></td>
        <td className={`rp-diff ${far ? (diff > 0 ? 'over' : 'under') : ''}`}>{signed(diff)}</td>
      </tr>
    )
  }
  return (
    <div className="rp-report">
      <div className="ts-print-head"><b>Scheduled vs worked</b><span>{dayLabel(days[0])} to {dayLabel(days.at(-1))}</span></div>
      <div className="rp-report-head"><p className="tm-muted mb-0">Worked hours follow "Approved only". Differences of an hour or more are colored.</p><CsvButton name={`wiseshift-scheduled-vs-worked-${days[0]}-to-${days.at(-1)}.csv`} rows={csv} /></div>
      <div className="tm-gridwrap ts-table rp-narrow">
        <table className="tm-sheet">
          <thead><tr><th scope="col">Name</th>{staffNo && <th scope="col">No.</th>}<th scope="col">Scheduled</th><th scope="col">Worked</th><th scope="col">Difference</th></tr></thead>
          {sections.map((sec) => (
            <tbody key={sec.name || 'all'}>
              {sec.name && <tr className="ts-group"><th scope="rowgroup" colSpan={span}>{sec.name}</th></tr>}
              {sec.rows.map(line)}
              {sec.name && (
                <tr className="ts-subtotal"><th scope="row">Subtotal</th>{staffNo && <td />}<td>{formatHours(sumOf(sec.rows, (r) => r.minutes))}</td><td>{formatHours(sumOf(sec.rows, (r) => r.worked))}</td><td>{signed(sumOf(sec.rows, (r) => r.worked - r.minutes))}</td></tr>
              )}
            </tbody>
          ))}
          <tfoot>
            <tr><th scope="row">Total</th>{staffNo && <td />}<td>{formatHours(sumOf(rows, (r) => r.minutes))}</td><td><b>{formatHours(sumOf(rows, (r) => r.worked))}</b></td><td>{signed(sumOf(rows, (r) => r.worked - r.minutes))}</td></tr>
          </tfoot>
        </table>
      </div>
      {rows.length === 0 && <p className="tm-muted mt-2">Nobody matches these filters.</p>}
    </div>
  )
}

// By role: scheduled and worked hours per role (a punch takes the role of the shift it matches), and with pay rates on,
// the labor cost of the worked hours at each person's rate (straight time: the overtime premium isn't split by role).
export function RoleReport({ data, days, now, filters }) {
  const f = useFeatures()
  const { dept, picked, approvedOnly } = { ...DEFAULT_FILTERS, ...filters }
  const people = new Set(data.employees.filter((e) => inDept(e, dept) && (!picked || picked.includes(e.id))).map((e) => e.id))
  const shifts = data.shifts.filter((s) => s.published && days.includes(s.date) && people.has(s.employeeId))
  const punches = data.punches.filter((p) => people.has(p.employeeId) && days.includes(dateKey(new Date(p.clockIn))) && (!approvedOnly || (p.clockOut && p.approvedAt)))
  const pay = f.payRates
  const rateOf = (id) => {
    const e = data.employees.find((x) => x.id === id)
    return e?.payType === 'hourly' ? data.payById[id]?.hourlyRate ?? 0 : 0
  }
  const known = (data.settings?.roles ?? []).map((r) => r.name)
  const names = [...new Set([...known, ...shifts.map((s) => s.role || ''), ...punches.map((p) => shiftFor(p, data.shifts)?.role || '')])]
  const rows = names
    .map((name) => {
      const sh = shifts.filter((s) => (s.role || '') === name)
      const pu = punches.filter((p) => (shiftFor(p, data.shifts)?.role || '') === name)
      const worked = sumOf(pu, (p) => punchMinutes(p, now))
      return { name: name || 'No role', shifts: sh.length, scheduled: sumOf(sh, shiftMinutes), worked, people: new Set([...sh, ...pu].map((x) => x.employeeId)).size, cost: sumOf(pu, (p) => (punchMinutes(p, now) / 60) * rateOf(p.employeeId)) }
    })
    .filter((r) => r.shifts || r.worked)
  const csv = [
    ['Role', 'People', 'Shifts', 'Scheduled hours', 'Worked hours', 'Difference', ...(pay ? ['Labor cost (est.)'] : [])],
    ...rows.map((r) => [r.name, r.people, r.shifts, decimalHours(r.scheduled), decimalHours(r.worked), decimalHours(r.worked - r.scheduled), ...(pay ? [Math.round(r.cost * 100) / 100] : [])]),
  ]
  return (
    <div className="rp-report">
      <div className="ts-print-head"><b>Hours by role</b><span>{dayLabel(days[0])} to {dayLabel(days.at(-1))}</span></div>
      <div className="rp-report-head"><p className="tm-muted mb-0">A punch counts toward the role of the shift it matches. {pay ? 'Labor cost is worked hours × each person’s rate, without the overtime premium.' : 'Turn on Pay rates to see labor cost.'}</p><CsvButton name={`wiseshift-by-role-${days[0]}-to-${days.at(-1)}.csv`} rows={csv} /></div>
      <div className="tm-gridwrap ts-table rp-narrow">
        <table className="tm-sheet">
          <thead><tr><th scope="col">Role</th><th scope="col">People</th><th scope="col">Shifts</th><th scope="col">Scheduled</th><th scope="col">Worked</th><th scope="col">Difference</th>{pay && <th scope="col">Labor cost (est.)</th>}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <th scope="row">{r.name}</th>
                <td>{r.people}</td>
                <td>{r.shifts}</td>
                <td>{formatHours(r.scheduled)}</td>
                <td><b>{formatHours(r.worked)}</b></td>
                <td>{signed(r.worked - r.scheduled)}</td>
                {pay && <td>{money(r.cost)}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><th scope="row">Total</th><td /><td>{sumOf(rows, (r) => r.shifts)}</td><td>{formatHours(sumOf(rows, (r) => r.scheduled))}</td><td><b>{formatHours(sumOf(rows, (r) => r.worked))}</b></td><td>{signed(sumOf(rows, (r) => r.worked - r.scheduled))}</td>{pay && <td>{money(sumOf(rows, (r) => r.cost))}</td>}</tr>
          </tfoot>
        </table>
      </div>
      {rows.length === 0 && <p className="tm-muted mt-2">No shifts or punches in these dates.</p>}
    </div>
  )
}
