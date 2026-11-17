import { useRef, useState } from 'react'
import { dateKey, formatClock } from '../lib/dates.js'
import { scheduleWeekOf } from './paycheck.js'
import { datesLabel, scheduleOnly, shiftTimes, useNow } from './format.js'
import { punchStatus, shiftFor } from './review.js'
import { PunchEditor } from './HoursTab.jsx'
import Avatar from './Avatar.jsx'
import RoleBadge from './RoleBadge.jsx'
import { useFeatures } from './features.js'
import ManagerNotes from './ManagerNotes.jsx'
import { StaffNotes, missingPunch } from './PunchNotes.jsx'

const LATE = 15 // minutes after the shift start that "On time" turns into "Late"
const MISSING_AFTER = 10 // minutes after a shift starts before "hasn't clocked in" shows

const WORDS = {
  en: { coverEyebrow: 'COVER REQUEST', coverLine: (taker, owner) => `${taker} takes ${owner}'s shift`, swapLine: (a, b) => `${a} and ${b} swap shifts`, gets: (n) => `${n} gets`, hi: 'Hi', attention: 'Needs your attention', clear: 'All clear. Nothing needs you right now.', notIn: (n) => `${n} hasn't clocked in`, started: (m) => `Shift started ${m} min ago`, call: 'Call', off: 'TIME OFF REQUEST', nobodyElse: 'Nobody else is off those days.', alsoOff: (n) => `Also off: ${n}.`, decline: 'Decline', approve: 'Approve', fix: 'PUNCH TO FIX', neverOut: (t) => `Clocked in ${t} and never clocked out.`, setOut: 'Set the clock-out time', review: (n) => `${n} ${n === 1 ? 'punch' : 'punches'} to review`, reviewSub: 'Approve the ones that look right', open: 'Open', working: 'Working now', clockedIn: (n) => `${n} clocked in`, nobody: 'Nobody is clocked in.', onTime: 'On time', late: 'Late', draft: 'This week is still a draft', changes: (n) => `${n} ${n === 1 ? 'change' : 'changes'} not published`, publish: 'Publish', youIn: "You're clocked in", since: (t) => `Since ${t}`, myClock: 'My clock', inAt: (t) => `In at ${t}`, sched: 'Review all punches', days: (n) => `${n} ${n === 1 ? 'day' : 'days'}` },
  es: { coverEyebrow: 'SOLICITUD DE COBERTURA', coverLine: (taker, owner) => `${taker} toma el turno de ${owner}`, swapLine: (a, b) => `${a} y ${b} cambian de turno`, gets: (n) => `${n} recibe`, hi: 'Hola', attention: 'Necesita tu atención', clear: 'Todo en orden. Nada te necesita ahora.', notIn: (n) => `${n} no ha marcado entrada`, started: (m) => `El turno empezó hace ${m} min`, call: 'Llamar', off: 'SOLICITUD DE AUSENCIA', nobodyElse: 'Nadie más falta esos días.', alsoOff: (n) => `También faltan: ${n}.`, decline: 'Rechazar', approve: 'Aprobar', fix: 'REGISTRO POR ARREGLAR', neverOut: (t) => `Registró su entrada a las ${t} y nunca registró su salida.`, setOut: 'Poner la hora de salida', review: (n) => `${n} ${n === 1 ? 'registro' : 'registros'} por revisar`, reviewSub: 'Aprueba los que se vean bien', open: 'Apertura', working: 'Trabajando ahora', clockedIn: (n) => `${n} con entrada`, nobody: 'Nadie ha marcado entrada.', onTime: 'A tiempo', late: 'Tarde', draft: 'Esta semana sigue en borrador', changes: (n) => `${n} ${n === 1 ? 'cambio' : 'cambios'} sin publicar`, publish: 'Publicar', youIn: 'Tu entrada está registrada', since: (t) => `Desde las ${t}`, myClock: 'Mi reloj', inAt: (t) => `Entrada ${t}`, sched: 'Revisar todos los registros', days: (n) => `${n} ${n === 1 ? 'día' : 'días'}` },
}

// The manager's Today screen: what needs a decision, who is working, and the
// week's draft. "My clock" and "Review" open from here.
export default function ManagerToday({ data, me, lang, onView }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const now = useNow()
  const f = useFeatures() // parts of the app this business has switched off disappear from this screen
  const today = dateKey(now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const [fixing, setFixing] = useState(null)
  // A request or draft card plays a short fold-away (a check mark, then the gap closes)
  // before the change is saved. leaving: id -> 'approved' | 'declined' | 'published'.
  const [leaving, setLeaving] = useState({})
  const timers = useRef([])
  const leave = (id, result, save) => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return save()
    setLeaving((l) => ({ ...l, [id]: result }))
    timers.current.push(setTimeout(save, 650))
  }
  const name = (id) => data.employees.find((e) => e.id === id)?.name ?? '?'
  const person = (id) => data.employees.find((e) => e.id === id)
  const first = (id) => name(id).split(' ')[0]

  const myOpen = f.timeClock ? data.punches.find((p) => p.employeeId === me.id && !p.clockOut) : undefined
  const todaysShifts = data.shifts.filter((s) => s.date === today && s.published)
  const inToday = (id) => data.punches.some((p) => p.employeeId === id && dateKey(new Date(p.clockIn)) === today)
  const notIn = !f.timeClock ? [] : todaysShifts.filter((s) => !scheduleOnly(person(s.employeeId)) && s.employeeId !== me.id && s.start + MISSING_AFTER <= nowMin && s.end > nowMin && !inToday(s.employeeId))
  const requests = !f.timeOff ? [] : data.timeOff.filter((t) => t.status === 'pending').sort((a, b) => a.start.localeCompare(b.start))
  const stuck = !f.timeClock ? [] : data.punches.filter((p) => !p.clockOut && dateKey(new Date(p.clockIn)) < today)
  const toReview = !f.timeClock ? 0 : data.punches.filter((p) => punchStatus(p) === 'pending').length
  const open = !f.timeClock ? [] : data.punches.filter((p) => !p.clockOut && dateKey(new Date(p.clockIn)) === today).sort((a, b) => new Date(a.clockIn) - new Date(b.clockIn))
  const week = scheduleWeekOf(now)
  const drafts = data.shifts.filter((s) => week.includes(s.date) && !s.published)
  const covers = !f.cover ? [] : (data.cover ?? []).filter((c) => c.status === 'taken' && data.shifts.some((s) => s.id === c.shiftId))
  const staffNotes = !f.timeClock ? [] : (data.punchNotes ?? []).filter((n) => !n.ackAt)
  const count = notIn.length + requests.length + covers.length + stuck.length + staffNotes.length + (toReview > 0 ? 1 : 0)

  const othersOff = (t) => data.teamOff.filter((o) => o.employeeId !== t.employeeId && o.start <= t.end && o.end >= t.start).map((o) => first(o.employeeId))

  return (
    <div className="tm-narrow desk mt">
      {myOpen && (
        <div className="mt-in">
          <div><small>{w.youIn}</small><b>{w.since(formatClock(myOpen.clockIn))}</b></div>
          <button type="button" onClick={() => onView('clock')}>{w.myClock}</button>
        </div>
      )}

      <div className="mt-left">
      <h2 className="sc-h mt-h">{w.attention} {count > 0 && <span className="mt-count">{count}</span>}</h2>
      {count === 0 && <p className="tm-muted">{w.clear}</p>}

      {notIn.map((s) => {
        const phone = data.privateById?.[s.employeeId]?.phone
        return (
          <div key={s.id} className="mt-alert">
            <Avatar employee={person(s.employeeId)} size={40} />
            <div>
              <b>{w.notIn(name(s.employeeId))}</b>
              <small>{s.title ? `${s.title} · ` : ''}{w.started(nowMin - s.start)}</small>
            </div>
            {phone && <a className="mt-call" href={`tel:${phone}`}>{w.call}</a>}
          </div>
        )
      })}

      {requests.map((t) => {
        const others = othersOff(t)
        return (
          <div key={t.id} className={`mt-fold ${leaving[t.id] ? `leaving ${leaving[t.id]}` : ''}`}><div className="mt-fold-in">
          <section className="mt-card">
            {leaving[t.id] && <span className="mt-stamp" aria-hidden="true">{leaving[t.id] === 'approved' ? '✓' : '✕'}</span>}
            <div className="mt-who"><Avatar employee={person(t.employeeId)} size={42} /><div><small className="mt-eyebrow ok">{w.off}</small><b>{name(t.employeeId)}</b></div></div>
            <p className="mt-big">{datesLabel(t.start, t.end)}</p>
            {t.reason && <p className="mt-quote">“{t.reason}”</p>}
            <p className="mt-sub">{others.length ? w.alsoOff(others.join(', ')) : w.nobodyElse}</p>
            <div className="to-actions">
              <button type="button" className="to-btn" disabled={Boolean(leaving[t.id])} onClick={() => leave(t.id, 'declined', () => data.actions.decideTimeOff(t.id, 'declined'))}>{w.decline}</button>
              <button type="button" className="to-btn yes" disabled={Boolean(leaving[t.id])} onClick={() => leave(t.id, 'approved', () => data.actions.decideTimeOff(t.id, 'approved'))}>{w.approve}</button>
            </div>
          </section>
          </div></div>
        )
      })}

      {covers.map((c) => {
        const s = data.shifts.find((x) => x.id === c.shiftId)
        const other = c.swapShiftId ? data.shifts.find((x) => x.id === c.swapShiftId) : null
        const when = (x) => `${new Date(`${x.date}T12:00`).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${shiftTimes(x)}`
        const done = (result) => leave(c.id, result, () => data.actions.decideCover(c.id, result === 'approved'))
        return (
          <div key={c.id} className={`mt-fold ${leaving[c.id] ? `leaving ${leaving[c.id]}` : ''}`}><div className="mt-fold-in">
            <section className="mt-card">
              {leaving[c.id] && <span className="mt-stamp" aria-hidden="true">{leaving[c.id] === 'approved' ? '✓' : '✕'}</span>}
              <div className="mt-who"><Avatar employee={person(c.takerId)} size={42} /><div><small className="mt-eyebrow ok">{w.coverEyebrow}</small><b>{other ? w.swapLine(first(c.requesterId), first(c.takerId)) : w.coverLine(first(c.takerId), first(c.requesterId))}</b></div></div>
              <p className="mt-big">{other && <small className="cv-lab">{w.gets(first(c.takerId))}</small>}{when(s)}</p>
              {other && <p className="mt-big">{<small className="cv-lab">{w.gets(first(c.requesterId))}</small>}{when(other)}</p>}
              <p className="mt-sub">{s.title ? `${s.title} ` : ''}<RoleBadge role={s.role} roles={data.settings?.roles} />{c.note ? ` “${c.note}”` : ''}</p>
              <div className="to-actions">
                <button type="button" className="to-btn" disabled={Boolean(leaving[c.id])} onClick={() => done('declined')}>{w.decline}</button>
                <button type="button" className="to-btn yes" disabled={Boolean(leaving[c.id])} onClick={() => done('approved')}>{w.approve}</button>
              </div>
            </section>
          </div></div>
        )
      })}

      {f.timeClock && <StaffNotes data={data} lang={lang} onFix={(n) => setFixing(missingPunch(n))} />}

      {stuck.map((p) => (
        <section key={p.id} className="mt-card">
          <div className="mt-who"><Avatar employee={person(p.employeeId)} size={42} /><div><small className="mt-eyebrow bad">{w.fix}</small><b>{name(p.employeeId)} · {new Date(p.clockIn).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { weekday: 'short', day: 'numeric' })}</b></div></div>
          <p className="mt-sub">{w.neverOut(formatClock(p.clockIn))}</p>
          <button type="button" className="to-btn wide" onClick={() => setFixing(p)}>{w.setOut}</button>
        </section>
      ))}

      {toReview > 0 && (
        <section className="mt-card">
          <b>{w.review(toReview)}</b>
          <p className="mt-sub">{w.reviewSub}</p>
          <button type="button" className="to-btn wide" onClick={() => onView('review')}>{w.sched}</button>
        </section>
      )}
      </div>

      <div className="mt-right">
      {f.timeClock && (
      <section className="mt-card">
        <div className="mt-line"><b>{w.working}</b><small>{w.clockedIn(open.length)}</small></div>
        {open.length === 0 && <p className="tm-muted mb-0">{w.nobody}</p>}
        {open.map((p) => {
          const shift = shiftFor(p, data.shifts)
          const late = shift ? new Date(p.clockIn).getHours() * 60 + new Date(p.clockIn).getMinutes() - shift.start > LATE : false
          return (
            <div key={p.id} className="mt-working">
              <Avatar employee={person(p.employeeId)} size={38} />
              <div><b><i className="live-dot" aria-hidden="true" />{name(p.employeeId)}</b><small>{w.inAt(formatClock(p.clockIn))}{shift?.title ? ` · ${shift.title}` : ''}</small></div>
              <span className={`mt-pill ${late ? 'late' : ''}`}>{late ? w.late : w.onTime}</span>
            </div>
          )
        })}
      </section>
      )}

      {drafts.length > 0 && (
        <div className={`mt-fold ${leaving.draft ? 'leaving published' : ''}`}><div className="mt-fold-in">
        <section className="mt-card mt-draft">
          {leaving.draft && <span className="mt-stamp" aria-hidden="true">✓</span>}
          <div><b>{w.draft}</b><small>{w.changes(drafts.length)}</small></div>
          <button type="button" disabled={Boolean(leaving.draft)} onClick={() => leave('draft', 'published', () => data.actions.publishWeek(week))}>{w.publish}</button>
        </section>
        </div></div>
      )}

      {f.timeClock && <button type="button" className="to-link mt-more" onClick={() => onView('clock')}>{w.myClock}</button>}
      {f.notes && <ManagerNotes data={data} />}
      </div>
      {fixing && <PunchEditor punch={fixing} data={data} onClose={() => setFixing(null)} />}
    </div>
  )
}
