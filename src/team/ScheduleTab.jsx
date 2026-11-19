import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
import Icon from './Icon.jsx'

// The week's schedule: everyone (a grid like Humanity) or just mine.
// Managers click a box to add or change a shift; new shifts are drafts that
// only managers see until Publish.
export default function ScheduleTab({ data, me, boss, look, lang, week, onWeek }) {
  // Employees start on their own shifts; managers on the whole-team grid.
  const [view, setView] = useState(boss ? 'everyone' : 'mine')
  const [weekDir, setWeekDir] = useState('') // which way the week was just moved, for the grid's short slide
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
  // Publishing confirms with a small toast (a check and one line) that goes away by itself.
  const [published, setPublished] = useState('')
  useEffect(() => {
    if (!published) return undefined
    const timer = setTimeout(() => setPublished(''), 4500)
    return () => clearTimeout(timer)
  }, [published])
  const publish = async () => {
    const count = drafts.length
    const problem = await data.actions.publishWeek(week)
    if (problem) return setMessage(problem)
    setMessage('')
    setPublished(`Published ${count} shift${count === 1 ? '' : 's'}. The team can see them now.`)
  }

  return (
    <div>
      <div className="tm-toolbar">
        <div className="tm-weeknav nav-center">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setWeekDir('prev'); onWeek(moveDays(week, -1)) }} aria-label="Week before"><Icon name="left" /></button>
          <b>{rangeLabel(week)}</b>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setWeekDir('next'); onWeek(moveDays(week, 1)) }} aria-label="Week after"><Icon name="right" /></button>
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
            <button type="button" className="btn btn-outline-secondary btn-sm" disabled={!drafts.length} onClick={clearDrafts} title="Remove this week's unpublished shifts (published ones stay)">Clear ({drafts.length})</button>
            <button type="button" className="btn btn-brand btn-sm" disabled={!drafts.length} onClick={publish}>Publish ({drafts.length})</button>
          </div>
        )}
      </div>
      {/* In the page body, not here: the page slides in with a transform, which would pin this to the wrong box. */}
      {published && createPortal(
        <div className="rv-toast pub-toast" role="status"><Icon name="check" size={18} /><span>{published}</span></div>,
        document.body,
      )}
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
        <WeekGrid key={week[0]} className={`mg-grid ${span === 'week' ? 'show-phone' : ''} ${weekDir ? `wk-${weekDir}` : ''}`} data={data} me={me} week={week} today={today} people={people} shifts={shifts} editable showSeen flash={flash} onEdit={setEditing} onDrop={dropShift} onPickDay={(d) => { setPickedDay(d); changeSpan('day') }} />
        </>
      ) : (
        <MySchedule data={data} me={me} week={week} today={today} lang={lang} view={view} onView={setView} />
      )}

      {dropping && <ShiftDropDialog shift={dropping.shift} target={dropping.target} data={data} onClose={() => setDropping(null)} onDone={(text) => { setDropping(null); setMessage(text) }} />}
      {editing && <ShiftEditor shift={editing} data={data} week={week} onClose={() => setEditing(null)} onDone={setMessage} />}
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
function ShiftEditor({ shift, data, week, onClose, onDone }) {
  // Quick picks (⚙️ → Business), starting from the Humanity schedule.
  const presets = data.settings.shiftPresets
  const roles = data.settings.roles ?? []
  const rolesOn = useFeature('roles')
  const [s, setS] = useState({ ...shift })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (field) => (e) => setS({ ...s, [field]: e.target.value })
  const days = week.includes(s.date) ? week : scheduleWeekOf(fromKey(s.date))
  // A new shift can go to several people and several days at once; changing one stays a single shift.
  const adding = !shift.id
  const [who, setWho] = useState(() => (shift.employeeId ? [shift.employeeId] : []))
  const [dts, setDts] = useState(() => [shift.date])
  const toggle = (list, setList, id) => setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  const people = data.employees.filter((e) => e.active)
  const clash = (e, d) => data.shifts.find((x) => x.id !== s.id && x.employeeId === e && x.date === d && s.start !== null && s.end !== null && x.start < s.end && s.start < x.end)
  const combos = adding ? who.flatMap((e) => days.filter((d) => dts.includes(d)).map((d) => ({ e, d }))) : []
  const many = combos.length > 1
  const clashing = many ? combos.filter(({ e, d }) => clash(e, d)) : []
  const offList = many ? combos.filter(({ e, d }) => offOn(data.teamOff, e, d)) : []
  const fresh = many ? combos.length - clashing.length : combos.length
  // The one person and day the single-shift warnings are about.
  const oneWho = adding ? who[0] : s.employeeId
  const oneDay = adding ? dts[0] : s.date
  const person = data.employees.find((e) => e.id === oneWho)
  const off = oneWho ? offOn(data.teamOff, oneWho, oneDay) : null
  const overlap = oneWho ? data.shifts.find((x) => x.id !== s.id && x.employeeId === oneWho && x.date === oneDay && x.start < s.end && s.start < x.end) : null

  const save = async () => {
    if (s.start === null || s.end === null || s.end <= s.start) return setError('The end time has to be after the start time.')
    const clean = { ...s, breakMin: Number(s.breakMin) || 0, title: s.title.trim(), role: s.role ?? '', note: s.note.trim() }
    if (adding && many) {
      const list = combos.filter(({ e, d }) => !clash(e, d)).map(({ e, d }) => ({ ...clean, employeeId: e, date: d }))
      if (!list.length) return setError('Everyone picked already has a shift at that time.')
      setBusy(true)
      const problem = await data.actions.saveShifts(list)
      setBusy(false)
      if (problem) return setError(problem)
      onDone?.(`Added ${list.length} draft shift${list.length === 1 ? '' : 's'}${clashing.length ? `; skipped ${clashing.length} that overlap an existing shift` : ''}. Press Publish when you're ready.`)
      return onClose()
    }
    setBusy(true)
    const problem = await data.actions.saveShift(adding && who.length === 1 ? { ...clean, employeeId: who[0], date: dts[0] } : clean)
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
          <button type="button" className="btn btn-brand" disabled={busy || (adding && (!who.length || !dts.length))} onClick={save}>{adding && many ? `Add ${fresh} ${fresh === 1 ? 'shift' : 'shifts'}` : 'Save'}</button>
        </>
      }
    >
      <div className="row g-2">
        {adding ? (
          <>
            <div className="col-12">
              <span className="form-label d-block" id="sh-who-l">Who <small className="tm-muted">(pick one or more)</small></span>
              <div className="rl-picks" role="group" aria-labelledby="sh-who-l">
                {people.map((e) => <button key={e.id} type="button" className="rl-pick" aria-pressed={who.includes(e.id)} onClick={() => toggle(who, setWho, e.id)}>{e.name}</button>)}
              </div>
            </div>
            <div className="col-12">
              <span className="form-label d-block" id="sh-day-l">Days <small className="tm-muted">(pick one or more)</small></span>
              <div className="rl-picks" role="group" aria-labelledby="sh-day-l">
                {days.map((d) => <button key={d} type="button" className="rl-pick" aria-pressed={dts.includes(d)} onClick={() => toggle(dts, setDts, d)}>{dayLabel(d)}</button>)}
              </div>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
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
      {many && <p className="tm-muted small mt-3 mb-0">{combos.length} shifts: {who.length} {who.length === 1 ? 'person' : 'people'} on {dts.length} {dts.length === 1 ? 'day' : 'days'}.</p>}
      {many && offList.length > 0 && <p className="tm-warn mt-3">{offList.length} of these fall on approved time off: {[...new Set(offList.map(({ e }) => data.employees.find((x) => x.id === e)?.name))].join(', ')}.</p>}
      {many && clashing.length > 0 && <p className="tm-warn mt-3">{clashing.length} already overlap an existing shift and will be skipped.</p>}
      {!many && off && <p className="tm-warn mt-3">{person?.name} has approved time off that day.</p>}
      {!many && overlap && <p className="tm-warn mt-3">This overlaps {person?.name}'s other shift ({shiftTimes(overlap)}).</p>}
      {!s.published && <p className="tm-muted small mt-3 mb-0">Draft until you press Publish on the schedule.</p>}
      {error && <p className="tm-error mt-2" role="alert">{error}</p>}
    </Modal>
  )
}
