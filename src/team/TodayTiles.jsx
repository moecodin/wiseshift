import { useState } from 'react'
import { dateKey } from '../lib/dates.js'
import { clockTime, offOn, useNow } from './format.js'
import Avatar from './Avatar.jsx'
import { formatHours, payPeriodOf, periodHours, shiftMinutes } from './paycheck.js'
import { useFeatures } from './features.js'
import { rangeName } from './words.js'
import YourDay from './YourDay.jsx'
import ComingUp from './ComingUp.jsx'

// Four summary tiles for the phone Today screens (staff and managers): my day, what is coming
// up, hours worked this pay period, and where my requests stand. Each tile opens the full screen.
// On a computer the full cards show instead, so these are hidden there.
const WORDS = {
  en: {
    day: 'Your day', coming: 'Coming up', worked: 'Worked this pay period', team: "Who's working today", justYou: 'Just you today', onNow: 'on now', working: 'working',
    dayOff: 'Day off', timeOff: 'Time off', nothing: 'Nothing scheduled', hrs: 'hrs', tomorrow: 'Tomorrow', today: 'Today', none: 'Nothing coming up',
    waiting: 'waiting', noneWaiting: 'None waiting', offOn: 'Off', ask: 'Ask for days off', overtime: 'Overtime', inSince: 'In since', approved: 'Approved',
  },
  es: {
    day: 'Tu día', coming: 'Próximamente', worked: 'Trabajado este período', team: 'Quién trabaja hoy', justYou: 'Solo tú hoy', onNow: 'ahora', working: 'trabajan',
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
  const [showDay, setShowDay] = useState(false)
  const [showNext, setShowNext] = useState(false)
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

  // Who's working today: everyone else with a published shift today, and who is on right now
  const person = (id) => data.employees.find((e) => e.id === id)
  const byPerson = new Map()
  for (const x of data.shifts.filter((x) => x.date === today && x.published && x.employeeId !== me.id && person(x.employeeId)).sort((a, b) => a.start - b.start)) {
    if (!byPerson.has(x.employeeId)) byPerson.set(x.employeeId, [])
    byPerson.get(x.employeeId).push(x)
  }
  const crew = [...byPerson].map(([id, list]) => ({ p: person(id), live: list.some((x) => x.start <= minutes && x.end > minutes) }))
  const onNow = crew.filter((c) => c.live).length

  return (
    <div className="tt-grid">
      <Tile title={w.day} big={dayBig} sub={open ? `${w.inSince} ${new Date(open.clockIn).toLocaleTimeString(locale(lang), { hour: 'numeric', minute: '2-digit' })}` : daySub} tone={open ? 'live' : off ? 'off' : ''} onClick={() => setShowDay(true)} />
      <Tile title={w.coming} big={nextDay} sub={next ? `${shiftTimes(next)}${next.title ? ` · ${next.title}` : ''}` : w.nothing} onClick={() => setShowNext(true)} />
      {f.timeClock && (
        <Tile title={w.worked} big={<>{formatHours(hours.total)} <span>{w.hrs}</span></>} sub={hours.overtime > 0 ? `${w.overtime} ${formatHours(hours.overtime)}` : rangeName(period, lang)} onClick={() => onGoTo('hours')} />
      )}
      <button type="button" className="tt tt-team" onClick={() => onGoTo('schedule')}>
        <span className="tt-top"><span>{w.team}</span><Arrow /></span>
        <span className="tt-faces">
          {crew.slice(0, 3).map(({ p, live }) => <span key={p.id} className={`tt-face ${live ? 'live' : ''}`}><Avatar employee={p} size={32} /></span>)}
          {crew.length > 3 && <span className="tt-more">+{crew.length - 3}</span>}
          {crew.length === 0 && <b className="tt-big">{w.justYou}</b>}
        </span>
        <small className="tt-sub">{crew.length ? `${crew.length} ${w.working}${onNow ? ` · ${onNow} ${w.onNow}` : ''}` : w.nothing}</small>
      </button>
      {showNext && <ComingUp data={data} me={me} lang={lang} onClose={() => setShowNext(false)} />}
      {showDay && <YourDay data={data} me={me} lang={lang} onClose={() => setShowDay(false)} />}
    </div>
  )
}
