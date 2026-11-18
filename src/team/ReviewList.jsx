import { useState } from 'react'
import { dateKey, DAY_NAMES, formatClock, fromKey } from '../lib/dates.js'
import Avatar from './Avatar.jsx'
import PunchDetails from './PunchDetails.jsx'
import { payPeriodOf, punchMinutes } from './paycheck.js'
import { isLateWarning, punchStatus, punchWarnings, STATUS_LABEL } from './review.js'
import { dayLabel, hoursLabel, rangeLabel, scheduleOnly, useNow } from './format.js'
import { REVIEW_DAYS } from './useTeamData.js'

const duration = (minutes) => (minutes >= 1440 ? `${Math.floor(minutes / 1440)}d ` : '') + `${Math.floor((minutes % 1440) / 60)}h ${Math.round(minutes % 60)}m`

// Managers: every punch, newest first, to approve (like Humanity's Manage list).
// ⚠️ marks late clock-ins and clock-outs; tap one for its details and map.
export default function ReviewList({ data }) {
  const now = useNow()
  const [range, setRange] = useState('week') // 'week' (past 7 days) or 'period' (this pay period)
  const [status, setStatus] = useState('pending') // 'pending' (awaiting approval), 'progress' (still clocked in), 'approved' or 'all'
  const [who, setWho] = useState('') // '' = everyone, otherwise one employee's id
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const today = dateKey(now)
  const from = range === 'week' ? dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - REVIEW_DAYS)) : payPeriodOf(now)[0]
  const name = (id) => data.employees.find((e) => e.id === id)
  const inRange = data.punches
    .filter((p) => dateKey(new Date(p.clockIn)) >= from || !p.clockOut)
    .filter((p) => !who || p.employeeId === who)
    .sort((a, b) => new Date(b.clockIn) - new Date(a.clockIn))
  const countOf = (st) => inRange.filter((p) => punchStatus(p) === st).length
  const list = status === 'all' ? inRange : inRange.filter((p) => punchStatus(p) === status)
  const people = data.employees.filter((e) => !scheduleOnly(e)).sort((a, b) => a.name.localeCompare(b.name))
  const pending = list.filter((p) => punchStatus(p) === 'pending')
  const pendingMinutes = pending.reduce((sum, p) => sum + punchMinutes(p, now), 0)

  const approve = async (ids) => {
    setBusy(true)
    setError('')
    const problem = await data.actions.approvePunches(ids, true)
    setBusy(false)
    if (problem) setError(problem)
  }

  const clockOut = async (p) => {
    setBusy(true)
    setError('')
    const problem = await data.actions.clockOutFor(p)
    setBusy(false)
    if (problem) setError(problem)
  }

  return (
    <div>
      <div className="tm-filters">
        <div className="tm-seg" role="group" aria-label="Which days">
          <button type="button" aria-pressed={range === 'week'} onClick={() => setRange('week')}>Past {REVIEW_DAYS} days</button>
          <button type="button" aria-pressed={range === 'period'} onClick={() => setRange('period')}>This pay period</button>
        </div>
        <select className="form-select form-select-sm rc-who-filter" aria-label="Employee" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">All employees</option>
          {people.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        {pending.length > 0 && (
          <button type="button" className="btn btn-success rc-all" disabled={busy} onClick={() => approve(pending.map((p) => p.id))}>
            Approve all ({pending.length}) · {hoursLabel(pendingMinutes)}
          </button>
        )}
      </div>
      <div className="tm-seg rc-status" role="group" aria-label="Status">
        {[['pending', 'Awaiting approval'], ['progress', 'In progress'], ['approved', 'Approved'], ['all', 'All']].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={status === id} onClick={() => setStatus(id)}>
            {label}{id !== 'all' && <span className="rc-n">{countOf(id)}</span>}
          </button>
        ))}
      </div>
      {range === 'period' && <p className="tm-muted small mb-2">{rangeLabel(payPeriodOf(now))}</p>}

      {list.length ? (
        <div className="rc-grid">
          {list.map((p) => {
            const person = name(p.employeeId)
            const status = punchStatus(p)
            const warnings = punchWarnings(p, data.shifts, data.shop, now)
            const dayKey = dateKey(new Date(p.clockIn))
            return (
              <article key={p.id} className={`rc st-${status}`}>
                <button type="button" className="rc-main" onClick={() => setOpen(p)}>
                  <span className="rc-top">
                    <Avatar employee={person} size={38} />
                    <span className="rc-who">
                      <b>{person?.name ?? '?'}</b>
                      <small>{person?.position}</small>
                    </span>
                    <span className={`rc-chip st-${status}`}>{STATUS_LABEL[status]}</span>
                  </span>
                  <span className="rc-day">{dayLabel(dayKey)}</span>
                  <span className="rc-time">
                    {formatClock(p.clockIn)} – {p.clockOut ? formatClock(p.clockOut) : '…'}
                    {p.clockOut && dateKey(new Date(p.clockOut)) !== dayKey && <small className="tm-bad"> (next day)</small>}
                  </span>
                  <span className="rc-dur">{duration(punchMinutes(p, now))}</span>
                  {warnings.length > 0 && (
                    <span className={`rc-why ${warnings.some(isLateWarning) ? 'late' : ''}`}>
                      {warnings.some(isLateWarning) && <span aria-hidden="true">⚠️ </span>}
                      {warnings[0]}{warnings.length > 1 ? ` (+${warnings.length - 1} more)` : ''}
                    </span>
                  )}
                </button>
                <div className="rc-foot">
                  {status === 'pending' && (
                    <button type="button" className="btn btn-success rc-ok" disabled={busy} onClick={() => approve([p.id])}>Approve {hoursLabel(punchMinutes(p, now))}</button>
                  )}
                  {status === 'progress' && (
                    <button type="button" className="btn btn-outline-secondary rc-out" disabled={busy} onClick={() => window.confirm(`Clock ${person?.name ?? 'this person'} out now (${formatClock(new Date().toISOString())})?`) && clockOut(p)}>Clock out now</button>
                  )}
                  <button type="button" className="btn btn-outline-secondary rc-details" onClick={() => setOpen(p)}>Details</button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <p className="tm-empty">{who ? `Nothing here for ${name(who)?.name ?? 'this person'} in these days.` : status === 'pending' ? 'Nothing is waiting for approval. 🎉' : status === 'progress' ? 'Nobody is clocked in right now.' : 'No punches in these days.'}</p>
      )}
      {error && <p className="tm-error" role="alert">{error}</p>}

      {pending.length > 0 && (
        <div className="tm-approve-bar">
          <button type="button" className="btn btn-success w-100" disabled={busy} onClick={() => approve(pending.map((p) => p.id))}>
            Approve all ({pending.length}) · {hoursLabel(pendingMinutes)}
          </button>
          {pending.some((p) => punchWarnings(p, data.shifts, data.shop, now).some(isLateWarning)) && (
            <small>Includes late punches (⚠️). Tap one first to check it.</small>
          )}
        </div>
      )}
      {list.some((p) => !p.clockOut && dateKey(new Date(p.clockIn)) === today) && (
        <p className="tm-muted small text-center mt-2">People still clocked in can be approved after they clock out.</p>
      )}

      {open && <PunchDetails punch={open} data={data} onClose={() => setOpen(null)} />}
    </div>
  )
}
