import { useEffect, useState } from 'react'
import { dateKey, DAY_NAMES, formatClock, fromKey } from '../lib/dates.js'
import Avatar from './Avatar.jsx'
import PunchDetails from './PunchDetails.jsx'
import { formatHours, payPeriodOf, punchMinutes } from './paycheck.js'
import { isLateWarning, punchStatus, punchWarnings } from './review.js'
import { hoursLabel, rangeLabel, scheduleOnly, useNow } from './format.js'
import { REVIEW_DAYS } from './useTeamData.js'

// "Maria L.", "8a", "Tue 17": short forms so a punch fits on one line.
const shortName = (full = '') => {
  const [first, ...rest] = full.trim().split(/\s+/)
  return rest.length ? `${first} ${rest.at(-1)[0]}.` : first ?? '?'
}
const short = (iso) => {
  const d = new Date(iso)
  const h = d.getHours() % 12 || 12
  const m = d.getMinutes()
  return `${h}${m ? `:${String(m).padStart(2, '0')}` : ''}${d.getHours() < 12 ? 'a' : 'p'}`
}
const dayShort = (key) => `${DAY_NAMES[fromKey(key).getDay()].slice(0, 3)} ${fromKey(key).getDate()}`

// Managers: every punch to approve (like Humanity's Manage list), one short line each so a big team
// fits on a screen. With groups set up (Settings → Business → Groups) the lines sit in one column per
// group, each with its own Approve all. ⚠ marks a punch with a warning (hover for the reason, or open
// Details); the round ✓ approves it, and an Undo shows for a few seconds after any approval.
export default function ReviewList({ data }) {
  const now = useNow()
  const [range, setRange] = useState('week') // 'week' (past 7 days) or 'period' (this pay period)
  const [status, setStatus] = useState('pending') // 'pending' (awaiting approval), 'progress' (still clocked in), 'approved' or 'all'
  const [who, setWho] = useState('') // '' = everyone, otherwise one employee's id
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [grouped, setGrouped] = useState(true) // one column per group, or one plain list
  const [undo, setUndo] = useState(null) // { ids, text } for a few seconds after approving

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

  // Groups (Settings → Business → Groups). With none set up, or with grouping switched off, it's one list.
  const groups = data.settings.groups ?? []
  const useGroups = grouped && groups.length > 0
  const groupOf = (p) => {
    const g = name(p.employeeId)?.group
    return groups.some((x) => x.name === g) ? g : ''
  }
  const byPerson = (a, b) => (name(a.employeeId)?.name ?? '').localeCompare(name(b.employeeId)?.name ?? '') || new Date(b.clockIn) - new Date(a.clockIn)
  const buckets = useGroups
    ? [...groups.map((g) => ({ key: g.name, name: g.name, color: g.color ?? 7, rows: list.filter((p) => groupOf(p) === g.name).sort(byPerson) })), { key: '', name: 'No group', color: 7, rows: list.filter((p) => groupOf(p) === '').sort(byPerson) }]
        .filter((b) => b.rows.length > 0)
    : [{ key: 'all', name: '', color: 7, rows: list }]
  for (const b of buckets) {
    b.pending = b.rows.filter((p) => punchStatus(p) === 'pending')
    b.open = true
  }

  const approve = async (ids) => {
    setBusy(true)
    setError('')
    const problem = await data.actions.approvePunches(ids, true)
    setBusy(false)
    if (problem) setError(problem)
    else setUndo({ ids, text: `Approved ${ids.length} ${ids.length === 1 ? 'punch' : 'punches'}` })
  }
  const undoApprove = async () => {
    const ids = undo.ids
    setUndo(null)
    const problem = await data.actions.approvePunches(ids, false)
    if (problem) setError(problem)
  }
  useEffect(() => {
    if (!undo) return undefined
    const timer = setTimeout(() => setUndo(null), 6500)
    return () => clearTimeout(timer)
  }, [undo])

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
        {groups.length > 0 && (
          <div className="tm-seg rv-mode" role="group" aria-label="Layout">
            <button type="button" aria-pressed={grouped} onClick={() => setGrouped(true)}>Groups</button>
            <button type="button" aria-pressed={!grouped} onClick={() => setGrouped(false)}>One list</button>
          </div>
        )}
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
        <div className={`rv ${useGroups ? 'cols' : ''}`}>
          {buckets.map((bucket) => (
            <details key={bucket.key} className="rv-group" open={bucket.open}>
              {useGroups && (
                <summary className="rv-head">
                  <i className={`rl-dot t${bucket.color}`} aria-hidden="true" />
                  <b>{bucket.name}</b>
                  <small>{bucket.rows.length} {bucket.rows.length === 1 ? 'punch' : 'punches'}{bucket.pending.length > 0 && ` · ${formatHours(bucket.pending.reduce((sum, p) => sum + punchMinutes(p, now), 0))} hrs`}</small>
                  {bucket.pending.length > 0 && (
                    <button type="button" className="rv-all" disabled={busy} onClick={(e) => { e.preventDefault(); approve(bucket.pending.map((p) => p.id)) }}>Approve {bucket.pending.length}</button>
                  )}
                </summary>
              )}
              <div className="rv-rows">
                {bucket.rows.map((p, i) => {
                  const person = name(p.employeeId)
                  const st = punchStatus(p)
                  const warnings = punchWarnings(p, data.shifts, data.shop, now)
                  const dayKey = dateKey(new Date(p.clockIn))
                  const again = useGroups && i > 0 && bucket.rows[i - 1].employeeId === p.employeeId
                  const out = p.clockOut ? short(p.clockOut) : '…'
                  return (
                    <div key={p.id} className={`rv-row st-${st} ${again ? 'again' : ''}`}>
                      <button type="button" className="rv-main" onClick={() => setOpen(p)} title={`${person?.name ?? '?'} · ${formatClock(p.clockIn)} – ${p.clockOut ? formatClock(p.clockOut) : 'still in'}`}>
                        <span className="rv-av"><Avatar employee={person} size={22} /></span>
                        <span className="rv-name">{again ? '' : shortName(person?.name)}</span>
                        <span className="rv-when">{dayShort(dayKey)} · {short(p.clockIn)}–{out}{p.clockOut && dateKey(new Date(p.clockOut)) !== dayKey && <em> +1</em>}</span>
                        <span className="rv-dur">{formatHours(punchMinutes(p, now))}</span>
                        {warnings.length > 0 && <span className={`rv-warn ${warnings.some(isLateWarning) ? 'late' : ''}`} title={warnings.join('\n')} aria-label={warnings[0]}>⚠</span>}
                      </button>
                      <button type="button" className="rv-more" onClick={() => setOpen(p)} aria-label={`Details for ${person?.name ?? 'this punch'}`} title="Details">⋯</button>
                      {st === 'pending' && <button type="button" className="rv-ok" disabled={busy} onClick={() => approve([p.id])} aria-label={`Approve ${hoursLabel(punchMinutes(p, now))} for ${person?.name ?? 'this person'}`} title={`Approve ${hoursLabel(punchMinutes(p, now))}`}>✓</button>}
                      {st === 'progress' && <button type="button" className="rv-out" disabled={busy} onClick={() => window.confirm(`Clock ${person?.name ?? 'this person'} out now (${formatClock(new Date().toISOString())})?`) && clockOut(p)} title="Clock out now">Out</button>}
                      {st === 'approved' && <span className="rv-done" title="Approved" aria-label="Approved">✓</span>}
                    </div>
                  )
                })}
              </div>
            </details>
          ))}
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

      {undo && (
        <div className="rv-toast" role="status">
          <span>{undo.text}</span>
          <button type="button" onClick={undoApprove}>Undo</button>
        </div>
      )}
      {open && <PunchDetails punch={open} data={data} onClose={() => setOpen(null)} />}
    </div>
  )
}
