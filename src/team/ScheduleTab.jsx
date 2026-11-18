import { useEffect, useRef, useState } from 'react'
import Modal from '../components/Modal.jsx'
import { dateKey, fromKey } from '../lib/dates.js'
import { formatHours, moveDays, scheduleWeekOf, shiftMinutes } from './paycheck.js'
import { clockTime, dayLabel, fromTimeInput, offOn, rangeLabel, shiftTimes, toTimeInput, useNow } from './format.js'
import { rangeName, say } from './words.js'
import MySchedule from './MySchedule.jsx'
import WeekGrid from './WeekGrid.jsx'
import { useFeature } from './features.js'
import DayTimeline from './DayTimeline.jsx'
import { loadSpan, saveSpan } from './viewPref.js'
import DayStrip from './DayStrip.jsx'
import ShiftDropDialog from './ShiftDropDialog.jsx'

// The week's schedule: everyone (a grid like Humanity) or just mine.
// Managers click a box to add or change a shift; new shifts are drafts that
// only managers see until Publish.
export default function ScheduleTab({ data, me, boss, look, lang, week, onWeek }) {
  // Employees start on their own shifts; managers on the whole-team grid.
  const [view, setView] = useState(boss ? 'everyone' : 'mine')
  const [editing, setEditing] = useState(null)
  // Manager on a phone: the day timeline or the week grid. The last choice is remembered.
  const [span, setSpan] = useState(loadSpan)
  const changeSpan = (next) => {
    setSpan(next)
    saveSpan(next)
  }
  const [pickedDay, setPickedDay] = useState(null)
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
  // Clear the week's drafts (published shifts stay), with a short Undo.
  const [undoClear, setUndoClear] = useState(null)
  useEffect(() => {
    if (!undoClear) return undefined
    const timer = setTimeout(() => setUndoClear(null), 8000)
    return () => clearTimeout(timer)
  }, [undoClear])
  const clearDrafts = async () => {
    if (!window.confirm(`Clear ${drafts.length} unpublished shift${drafts.length === 1 ? '' : 's'} for ${rangeLabel(week)}? Shifts you've published stay.`)) return
    const { error, removed } = await data.actions.clearDrafts(week)
    if (error) return setMessage(error)
    setMessage(`Cleared ${removed.length} unpublished shift${removed.length === 1 ? '' : 's'}.`)
    setUndoClear(removed)
  }
  const restore = async () => {
    const list = undoClear
    setUndoClear(null)
    const problem = await data.actions.restoreShifts(list)
    setMessage(problem || `Put back ${list.length} shift${list.length === 1 ? '' : 's'}.`)
  }
  // A shift was dragged somewhere new: ask Move or Copy (nothing if it landed where it started).
  const [dropping, setDropping] = useState(null)
  const dropShift = (shift, target) => {
    const same = shift.employeeId === target.employeeId && shift.date === target.date && shift.start === target.start && shift.end === target.end
    if (!same) setDropping({ shift, target })
  }
  const publish = async () => {
    const problem = await data.actions.publishWeek(week)
    setMessage(problem || `Published ${drafts.length} shift${drafts.length === 1 ? '' : 's'}. The team can see them now.`)
  }

  return (
    <div>
      <div className="tm-toolbar">
        <div className="tm-weeknav nav-center">
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
            <button type="button" className="btn btn-outline-danger btn-sm" disabled={!drafts.length} onClick={clearDrafts} title="Remove this week's unpublished shifts (published ones stay)">Clear ({drafts.length})</button>
            <button type="button" className="btn btn-success btn-sm" disabled={!drafts.length} onClick={publish}>Publish ({drafts.length})</button>
          </div>
        )}
      </div>
      {message && (
        <p className="tm-msg" role="status">
          {message}
          {undoClear && undoClear.length > 0 && <> <button type="button" className="tm-link" onClick={restore}>Undo</button></>}
        </p>
      )}
      {boss && drafts.length > 0 && <p className="tm-muted small">Dashed shifts are drafts: only managers see them until you press Publish.</p>}

      {!boss ? (
        <MySchedule data={data} me={me} week={week} today={today} lang={lang} view={view} onView={setView} />
      ) : view === 'everyone' ? (
        <>
        <ManagerDay span={span} onSpan={changeSpan} picked={pickedDay} onPick={setPickedDay} flash={flash} view={view} onView={setView} data={data} me={me} week={week} today={today} shifts={shifts} onEdit={setEditing} onDrop={dropShift} />
        <WeekGrid className={`mg-grid ${span === 'week' ? 'show-phone' : ''}`} data={data} me={me} week={week} today={today} people={people} shifts={shifts} editable showSeen flash={flash} onEdit={setEditing} onDrop={dropShift} onPickDay={(d) => { setPickedDay(d); changeSpan('day') }} />
        </>
      ) : (
        <MySchedule data={data} me={me} week={week} today={today} lang={lang} view={view} onView={setView} />
      )}

      {dropping && <ShiftDropDialog shift={dropping.shift} target={dropping.target} data={data} onClose={() => setDropping(null)} onDone={(text) => { setDropping(null); setMessage(text) }} />}
      {editing && <ShiftEditor shift={editing} data={data} week={week} onClose={() => setEditing(null)} />}
    </div>
  )
}

// Manager's phone view of the whole team: pick a day on the strip, then see that day as a
// timeline (tap a bar to change a shift, + to add one). "Week" shows the week grid instead.
// Wide screens always show the grid (see .mg-phone / .mg-grid in team.css).
function ManagerDay({ span, onSpan, picked, onPick, view, onView, data, me, week, today, shifts, flash, onEdit, onDrop }) {
  const selected = week.includes(picked) ? picked : week.includes(today) ? today : week[0]
  const blank = () => ({ employeeId: me.id, date: selected, start: 480, end: 840, breakMin: 0, title: '', role: '', note: '', published: false })
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
            <button key={d} type="button" className={`sc-day ${d === selected ? 'on' : ''}`} aria-pressed={d === selected} onClick={() => onPick(d)}>
              <span>{fromKey(d).toLocaleDateString('en-US', { weekday: 'narrow' }).toUpperCase()}</span>
              <b>{fromKey(d).getDate()}</b>
              <i className={any ? 'dot' : ''} />
            </button>
          )
        }} />
      <div key={selected} className="sc-fade">
        <DayTimeline mode="manager" data={data} me={me} date={selected} today={today} lang="en" flash={flash} onEdit={onEdit} onDrop={onDrop} onAdd={() => onEdit(blank())} />
      </div>
      </>}
    </div>
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

// Add or change one shift.
function ShiftEditor({ shift, data, week, onClose }) {
  // Quick picks (⚙️ → Business), starting from the Humanity schedule.
  const presets = data.settings.shiftPresets
  const roles = data.settings.roles ?? []
  const rolesOn = useFeature('roles')
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
    if (!window.confirm('Delete this shift? This can’t be undone.')) return
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
        {rolesOn && (
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
        )}
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
