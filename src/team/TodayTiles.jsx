import { dateKey } from '../lib/dates.js'
import { clockTime, datesLabel, offOn, useNow } from './format.js'
import { formatHours, payPeriodOf, periodHours, shiftMinutes } from './paycheck.js'
import { useFeatures } from './features.js'
import { rangeName } from './words.js'

// Four summary tiles for the phone Today screens (staff and managers): my day, what is coming
// up, hours worked this pay period, and where my requests stand. Each tile opens the full screen.
// On a computer the full cards show instead, so these are hidden there.
const WORDS = {
  en: {
    day: 'Your day', coming: 'Coming up', worked: 'Worked this pay period', requests: 'My requests',
    dayOff: 'Day off', timeOff: 'Time off', nothing: 'Nothing scheduled', hrs: 'hrs', tomorrow: 'Tomorrow', today: 'Today', none: 'Nothing coming up',
    waiting: 'waiting', noneWaiting: 'None waiting', offOn: 'Off', ask: 'Ask for days off', overtime: 'Overtime', inSince: 'In since', approved: 'Approved',
  },
  es: {
    day: 'Tu día', coming: 'Próximamente', worked: 'Trabajado este período', requests: 'Mis solicitudes',
    dayOff: 'Día libre', timeOff: 'Ausencia', nothing: 'Nada programado', hrs: 'hrs', tomorrow: 'Mañana', today: 'Hoy', none: 'Nada próximo',
    waiting: 'en espera', noneWaiting: 'Ninguna en espera', offOn: 'Libre', ask: 'Pedir días libres', overtime: 'Horas extra', inSince: 'Desde las', approved: 'Aprobada',
  },
}
const locale = (lang) => (lang === 'es' ? 'es-US' : 'en-US')
// "8:00 AM – 2:00 PM" becomes "8 AM – 2 PM" so it fits a small tile; minutes stay when there are some.
const short = (min) => clockTime(min).replace(':00', '')
const shiftTimes = (s) => `${short(s.start)} – ${short(s.end)}`
const Arrow = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>

function Tile({ title, big, sub, onClick, tone }) {
  return (
    <button type="button" className={`tt ${tone ?? ''}`} onClick={onClick}>
      <span className="tt-top"><span>{title}</span><Arrow /></span>
      <b className="tt-big">{big}</b>
      <small className="tt-sub">{sub}</small>
    </button>
  )
}

export default function TodayTiles({ data, me, lang, onGoTo }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const f = useFeatures()
  const now = useNow(30000)
  const today = dateKey(now)
  const minutes = now.getHours() * 60 + now.getMinutes()
  const mine = data.shifts.filter((s) => s.employeeId === me.id).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)

  // Your day
  const todays = mine.filter((s) => s.date === today)
  const off = offOn(data.teamOff, me.id, today)
  const open = f.timeClock ? data.punches.find((p) => p.employeeId === me.id && !p.clockOut) : undefined
  const dayBig = off ? w.timeOff : todays.length ? shiftTimes(todays[0]) : w.dayOff
  const dayHours = todays.reduce((sum, s) => sum + shiftMinutes(s), 0)
  const daySub = off ? w.nothing : todays.length ? `${todays[0].title ? `${todays[0].title} · ` : ''}${formatHours(dayHours)} ${w.hrs}` : w.nothing

  // Coming up: the next shift that is not the one happening now
  const next = mine.find((s) => s.date > today || (s.date === today && s.start > minutes))
  const tomorrow = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  const nextDay = next ? (next.date === today ? w.today : next.date === tomorrow ? w.tomorrow : new Date(`${next.date}T12:00`).toLocaleDateString(locale(lang), { weekday: 'short', month: 'short', day: 'numeric' })) : w.none

  // Worked this pay period
  const period = payPeriodOf(now)
  const hours = periodHours(data.punches, me.id, period, now)

  // My requests: waiting time off and cover requests, and the next approved day off
  const pendingOff = f.timeOff ? data.timeOff.filter((t) => t.employeeId === me.id && t.status === 'pending').length : 0
  const liveCover = f.cover ? (data.cover ?? []).filter((c) => c.requesterId === me.id && (c.status === 'open' || c.status === 'taken')).length : 0
  const waiting = pendingOff + liveCover
  const nextOff = f.timeOff ? data.timeOff.filter((t) => t.employeeId === me.id && t.status === 'approved' && t.end >= today).sort((a, b) => a.start.localeCompare(b.start))[0] : undefined

  return (
    <div className="tt-grid">
      <Tile title={w.day} big={dayBig} sub={open ? `${w.inSince} ${new Date(open.clockIn).toLocaleTimeString(locale(lang), { hour: 'numeric', minute: '2-digit' })}` : daySub} tone={open ? 'live' : off ? 'off' : ''} onClick={() => onGoTo('schedule')} />
      <Tile title={w.coming} big={nextDay} sub={next ? `${shiftTimes(next)}${next.title ? ` · ${next.title}` : ''}` : w.nothing} onClick={() => onGoTo('schedule')} />
      {f.timeClock && (
        <Tile title={w.worked} big={<>{formatHours(hours.total)} <span>{w.hrs}</span></>} sub={hours.overtime > 0 ? `${w.overtime} ${formatHours(hours.overtime)}` : rangeName(period, lang)} onClick={() => onGoTo('hours')} />
      )}
      {(f.timeOff || f.cover) && (
        <Tile title={w.requests} big={waiting > 0 ? `${waiting} ${w.waiting}` : w.noneWaiting} sub={nextOff ? `${w.offOn} ${datesLabel(nextOff.start, nextOff.end)}` : w.ask} tone={waiting > 0 ? 'warn' : ''} onClick={() => onGoTo('off')} />
      )}
    </div>
  )
}
