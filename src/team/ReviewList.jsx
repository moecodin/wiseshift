import { useState } from 'react'
import { dateKey, DAY_NAMES, formatClock, fromKey } from '../lib/dates.js'
import Avatar from './Avatar.jsx'
import PunchDetails from './PunchDetails.jsx'
import { payPeriodOf, punchMinutes } from './paycheck.js'
import { punchStatus, punchWarnings, STATUS_LABEL } from './review.js'
import { rangeLabel, useNow } from './format.js'
import { REVIEW_DAYS } from './useTeamData.js'

const duration = (minutes) => (minutes >= 1440 ? `${Math.floor(minutes / 1440)}d ` : '') + `${Math.floor((minutes % 1440) / 60)}h ${Math.round(minutes % 60)}m`

// Managers: every punch, newest first, to approve (like Humanity's Manage list).
// ⚠️ marks the ones worth a look; tap one for its details and map.
export default function ReviewList({ data }) {
  const now = useNow()
  const [range, setRange] = useState('week') // 'week' (past 7 days) or 'period' (this pay period)
  const [onlyPending, setOnlyPending] = useState(true)
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const today = dateKey(now)
  const from = range === 'week' ? dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - REVIEW_DAYS)) : payPeriodOf(now)[0]
  const name = (id) => data.employees.find((e) => e.id === id)
  const list = data.punches
    .filter((p) => dateKey(new Date(p.clockIn)) >= from || !p.clockOut)
    .filter((p) => !onlyPending || punchStatus(p) !== 'approved')
    .sort((a, b) => new Date(b.clockIn) - new Date(a.clockIn))
  const pending = list.filter((p) => punchStatus(p) === 'pending')

  const approve = async (ids) => {
    setBusy(true)
    setError('')
    const problem = await data.actions.approvePunches(ids, true)
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
        <label className="form-check small mb-0">
          <input type="checkbox" className="form-check-input" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> Not approved only
        </label>
      </div>
      {range === 'period' && <p className="tm-muted small mb-2">{rangeLabel(payPeriodOf(now))}</p>}

      {list.length ? (
        <div className="tm-card tm-review">
          {list.map((p) => {
            const person = name(p.employeeId)
            const status = punchStatus(p)
            const warnings = punchWarnings(p, data.shifts, data.shop, now)
            const day = fromKey(dateKey(new Date(p.clockIn)))
            return (
              <div key={p.id} className={`tm-rv st-${status}`}>
                <button type="button" className="tm-rv-main" onClick={() => setOpen(p)}>
                  <div className="tm-datebox">
                    <small>{DAY_NAMES[day.getDay()].slice(0, 3).toUpperCase()}</small>
                    <b>{day.getDate()}</b>
                  </div>
                  <div className="tm-rv-body">
                    <b className="tm-rv-name">
                      <Avatar employee={person} size={24} />
                      {person?.name ?? '?'}
                      {warnings.length > 0 && <span className="tm-rv-warn" title={warnings.join('\n')}> ⚠️</span>}
                    </b>
                    <span>
                      {formatClock(p.clockIn)} – {p.clockOut ? formatClock(p.clockOut) : ''}
                      {p.clockOut && dateKey(new Date(p.clockOut)) !== dateKey(new Date(p.clockIn)) && <small className="tm-bad"> (next day)</small>}
                    </span>
                    <small className="tm-muted">{person?.position}</small>
                    <small>
                      <span className={`tm-rv-status st-${status}`}>{STATUS_LABEL[status]}</span> · {duration(punchMinutes(p, now))}
                    </small>
                    {warnings.length > 0 && <small className="tm-rv-why">{warnings[0]}{warnings.length > 1 ? ` (+${warnings.length - 1} more)` : ''}</small>}
                  </div>
                </button>
                {status === 'pending' && (
                  <button type="button" className="btn btn-success btn-sm tm-rv-ok" disabled={busy} onClick={() => approve([p.id])}>Approve</button>
                )}
                {status === 'approved' && <span className="tm-rv-done" title={`Approved by ${p.approvedBy ?? ''}`}>✓</span>}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="tm-empty">{onlyPending ? 'Everything is approved. 🎉' : 'No punches in these days.'}</p>
      )}
      {error && <p className="tm-error" role="alert">{error}</p>}

      {pending.length > 0 && (
        <div className="tm-approve-bar">
          <button type="button" className="btn btn-success w-100" disabled={busy} onClick={() => approve(pending.map((p) => p.id))}>
            Approve all ({pending.length})
          </button>
          {pending.some((p) => punchWarnings(p, data.shifts, data.shop, now).length) && (
            <small>Includes punches with ⚠️. Tap one first to check it.</small>
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
