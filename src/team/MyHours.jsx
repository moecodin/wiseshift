import { dateKey, formatClock, fromKey } from '../lib/dates.js'
import { decimalHours, formatHours, periodHours, shiftMinutes } from './paycheck.js'
import CountUp from './CountUp.jsx'

// An employee's own hours for the pay period: the total so far, how it compares
// with what's scheduled, and a row for each day worked. Only a manager can fix a
// punch, so a day with no clock-out says to ask one.
const WORDS = {
  en: { label: 'Hours this pay period', unit: 'hrs so far', scheduled: (h) => `${h} hrs scheduled this period`, fix: (n) => ` · ${n} ${n === 1 ? 'day needs' : 'days need'} fixing`, days: 'Your days', none: 'No hours yet this pay period.', still: 'working now', stillOn: 'Still clocked in', today: 'Today', noOut: 'no clock-out', missing: 'Missing clock-out. Ask a manager to fix it.', fixed: 'Fixed by a manager', note: 'Times within a few minutes of the hour may be rounded. Only a manager can change a punch.', now: '…' },
  es: { label: 'Horas de este período', unit: 'hrs hasta ahora', scheduled: (h) => `${h} hrs programadas este período`, fix: (n) => ` · ${n} ${n === 1 ? 'día necesita' : 'días necesitan'} arreglo`, days: 'Tus días', none: 'Aún no hay horas en este período.', still: 'trabajando ahora', stillOn: 'Aún en turno (sin salida)', today: 'Hoy', noOut: 'sin salida', missing: 'Falta la salida. Pide a un gerente que la arregle.', fixed: 'Arreglado por un gerente', note: 'Las horas cercanas a la hora en punto pueden redondearse. Solo un gerente puede cambiar un registro.', now: '…' },
}

export default function MyHours({ data, me, period, now, lang }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const locale = lang === 'es' ? 'es-US' : 'en-US'
  const today = dateKey(now)
  const hours = periodHours(data.punches, me.id, period, now)
  const scheduled = data.shifts.filter((s) => s.employeeId === me.id && period.includes(s.date)).reduce((sum, s) => sum + shiftMinutes(s), 0)
  const days = hours.byDay.filter((d) => d.punches.length > 0).sort((a, b) => b.date.localeCompare(a.date))
  const broken = (d) => d.punches.some((p) => !p.clockOut && d.date < today)
  const needFix = days.filter(broken).length
  const pct = scheduled > 0 ? Math.min(100, Math.round((hours.total / scheduled) * 100)) : 0

  return (
    <div className="tm-narrow desk hr-grid">
      <div className="hr-side">
      <section className="hr-hero">
        <small>{w.label}</small>
        <div><b><CountUp value={decimalHours(hours.total)} /></b> <span>{w.unit}</span></div>
        <div className="hr-bar" role="img" aria-label={`${pct}%`}><i style={{ width: `${pct}%` }} /></div>
        <small>{w.scheduled(formatHours(scheduled))}{needFix > 0 && w.fix(needFix)}</small>
      </section>
      </div>

      <div className="hr-weeks">
      <h2 className="sc-h">{w.days}</h2>
      {days.length === 0 && <p className="tm-muted">{w.none}</p>}
      {days.map((d) => {
        const date = fromKey(d.date)
        const stuck = broken(d)
        const live = d.punches.some((p) => !p.clockOut) && d.date === today
        const fixed = d.punches.some((p) => p.editedBy)
        return (
          <div key={d.date} className={`sc-row hr-day ${stuck ? 'warn' : ''}`}>
            <div className="sc-date">
              <small>{date.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '').toUpperCase()}</small>
              <b>{date.getDate()}</b>
            </div>
            <div className="sc-body">
              {d.punches.map((p) => (
                <b key={p.id} className="hr-times">
                  {formatClock(p.clockIn)} – {p.clockOut ? formatClock(p.clockOut) : live ? w.still : w.noOut}
                </b>
              ))}
              {stuck && <small className="hr-warn">{w.missing}</small>}
              {live && <small>{w.today} · {w.stillOn}</small>}
              {fixed && !stuck && <small>{w.fixed}</small>}
            </div>
            <span className="sc-hrs hr-total">{stuck ? '?' : live ? w.now : formatHours(d.minutes)}</span>
          </div>
        )
      })}
      <p className="tm-muted small">{w.note}</p>
      </div>
    </div>
  )
}
