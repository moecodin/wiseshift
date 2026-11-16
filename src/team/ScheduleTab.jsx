import { useState } from 'react'
import Modal from '../components/Modal.jsx'
import { dateKey, fromKey } from '../lib/dates.js'
import { formatHours, moveDays, scheduleWeekOf, shiftMinutes } from './paycheck.js'
import { clockTime, dayLabel, fromTimeInput, money, offOn, rangeLabel, scheduleOnly, shiftTimes, toTimeInput, useNow } from './format.js'
import { rangeName, say } from './words.js'

// The week's schedule: everyone (a grid like Humanity) or just mine.
// Managers click a box to add or change a shift; new shifts are drafts that
// only managers see until Publish.
export default function ScheduleTab({ data, me, boss, look, week, onWeek }) {
  const [view, setView] = useState('everyone')
  const [editing, setEditing] = useState(null)
  const [message, setMessage] = useState('')
  const now = useNow()
  const today = dateKey(now)
  const people = data.employees.filter((e) => e.active)
  const shifts = data.shifts.filter((s) => week.includes(s.date)).sort((a, b) => a.start - b.start)
  const drafts = shifts.filter((s) => !s.published)
  const thisWeek = scheduleWeekOf(now)[0] === week[0]

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
        <div className="tm-seg" role="group" aria-label="Whose shifts">
          <button type="button" aria-pressed={view === 'everyone'} onClick={() => setView('everyone')}>Everyone</button>
          <button type="button" aria-pressed={view === 'mine'} onClick={() => setView('mine')}>Just me</button>
        </div>
        {boss && (
          <div className="tm-tools">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={copyLastWeek}>Copy last week</button>
            <button type="button" className="btn btn-success btn-sm" disabled={!drafts.length} onClick={publish}>Publish ({drafts.length})</button>
          </div>
        )}
      </div>
      {message && <p className="tm-msg" role="status">{message}</p>}
      {boss && drafts.length > 0 && <p className="tm-muted small">Dashed shifts are drafts: only managers see them until you press Publish.</p>}

      {view === 'everyone' ? (
        <div className="tm-gridwrap">
          <table className="tm-grid">
            <thead>
              <tr>
                <th scope="col">{rangeLabel(week)}</th>
                {week.map((d) => (
                  <th key={d} scope="col" className={d === today ? 'today' : ''}>{dayLabel(d)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((person) => {
                const theirs = shifts.filter((s) => s.employeeId === person.id)
                return (
                  <tr key={person.id} className={person.id === me.id ? 'me' : ''}>
                    <th scope="row">
                      {person.name}
                      {boss && person.id !== me.id && !scheduleOnly(person) && <SeenTick shifts={theirs} seenAt={data.seenById?.[person.id]} ready={data.seenById != null} />}
                      <small>{person.position}</small>
                      <small className="tm-hrs">{formatHours(theirs.reduce((sum, s) => sum + shiftMinutes(s), 0))} hrs</small>
                    </th>
                    {week.map((d) => {
                      const dayShifts = theirs.filter((s) => s.date === d)
                      const off = offOn(data.teamOff, person.id, d)
                      return (
                        <td key={d} className={d === today ? 'today' : ''}>
                          {off && <div className="tm-off">Time off</div>}
                          {dayShifts.map((s) => (
                            <ShiftBox key={s.id} shift={s} position={person.position} onClick={boss ? () => setEditing(s) : undefined} />
                          ))}
                          {boss && (
                            <button type="button" className="tm-add" aria-label={`Add a shift for ${person.name} on ${dayLabel(d)}`} onClick={() => setEditing({ employeeId: person.id, date: d, start: 480, end: 840, breakMin: 0, title: '', note: '', published: false })}>
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
      ) : (
        <div className="tm-narrow">
          <WeekTotal data={data} me={me} week={week} />
          {week.map((d) => {
            const mine = shifts.filter((s) => s.date === d && s.employeeId === me.id)
            const off = offOn(data.teamOff, me.id, d)
            return (
              <div key={d} className={`tm-card tm-day ${d === today ? 'today' : ''}`}>
                <b>{dayLabel(d)}</b>
                <div>
                  {off && <div className="tm-off">Time off</div>}
                  {mine.length ? mine.map((s) => (
                    <div key={s.id}>
                      {s.title && <span className="tm-title">{s.title} · </span>}
                      {shiftTimes(s)} <span className="tm-muted">({formatHours(shiftMinutes(s))} hrs)</span>
                      {s.note && <div className="tm-muted small">{s.note}</div>}
                    </div>
                  )) : !off && <span className="tm-muted">{look?.offDay ?? 'Off'}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing && <ShiftEditor shift={editing} data={data} week={week} onClose={() => setEditing(null)} />}
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
// (like Humanity's weekly total). On the Clock tab and Schedule → Just me.
export function WeekTotal({ data, me, week, lang, onClick }) {
  const w = say(lang)
  const today = dateKey(useNow())
  const minutes = data.shifts.filter((s) => s.employeeId === me.id && week.includes(s.date)).reduce((sum, s) => sum + shiftMinutes(s), 0)
  const rate = me.payType === 'hourly' ? data.payById[me.id]?.hourlyRate : 0
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} className="tm-card tm-summary" onClick={onClick}>
      <span>
        {week.includes(today) ? w.scheduledWeek : w.scheduled} <small>{rangeName(week, lang)}</small>
      </span>
      <span className="text-end">
        <b>{formatHours(minutes)} {w.hrs}</b>
        {rate > 0 && minutes > 0 && <small>{w.aboutPay(money((minutes / 60) * rate))}</small>}
      </span>
    </Tag>
  )
}

function ShiftBox({ shift, position, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} className={`tm-shift ${shift.published ? '' : 'draft'}`} onClick={onClick}>
      {shift.title && <b>{shift.title}</b>}
      {position && <span>{position}</span>}
      <span>{shiftTimes(shift)}</span>
      <span>{formatHours(shiftMinutes(shift))} hrs</span>
      {shift.note && <span className="tm-shift-note">{shift.note}</span>}
    </Tag>
  )
}

// Add or change one shift.
function ShiftEditor({ shift, data, week, onClose }) {
  // Quick picks (⚙️ → Business), starting from the Humanity schedule.
  const presets = data.settings.shiftPresets
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
    const problem = await data.actions.saveShift({ ...s, breakMin: Number(s.breakMin) || 0, title: s.title.trim(), note: s.note.trim() })
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
