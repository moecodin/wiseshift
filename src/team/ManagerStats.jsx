import { dateKey } from '../lib/dates.js'
import { scheduleOnly, useNow } from './format.js'
import { formatHours, moveDays, payPeriodOf, periodHours, scheduleWeekOf } from './paycheck.js'
import { punchStatus, shiftFor } from './review.js'

// Desktop manager Today: four stat cards across the top, each with a trend where one makes
// sense. Hours and overtime compare this pay period with the one before; to review opens the
// Review list; late clock-ins counts this schedule week. Hidden on phones (the tiles do that job).
const LATE = 15 // minutes after the shift start that a clock-in counts as late (same as Working now)
const WORDS = {
  en: { worked: 'Worked this pay period', overtime: 'Overtime', review: 'To review', late: 'Late clock-ins', hrs: 'hrs', vs: 'vs last period', punches: (n) => (n === 1 ? 'punch waiting' : 'punches waiting'), thisWeek: 'this week', clear: 'All caught up', none: 'None this week' },
  es: { worked: 'Trabajado este período', overtime: 'Horas extra', review: 'Por revisar', late: 'Entradas tarde', hrs: 'hrs', vs: 'vs período anterior', punches: (n) => (n === 1 ? 'registro en espera' : 'registros en espera'), thisWeek: 'esta semana', clear: 'Todo al día', none: 'Ninguna esta semana' },
}
const arrow = (n) => (n > 0 ? '▲' : n < 0 ? '▼' : '–')

export default function ManagerStats({ data, lang, onReview }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const now = useNow(60000)
  const period = payPeriodOf(now)
  const before = moveDays(period, -1)
  const staff = data.employees.filter((e) => !scheduleOnly(e) && e.active)
  const sum = (days, key) => staff.reduce((total, e) => total + periodHours(data.punches, e.id, days, now)[key], 0)
  const total = sum(period, 'total')
  const prevTotal = sum(before, 'total')
  const overtime = sum(period, 'overtime')
  const prevOvertime = sum(before, 'overtime')
  const toReview = data.punches.filter((p) => punchStatus(p) === 'pending').length

  const week = scheduleWeekOf(now)
  const late = data.punches.filter((p) => {
    if (!week.includes(dateKey(new Date(p.clockIn)))) return false
    const shift = shiftFor(p, data.shifts)
    return shift ? new Date(p.clockIn).getHours() * 60 + new Date(p.clockIn).getMinutes() - shift.start > LATE : false
  }).length

  // Percent change against the last pay period, or nothing when that period has no hours to compare.
  const pct = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null
  const otDiff = prevTotal > 0 || prevOvertime > 0 ? overtime - prevOvertime : null

  return (
    <div className="mt-stats ms-cards">
      <div className="ms-card">
        <small>{w.worked}</small>
        <b>{formatHours(total)} <span>{w.hrs}</span></b>
        {pct !== null && <em className={pct >= 0 ? 'up' : ''}>{arrow(pct)} {Math.abs(pct)}% {w.vs}</em>}
      </div>
      <div className="ms-card">
        <small>{w.overtime}</small>
        <b>{formatHours(overtime)} <span>{w.hrs}</span></b>
        {otDiff !== null && <em className={otDiff > 0 ? 'bad' : otDiff < 0 ? 'up' : ''}>{arrow(otDiff)} {formatHours(Math.abs(otDiff))} {w.hrs} {w.vs}</em>}
      </div>
      <button type="button" className={`ms-card ms-click ${toReview > 0 ? 'warn' : ''}`} onClick={onReview}>
        <small>{w.review}</small>
        <b>{toReview}</b>
        <em>{toReview > 0 ? w.punches(toReview) : w.clear}</em>
      </button>
      <div className={`ms-card ${late > 0 ? 'warn' : ''}`}>
        <small>{w.late}</small>
        <b>{late}</b>
        <em>{late > 0 ? w.thisWeek : w.none}</em>
      </div>
    </div>
  )
}
