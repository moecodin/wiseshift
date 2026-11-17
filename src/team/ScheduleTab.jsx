import { useEffect, useRef, useState } from 'react'
import Modal from '../components/Modal.jsx'
import { dateKey, fromKey } from '../lib/dates.js'
import { formatHours, moveDays, scheduleWeekOf, shiftMinutes } from './paycheck.js'
import { clockTime, dayLabel, fromTimeInput, offOn, rangeLabel, scheduleOnly, shiftTimes, toTimeInput, useNow } from './format.js'
import { rangeName, say } from './words.js'
import MySchedule, { tagClass } from './MySchedule.jsx'
import Avatar from './Avatar.jsx'
import DayStrip from './DayStrip.jsx'
import RoleBadge from './RoleBadge.jsx'
import { activeCover } from './CoverUI.jsx'

// The week's schedule: everyone (a grid like Humanity) or just mine.
// Managers click a box to add or change a shift; new shifts are drafts that
// only managers see until Publish.
export default function ScheduleTab({ data, me, boss, look, lang, week, onWeek }) {
  // Employees start on their own shifts; managers on the whole-team grid.
  const [view, setView] = useState(boss ? 'everyone' : 'mine')
  const [editing, setEditing] = useState(null)
  const [span, setSpan] = useState('day') // manager on a phone: one day of cards, or the whole week grid
  const [message, setMessage] = useState('')
  const now = useNow()
  const today = dateKey(now)
  const people = data.employees.filter((e) => e.active)
  const shifts = data.shifts.filter((s) => week.includes(s.date)).sort((a, b) => a.start - b.start)
  const drafts = shifts.filter((s) => !s.published)
  const thisWeek = scheduleWeekOf(now)[0] === week[0]
  // Shifts that were drafts a moment ago and are published now get a short ripple.
  const [flash, setFlash] = useState(() => new Set())
  const draftIds = useRef(new Set())
  const flashTimer = useRef(0)
  useEffect(() => {
    const nowDrafts = new Set(drafts.map((s) => s.id))
    const done = [...draftIds.current].filter((id) => !nowDrafts.has(id) && shifts.some((s) => s.id === id))
    draftIds.current = nowDrafts
    if (!done.length) return
    setFlash(new Set(done))
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(new Set()), 1100)
  })
  useEffect(() => () => clearTimeout(flashTimer.current), [])

  const copyLastWeek = async () => {
    const { error, copied } = await data.actions.copyWeek(moveDays(week, -1), week)
    setMessage(error || (copied ? `Copied ${copied} shift${copied === 1 ? '' : 's'} from last week as drafts.` : 'Nothing new to copy from last week.'))
  }
  const publish = async () => {
    const problem = await data.actions.publishWeek(week)
    setMessage(problem || `Published ${drafts.length} shift${drafts.length === 1 ? '' : 's'}. The team can see them now.`)
  }

  return (
    <div>
      <div className="tm-toolbar">
        <div className="tm-weeknav">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onWeek(moveDays(week, -1))} aria-label="Week before">‹</button>
          <b>{rangeLabel(week)}</b>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onWeek(moveDays(week, 1))} aria-label="Week after">›</button>
          {!thisWeek && <button type="button" className="btn btn-link btn-sm" onClick={() => onWeek(scheduleWeekOf(new Date()))}>This week</button>}
        </div>
        {boss && (
          <div className="tm-seg mg-seg" role="group" aria-label="Whose shifts">
            <button type="button" aria-pressed={view === 'everyone'} onClick={() => setView('everyone')}>Whole team</button>
            <button type="button" aria-pressed={view === 'mine'} onClick={() => setView('mine')}>My shifts</button>
          </div>
        )}
        {boss && (
          <div className="tm-tools">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={copyLastWeek}>Copy last week</button>
            <button type="button" className="btn btn-success btn-sm" disabled={!drafts.length} onClick={publish}>Publish ({drafts.length})</button>
          </div>
        )}
      </div>
      {message && <p className="tm-msg" role="status">{message}</p>}
      {boss && drafts.length > 0 && <p className="tm-muted small">Dashed shifts are drafts: only managers see them until you press Publish.</p>}

      {!boss ? (
        <MySchedule data={data} me={me} week={week} today={today} lang={lang} view={view} onView={setView} />
      ) : view === 'everyone' ? (
        <>
        <ManagerDay span={span} onSpan={setSpan} flash={flash} view={view} onView={setView} data={data} me={me} week={week} today={today} people={people} shifts={shifts} onEdit={setEditing} />
        <div className={`tm-gridwrap mg-grid ${span === 'week' ? 'show-phone' : ''}`}>
          <table className="tm-grid">
            <thead>
              <tr>
                <th scope="col">{rangeLabel(week)}</th>
                {week.map((d) => (
                  <th key={d} scope="col" className={d === today ? 'today' : ''}>
                    <span className="gr-dow">{fromKey(d).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    <span className="gr-date">{fromKey(d).getDate()}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((person) => {
                const theirs = shifts.filter((s) => s.employeeId === person.id)
                return (
                  <tr key={person.id} className={person.id === me.id ? 'me' : ''}>
                    <th scope="row">
                      <div className="gr-person">
                        <Avatar employee={person} size={34} />
                        <div>
                          <b>
                            {person.name}
                            {boss && person.id !== me.id && !scheduleOnly(person) && <SeenTick shifts={theirs} seenAt={data.seenById?.[person.id]} ready={data.seenById != null} />}
                          </b>
                          <small>{person.position}</small>
                          <small className="tm-hrs">{formatHours(theirs.reduce((sum, s) => sum + shiftMinutes(s), 0))} hrs</small>
                        </div>
                      </div>
                    </th>
                    {week.map((d) => {
                      const dayShifts = theirs.filter((s) => s.date === d)
                      const off = offOn(data.teamOff, person.id, d)
                      return (
                        <td key={d} className={d === today ? 'today' : ''}>
                          {off && <div className="tm-off">Time off</div>}
                          {dayShifts.map((s) => (
                            <ShiftBox key={s.id} cover={activeCover(data.cover, s.id)} flash={flash.has(s.id)} shift={s} roles={data.settings?.roles} presets={data.settings?.shiftPresets} onClick={boss ? () => setEditing(s) : undefined} />
                          ))}
                          {boss && (
                            <button type="button" className="tm-add" aria-label={`Add a shift for ${person.name} on ${dayLabel(d)}`} onClick={() => setEditing({ employeeId: person.id, date: d, start: 480, end: 840, breakMin: 0, title: '', role: '', note: '', published: false })}>
                              +
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Hours</th>
                {week.map((d) => (
                  <td key={d}>{formatHours(shifts.filter((s) => s.date === d).reduce((sum, s) => sum + shiftMinutes(s), 0))}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        </>
      ) : (
        <MySchedule data={data} me={me} week={week} today={today} lang={lang} view={view} onView={setView} />
      )}

      {editing && <ShiftEditor shift={editing} data={data} week={week} onClose={() => setEditing(null)} />}
    </div>
  )
}

// Manager's phone view of the whole team: pick a day on the strip, then see one
// card per person with their shifts (tap a shift to change it, + to add one).
// Wide screens show the grid above instead (see .mg-phone / .mg-grid in team.css).
function ManagerDay({ span, onSpan, view, onView, data, me, week, today, people, shifts, flash, onEdit }) {
  const [picked, setPicked] = useState(null)
  const selected = week.includes(picked) ? picked : week.includes(today) ? today : week[0]
  const presets = data.settings?.shiftPresets
  const roles = data.settings?.roles
  const dayShifts = shifts.filter((s) => s.date === selected)
  const dayHours = dayShifts.reduce((sum, s) => sum + shiftMinutes(s), 0)
  const working = new Set(dayShifts.map((s) => s.employeeId)).size
  const heading = selected === today ? 'Today' : fromKey(selected).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const blank = (person) => ({ employeeId: person.id, date: selected, start: 480, end: 840, breakMin: 0, title: '', role: '', note: '', published: false })
  return (
    <div className="tm-narrow mg-phone">
      <div className="sc-toggle" role="group" aria-label="Whose shifts">
        <button type="button" aria-pressed={view === 'mine'} onClick={() => onView('mine')}>My shifts</button>
        <button type="button" aria-pressed={view === 'everyone'} onClick={() => onView('everyone')}>Whole team</button>
      </div>
      <div className="sc-toggle sc-span" role="group" aria-label="Show a day or the week">
        <button type="button" aria-pressed={span === 'day'} onClick={() => onSpan('day')}>Day</button>
        <button type="button" aria-pressed={span === 'week'} onClick={() => onSpan('week')}>Week</button>
      </div>
      {span === 'day' && <>
      <DayStrip days={week} selected={selected} renderDay={(d) => {
          const any = shifts.some((s) => s.date === d)
          return (
            <button key={d} type="button" className={`sc-day ${d === selected ? 'on' : ''}`} aria-pressed={d === selected} onClick={() => setPicked(d)}>
              <span>{fromKey(d).toLocaleDateString('en-US', { weekday: 'narrow' }).toUpperCase()}</span>
              <b>{fromKey(d).getDate()}</b>
              <i className={any ? 'dot' : ''} />
            </button>
          )
        }} />
      <div key={selected} className="sc-fade">
      <h2 className="sc-h">{heading} <small className="mg-sum">{working} working · {formatHours(dayHours)} hrs</small></h2>
      {people.map((person) => {
        const theirs = shifts.filter((s) => s.employeeId === person.id)
        const mine = dayShifts.filter((s) => s.employeeId === person.id)
        const off = offOn(data.teamOff, person.id, selected)
        return (
          <div key={person.id} className={`sc-row person mg-person ${person.id === me.id ? 'me' : ''} ${!mine.length ? 'free' : ''}`}>
            <Avatar employee={person} size={42} />
            <div className="sc-body">
              <b>
                {person.name}{person.id === me.id ? ' (you)' : ''}
                {person.id !== me.id && !scheduleOnly(person) && <SeenTick shifts={theirs} seenAt={data.seenById?.[person.id]} ready={data.seenById != null} />}
              </b>
              {off && <small>Time off</small>}
              {mine.map((s) => (
                <button key={s.id} type="button" className={`mg-shift ${s.published ? '' : 'draft'} ${flash.has(s.id) ? 'flash' : ''}`} onClick={() => onEdit(s)}>
                  <span className="sc-time">{shiftTimes(s)}</span>
                  {s.title && <span className={tagClass(s.title, presets)}>{s.title}</span>}
                  <RoleBadge role={s.role} roles={roles} />
                  {activeCover(data.cover, s.id) && <span className="cv-tag">cover?</span>}
                  {!s.published && <small>Draft</small>}
                </button>
              ))}
              {!mine.length && !off && <small>Off · {person.position}</small>}
            </div>
            <button type="button" className="mg-add" aria-label={`Add a shift for ${person.name}`} onClick={() => onEdit(blank(person))}>+</button>
          </div>
        )
      })}
      </div>
      </>}
    </div>
  )
}

// Managers: has this person opened the app since their shifts this week were
// posted? ✓ gray = posted, not yet; ✓✓ blue = yes (Humanity's "logged in since
// shift was posted"). Tap for the times. Same look in every theme.
function SeenTick({ shifts, seenAt, ready }) {
  const [open, setOpen] = useState(false)
  const posted = shifts.filter((s) => s.published && s.postedAt).map((s) => s.postedAt).sort().at(-1)
  if (!ready || !posted) return null
  const seen = Boolean(seenAt && new Date(seenAt) >= new Date(posted))
  const when = (iso) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const label = seen ? `Seen: logged in since shift was posted` : 'Posted, not logged in since'
  return (
    <>
      <button type="button" className={`rp-seen ${seen ? 'seen' : ''}`} aria-label={label} title={label} aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 18 12" aria-hidden="true">
          {seen && <path d="M1 6.5l3 3L10.5 3" />}
          <path d={seen ? 'M6.5 8.5l1 1L14 3' : 'M4 6.5l3 3L13.5 3'} />
        </svg>
      </button>
      {open && (
        <span className="rp-seen-note" role="status">
          {seen ? <>✓✓ Logged in since shift was posted</> : <>✓ Not logged in since shift was posted</>}
          <span>Posted {when(posted)}</span>
          <span>Last opened the app: {seenAt ? when(seenAt) : 'never'}</span>
        </span>
      )}
    </>
  )
}

// Hours on my schedule for a week, and roughly what that pays before taxes
// (like Humanity's weekly total; the pay line is hidden for now). On the Clock tab and Schedule → Just me.
export function WeekTotal({ data, me, week, lang, onClick }) {
  const w = say(lang)
  const today = dateKey(useNow())
  const minutes = data.shifts.filter((s) => s.employeeId === me.id && week.includes(s.date)).reduce((sum, s) => sum + shiftMinutes(s), 0)
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} className="tm-card tm-summary" onClick={onClick}>
      <span>
        {week.includes(today) ? w.scheduledWeek : w.scheduled} <small>{rangeName(week, lang)}</small>
      </span>
      <span className="text-end">
        <b>{formatHours(minutes)} {w.hrs}</b>
      </span>
    </Tag>
  )
}

function ShiftBox({ shift, roles, presets, flash, cover, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  // The shift type's color (Open, Close…) tints the box; no type means a plain cream box.
  const tint = shift.title ? tagClass(shift.title, presets).match(/t\d/)?.[0] : ''
  return (
    <Tag type={onClick ? 'button' : undefined} className={`tm-shift ${tint} ${shift.published ? '' : 'draft'} ${flash ? 'flash' : ''}`} onClick={onClick}>
      <b>{shiftTimes(shift)}</b>
      <span className="gr-meta">{shift.title ? `${shift.title} · ` : ''}{formatHours(shiftMinutes(shift))} hrs</span>
      {shift.role && <RoleBadge role={shift.role} roles={roles} />}
      {cover && <span className="cv-tag">cover?</span>}
      {shift.note && <span className="tm-shift-note">{shift.note}</span>}
    </Tag>
  )
}

// Add or change one shift.
function ShiftEditor({ shift, data, week, onClose }) {
  // Quick picks (⚙️ → Business), starting from the Humanity schedule.
  const presets = data.settings.shiftPresets
  const roles = data.settings.roles ?? []
  const [s, setS] = useState({ ...shift })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (field) => (e) => setS({ ...s, [field]: e.target.value })
  const person = data.employees.find((e) => e.id === s.employeeId)
  const days = week.includes(s.date) ? week : scheduleWeekOf(fromKey(s.date))
  const off = offOn(data.teamOff, s.employeeId, s.date)
  const overlap = data.shifts.find((x) => x.id !== s.id && x.employeeId === s.employeeId && x.date === s.date && x.start < s.end && s.start < x.end)

  const save = async () => {
    if (s.start === null || s.end === null || s.end <= s.start) return setError('The end time has to be after the start time.')
    setBusy(true)
    const problem = await data.actions.saveShift({ ...s, breakMin: Number(s.breakMin) || 0, title: s.title.trim(), role: s.role ?? '', note: s.note.trim() })
    setBusy(false)
    if (problem) setError(problem)
    else onClose()
  }
  const remove = async () => {
    setBusy(true)
    const problem = await data.actions.deleteShift(s.id)
    setBusy(false)
    if (problem) setError(problem)
    else onClose()
  }

  return (
    <Modal
      title={s.id ? 'Change shift' : 'Add shift'}
      onClose={onClose}
      footer={
        <>
          {s.id && <button type="button" className="btn btn-outline-danger me-auto" disabled={busy} onClick={remove}>Delete</button>}
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-brand" disabled={busy} onClick={save}>Save</button>
        </>
      }
    >
      <div className="row g-2">
        <div className="col-7">
          <label className="form-label" htmlFor="sh-who">Who</label>
          <select id="sh-who" className="form-select" value={s.employeeId} onChange={set('employeeId')}>
            {data.employees.filter((e) => e.active || e.id === s.employeeId).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="col-5">
          <label className="form-label" htmlFor="sh-day">Day</label>
          <select id="sh-day" className="form-select" value={s.date} onChange={set('date')}>
            {days.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
          </select>
        </div>
        <div className="col-12">
          <div className="tm-presets">
            {presets.map((p) => (
              <button key={p.title} type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setS({ ...s, ...p })}>
                {p.title} <small>{clockTime(p.start)}–{clockTime(p.end)}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="col-6">
          <label className="form-label" htmlFor="sh-start">Start</label>
          <input id="sh-start" type="time" step="900" className="form-control" value={s.start === null ? '' : toTimeInput(s.start)} onChange={(e) => setS({ ...s, start: fromTimeInput(e.target.value) })} />
        </div>
        <div className="col-6">
          <label className="form-label" htmlFor="sh-end">End</label>
          <input id="sh-end" type="time" step="900" className="form-control" value={s.end === null ? '' : toTimeInput(s.end)} onChange={(e) => setS({ ...s, end: fromTimeInput(e.target.value) })} />
        </div>
        <div className="col-7">
          <label className="form-label" htmlFor="sh-title">Label</label>
          <input id="sh-title" className="form-control" list="sh-titles" value={s.title} placeholder="Open, Close, All Day…" onChange={set('title')} />
          <datalist id="sh-titles">{presets.map((p) => <option key={p.title} value={p.title} />)}</datalist>
        </div>
        <div className="col-5">
          <label className="form-label" htmlFor="sh-break">Unpaid break (min)</label>
          <input id="sh-break" type="number" min="0" step="15" className="form-control" value={s.breakMin} onChange={set('breakMin')} />
        </div>
        <div className="col-12">
          <span className="form-label d-block" id="sh-role-l">Role</span>
          <div className="rl-picks" role="group" aria-labelledby="sh-role-l">
            <button type="button" className="rl-pick" aria-pressed={!s.role} onClick={() => setS({ ...s, role: '' })}>None</button>
            {roles.map((r) => (
              <button key={r.name} type="button" className="rl-pick" aria-pressed={s.role === r.name} onClick={() => setS({ ...s, role: r.name })}>
                <i className={`rl-dot t${r.color ?? 0}`} aria-hidden="true" />{r.name}
              </button>
            ))}
            {s.role && !roles.some((r) => r.name === s.role) && <button type="button" className="rl-pick" aria-pressed="true"><i className="rl-dot none" aria-hidden="true" />{s.role}</button>}
          </div>
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="sh-note">Note</label>
          <input id="sh-note" className="form-control" value={s.note} maxLength={200} onChange={set('note')} />
        </div>
      </div>
      {off && <p className="tm-warn mt-3">{person?.name} has approved time off that day.</p>}
      {overlap && <p className="tm-warn mt-3">This overlaps {person?.name}'s other shift ({shiftTimes(overlap)}).</p>}
      {!s.published && <p className="tm-muted small mt-3 mb-0">Draft until you press Publish on the schedule.</p>}
      {error && <p className="tm-error mt-2" role="alert">{error}</p>}
    </Modal>
  )
}
