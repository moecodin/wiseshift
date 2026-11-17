import { fromKey } from '../lib/dates.js'
import { datesLabel, shiftTimes } from './format.js'
import Avatar from './Avatar.jsx'
import { useFeatures } from './features.js'

// Extra cards for the staff Today screen (the Clock tab): a countdown to the next shift,
// who else works today, and where my own requests stand.
const WORDS = {
  en: {
    next: (t) => `Your next shift starts ${t}`, in: (t) => `in ${t}`, on: (t) => t,
    team: "Who's working today", more: (n) => `+${n} more`, onNow: 'On now', see: 'See the schedule',
    requests: 'My requests', timeOff: 'Time off', cover: 'Cover', swap: 'Swap',
    off: { pending: 'Waiting for a manager', approved: 'Approved', declined: 'Declined' },
    coverStatus: {
      open: 'Waiting for a coworker', openTo: (n) => `Waiting for ${n}`, taken: (n) => `${n} agreed. Waiting for a manager`, approved: (n) => `Approved. ${n} covers it`,
      swapApproved: (n) => `Approved. Swapped with ${n}`, declined: 'A manager declined it', passed: (n) => `${n} can't do it`,
    },
  },
  es: {
    next: (t) => `Tu próximo turno empieza ${t}`, in: (t) => `en ${t}`, on: (t) => t,
    team: 'Quién trabaja hoy', more: (n) => `+${n} más`, onNow: 'Ahora', see: 'Ver el horario',
    requests: 'Mis solicitudes', timeOff: 'Ausencia', cover: 'Cobertura', swap: 'Cambio',
    off: { pending: 'Esperando a un gerente', approved: 'Aprobada', declined: 'Rechazada' },
    coverStatus: {
      open: 'Esperando a un compañero', openTo: (n) => `Esperando a ${n}`, taken: (n) => `${n} aceptó. Esperando a un gerente`, approved: (n) => `Aprobada. ${n} lo cubre`,
      swapApproved: (n) => `Aprobado. Cambio con ${n}`, declined: 'Un gerente lo rechazó', passed: (n) => `${n} no puede`,
    },
  },
}
const words = (lang) => WORDS[lang === 'es' ? 'es' : 'en']
const locale = (lang) => (lang === 'es' ? 'es-US' : 'en-US')
const first = (name) => (name || '?').split(' ')[0]
const startsAt = (shift) => fromKey(shift.date).getTime() + shift.start * 60000
const DAY = 86400000
// First name, plus a last initial when two people in the list share a first name.
const label = (p, list) => {
  const [f, ...rest] = p.name.split(' ')
  return list.some((o) => o.p.id !== p.id && o.p.name.split(' ')[0] === f) && rest.length ? `${f} ${rest.at(-1)[0]}.` : f
}

// "Your next shift starts in 3h 20m", or the day and time when it is a day or more away.
export function Countdown({ data, me, now, open, lang }) {
  const w = words(lang)
  if (open) return null
  const next = data.shifts
    .filter((s) => s.employeeId === me.id && s.published && startsAt(s) > now.getTime())
    .sort((a, b) => startsAt(a) - startsAt(b))[0]
  if (!next) return null
  const mins = Math.ceil((startsAt(next) - now.getTime()) / 60000)
  const h = Math.floor(mins / 60)
  let when
  if (mins < 60) when = w.in(`${mins} min`)
  else if (startsAt(next) - now.getTime() < DAY) when = w.in(`${h}h${mins % 60 ? ` ${mins % 60}m` : ''}`)
  else when = `${fromKey(next.date).toLocaleDateString(locale(lang), { weekday: 'short' })} ${shiftTimes(next).split(' – ')[0]}`
  return <p className="td-countdown">{w.next(when)}</p>
}

// Everyone else working today, with a green dot while their shift is on.
export function TodayTeam({ data, me, today, now, lang, onMore }) {
  const w = words(lang)
  const minutes = now.getHours() * 60 + now.getMinutes()
  const person = (id) => data.employees.find((e) => e.id === id)
  const byPerson = new Map()
  for (const s of data.shifts.filter((x) => x.date === today && x.published && x.employeeId !== me.id && person(x.employeeId)).sort((a, b) => a.start - b.start)) {
    if (!byPerson.has(s.employeeId)) byPerson.set(s.employeeId, [])
    byPerson.get(s.employeeId).push(s)
  }
  const list = [...byPerson].map(([id, shifts]) => ({ p: person(id), shifts })).sort((a, b) => a.shifts[0].start - b.shifts[0].start)
  if (!list.length) return null
  const LIMIT = 6
  return (
    <section className="tm-card td-team">
      <h2>{w.team}</h2>
      <ul>
        {list.slice(0, LIMIT).map(({ p, shifts }) => {
          const live = shifts.some((s) => s.start <= minutes && s.end > minutes)
          return (
            <li key={p.id}>
              <span className="td-av"><Avatar employee={p} size={36} />{live && <i className="live-dot" title={w.onNow} />}</span>
              <b>{label(p, list)}</b>
              <small>{shifts.map(shiftTimes).join(', ')}</small>
            </li>
          )
        })}
      </ul>
      {list.length > LIMIT && <p className="tm-muted small mb-1">{w.more(list.length - LIMIT)}</p>}
      <button type="button" className="td-more" onClick={onMore}>{w.see}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg></button>
    </section>
  )
}

// My time off and cover requests: waiting ones, and ones decided in the last week.
export function MyRequests({ data, me, now, lang, onGoTo }) {
  const w = words(lang)
  const f = useFeatures()
  const recent = (iso) => !iso || now.getTime() - new Date(iso).getTime() < 7 * DAY
  const person = (id) => first(data.employees.find((e) => e.id === id)?.name)
  const items = []
  for (const t of f.timeOff ? data.timeOff.filter((x) => x.employeeId === me.id) : []) {
    if (t.status !== 'pending' && !recent(t.decidedAt)) continue
    items.push({ id: `t${t.id}`, kind: w.timeOff, title: datesLabel(t.start, t.end), status: w.off[t.status] ?? t.status, tone: t.status, sort: t.createdAt ?? t.start, go: 'off' })
  }
  for (const c of f.cover ? (data.cover ?? []).filter((x) => x.requesterId === me.id) : []) {
    const shift = data.shifts.find((s) => s.id === c.shiftId)
    if (!shift || c.status === 'cancelled') continue
    const live = c.status === 'open' || c.status === 'taken'
    if (!live && !recent(c.decidedAt || c.passedAt)) continue
    const cs = w.coverStatus
    const swap = c.kind === 'swap'
    const status =
      c.status === 'open' ? (c.targetId ? cs.openTo(person(c.targetId)) : cs.open)
        : c.status === 'taken' ? cs.taken(person(c.takerId))
          : c.status === 'approved' ? (swap ? cs.swapApproved(person(c.takerId)) : cs.approved(person(c.takerId)))
            : c.status === 'declined' ? cs.declined
              : cs.passed(person(c.targetId))
    items.push({
      id: `c${c.id}`, kind: swap ? w.swap : w.cover,
      title: `${fromKey(shift.date).toLocaleDateString(locale(lang), { weekday: 'short', month: 'short', day: 'numeric' })} · ${shiftTimes(shift)}`,
      status, tone: c.status === 'approved' ? 'approved' : c.status === 'declined' || c.status === 'passed' ? 'declined' : 'pending', sort: c.createdAt, go: 'schedule',
    })
  }
  if (!items.length) return null
  items.sort((a, b) => String(b.sort).localeCompare(String(a.sort)))
  return (
    <section className="tm-card td-requests">
      <h2>{w.requests}</h2>
      {items.slice(0, 4).map((it) => (
        <button key={it.id} type="button" className="td-req" onClick={() => onGoTo(it.go)}>
          <span><small>{it.kind}</small><b>{it.title}</b></span>
          <span className={`td-state ${it.tone}`}>{it.status}</span>
        </button>
      ))}
    </section>
  )
}
