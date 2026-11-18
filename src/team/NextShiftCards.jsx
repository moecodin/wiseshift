import { useState } from 'react'
import { dateKey, fromKey } from '../lib/dates.js'
import { clockTime, useNow } from './format.js'
import { formatHours, shiftMinutes } from './paycheck.js'
import ComingUp from './ComingUp.jsx'

// Staff, phone Today page, below the tiles: the next few scheduled shifts, each its own card
// (day, times, role, hours), with the hours added up in the header. A computer keeps the
// full "next shifts" card instead, so this is hidden there. "See all" opens the Coming up pop-up.
const SHOWN = 5
const WORDS = {
  en: { title: 'Next shifts', hrs: 'hrs', now: 'On now', next: 'Next', all: (n) => `See all ${n} shifts` },
  es: { title: 'Próximos turnos', hrs: 'hrs', now: 'Ahora', next: 'Siguiente', all: (n) => `Ver los ${n} turnos` },
}
const locale = (lang) => (lang === 'es' ? 'es-US' : 'en-US')

export default function NextShiftCards({ data, me, lang }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const now = useNow(60000)
  const [all, setAll] = useState(false)
  const today = dateKey(now)
  const minutes = now.getHours() * 60 + now.getMinutes()
  const coming = data.shifts
    .filter((s) => s.employeeId === me.id && (s.date > today || (s.date === today && s.end > minutes)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
  if (!coming.length) return null
  const shown = coming.slice(0, SHOWN)
  const total = shown.reduce((sum, s) => sum + shiftMinutes(s), 0)
  const isNow = (s) => s.date === today && s.start <= minutes
  const nextId = shown.find((s) => !isNow(s))?.id

  return (
    <section className="tt-next" aria-label={w.title}>
      <div className="tn-head"><h2>{w.title}</h2><span>{formatHours(total)} {w.hrs}</span></div>
      {shown.map((s) => {
        const d = fromKey(s.date)
        return (
          <button key={s.id} type="button" className={`tn-card ${isNow(s) ? 'live' : ''}`} onClick={() => setAll(true)}>
            <span className="tn-date">
              <small>{d.toLocaleDateString(locale(lang), { weekday: 'short' }).toUpperCase()}</small>
              <b>{d.getDate()}</b>
            </span>
            <span className="tn-what">
              <b>{clockTime(s.start)} – {clockTime(s.end)}</b>
              {(s.title || isNow(s) || s.id === nextId) && (
                <small>{s.title}{s.title && (isNow(s) || s.id === nextId) ? ' · ' : ''}{isNow(s) ? w.now : s.id === nextId ? w.next : ''}</small>
              )}
            </span>
            <span className="tn-hrs">{formatHours(shiftMinutes(s))}</span>
          </button>
        )
      })}
      {coming.length > SHOWN && <button type="button" className="tn-all" onClick={() => setAll(true)}>{w.all(coming.length)}</button>}
      {all && <ComingUp data={data} me={me} lang={lang} onClose={() => setAll(false)} />}
    </section>
  )
}
