import Modal from '../components/Modal.jsx'
import { dateKey, formatClock } from '../lib/dates.js'
import Avatar from './Avatar.jsx'
import { clockTime, scheduleOnly, useNow } from './format.js'
import { shiftFor } from './review.js'

// Managers: the "Who's working today" tile on the phone Today screen opens this pop-up. Everyone
// with a shift today or a punch today, with a badge for where they are: on time or late (when they
// clocked in), hasn't punched in yet, or hasn't punched out yet (still in after their shift ended).
const LATE = 15 // minutes after the shift start that "On time" turns into "Late"
const WORDS = {
  en: {
    title: "Who's working today", empty: 'Nobody is scheduled or clocked in today.', count: (n) => `${n} ${n === 1 ? 'person' : 'people'} today`,
    onTime: 'On time', late: 'Late', noIn: "Hasn't punched in", noOut: "Hasn't punched out", scheduled: 'Scheduled', clockedIn: 'Clocked in', done: 'Done',
    notScheduled: 'Not scheduled', in: 'In', out: 'Out', still: 'still in',
  },
  es: {
    title: 'Quién trabaja hoy', empty: 'Nadie está programado ni ha marcado entrada hoy.', count: (n) => `${n} ${n === 1 ? 'persona' : 'personas'} hoy`,
    onTime: 'A tiempo', late: 'Tarde', noIn: 'No ha marcado entrada', noOut: 'No ha marcado salida', scheduled: 'Programado', clockedIn: 'Con entrada', done: 'Terminó',
    notScheduled: 'Sin turno', in: 'Entrada', out: 'Salida', still: 'sigue adentro',
  },
}
const minutesOfDay = (iso) => new Date(iso).getHours() * 60 + new Date(iso).getMinutes()

export default function WhoWorking({ data, lang, onClose }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const now = useNow(30000)
  const today = dateKey(now)
  const minutes = now.getHours() * 60 + now.getMinutes()
  const person = (id) => data.employees.find((e) => e.id === id)

  const shifts = data.shifts.filter((s) => s.date === today && s.published)
  const punches = data.punches.filter((p) => dateKey(new Date(p.clockIn)) === today || !p.clockOut)
  const ids = [...new Set([...shifts.map((s) => s.employeeId), ...punches.map((p) => p.employeeId)])].filter((id) => person(id))

  const rows = ids.map((id) => {
    const mine = shifts.filter((s) => s.employeeId === id).sort((a, b) => a.start - b.start)
    const taps = punches.filter((p) => p.employeeId === id).sort((a, b) => new Date(a.clockIn) - new Date(b.clockIn))
    const first = taps[0]
    const open = taps.find((p) => !p.clockOut)
    const lastEnd = mine.at(-1)?.end
    const shift = first ? shiftFor(first, mine) : mine[0]
    let badge
    if (scheduleOnly(person(id))) badge = { tone: 'quiet', text: w.scheduled }
    else if (open && lastEnd != null && lastEnd <= minutes) badge = { tone: 'warn', text: w.noOut }
    else if (first) {
      const late = shift ? minutesOfDay(first.clockIn) - shift.start > LATE : false
      badge = shift ? { tone: late ? 'late' : 'ok', text: late ? w.late : w.onTime } : { tone: 'quiet', text: w.clockedIn }
    } else if (mine.length && mine[0].start <= minutes) badge = { tone: 'warn', text: w.noIn }
    else badge = { tone: 'quiet', text: w.scheduled }
    return { id, mine, taps, badge, sort: mine[0]?.start ?? (first ? minutesOfDay(first.clockIn) : 1440) }
  }).sort((a, b) => a.sort - b.sort || person(a.id).name.localeCompare(person(b.id).name))

  return (
    <Modal title={w.title} onClose={onClose}>
      {rows.length === 0 ? (
        <p className="yd-empty"><b>{w.empty}</b></p>
      ) : (
        <>
          <p className="yd-date">{w.count(rows.length)}</p>
          <ul className="cu-list">
            {rows.map((r) => (
              <li key={r.id} className="ww-row">
                <Avatar employee={person(r.id)} size={38} />
                <span className="ww-who">
                  <b>{person(r.id).name}</b>
                  <small>{r.mine.length ? r.mine.map((s) => `${clockTime(s.start)} – ${clockTime(s.end)}`).join(', ') : w.notScheduled}{r.mine[0]?.title ? ` · ${r.mine[0].title}` : ''}</small>
                  {r.taps.length > 0 && (
                    <small>{r.taps.map((p) => `${w.in} ${formatClock(p.clockIn)} · ${p.clockOut ? `${w.out} ${formatClock(p.clockOut)}` : w.still}`).join('  |  ')}</small>
                  )}
                </span>
                <span className={`ww-badge ${r.badge.tone}`}>{r.badge.text}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  )
}
