import { useMemo, useState } from 'react'
import Modal from '../components/Modal.jsx'
import { dateKey, formatClock, fromKey } from '../lib/dates.js'
import { decimalHours, formatHours, grossPay, moveDays, payPeriodOf, periodHours, punchMinutes, scheduleWeekOf } from './paycheck.js'
import { dayLabel, money, scheduleOnly } from './format.js'
import { describeSpot } from './location.js'
import { useFeatures } from './features.js'

// Export hours (managers, on a computer): pick a timeline, who to include and a format, see
// the numbers, then download a CSV. Summary is one line per person; detailed is one line per
// punch. Pay columns only appear when the Pay rates feature is on, and location columns only
// when Location on punches is on.

const TIMELINES = [
  { id: 'period', label: 'This pay period' },
  { id: 'lastPeriod', label: 'Last pay period' },
  { id: 'week', label: 'This week' },
  { id: 'lastWeek', label: 'Last week' },
  { id: 'custom', label: 'Custom dates' },
]
const MAX_DAYS = 92

// The date keys from one date to another, both included (nothing if they're backwards or absurdly far apart).
function daysBetween(start, end) {
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
function timelineDays(id, now, start, end) {
  const period = payPeriodOf(now)
  const week = scheduleWeekOf(now)
  if (id === 'period') return period
  if (id === 'lastPeriod') return moveDays(period, -1)
  if (id === 'week') return week
  if (id === 'lastWeek') return moveDays(week, -1)
  return daysBetween(start, end)
}

const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
function download(fileName, rows) {
  // The leading mark makes Excel read names with accents correctly.
  const text = `﻿${rows.map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function ExportHours({ data, now, onClose }) {
  const f = useFeatures()
  const [timeline, setTimeline] = useState('period')
  const [customStart, setCustomStart] = useState(() => dateKey(now))
  const [customEnd, setCustomEnd] = useState(() => dateKey(now))
  const [position, setPosition] = useState('all')
  const [excluded, setExcluded] = useState(() => new Set()) // people unticked in the list
  const [group, setGroup] = useState(false)
  const [format, setFormat] = useState('summary')
  const [withPay, setWithPay] = useState(false)
  const [making, setMaking] = useState(false) // building the PDF

  const days = useMemo(() => timelineDays(timeline, now, customStart, customEnd), [timeline, now, customStart, customEnd])
  const start = days[0] ?? ''
  const end = days.at(-1) ?? ''

  // Everyone who clocks in, then narrowed by position and the people ticked in the list.
  const people = data.employees.filter((e) => !scheduleOnly(e))
  const positions = [...new Set(people.map((e) => e.position).filter(Boolean))].sort()
  const rows = useMemo(() => {
    const list = people
      .filter((e) => position === 'all' || e.position === position)
      .filter((e) => !excluded.has(e.id))
      .map((e) => {
        const hours = periodHours(data.punches, e.id, days, now)
        const rate = data.payById[e.id]?.hourlyRate ?? 0
        return { e, hours, rate, gross: e.payType === 'hourly' ? grossPay(hours, rate).gross : null }
      })
      .filter((r) => r.e.active || r.hours.total > 0)
    return list.sort((a, b) => (group ? (a.e.position || '').localeCompare(b.e.position || '') : 0) || a.e.name.localeCompare(b.e.name))
    // people comes from data.employees, which changes identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.employees, data.punches, data.payById, days, position, excluded, group, now])

  const sum = (list, fn) => list.reduce((total, r) => total + fn(r), 0)
  const stillIn = rows.filter((r) => r.hours.open)
  const unapproved = rows.flatMap((r) => r.hours.byDay.flatMap((d) => d.punches)).filter((p) => p.clockOut && !p.approvedAt).length
  const groups = group ? [...new Set(rows.map((r) => r.e.position || 'No position'))].map((name) => ({ name, rows: rows.filter((r) => (r.e.position || 'No position') === name) })) : [{ name: '', rows }]
  const showPay = f.payRates && withPay

  const toggle = (id) => {
    const next = new Set(excluded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExcluded(next)
  }

  // Both downloads first check that there is something to export and that unapproved punches are OK.
  const ready = () => {
    if (!days.length || !rows.length) return false
    return !unapproved || window.confirm(`${unapproved} punch${unapproved === 1 ? '' : 'es'} in this range ${unapproved === 1 ? "isn't" : "aren't"} approved yet (Clock → Review). Download anyway?`)
  }

  const exportPdf = async () => {
    if (!ready()) return
    setMaking(true)
    try {
      const { downloadPdf } = await import('./exportPdf.js')
      const place = (spot) => (spot ? describeSpot(spot, data.shop).label : 'No location')
      const filters = [position === 'all' ? 'All positions' : position, `${rows.length} ${rows.length === 1 ? 'person' : 'people'}`, format === 'summary' ? 'Summary' : 'Detailed']
      let tables
      if (format === 'summary') {
        const head = ['Employee', 'Position', 'Regular', 'Overtime', 'Total', ...(showPay ? ['Rate', 'Gross (est.)'] : [])]
        const body = []
        const boldRows = []
        for (const g of groups) {
          for (const r of g.rows) {
            body.push([r.e.name, r.e.position || '', formatHours(r.hours.regular), formatHours(r.hours.overtime), formatHours(r.hours.total), ...(showPay ? [r.e.payType === 'hourly' ? money(r.rate) : 'Commission', r.gross === null ? '' : money(r.gross)] : [])])
          }
          if (group) {
            boldRows.push(body.length)
            body.push([`Subtotal: ${g.name}`, '', formatHours(sum(g.rows, (r) => r.hours.regular)), formatHours(sum(g.rows, (r) => r.hours.overtime)), formatHours(sum(g.rows, (r) => r.hours.total)), ...(showPay ? ['', money(sum(g.rows, (r) => r.gross ?? 0))] : [])])
          }
        }
        const foot = ['Total', '', formatHours(sum(rows, (r) => r.hours.regular)), formatHours(sum(rows, (r) => r.hours.overtime)), formatHours(sum(rows, (r) => r.hours.total)), ...(showPay ? ['', money(sum(rows, (r) => r.gross ?? 0))] : [])]
        tables = [{ head, body, boldRows, foot }]
      } else {
        tables = rows
          .filter((r) => r.hours.byDay.some((d) => d.punches.length))
          .map((r) => ({
            heading: `${r.e.name}${r.e.position ? ` · ${r.e.position}` : ''}`,
            head: ['Date', 'Clock in', 'Clock out', 'Hours', ...(f.location ? ['Clocked in at', 'Clocked out at'] : []), 'Approved', 'Note'],
            body: r.hours.byDay.flatMap((d) =>
              d.punches.map((p) => [
                dayLabel(d.date), formatClock(p.clockIn), p.clockOut ? formatClock(p.clockOut) : 'still in', formatHours(punchMinutes(p, now)),
                ...(f.location ? [place(p.inSpot), p.clockOut ? place(p.outSpot) : ''] : []),
                p.approvedAt ? 'Yes' : 'No', [p.editedBy ? `Fixed by ${p.editedBy}` : '', p.note].filter(Boolean).join(' · '),
              ]),
            ),
            foot: ['Total', '', '', formatHours(r.hours.total), ...(f.location ? ['', ''] : []), '', ''],
          }))
      }
      await downloadPdf({
        fileName: `wiseshift-hours-${format}-${start}-to-${end}.pdf`,
        title: 'Hours report',
        subtitle: `${dayLabel(start)} to ${dayLabel(end)}`,
        notes: [filters.join(' · '), ...(stillIn.length ? [`Still clocked in: ${stillIn.map((r) => r.e.name).join(', ')}`] : [])],
        tables,
        landscape: format === 'detailed' && f.location,
      })
    } finally {
      setMaking(false)
    }
  }

  const exportFile = () => {
    if (!ready()) return
    const name = `wiseshift-hours-${format}-${start}-to-${end}.csv`
    if (format === 'summary') {
      const header = ['Employee', 'Position', 'Email', 'Start', 'End', 'Regular hours', 'Overtime hours', 'Total hours', ...(showPay ? ['Hourly rate', 'Gross pay (estimate)'] : [])]
      const line = (r) => [r.e.name, r.e.position, r.e.email, start, end, decimalHours(r.hours.regular), decimalHours(r.hours.overtime), decimalHours(r.hours.total), ...(showPay ? [r.e.payType === 'hourly' ? r.rate : 'commission', r.gross ?? ''] : [])]
      const lines = groups.flatMap((g) => [
        ...g.rows.map(line),
        ...(group ? [[`Subtotal: ${g.name}`, '', '', '', '', decimalHours(sum(g.rows, (r) => r.hours.regular)), decimalHours(sum(g.rows, (r) => r.hours.overtime)), decimalHours(sum(g.rows, (r) => r.hours.total)), ...(showPay ? ['', sum(g.rows, (r) => r.gross ?? 0)] : [])]] : []),
      ])
      download(name, [header, ...lines])
    } else {
      const place = (spot) => (spot ? describeSpot(spot, data.shop).label : 'No location')
      const header = ['Employee', 'Position', 'Date', 'Clock in', 'Clock out', 'Hours', ...(f.location ? ['Clocked in at', 'Clocked out at'] : []), 'Approved', 'Fixed', 'Note']
      const lines = rows.flatMap((r) =>
        r.hours.byDay.flatMap((d) =>
          d.punches.map((p) => [
            r.e.name, r.e.position, d.date, formatClock(p.clockIn), p.clockOut ? formatClock(p.clockOut) : 'still in', decimalHours(punchMinutes(p, now)),
            ...(f.location ? [place(p.inSpot), p.clockOut ? place(p.outSpot) : ''] : []),
            p.approvedAt ? 'Yes' : 'No', p.editedBy ? `Fixed by ${p.editedBy}` : '', p.note,
          ]),
        ),
      )
      download(name, [header, ...lines])
    }
  }

  return (
    <Modal
      title="Export hours"
      size="xl"
      onClose={onClose}
      footer={
        <>
          <span className="ex-count me-auto">{rows.length} {rows.length === 1 ? 'person' : 'people'} · {formatHours(sum(rows, (r) => r.hours.total))} hrs</span>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-outline-secondary" disabled={!days.length || !rows.length || making} onClick={exportPdf}>{making ? 'Making PDF…' : 'Download PDF'}</button>
          <button type="button" className="btn btn-brand" disabled={!days.length || !rows.length} onClick={exportFile}>Download CSV</button>
        </>
      }
    >
      <div className="ex-filters">
        <div>
          <label className="form-label" htmlFor="ex-timeline">Timeline</label>
          <select id="ex-timeline" className="form-select" value={timeline} onChange={(e) => setTimeline(e.target.value)}>
            {TIMELINES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="ex-start">Start date</label>
          <input id="ex-start" type="date" className="form-control" value={timeline === 'custom' ? customStart : start} disabled={timeline !== 'custom'} onChange={(e) => setCustomStart(e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor="ex-end">End date</label>
          <input id="ex-end" type="date" className="form-control" value={timeline === 'custom' ? customEnd : end} disabled={timeline !== 'custom'} onChange={(e) => setCustomEnd(e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor="ex-position">Position</label>
          <select id="ex-position" className="form-select" value={position} onChange={(e) => setPosition(e.target.value)}>
            <option value="all">All positions</option>
            {positions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      {timeline === 'custom' && days.length === 0 && <p className="tm-warn">The end date has to be on or after the start date.</p>}
      {timeline === 'custom' && days.length > 0 && <p className="tm-muted small">Overtime counts after 40 hours in each 7 days, starting from the start date. Ranges over {MAX_DAYS} days are cut short.</p>}

      <div className="ex-options">
        <fieldset className="ex-people">
          <legend>Employees</legend>
          <div>
            <button type="button" className="tm-link small" onClick={() => setExcluded(new Set())}>All</button>
            <button type="button" className="tm-link small" onClick={() => setExcluded(new Set(people.map((e) => e.id)))}>None</button>
          </div>
          {people.filter((e) => position === 'all' || e.position === position).map((e) => (
            <label key={e.id} className="ex-check">
              <input type="checkbox" className="form-check-input" checked={!excluded.has(e.id)} onChange={() => toggle(e.id)} />
              <span>{e.name}{e.active ? '' : ' (not active)'}</span>
            </label>
          ))}
        </fieldset>
        <div className="ex-side">
          <fieldset>
            <legend>Format</legend>
            <label className="ex-check"><input type="radio" className="form-check-input" name="ex-format" checked={format === 'summary'} onChange={() => setFormat('summary')} /><span><b>Summary</b> · one line per person</span></label>
            <label className="ex-check"><input type="radio" className="form-check-input" name="ex-format" checked={format === 'detailed'} onChange={() => setFormat('detailed')} /><span><b>Detailed</b> · one line per punch</span></label>
          </fieldset>
          <label className="ex-check"><input type="checkbox" className="form-check-input" checked={group} onChange={(e) => setGroup(e.target.checked)} /><span>Group by position</span></label>
          {f.payRates && <label className="ex-check"><input type="checkbox" className="form-check-input" checked={withPay} onChange={(e) => setWithPay(e.target.checked)} /><span>Include pay rates and gross estimate</span></label>}
        </div>
      </div>

      {stillIn.length > 0 && <p className="tm-warn">Still clocked in: {stillIn.map((r) => r.e.name).join(', ')}. Fix any forgotten clock-outs first.</p>}
      {unapproved > 0 && <p className="tm-warn">{unapproved} punch{unapproved === 1 ? '' : 'es'} not approved yet. Approve them on Today → Review before payroll.</p>}

      <div className="tm-gridwrap ex-preview">
        <table className="tm-sheet">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Position</th>
              <th scope="col">Regular</th>
              <th scope="col">Overtime</th>
              <th scope="col">Total</th>
              {showPay && <th scope="col">Rate</th>}
              {showPay && <th scope="col">Gross (est.)</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={showPay ? 7 : 5} className="tm-muted">No one matches these filters.</td></tr>}
            {groups.map((g) => (
              <PreviewGroup key={g.name || 'all'} group={g} grouped={group} showPay={showPay} sum={sum} />
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td />
                <td>{formatHours(sum(rows, (r) => r.hours.regular))}</td>
                <td>{formatHours(sum(rows, (r) => r.hours.overtime))}</td>
                <td><b>{formatHours(sum(rows, (r) => r.hours.total))}</b></td>
                {showPay && <td />}
                {showPay && <td>{money(sum(rows, (r) => r.gross ?? 0))}</td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="tm-muted small mt-2">
        {days.length > 0 ? `${dayLabel(start)} to ${dayLabel(end)}. ` : ''}Hours are exact, to the minute. Overtime is time and a half after 40 hours in each seven-day stretch.
      </p>
    </Modal>
  )
}

function PreviewGroup({ group, grouped, showPay, sum }) {
  return (
    <>
      {group.rows.map((r) => (
        <tr key={r.e.id}>
          <th scope="row">{r.e.name}</th>
          <td>{r.e.position || '—'}</td>
          <td>{formatHours(r.hours.regular)}</td>
          <td className={r.hours.overtime ? 'tm-ot' : ''}>{formatHours(r.hours.overtime)}</td>
          <td><b>{formatHours(r.hours.total)}</b></td>
          {showPay && <td>{r.e.payType === 'hourly' ? money(r.rate) : 'Commission'}</td>}
          {showPay && <td>{r.gross === null ? '—' : money(r.gross)}</td>}
        </tr>
      ))}
      {grouped && (
        <tr className="ex-sub">
          <th scope="row">Subtotal: {group.name}</th>
          <td />
          <td>{formatHours(sum(group.rows, (r) => r.hours.regular))}</td>
          <td>{formatHours(sum(group.rows, (r) => r.hours.overtime))}</td>
          <td><b>{formatHours(sum(group.rows, (r) => r.hours.total))}</b></td>
          {showPay && <td />}
          {showPay && <td>{money(sum(group.rows, (r) => r.gross ?? 0))}</td>}
        </tr>
      )}
    </>
  )
}
