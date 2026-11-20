import { useEffect, useRef, useState } from 'react'
import { dateKey } from '../lib/dates.js'
import { isPayPeriod, moveDays, payPeriodOf, scheduleWeekOf } from './paycheck.js'
import { rangeLabel, scheduleOnly, useNow } from './format.js'
import { Timesheet } from './HoursTab.jsx'
import ExportHours from './ExportHours.jsx'
import { DEFAULT_FILTERS, daysBetween, departments, downloadCsv, reportRows, unapprovedCount } from './reportFilters.js'
import { missingIds, payrollCsv, payrollLayout } from './payroll.js'
import Icon from './Icon.jsx'
import Seg from './Seg.jsx'
import { RoleReport, ScheduledReport, VarianceReport } from './ReportViews.jsx'

const TYPES = [
  { id: 'timesheet', label: 'Timesheet' },
  { id: 'scheduled', label: 'Hours scheduled' },
  { id: 'variance', label: 'Scheduled vs worked' },
  { id: 'roles', label: 'By role' },
]

// Reports (managers): everyone's hours as a timesheet, narrowed by a filter bar (dates, department, people, grouping,
// approved only, hours only). Export starts from the same choices, so the download matches the page.
export default function ReportsTab({ data, period, onPeriod, focus }) {
  const now = useNow()
  const [exporting, setExporting] = useState(false)
  const [type, setType] = useState('timesheet')
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value }))
  const [kind, setKind] = useState('period')
  const [custom, setCustom] = useState({ start: period[0], end: period.at(-1) })
  // The page's dates are the app's loaded range, so any range picked here is fetched. Leaving Reports goes back to a pay period.
  const periodRef = useRef(period)
  useEffect(() => { periodRef.current = period }, [period])
  useEffect(() => () => { if (!isPayPeriod(periodRef.current)) onPeriod(payPeriodOf(new Date())) }, [onPeriod])

  const pickKind = (next) => {
    setKind(next)
    if (next === 'period') onPeriod(payPeriodOf(now))
    else if (next === 'week') onPeriod(scheduleWeekOf(now))
    else {
      const days = daysBetween(custom.start, custom.end)
      if (days.length) onPeriod(days)
      else onPeriod(daysBetween(dateKey(now), dateKey(now)))
    }
  }
  const setRange = (start, end) => {
    setCustom({ start, end })
    const days = daysBetween(start, end)
    if (days.length) onPeriod(days)
  }
  const current = kind === 'period' ? payPeriodOf(now)[0] === period[0] : kind === 'week' ? scheduleWeekOf(now)[0] === period[0] : true
  const { groups, positions } = departments(data)
  // Schedule-only people are in the list too: they have hours on the schedule reports.
  const people = data.employees.filter((e) => type !== 'timesheet' || !scheduleOnly(e)).sort((a, b) => a.name.localeCompare(b.name))
  const picked = filters.picked
  const togglePerson = (id) => {
    const base = picked ?? people.map((e) => e.id)
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id]
    set('picked', next.length === people.length ? null : next)
  }

  // One click, in the saved payroll layout, following the filters on the page. The same checks as Export first.
  const payrollDownload = () => {
    const rows = reportRows(data, period, now, filters)
    if (!rows.length) return window.alert('Nobody matches these filters.')
    const open = filters.approvedOnly ? [] : rows.filter((r) => r.hours.open).map((r) => r.e.name)
    const waiting = filters.approvedOnly ? 0 : unapprovedCount(data, rows, period)
    const layout = payrollLayout(data.settings.payrollExport)
    const missing = missingIds(rows, data, layout)
    const problems = [
      open.length && `Still clocked in: ${open.join(', ')}.`,
      waiting && `${waiting} punch${waiting === 1 ? '' : 'es'} not approved yet.`,
      missing.length && `No ID for payroll: ${missing.join(', ')}.`,
    ].filter(Boolean)
    if (problems.length && !window.confirm(`${problems.join('\n')}\n\nDownload anyway?`)) return
    downloadCsv(`payroll-${period[0]}-to-${period.at(-1)}.csv`, payrollCsv(rows, period, data, layout))
  }

  return (
    <div className="rp">
      <Seg className="sc-toggle rp-types" role="group" aria-label="Report">
        {TYPES.map((t) => <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => setType(t.id)}>{t.label}</button>)}
      </Seg>
      <div className="rp-bar">
        <div className="rp-when">
          <select className="form-select form-select-sm" aria-label="Dates" value={kind} onChange={(e) => pickKind(e.target.value)}>
            <option value="period">Pay period</option>
            <option value="week">Week</option>
            <option value="custom">Custom dates</option>
          </select>
          {kind === 'custom' ? (
            <>
              <input type="date" className="form-control form-control-sm" aria-label="Start date" value={custom.start} onChange={(e) => setRange(e.target.value, custom.end)} />
              <span aria-hidden="true">to</span>
              <input type="date" className="form-control form-control-sm" aria-label="End date" value={custom.end} onChange={(e) => setRange(custom.start, e.target.value)} />
            </>
          ) : (
            <>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onPeriod(moveDays(period, -1))} aria-label={kind === 'week' ? 'Week before' : 'Pay period before'}><Icon name="left" /></button>
              <b className="rp-range">{rangeLabel(period)}</b>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onPeriod(moveDays(period, 1))} aria-label={kind === 'week' ? 'Week after' : 'Pay period after'}><Icon name="right" /></button>
              {!current && <button type="button" className="btn btn-link btn-sm" onClick={() => pickKind(kind)}>{kind === 'week' ? 'This week' : 'This pay period'}</button>}
            </>
          )}
        </div>
        {type === 'timesheet' && (
          <span className="rp-actions">
            {data.settings.payrollExport && <button type="button" className="btn btn-outline-secondary btn-sm desk-only" data-search="payroll-csv" onClick={payrollDownload}>Payroll CSV</button>}
            <button type="button" className="btn btn-brand btn-sm ex-btn desk-only" data-search="export" onClick={() => setExporting(true)}>Export hours…</button>
          </span>
        )}
      </div>

      <div className="rp-filters">
        <label className="rp-field">
          <span>Department</span>
          <select className="form-select form-select-sm" value={filters.dept} onChange={(e) => set('dept', e.target.value)}>
            <option value="all">Everyone</option>
            {groups.length > 0 && <optgroup label="Staff groups">{groups.map((g) => <option key={g} value={`g:${g}`}>{g}</option>)}</optgroup>}
            {positions.length > 0 && <optgroup label="Positions">{positions.map((p) => <option key={p} value={`p:${p}`}>{p}</option>)}</optgroup>}
          </select>
        </label>
        <details className="rp-field rp-people">
          <summary><span>People</span><b>{picked ? `${picked.length} of ${people.length}` : `All ${people.length}`}</b></summary>
          <div className="rp-people-list">
            <div className="rp-people-all">
              <button type="button" className="tm-link small" onClick={() => set('picked', null)}>All</button>
              <button type="button" className="tm-link small" onClick={() => set('picked', [])}>None</button>
            </div>
            {people.map((e) => (
              <label key={e.id} className="ex-check">
                <input type="checkbox" className="form-check-input" checked={!picked || picked.includes(e.id)} onChange={() => togglePerson(e.id)} />
                <span>{e.name}{e.active ? '' : ' (not active)'}</span>
              </label>
            ))}
          </div>
        </details>
        {type !== 'roles' && <label className="rp-field">
          <span>Group by</span>
          <select className="form-select form-select-sm" value={filters.groupBy} onChange={(e) => set('groupBy', e.target.value)}>
            <option value="none">Nothing</option>
            {groups.length > 0 && <option value="group">Staff group</option>}
            <option value="position">Position</option>
          </select>
        </label>}
        <div className="rp-toggles">
          {type !== 'scheduled' && <label className="form-check form-switch"><input className="form-check-input" type="checkbox" role="switch" checked={filters.approvedOnly} onChange={(e) => set('approvedOnly', e.target.checked)} /><span>Approved only</span></label>}
          {(type === 'timesheet' || type === 'scheduled') && <label className="form-check form-switch"><input className="form-check-input" type="checkbox" role="switch" checked={filters.hoursOnly} onChange={(e) => set('hoursOnly', e.target.checked)} /><span>Hours only</span></label>}
          {type !== 'roles' && <label className="form-check form-switch"><input className="form-check-input" type="checkbox" role="switch" checked={filters.staffNo} onChange={(e) => set('staffNo', e.target.checked)} /><span>Staff no.</span></label>}
        </div>
      </div>

      {type === 'timesheet' && <Timesheet data={data} period={period} now={now} focus={focus} filters={filters} />}
      {type === 'scheduled' && <ScheduledReport data={data} days={period} filters={filters} />}
      {type === 'variance' && <VarianceReport data={data} days={period} now={now} filters={filters} />}
      {type === 'roles' && <RoleReport data={data} days={period} now={now} filters={filters} />}
      <p className="ex-note">Exports are available on a computer.</p>
      {exporting && <ExportHours data={data} now={now} preset={{ days: period, filters }} onClose={() => setExporting(false)} />}
    </div>
  )
}
