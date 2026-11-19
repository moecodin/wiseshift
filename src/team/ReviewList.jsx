import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { dateKey, DAY_NAMES, formatClock, fromKey } from '../lib/dates.js'
import PunchDetails from './PunchDetails.jsx'
import PeoplePicker from './PeoplePicker.jsx'
import { PunchEditor } from './HoursTab.jsx'
import { formatHours, moveDays, payPeriodOf, punchMinutes } from './paycheck.js'
import { isLateWarning, punchStatus, punchWarnings, shiftFor, STATUS_LABEL } from './review.js'
import Avatar from './Avatar.jsx'
import { loadDensity, saveDensity } from './viewPref.js'
import { dayLabel, hoursLabel, rangeLabel, scheduleOnly, timeInputToIso, useNow } from './format.js'
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
const duration = (minutes) => `${Math.floor(minutes / 60)}h ${String(Math.round(minutes % 60)).padStart(2, '0')}m`
const dayShort = (key) => `${DAY_NAMES[fromKey(key).getDay()].slice(0, 3)} ${fromKey(key).getDate()}`

// Managers: every punch to approve (like Humanity's Manage list), one short line each so a big team
// fits on a screen. With groups set up (Settings → Business → Groups) the lines sit in one column per
// group, each with its own Approve all. ⚠ marks a punch with a warning (hover for the reason, or open
// Details); the round ✓ approves it, and an Undo shows for a few seconds after any approval.
export default function ReviewList({ data }) {
  const now = useNow()
  const [range, setRange] = useState('week') // 'week' (past 7 days), 'period' (this pay period) or 'last' (the one before)
  const [status, setStatus] = useState('pending') // 'pending' (awaiting approval), 'progress' (still clocked in), 'approved' or 'all'
  const [picked, setPicked] = useState(() => new Set()) // the employees ticked in the picker; none = everyone
  const [adding, setAdding] = useState(null) // a blank punch being added from the toolbar
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Roomy (a card per punch, Approve right under the times) or compact (one line each). Small teams
  // (under 10 people on the clock) start roomy, bigger ones compact; the switch is remembered on this device.
  const [savedDensity, setSavedDensity] = useState(loadDensity)
  const teamSize = data.employees.filter((e) => e.active && !scheduleOnly(e)).length
  const roomy = (savedDensity ?? (teamSize < 10 ? 'roomy' : 'compact')) === 'roomy'
  const setDensity = (value) => {
    saveDensity(value)
    setSavedDensity(value)
  }
  const [groupBy, setGroupBy] = useState(null) // 'group' (staff group), 'role', 'date' or 'none'; null = the best default
  const [undo, setUndo] = useState(null) // { ids, text } for a few seconds after approving

  const today = dateKey(now)
  const thisPeriod = payPeriodOf(now)
  const lastPeriod = moveDays(thisPeriod, -1)
  const from = range === 'week' ? dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - REVIEW_DAYS)) : range === 'last' ? lastPeriod[0] : thisPeriod[0]
  const to = range === 'last' ? lastPeriod.at(-1) : null
  const name = (id) => data.employees.find((e) => e.id === id)
  const inRange = data.punches
    .filter((p) => (dateKey(new Date(p.clockIn)) >= from && (!to || dateKey(new Date(p.clockIn)) <= to)) || (!to && !p.clockOut))
    .filter((p) => !picked.size || picked.has(p.employeeId))
    .sort((a, b) => new Date(b.clockIn) - new Date(a.clockIn))
  const countOf = (st) => inRange.filter((p) => punchStatus(p) === st).length
  const list = status === 'all' ? inRange : inRange.filter((p) => punchStatus(p) === status)
  const people = data.employees.filter((e) => !scheduleOnly(e)).sort((a, b) => a.name.localeCompare(b.name))
  const pending = list.filter((p) => punchStatus(p) === 'pending')
  const pendingMinutes = pending.reduce((sum, p) => sum + punchMinutes(p, now), 0)

  // How the punches are sorted into columns: by staff group (Settings → Business → Groups), by the role
  // on the shift they belong to, by day, or one plain list. Defaults to staff group when groups exist.
  const groups = data.settings.groups ?? []
  const roles = data.settings.roles ?? []
  const mode = groupBy ?? (groups.length > 0 ? 'group' : 'none')
  const grouped = mode !== 'none'
  const byPerson = (a, b) => (name(a.employeeId)?.name ?? '').localeCompare(name(b.employeeId)?.name ?? '') || new Date(b.clockIn) - new Date(a.clockIn)
  const groupOf = (p) => {
    const g = name(p.employeeId)?.group
    return groups.some((x) => x.name === g) ? g : ''
  }
  const roleOf = (p) => shiftFor(p, data.shifts)?.role ?? ''
  let buckets
  if (mode === 'group') {
    buckets = [...groups.map((g) => ({ key: g.name, name: g.name, color: g.color ?? 7, rows: list.filter((p) => groupOf(p) === g.name) })), { key: '', name: 'No group', color: 7, rows: list.filter((p) => groupOf(p) === '') }]
  } else if (mode === 'role') {
    const extra = [...new Set(list.map(roleOf).filter((r) => r && !roles.some((x) => x.name === r)))]
    buckets = [...roles.map((r) => ({ key: r.name, name: r.name, color: r.color ?? 7, rows: list.filter((p) => roleOf(p) === r.name) })), ...extra.map((r) => ({ key: r, name: r, color: 7, rows: list.filter((p) => roleOf(p) === r) })), { key: '', name: 'No role', color: 7, rows: list.filter((p) => !roleOf(p)) }]
  } else if (mode === 'date') {
    const days = [...new Set(list.map((p) => dateKey(new Date(p.clockIn))))].sort() // earliest day first
    buckets = days.map((d) => ({ key: d, name: d === today ? 'Today' : `${dayShort(d)}`, color: d === today ? 0 : 7, rows: list.filter((p) => dateKey(new Date(p.clockIn)) === d) }))
  } else {
    buckets = [{ key: 'all', name: '', color: 7, rows: list }]
  }
  buckets = buckets.filter((b) => b.rows.length > 0)
  for (const b of buckets) {
    if (grouped) b.rows = [...b.rows].sort(byPerson)
    b.pending = b.rows.filter((p) => punchStatus(p) === 'pending')
    b.open = true
  }
  const useGroups = grouped

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

  // Balanced columns: as many as fit across (about 318px each), each group added to the shortest column
  // so far (height estimated from its lines), so uneven groups stack straight down with no gaps.
  const [box, setBox] = useState(null)
  const [boxWidth, setBoxWidth] = useState(0)
  useEffect(() => {
    if (!box) return undefined
    const measure = () => setBoxWidth(box.clientWidth)
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(box)
    return () => watch.disconnect()
  }, [box])
  const columnCount = useGroups ? Math.max(1, Math.min(buckets.length, Math.floor((boxWidth + 12) / (318 + 12)))) : 1
  const columns = Array.from({ length: columnCount }, () => ({ cost: 0, items: [] }))
  // Biggest groups first, so the columns come out about equally tall; within a column the groups keep their usual order.
  const order = new Map(buckets.map((b, i) => [b, i]))
  for (const b of [...buckets].sort((x, y) => y.rows.length - x.rows.length)) {
    const shortest = columns.reduce((best, c) => (c.cost < best.cost ? c : best), columns[0])
    shortest.items.push(b)
    shortest.cost += b.rows.length + 2
  }
  for (const c of columns) c.items.sort((x, y) => order.get(x) - order.get(y))
  // The column holding the first group goes leftmost, so Management (or the newest day) still leads.
  columns.sort((x, y) => (x.items.length ? order.get(x.items[0]) : Infinity) - (y.items.length ? order.get(y.items[0]) : Infinity))
  const columnLists = columns.map((c) => c.items)

  // Roomy: a card per punch, with Approve (or Clock out now) and Details right under the times.
  const renderCards = (bucket) => (
    <div className="rc-grid rv-cards">
      {bucket.rows.map((p) => {
        const person = name(p.employeeId)
        const st = punchStatus(p)
        const warnings = punchWarnings(p, data.shifts, data.shop, now)
        const dayKey = dateKey(new Date(p.clockIn))
        return (
          <article key={p.id} className={`rc st-${st}`}>
            <button type="button" className="rc-main" onClick={() => setOpen(p)}>
              <span className="rc-top">
                <Avatar employee={person} size={36} />
                <span className="rc-who">
                  <b>{person?.name ?? '?'}</b>
                  <small>{mode === 'date' ? roleOf(p) || person?.position : person?.position}</small>
                </span>
                <span className={`rc-chip st-${st}`}>{STATUS_LABEL[st]}</span>
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
              {st === 'pending' && <button type="button" className="btn btn-success rc-ok" disabled={busy} onClick={() => approve([p.id])}>Approve {hoursLabel(punchMinutes(p, now))}</button>}
              {st === 'progress' && <button type="button" className="btn btn-outline-secondary rc-out" disabled={busy} onClick={() => window.confirm(`Clock ${person?.name ?? 'this person'} out now (${formatClock(new Date().toISOString())})?`) && clockOut(p)}>Clock out now</button>}
              {st === 'approved' && <span className="rc-done">Approved{p.approvedBy ? ` by ${p.approvedBy.split(' ')[0]}` : ''}</span>}
              <button type="button" className="btn btn-outline-secondary rc-details" onClick={() => setOpen(p)}>Details</button>
            </div>
          </article>
        )
      })}
    </div>
  )

  // Compact: one short line per punch.
  const renderRows = (bucket) => (
              <div className="rv-rows" style={{ '--nw': `${Math.min(8.5, Math.max(5, ...bucket.rows.map((r) => shortName(name(r.employeeId)?.name).length)))}ch` }}>
                {bucket.rows.map((p, i) => {
                  const person = name(p.employeeId)
                  const st = punchStatus(p)
                  const warnings = punchWarnings(p, data.shifts, data.shop, now)
                  const dayKey = dateKey(new Date(p.clockIn))
                  const again = useGroups && i > 0 && bucket.rows[i - 1].employeeId === p.employeeId
                  const out = p.clockOut ? short(p.clockOut) : '…'
                  // Grouped by date there is no staff group to say what someone does, so each line shows their role
                  // (the shift's role, else their position).
                  const role = mode === 'date' ? roleOf(p) || person?.position || '' : ''
                  const roleColor = roles.find((r) => r.name === role)?.color
                  return (
                    <div key={p.id} className={`rv-row st-${st} ${again ? 'again' : ''}`}>
                      <button type="button" className={`rv-main ${mode === 'date' ? 'with-role' : ''}`} onClick={() => setOpen(p)} title={`${person?.name ?? '?'} · ${formatClock(p.clockIn)} – ${p.clockOut ? formatClock(p.clockOut) : 'still in'}`}>
                        <span className="rv-name">{again ? '' : shortName(person?.name)}</span>
                        {mode === 'date' && <span className="rv-role">{roleColor !== undefined && <i className={`rl-dot t${roleColor}`} aria-hidden="true" />}<span>{role}</span></span>}
                        {mode !== 'date' && <span className="rv-day">{dayShort(dayKey)}</span>}
                        <span className="rv-when">{short(p.clockIn)}–{out}{p.clockOut && dateKey(new Date(p.clockOut)) !== dayKey && <em> +1</em>}</span>
                        <span className="rv-dur">{formatHours(punchMinutes(p, now))}</span>
                        {warnings.length > 0 ? <span className={`rv-warn ${warnings.some(isLateWarning) ? 'late' : ''}`} title={warnings.join('\n')} aria-label={warnings[0]}>⚠</span> : <span className="rv-warn" aria-hidden="true" />}
                      </button>
                      <button type="button" className="rv-more" onClick={() => setOpen(p)} aria-label={`Details for ${person?.name ?? 'this punch'}`} title="Details">⋯</button>
                      {st === 'pending' && <button type="button" className="rv-ok" disabled={busy} onClick={() => approve([p.id])} aria-label={`Approve ${hoursLabel(punchMinutes(p, now))} for ${person?.name ?? 'this person'}`} title={`Approve ${hoursLabel(punchMinutes(p, now))}`}>✓</button>}
                      {st === 'progress' && <button type="button" className="rv-out" disabled={busy} onClick={() => window.confirm(`Clock ${person?.name ?? 'this person'} out now (${formatClock(new Date().toISOString())})?`) && clockOut(p)} title="Clock out now">Out</button>}
                      {st === 'approved' && <span className="rv-done" title="Approved" aria-label="Approved">✓</span>}
                    </div>
                  )
                })}
              </div>
  )

  const renderBucket = (bucket) => (
            <Group key={bucket.key} header={useGroups} open={bucket.open}>
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
              {roomy ? renderCards(bucket) : renderRows(bucket)}
            </Group>
  )

  return (
    <div>
      <div className="tm-filters rv-filters">
        <PeoplePicker people={people} groups={groups} picked={picked} onChange={setPicked} />
        <select className="form-select form-select-sm rv-period" aria-label="Which days" value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="week">Past {REVIEW_DAYS} days</option>
          <option value="period">This pay period</option>
          <option value="last">Last pay period</option>
        </select>
        <select className="form-select form-select-sm rv-period rv-groupby" aria-label="Group by" value={mode} onChange={(e) => setGroupBy(e.target.value)}>
          {groups.length > 0 && <option value="group">By staff group</option>}
          {roles.length > 0 && <option value="role">By role</option>}
          <option value="date">By date</option>
          <option value="none">One list</option>
        </select>
        <div className="tm-seg rv-density" role="group" aria-label="Layout">
          <button type="button" aria-pressed={roomy} onClick={() => setDensity('roomy')}>Roomy</button>
          <button type="button" aria-pressed={!roomy} onClick={() => setDensity('compact')}>Compact</button>
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm rv-add" onClick={() => setAdding({ employeeId: picked.size === 1 ? [...picked][0] : '', clockIn: timeInputToIso(today, '08:00'), clockOut: timeInputToIso(today, '14:00'), note: '', isNew: true, chooseWho: true })}>+ Add punch</button>
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
        roomy ? (
          <div className="rv roomy">{buckets.map(renderBucket)}</div>
        ) : (
          <div ref={setBox} className={`rv ${useGroups ? 'cols' : ''}`} style={useGroups ? { gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` } : undefined}>
            {columnLists.map((col, ci) => (
              <div key={ci} className="rv-col">{col.map(renderBucket)}</div>
            ))}
          </div>
        )
      ) : (
        <p className="tm-empty">{picked.size ? `Nothing here for ${picked.size === 1 ? name([...picked][0])?.name ?? 'this person' : 'the people picked'} in these days.` : status === 'pending' ? 'Nothing is waiting for approval. 🎉' : status === 'progress' ? 'Nobody is clocked in right now.' : 'No punches in these days.'}</p>
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

      {/* In the page body, not here: the page slides in with a transform, which would pin this to the wrong box. */}
      {undo && createPortal(
        <div className="rv-toast" role="status">
          <span>{undo.text}</span>
          <button type="button" onClick={undoApprove}>Undo</button>
        </div>,
        document.body,
      )}
      {adding && <PunchEditor punch={adding} data={data} onClose={() => setAdding(null)} />}
      {open && <PunchDetails punch={open} data={data} onClose={() => setOpen(null)} />}
    </div>
  )
}

// A group's lines: collapsible (with its header as the summary) when grouped, a plain box otherwise.
function Group({ header, open, children }) {
  return header ? <details className="rv-group" open={open}>{children}</details> : <div className="rv-group">{children}</div>
}
