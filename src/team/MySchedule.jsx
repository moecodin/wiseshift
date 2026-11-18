import { useState } from 'react'
import { fromKey } from '../lib/dates.js'
import { formatHours, shiftMinutes } from './paycheck.js'
import { offOn, shiftTimes } from './format.js'
import RoleBadge from './RoleBadge.jsx'
import DayStrip from './DayStrip.jsx'
import { useFeatures } from './features.js'
import DayTimeline from './DayTimeline.jsx'
import WeekGrid from './WeekGrid.jsx'
import { loadSpan, saveSpan } from './viewPref.js'
import { tagClass } from './tags.js'
export { tagClass }
import { activeCover, CoverStatus, OpenShifts } from './CoverUI.jsx'
import { WeekTotal } from './ScheduleTab.jsx'

// The phone schedule for employees: a strip of the week's days, a card for the
// chosen day, then the whole week as a list. "My shifts" shows just yours;
// "Whole team" shows who is working each day.

const WORDS = {
  en: { mine: 'My shifts', team: 'Whole team', today: 'Today', week: 'This week', dayOff: 'Day off', nothing: 'Nothing scheduled', timeOff: 'Time off', approved: 'Approved', hrs: 'hrs', comingUp: 'The week', working: 'Working', off: 'Off', offShort: 'off', nobody: 'Nobody is scheduled this day.', day: 'Day', weekLabel: 'Week', dayOrWeek: 'Show a day or the week' },
  es: { mine: 'Mis turnos', team: 'Todo el equipo', today: 'Hoy', week: 'Esta semana', dayOff: 'Día libre', nothing: 'Nada programado', timeOff: 'Ausencia', approved: 'Aprobada', hrs: 'hrs', comingUp: 'La semana', working: 'Trabajan', off: 'Libres', offShort: 'libre', nobody: 'Nadie está programado este día.', day: 'Día', weekLabel: 'Semana', dayOrWeek: 'Mostrar un día o la semana' },
}
const locale = (lang) => (lang === 'es' ? 'es-US' : 'en-US')

export default function MySchedule({ data, me, week, today, lang, view, onView }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const [picked, setPicked] = useState(null)
  // Whole team: the day timeline or the read-only week grid. The last choice is remembered.
  const [span, setSpan] = useState(loadSpan)
  const changeSpan = (next) => {
    setSpan(next)
    saveSpan(next)
  }
  const selected = week.includes(picked) ? picked : week.includes(today) ? today : week[0]
  const shiftsOn = (d, id) => data.shifts.filter((s) => s.date === d && (id ? s.employeeId === id : true)).sort((a, b) => a.start - b.start)
  const dayName = (d, style) => fromKey(d).toLocaleDateString(locale(lang), { weekday: style })

  return (
    <div className="tm-narrow desk">
      <div className="sc-toggle" role="group" aria-label="Whose shifts">
        <button type="button" aria-pressed={view === 'mine'} onClick={() => onView('mine')}>{w.mine}</button>
        <button type="button" aria-pressed={view === 'everyone'} onClick={() => onView('everyone')}>{w.team}</button>
      </div>

      {(
        <div className="sc-toggle sc-span" role="group" aria-label={w.dayOrWeek}>
          <button type="button" aria-pressed={span === 'day'} onClick={() => changeSpan('day')}>{w.day}</button>
          <button type="button" aria-pressed={span === 'week'} onClick={() => changeSpan('week')}>{w.weekLabel}</button>
        </div>
      )}

      {span !== 'week' && <DayStrip days={week} selected={selected} renderDay={(d) => {
          const working = view === 'mine' ? shiftsOn(d, me.id).length > 0 : shiftsOn(d).length > 0
          // On "My shifts" a day with no shift says "off"; the team view only marks days someone works.
          const dayOff = view === 'mine' && !working
          return (
            <button key={d} type="button" className={`sc-day ${d === selected ? 'on' : ''}`} aria-pressed={d === selected} onClick={() => setPicked(d)}>
              <span>{dayName(d, 'narrow').toUpperCase()}</span>
              <b>{fromKey(d).getDate()}</b>
              {dayOff ? <em>{w.offShort}</em> : <i className={working ? 'dot' : ''} />}
            </button>
          )
        }} />}

      {view === 'mine' ? (
        <>
          <OpenShifts data={data} me={me} lang={lang} />
          {span === 'week' ? (
            <div className="sc-mine week">
              <div className="sc-mine-l">
                <WeekTotal data={data} me={me} week={week} lang={lang} />
              </div>
              <div className="sc-mine-r">
                <h2 className="sc-h">{w.comingUp}</h2>
                {week.map((d) => <Row key={d} data={data} me={me} date={d} w={w} lang={lang} on={d === selected} onPick={() => { setPicked(d); changeSpan('day') }} />)}
              </div>
            </div>
          ) : (
            <div className="sc-mine day">
              <div key={selected} className="sc-fade"><Hero data={data} me={me} date={selected} today={today} w={w} lang={lang} /></div>
            </div>
          )}
        </>
      ) : span === 'week' ? (
        <WeekGrid
          className="mg-grid show-phone"
          data={data}
          me={me}
          week={week}
          today={today}
          people={data.employees.filter((e) => e.active)}
          shifts={data.shifts.filter((x) => week.includes(x.date) && x.published)}
          onPickDay={(d) => { setPicked(d); changeSpan('day') }}
        />
      ) : (
        <div key={selected} className="sc-fade"><DayTimeline mode="staff" data={data} me={me} date={selected} today={today} lang={lang} /></div>
      )}
    </div>
  )
}

// The chosen day, big: today's card is green, other days are cream.
function Hero({ data, me, date, today, w, lang }) {
  const f = useFeatures()
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
            {f.roles && s.role && <em className="sc-hero-role">{s.role}</em>}
            <span>{formatHours(shiftMinutes(s))} {w.hrs}{s.note ? ` · ${s.note}` : ''}</span>
            <CoverStatus data={data} shift={s} lang={lang} />
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
function Row({ data, me, date, w, lang, on, onPick }) {
  const f = useFeatures()
  const mine = data.shifts.filter((s) => s.date === date && s.employeeId === me.id).sort((a, b) => a.start - b.start)
  const off = offOn(data.teamOff, me.id, date)
  const d = fromKey(date)
  const kind = off ? 'off' : mine.length ? '' : 'free'
  return (
    <div className={`sc-row ${kind} ${on ? 'on' : ''} ${onPick ? 'pick' : ''}`} onClick={onPick} role={onPick ? 'button' : undefined} tabIndex={onPick ? 0 : undefined} onKeyDown={onPick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick()) : undefined}>
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
              <RoleBadge role={s.role} roles={data.settings?.roles} />
              {f.cover && activeCover(data.cover, s.id) && <span className="cv-tag">cover?</span>}
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
