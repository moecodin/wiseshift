import Modal from '../components/Modal.jsx'
import { dateKey, fromKey } from '../lib/dates.js'
import { clockTime, datesLabel, hoursLabel, useNow } from './format.js'
import { shiftMinutes } from './paycheck.js'

// The "Coming up" tile on the phone Today screen opens this pop-up: every shift you have on
// the schedule from now on (published ones; the day's already-finished shifts are left out),
// plus any approved time off, in date order.
const WORDS = {
  en: { title: 'Coming up', today: 'Today', tomorrow: 'Tomorrow', empty: 'Nothing coming up.', hint: 'Shifts show here once your manager publishes the schedule.', timeOff: 'Time off', now: 'On now', count: (n) => `${n} ${n === 1 ? 'shift' : 'shifts'} scheduled` },
  es: { title: 'Próximamente', today: 'Hoy', tomorrow: 'Mañana', empty: 'Nada próximo.', hint: 'Los turnos aparecen aquí cuando tu gerente publica el horario.', timeOff: 'Ausencia', now: 'Ahora', count: (n) => `${n} ${n === 1 ? 'turno programado' : 'turnos programados'}` },
}
const locale = (lang) => (lang === 'es' ? 'es-US' : 'en-US')

export default function ComingUp({ data, me, lang, onClose }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const now = useNow(60000)
  const today = dateKey(now)
  const tomorrow = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  const minutes = now.getHours() * 60 + now.getMinutes()

  const shifts = data.shifts.filter((s) => s.employeeId === me.id && (s.date > today || (s.date === today && s.end > minutes)))
  const off = data.teamOff.filter((t) => t.employeeId === me.id && t.end >= today)
  const rows = [
    ...shifts.map((s) => ({ kind: 'shift', key: s.id, date: s.date, sort: s.start, s })),
    ...off.map((t) => ({ kind: 'off', key: `off-${t.id}`, date: t.start < today ? today : t.start, sort: -1, t })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.sort - b.sort)

  const dayName = (d) => (d === today ? w.today : d === tomorrow ? w.tomorrow : fromKey(d).toLocaleDateString(locale(lang), { weekday: 'short', month: 'short', day: 'numeric' }))

  return (
    <Modal title={w.title} onClose={onClose}>
      {rows.length === 0 ? (
        <p className="yd-empty"><b>{w.empty}</b> {w.hint}</p>
      ) : (
        <>
          <p className="yd-date">{w.count(shifts.length)}</p>
          <ul className="cu-list">
            {rows.map((r) => (
              <li key={r.key} className={`cu-row ${r.kind === 'off' ? 'off' : ''} ${r.date === today ? 'today' : ''}`}>
                <span className="cu-day">{dayName(r.date)}</span>
                {r.kind === 'off' ? (
                  <span className="cu-what"><b>{w.timeOff}</b><small>{datesLabel(r.t.start, r.t.end)}</small></span>
                ) : (
                  <span className="cu-what">
                    <b>{clockTime(r.s.start)} – {clockTime(r.s.end)}{r.s.start <= minutes && r.date === today ? <em>{w.now}</em> : null}</b>
                    <small>{r.s.title ? `${r.s.title} · ` : ''}{hoursLabel(shiftMinutes(r.s))}</small>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  )
}
