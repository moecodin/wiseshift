import { useEffect, useRef, useState } from 'react'
import { dateKey, formatClock, fromKey, formatShort } from '../lib/dates.js'
import { clockTime, scheduleOnly, shiftTimes, useNow } from './format.js'
import { formatHours, moveDays, payPeriodOf, punchMinutes, scheduleWeekOf, shiftMinutes } from './paycheck.js'
import { punchStatus } from './review.js'
import { OVERTIME_AFTER_HOURS } from './taxRates.js'
import { useFeatures } from './features.js'
import RoleBadge from './RoleBadge.jsx'
import Tick from './Tick.jsx'

// Four cards for the manager's Today screen on a computer (they are hidden under 900px, where the
// phone Today has its own order): Today's shifts, Payroll readiness, Overtime watch and Schedule status.
// Everything here is worked out from data the app already has; nothing is saved.
const LATE = 15 // minutes after the shift start that a clock-in counts as late (same as Working now)
const MISSING_AFTER = 10 // minutes after a shift starts before "not clocked in" shows
const NEAR_OVERTIME = 4 // hours below 40 where a person starts to appear in Overtime watch

const WORDS = {
  en: {
    shifts: "Today's shifts", shiftsNone: 'No published shifts today.', cols: { time: 'Shift', who: 'Person', status: 'Status' },
    scheduled: 'Scheduled', onTime: 'On time', late: 'Late', done: 'Done', missing: 'Missing', notYet: (t) => `Starts ${t}`,
    payroll: 'Payroll readiness', endsToday: 'Period ends today', endsIn: (n) => `${n} ${n === 1 ? 'day' : 'days'} left in this pay period`, ends: (d) => `Ends ${d}`,
    toApprove: 'Punches to approve', missingOut: 'Missing clock-outs', stillIn: 'Still clocked in', clear: 'None', review: 'Review',
    ready: 'Ready for payroll', notReady: 'Not ready for payroll yet',
    overtime: 'Overtime watch', weekEnds: (d) => `Work week ends ${d}`, otCols: { who: 'Person', worked: 'Worked', plan: 'With schedule' }, over: (h) => `${h} over`, near: 'Close', otNone: (h) => `Nobody is on track to pass ${h} hours.`,
    status: 'Schedule status', thisWeek: 'This week', nextWeek: 'Next week', empty: 'No shifts yet', published: 'Published', unpublished: (n) => `${n} ${n === 1 ? 'change' : 'changes'} not published`, publish: 'Publish',
    unseen: (names) => `Not opened since posted: ${names}`,
  },
  es: {
    shifts: 'Turnos de hoy', shiftsNone: 'No hay turnos publicados hoy.', cols: { time: 'Turno', who: 'Persona', status: 'Estado' },
    scheduled: 'Programado', onTime: 'A tiempo', late: 'Tarde', done: 'Terminó', missing: 'Falta', notYet: (t) => `Empieza ${t}`,
    payroll: 'Listo para nómina', endsToday: 'El período termina hoy', endsIn: (n) => `${n} ${n === 1 ? 'día' : 'días'} para terminar el período`, ends: (d) => `Termina ${d}`,
    toApprove: 'Registros por aprobar', missingOut: 'Salidas sin registrar', stillIn: 'Aún con entrada', clear: 'Ninguno', review: 'Revisar',
    ready: 'Listo para nómina', notReady: 'Aún no está listo para nómina',
    overtime: 'Vigilar horas extra', weekEnds: (d) => `La semana termina ${d}`, otCols: { who: 'Persona', worked: 'Trabajado', plan: 'Con horario' }, over: (h) => `${h} de más`, near: 'Cerca', otNone: (h) => `Nadie va a pasar de ${h} horas.`,
    status: 'Estado del horario', thisWeek: 'Esta semana', nextWeek: 'Próxima semana', empty: 'Aún no hay turnos', published: 'Publicado', unpublished: (n) => `${n} ${n === 1 ? 'cambio' : 'cambios'} sin publicar`, publish: 'Publicar',
    unseen: (names) => `No han abierto el horario: ${names}`,
  },
}
const words = (lang) => WORDS[lang === 'es' ? 'es' : 'en']
const dayText = (key, lang) => fromKey(key).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })
// A status that fades in with a soft highlight when its text changes. It stays plain on first show.
function Flash({ text }) {
  const prev = useRef(text)
  const [times, setTimes] = useState(0)
  useEffect(() => {
    if (prev.current === text) return
    prev.current = text
    setTimes((n) => n + 1) // eslint-disable-line react-hooks/set-state-in-effect
  }, [text])
  return <span key={times} className={times ? 'td-flash' : ''}>{text}</span>
}
const staffOf = (data) => data.employees.filter((e) => e.active && !scheduleOnly(e))

// 1. Who is due today, in start order, with where each person stands.
export function TodayShifts({ data, lang }) {
  const w = words(lang)
  const now = useNow()
  const f = useFeatures()
  const today = dateKey(now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const person = (id) => data.employees.find((e) => e.id === id)
  const rows = data.shifts.filter((s) => s.date === today && s.published).sort((a, b) => a.start - b.start || a.end - b.end)

  const stateOf = (s) => {
    if (!f.timeClock || scheduleOnly(person(s.employeeId))) return { text: w.scheduled, tone: 'muted' }
    const mine = data.punches.filter((p) => p.employeeId === s.employeeId && dateKey(new Date(p.clockIn)) === today).sort((a, b) => new Date(a.clockIn) - new Date(b.clockIn))
    if (mine.length) {
      const d = new Date(mine[0].clockIn)
      const late = d.getHours() * 60 + d.getMinutes() - s.start > LATE
      if (mine.some((p) => !p.clockOut)) return { text: `${late ? w.late : w.onTime} · ${formatClock(mine[0].clockIn)}`, tone: late ? 'bad' : '' }
      return { text: w.done, tone: 'muted' }
    }
    if (s.end <= nowMin || s.start + MISSING_AFTER <= nowMin) return { text: w.missing, tone: 'bad' }
    return { text: w.notYet(clockTime(s.start)), tone: 'muted' }
  }

  return (
    <section className="mt-card td-desk" aria-label={w.shifts}>
      <div className="mt-line"><b>{w.shifts}</b><small>{dayText(today, lang)}</small></div>
      {rows.length === 0 ? <p className="tm-muted mb-0">{w.shiftsNone}</p> : (
        <table className="td-tbl">
          <thead><tr><th>{w.cols.time}</th><th>{w.cols.who}</th><th className="r">{w.cols.status}</th></tr></thead>
          <tbody>
            {rows.map((s) => {
              const st = stateOf(s)
              return (
                <tr key={s.id}>
                  <td>{shiftTimes(s)}</td>
                  <td>{person(s.employeeId)?.name ?? '?'} <RoleBadge role={s.role} roles={data.settings?.roles} /></td>
                  <td className={`r td-st ${st.tone}`}><Flash text={st.text} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}

// 2. What still stands between this pay period and payroll.
export function PayrollReadiness({ data, lang, onReview }) {
  const w = words(lang)
  const now = useNow(60000)
  const today = dateKey(now)
  const period = payPeriodOf(now)
  const left = period.length - 1 - period.indexOf(today)
  const toApprove = data.punches.filter((p) => punchStatus(p) === 'pending').length
  const missing = data.punches.filter((p) => !p.clockOut && dateKey(new Date(p.clockIn)) < today).length
  const stillIn = data.punches.filter((p) => !p.clockOut && dateKey(new Date(p.clockIn)) === today).length
  const ready = toApprove === 0 && missing === 0
  const lines = [
    { label: w.toApprove, n: toApprove, tone: '', act: toApprove > 0 ? onReview : null },
    { label: w.missingOut, n: missing, tone: 'bad' },
    { label: w.stillIn, n: stillIn, tone: 'muted' },
  ]
  return (
    <section className="mt-card td-desk" aria-label={w.payroll}>
      <div className="mt-line"><b>{w.payroll}</b><small>{left === 0 ? w.endsToday : w.endsIn(left)}</small></div>
      <table className="td-tbl">
        <tbody>
          {lines.map((l) => (
            <tr key={l.label}>
              <td>{l.label}</td>
              <td className={`r td-st ${l.n > 0 ? l.tone : 'muted'}`}>{l.n > 0 ? <Tick value={l.n} format={(n) => String(Math.round(n))} /> : w.clear}</td>
              <td className="r td-act">{l.act && <button type="button" className="btn btn-sm" onClick={l.act}>{w.review}</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={`td-foot ${ready ? 'ready' : 'bad'}`}>{ready ? w.ready : w.notReady}</p>
    </section>
  )
}

// 3. Who is heading past 40 hours in the current work week, counting the shifts still to come.
export function OvertimeWatch({ data, lang }) {
  const w = words(lang)
  const now = useNow(60000)
  const today = dateKey(now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const period = payPeriodOf(now)
  const days = period.indexOf(today) < 7 ? period.slice(0, 7) : period.slice(7)
  const limit = OVERTIME_AFTER_HOURS * 60

  const rows = staffOf(data).map((e) => {
    const worked = data.punches.filter((p) => p.employeeId === e.id && days.includes(dateKey(new Date(p.clockIn)))).reduce((sum, p) => sum + punchMinutes(p, now), 0)
    let ahead = 0
    for (const s of data.shifts) {
      if (s.employeeId !== e.id || !s.published || !days.includes(s.date) || s.date < today) continue
      if (s.date > today) { ahead += shiftMinutes(s); continue }
      const mine = data.punches.filter((p) => p.employeeId === e.id && dateKey(new Date(p.clockIn)) === today)
      if (mine.length === 0) ahead += shiftMinutes(s)
      else if (mine.some((p) => !p.clockOut)) ahead += Math.max(0, s.end - nowMin)
    }
    return { e, worked, plan: worked + ahead }
  }).filter((r) => r.plan >= limit - NEAR_OVERTIME * 60).sort((a, b) => b.plan - a.plan)

  return (
    <section className="mt-card td-desk" aria-label={w.overtime}>
      <div className="mt-line"><b>{w.overtime}</b><small>{w.weekEnds(dayText(days.at(-1), lang))}</small></div>
      {rows.length === 0 ? <p className="tm-muted mb-0">{w.otNone(OVERTIME_AFTER_HOURS)}</p> : (
        <table className="td-tbl">
          <thead><tr><th>{w.otCols.who}</th><th className="r">{w.otCols.worked}</th><th className="r">{w.otCols.plan}</th><th className="r" /></tr></thead>
          <tbody>
            {rows.map(({ e, worked, plan }) => (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td className="r">{formatHours(worked)}</td>
                <td className="r">{formatHours(plan)}</td>
                <td className={`r td-st ${plan > limit ? 'strong' : 'muted'}`}>{plan > limit ? w.over(formatHours(plan - limit)) : w.near}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

// 4. This week and next week: published or not, a Publish button for what is not, and who has not
// opened the app since the schedule was posted.
export function ScheduleStatus({ data, lang }) {
  const w = words(lang)
  const now = useNow(60000)
  const thisWeek = scheduleWeekOf(now)
  const weeks = [{ days: thisWeek, label: w.thisWeek }, { days: moveDays(thisWeek, 1), label: w.nextWeek }]
  const staffIds = new Set(staffOf(data).map((e) => e.id))

  return (
    <section className="mt-card td-desk" aria-label={w.status}>
      <div className="mt-line"><b>{w.status}</b></div>
      <table className="td-tbl">
        <tbody>
          {weeks.map(({ days, label }) => {
            const shifts = data.shifts.filter((s) => days.includes(s.date))
            const drafts = shifts.filter((s) => !s.published)
            const live = shifts.filter((s) => s.published)
            const posted = live.map((s) => s.postedAt).filter(Boolean).sort().at(-1)
            const unseen = !posted || data.seenById == null ? [] : [...new Set(live.map((s) => s.employeeId))]
              .filter((id) => staffIds.has(id) && id !== data.me?.id && !(data.seenById[id] && new Date(data.seenById[id]) >= new Date(posted)))
              .map((id) => data.employees.find((e) => e.id === id)?.name.split(' ')[0]).filter(Boolean)
            return (
              <tr key={label}>
                <td>
                  <b>{label}</b>
                  <small className="td-sub">{formatShort(fromKey(days[0]))} – {formatShort(fromKey(days.at(-1)))}</small>
                </td>
                <td>
                  {shifts.length === 0 ? <span className="td-st muted">{w.empty}</span>
                    : drafts.length > 0 ? <span className="td-st strong">{w.unpublished(drafts.length)}</span>
                    : <span className="td-st">{w.published}</span>}
                  {unseen.length > 0 && <small className="td-sub">{w.unseen(unseen.join(', '))}</small>}
                </td>
                <td className="r td-act">{drafts.length > 0 && <button type="button" className="btn btn-brand btn-sm" onClick={() => data.actions.publishWeek(days)}>{w.publish}</button>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
