import { useState } from 'react'
import { fromKey } from '../lib/dates.js'
import { formatHours, shiftMinutes } from './paycheck.js'
import { offOn, scheduleOnly, shiftTimes } from './format.js'
import Avatar from './Avatar.jsx'
import { WeekTotal } from './ScheduleTab.jsx'

// The phone schedule for employees: a strip of the week's days, a card for the
// chosen day, then the whole week as a list. "My shifts" shows just yours;
// "Whole team" shows who is working each day.

// Shift names get a soft color (Open, Close, All day, then others by name).
const NAMED = { open: 0, close: 1, 'all day': 2 }
export function tagClass(title, presets = []) {
  const t = (title || '').trim().toLowerCase()
  const chosen = presets.find((p) => (p.title || '').trim().toLowerCase() === t)?.color
  if (Number.isInteger(chosen)) return `sc-tag t${chosen}`
  if (t in NAMED) return `sc-tag t${NAMED[t]}`
  const hash = [...t].reduce((sum, c) => sum + c.charCodeAt(0), 0)
  return `sc-tag t${3 + (hash % 5)}`
}

const WORDS = {
  en: { mine: 'My shifts', team: 'Whole team', today: 'Today', week: 'This week', dayOff: 'Day off', nothing: 'Nothing scheduled', timeOff: 'Time off', approved: 'Approved', hrs: 'hrs', comingUp: 'The week', working: 'Working', off: 'Off', nobody: 'Nobody is scheduled this day.' },
  es: { mine: 'Mis turnos', team: 'Todo el equipo', today: 'Hoy', week: 'Esta semana', dayOff: 'Día libre', nothing: 'Nada programado', timeOff: 'Ausencia', approved: 'Aprobada', hrs: 'hrs', comingUp: 'La semana', working: 'Trabajan', off: 'Libres', nobody: 'Nadie está programado este día.' },
}
const locale = (lang) => (lang === 'es' ? 'es-US' : 'en-US')

export default function MySchedule({ data, me, week, today, lang, view, onView }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const [picked, setPicked] = useState(null)
  const selected = week.includes(picked) ? picked : week.includes(today) ? today : week[0]
  const shiftsOn = (d, id) => data.shifts.filter((s) => s.date === d && (id ? s.employeeId === id : true)).sort((a, b) => a.start - b.start)
  const dayName = (d, style) => fromKey(d).toLocaleDateString(locale(lang), { weekday: style })

  return (
    <div className="tm-narrow">
      <div className="sc-toggle" role="group" aria-label="Whose shifts">
        <button type="button" aria-pressed={view === 'mine'} onClick={() => onView('mine')}>{w.mine}</button>
        <button type="button" aria-pressed={view === 'everyone'} onClick={() => onView('everyone')}>{w.team}</button>
      </div>

      <div className="sc-strip" role="group" aria-label="Days">
        {week.map((d) => {
          const working = view === 'mine' ? shiftsOn(d, me.id).length > 0 : shiftsOn(d).length > 0
          return (
            <button key={d} type="button" className={`sc-day ${d === selected ? 'on' : ''}`} aria-pressed={d === selected} onClick={() => setPicked(d)}>
              <span>{dayName(d, 'narrow').toUpperCase()}</span>
              <b>{fromKey(d).getDate()}</b>
              <i className={working ? 'dot' : ''} />
            </button>
          )
        })}
      </div>

      {view === 'mine' ? (
        <>
          <Hero data={data} me={me} date={selected} today={today} w={w} lang={lang} />
          <WeekTotal data={data} me={me} week={week} lang={lang} />
          <h2 className="sc-h">{w.comingUp}</h2>
          {week.map((d) => <Row key={d} data={data} me={me} date={d} w={w} lang={lang} on={d === selected} />)}
        </>
      ) : (
        <Everyone data={data} me={me} date={selected} today={today} w={w} lang={lang} />
      )}
    </div>
  )
}

// The chosen day, big: today's card is green, other days are cream.
function Hero({ data, me, date, today, w, lang }) {
  const mine = data.shifts.filter((s) => s.date === date && s.employeeId === me.id).sort((a, b) => a.start - b.start)
  const off = offOn(data.teamOff, me.id, date)
  const label = date === today ? w.today : fromKey(date).toLocaleDateString(locale(lang), { weekday: 'long', month: 'short', day: 'numeric' })
  return (
    <section className={`sc-hero ${date === today ? 'today' : ''}`}>
      {off ? (
        <>
          <small>{label}</small>
          <b>{w.timeOff}</b>
        </>
      ) : mine.length ? (
        mine.map((s) => (
          <div key={s.id}>
            <small>{label}{s.title ? ` · ${s.title}` : ''}</small>
            <b>{shiftTimes(s)}</b>
            <span>{formatHours(shiftMinutes(s))} {w.hrs}{s.note ? ` · ${s.note}` : ''}</span>
          </div>
        ))
      ) : (
        <>
          <small>{label}</small>
          <b>{w.dayOff}</b>
        </>
      )}
    </section>
  )
}

// One day of my week, as a row.
function Row({ data, me, date, w, lang, on }) {
  const mine = data.shifts.filter((s) => s.date === date && s.employeeId === me.id).sort((a, b) => a.start - b.start)
  const off = offOn(data.teamOff, me.id, date)
  const d = fromKey(date)
  const kind = off ? 'off' : mine.length ? '' : 'free'
  return (
    <div className={`sc-row ${kind} ${on ? 'on' : ''}`}>
      <div className="sc-date">
        <small>{d.toLocaleDateString(locale(lang), { weekday: 'short' }).replace('.', '').toUpperCase()}</small>
        <b>{d.getDate()}</b>
      </div>
      <div className="sc-body">
        {off ? (
          <>
            <b>{w.timeOff}</b>
            <small>{w.approved}</small>
          </>
        ) : mine.length ? (
          mine.map((s) => (
            <div key={s.id}>
              <span className="sc-time">{shiftTimes(s)}</span>
              {s.title && <span className={tagClass(s.title, data.settings?.shiftPresets)}>{s.title}</span>}
              {s.note && <small>{s.note}</small>}
            </div>
          ))
        ) : (
          <>
            <b>{w.dayOff}</b>
            <small>{w.nothing}</small>
          </>
        )}
      </div>
      {!off && mine.length > 0 && <span className="sc-hrs">{formatHours(mine.reduce((sum, s) => sum + shiftMinutes(s), 0))} {w.hrs}</span>}
    </div>
  )
}

// The whole team on the chosen day: who works and when, then who is off.
function Everyone({ data, me, date, today, w, lang }) {
  const people = data.employees.filter((e) => e.active)
  const shifts = data.shifts.filter((s) => s.date === date).sort((a, b) => a.start - b.start)
  const working = shifts.map((s) => ({ s, person: people.find((p) => p.id === s.employeeId) })).filter((x) => x.person)
  const offPeople = people.filter((p) => !shifts.some((s) => s.employeeId === p.id) && offOn(data.teamOff, p.id, date))
  const label = date === today ? w.today : fromKey(date).toLocaleDateString(locale(lang), { weekday: 'long', month: 'short', day: 'numeric' })
  return (
    <>
      <h2 className="sc-h">{label} · {w.working}</h2>
      {working.length === 0 && <p className="tm-muted">{w.nobody}</p>}
      {working.map(({ s, person }) => (
        <div key={s.id} className={`sc-row person ${person.id === me.id ? 'me' : ''}`}>
          <Avatar employee={person} size={42} />
          <div className="sc-body">
            <b>{person.name}{person.id === me.id ? (lang === 'es' ? ' (tú)' : ' (you)') : ''}</b>
            <div>
              <span className="sc-time">{shiftTimes(s)}</span>
              {s.title && <span className={tagClass(s.title, data.settings?.shiftPresets)}>{s.title}</span>}
            </div>
            {person.position && !scheduleOnly(person) && <small>{person.position}</small>}
          </div>
        </div>
      ))}
      {offPeople.length > 0 && (
        <>
          <h2 className="sc-h">{w.off}</h2>
          {offPeople.map((p) => (
            <div key={p.id} className="sc-row off person">
              <Avatar employee={p} size={42} />
              <div className="sc-body"><b>{p.name}</b><small>{w.timeOff}</small></div>
            </div>
          ))}
        </>
      )}
    </>
  )
}
