import Modal from '../components/Modal.jsx'
import { dateKey, formatClock, fromKey } from '../lib/dates.js'
import { clockTime, hoursLabel, offOn, useNow } from './format.js'
import { minutesBetween, punchMinutes, shiftMinutes } from './paycheck.js'
import { useFeatures } from './features.js'

// The "Your day" tile on the phone Today screen opens this pop-up instead of leaving the page:
// where you are in today's clock, today's shift, and (once tasks exist) today's tasks.
const WORDS = {
  en: {
    title: 'Your day', timeOff: 'Time off today', dayOff: 'Day off. Nothing scheduled.',
    clock: 'Time clock', notIn: 'Not clocked in yet', startedAt: (t) => `Your shift started at ${t}`, startsAt: (t) => `Your shift starts at ${t}`,
    since: (t) => `Clocked in since ${t}`, soFar: (h) => `Worked so far: ${h}`, out: (t) => `Clocked out at ${t}`, outBy: (n) => `Clocked out by ${n}`, worked: (h) => `${h} worked`,
    shift: 'Shift today', until: (t) => `until ${t}`, left: (h) => `${h} left`, over: 'Shift is over', total: (h) => `${h} scheduled`,
    tasks: 'Tasks for today', noTasks: 'Nothing assigned yet.', tasksHint: 'Tasks you are given will show up here.',
  },
  es: {
    title: 'Tu día', timeOff: 'Ausencia hoy', dayOff: 'Día libre. Nada programado.',
    clock: 'Reloj', notIn: 'Aún no has marcado entrada', startedAt: (t) => `Tu turno empezó a las ${t}`, startsAt: (t) => `Tu turno empieza a las ${t}`,
    since: (t) => `Entrada desde las ${t}`, soFar: (h) => `Trabajado hasta ahora: ${h}`, out: (t) => `Salida a las ${t}`, outBy: (n) => `Salida registrada por ${n}`, worked: (h) => `${h} trabajadas`,
    shift: 'Turno de hoy', until: (t) => `hasta las ${t}`, left: (h) => `faltan ${h}`, over: 'El turno terminó', total: (h) => `${h} programadas`,
    tasks: 'Tareas de hoy', noTasks: 'Aún no tienes tareas.', tasksHint: 'Las tareas que te asignen aparecerán aquí.',
  },
}
const locale = (lang) => (lang === 'es' ? 'es-US' : 'en-US')
const clockedOutByManager = (p, me) =>
  p.editedBy && p.editedBy !== me.name && p.editedAt && p.clockOut && Math.abs(new Date(p.clockOut) - new Date(p.editedAt)) < 120000

export default function YourDay({ data, me, lang, onClose }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const f = useFeatures()
  const now = useNow(15000)
  const today = dateKey(now)
  const minutes = now.getHours() * 60 + now.getMinutes()
  const todays = data.shifts.filter((s) => s.employeeId === me.id && s.date === today).sort((a, b) => a.start - b.start)
  const off = offOn(data.teamOff, me.id, today)
  const punches = data.punches.filter((p) => p.employeeId === me.id && dateKey(new Date(p.clockIn)) === today || (p.employeeId === me.id && !p.clockOut)).sort((a, b) => new Date(a.clockIn) - new Date(b.clockIn))
  const open = punches.find((p) => !p.clockOut)
  const last = punches.at(-1)
  const doneMinutes = punches.reduce((sum, p) => sum + punchMinutes(p, now), 0)
  const hrs = (m) => hoursLabel(m)
  const time = (iso) => formatClock(iso)
  const date = fromKey(today).toLocaleDateString(locale(lang), { weekday: 'long', month: 'short', day: 'numeric' })

  // No shift today (day off or time off): the time clock and tasks serve no purpose, so they're
  // hidden. A clock that's already running or finished today still shows, so nobody's punch hides.
  const scheduled = todays.length > 0 && !off
  const showClock = f.timeClock && (scheduled || punches.length > 0)

  // How much of the shift is left: the one under way, else the next one, else the last.
  const current = todays.find((s) => s.start <= minutes && s.end > minutes)
  const upcoming = todays.find((s) => s.start > minutes)
  const leftNote = !scheduled ? '' : current ? w.left(hrs(current.end - minutes)) : upcoming ? w.total(hrs(shiftMinutes(upcoming))) : w.over

  let status
  if (open) {
    status = { live: true, big: w.since(time(open.clockIn)), sub: w.soFar(hrs(minutesBetween(open.clockIn, now))) }
  } else if (last) {
    status = { big: clockedOutByManager(last, me) ? w.outBy(last.editedBy) : w.out(time(last.clockOut)), sub: w.worked(hrs(doneMinutes)) }
  } else {
    const first = todays[0]
    status = { big: w.notIn, sub: first ? (first.start <= minutes ? w.startedAt(clockTime(first.start)) : w.startsAt(clockTime(first.start))) : '' }
  }

  return (
    <Modal title={w.title} onClose={onClose}>
      <p className="yd-date">{date}</p>
      {/* Under the title: today's shift times as bullets (or the day off / time off line). */}
      <ul className="yd-bullets">
        {off ? (
          <li>{w.timeOff}</li>
        ) : todays.length ? (
          todays.map((s) => <li key={s.id}>{clockTime(s.start)} – {clockTime(s.end)}{s.title ? ` · ${s.title}` : ''}</li>)
        ) : (
          <li>{w.dayOff}</li>
        )}
      </ul>

      {showClock && (
        <section className={`yd-block ${status.live ? 'live' : ''}`}>
          <small className="yd-label">{w.clock}</small>
          <b className="yd-big">{status.live && <i className="live-dot" aria-hidden="true" />}{status.big}</b>
          {status.sub && <span className="yd-sub">{status.sub}</span>}
          {leftNote && <span className="yd-left">{leftNote}</span>}
        </section>
      )}
      {!showClock && scheduled && leftNote && <p className="yd-left alone">{leftNote}</p>}

      {/* Placeholder until tasks exist: the real list goes in this section. */}
      {scheduled && (
        <section className="yd-block yd-tasks">
          <small className="yd-label">{w.tasks}</small>
          <span className="yd-empty"><b>{w.noTasks}</b> {w.tasksHint}</span>
        </section>
      )}
    </Modal>
  )
}
