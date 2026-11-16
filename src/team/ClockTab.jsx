import { useState } from 'react'
import { dateKey, formatClock } from '../lib/dates.js'
import { formatHours, payPeriodOf, periodHours, punchMinutes, scheduleWeekOf } from './paycheck.js'
import { dayLabel, firstName, offOn, scheduleOnly, shiftTimes, useNow } from './format.js'
import { currentSpot, streetAddress } from './location.js'
import SpotTag from './SpotTag.jsx'
import { WeekTotal } from './ScheduleTab.jsx'
import ReviewList from './ReviewList.jsx'
import ClockHero from './themes/ClockHero.jsx'
import { playSound } from './themes/sfx.js'
import { punchStatus } from './review.js'
import { dayName, rangeName, say } from './words.js'

const UPCOMING = 4 // shifts listed under "My next shifts"

// The Clock tab. Managers switch between their own clock and Review (approving
// everyone's punches), like Humanity's Clock / Manage.
export default function ClockTab({ data, me, boss, look, lang, onGoTo }) {
  const [view, setView] = useState('clock')
  if (!boss) return <MyClock data={data} me={me} boss={boss} look={look} lang={lang} onGoTo={onGoTo} />
  const pending = data.punches.filter((p) => punchStatus(p) === 'pending').length
  return (
    <>
      <div className="tm-narrow tm-switch">
        <div className="tm-seg" role="group" aria-label="Clock or review">
          <button type="button" aria-pressed={view === 'clock'} onClick={() => setView('clock')}>My clock</button>
          <button type="button" aria-pressed={view === 'review'} onClick={() => setView('review')}>
            Review{pending > 0 && <span className="tm-badge">{pending}</span>}
          </button>
        </div>
      </div>
      {view === 'review' ? (
        <div className="tm-narrow"><ReviewList data={data} /></div>
      ) : (
        <MyClock data={data} me={me} boss={boss} look={look} lang={lang} onGoTo={onGoTo} />
      )}
    </>
  )
}

// Clock in and out, today's shift and punches, the next shifts, and hours so far
// this pay period. Managers also see who's in right now.
function MyClock({ data, me, boss, look, lang, onGoTo }) {
  // Every second, for the themes' running timers.
  const now = useNow(1000)
  const theme = look?.id ?? 'classic'
  const w = say(lang)
  const [flash, setFlash] = useState(null) // just clocked in or out: { kind, minutes, saved }
  const today = dateKey(now)
  const [busy, setBusy] = useState('') // '', 'locating' or 'saving'
  const [error, setError] = useState('')
  const [noSpot, setNoSpot] = useState('')

  const open = data.punches.find((p) => p.employeeId === me.id && !p.clockOut)
  const staleOpen = open && dateKey(new Date(open.clockIn)) !== today
  const todayShifts = data.shifts.filter((s) => s.employeeId === me.id && s.date === today).sort((a, b) => a.start - b.start)
  const todayPunches = data.punches
    .filter((p) => p.employeeId === me.id && dateKey(new Date(p.clockIn)) === today)
    .sort((a, b) => new Date(a.clockIn) - new Date(b.clockIn))
  const period = payPeriodOf(now)
  const hours = periodHours(data.punches, me.id, period, now)
  const todayMinutes = todayPunches.reduce((sum, p) => sum + punchMinutes(p, now), 0)
  const off = offOn(data.teamOff, me.id, today)

  // Find where the phone is, then clock in or out (without the location if the
  // phone can't or won't say).
  const punch = async () => {
    setBusy('locating')
    setError('')
    setNoSpot('')
    const where = await currentSpot()
    // The street too, for the punch's details (skipped if it takes too long).
    if (!where.error) where.address = await streetAddress(where)
    setBusy('saving')
    const wasOpen = open
    const problem = open ? await data.actions.clockOut(where) : await data.actions.clockIn(where)
    setBusy('')
    if (problem) return setError(problem)
    if (where.error) setNoSpot(where.error)
    // The game themes celebrate: a flash at clock-in, "saving the game" at clock-out.
    const sounds = data.sounds && look?.sounds
    if (wasOpen) {
      const minutes = punchMinutes(wasOpen, new Date())
      setFlash({ kind: 'out', minutes, saved: false })
      if (sounds) playSound('save')
      setTimeout(() => setFlash((f) => f && { ...f, saved: true }), 1400)
      setTimeout(() => setFlash(null), 6000)
    } else {
      setFlash({ kind: 'in' })
      if (sounds) playSound('in')
      setTimeout(() => setFlash(null), 3500)
    }
  }

  return (
    <div className="tm-narrow">
      <section className={`tm-card tm-clock th-hero-${theme}`}>
        <ClockHero theme={theme} lang={lang} open={open} busy={busy} onPunch={punch} now={now} data={data} me={me} staleOpen={staleOpen} todayMinutes={todayMinutes} flash={flash} onGoTo={onGoTo} />
        {staleOpen && <p className="tm-warn">{w.stale(dayName(dateKey(new Date(open.clockIn)), lang))}</p>}
        {noSpot && <p className="tm-warn">{noSpot === 'denied' ? w.noSpotDenied : w.noSpot}</p>}
        {error && <p className="tm-error" role="alert">{error}</p>}
        <p className="tm-muted small mt-3 mb-0">{w.locationNote}</p>
      </section>

      <section className="tm-card">
        <h2>{w.today}</h2>
        {off && <p className="tm-offline">{w.timeOffToday}</p>}
        {todayShifts.length ? (
          todayShifts.map((s) => (
            <div key={s.id} className="tm-row">
              <span>{s.title || w.shift}</span>
              <b>{shiftTimes(s)}</b>
            </div>
          ))
        ) : (
          <p className="tm-muted">{w.noShiftToday}</p>
        )}
        {todayPunches.length > 0 && (
          <ul className="tm-punches">
            {todayPunches.map((p) => (
              <li key={p.id}>
                <span>
                  {w.in} {formatClock(p.clockIn)} <SpotTag spot={p.inSpot} shop={data.shop} lang={lang} />
                  {p.clockOut ? <> · {w.out} {formatClock(p.clockOut)} <SpotTag spot={p.outSpot} shop={data.shop} lang={lang} /></> : ` · ${w.stillIn}`}
                </span>
                <span>{formatHours(punchMinutes(p, now))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <NextShifts data={data} me={me} now={now} lang={lang} onMore={() => onGoTo('schedule')} />

      <WeekTotal data={data} me={me} lang={lang} week={scheduleWeekOf(now)} onClick={() => onGoTo('schedule')} />

      <button type="button" className="tm-card tm-summary" onClick={() => onGoTo('hours')}>
        <span>
          {w.workedPeriod} <small>{rangeName(period, lang)}</small>
        </span>
        <b>{formatHours(hours.total)} {w.hrs}</b>
      </button>

      {boss && <WhoIsIn data={data} now={now} today={today} />}
    </div>
  )
}

// The next few shifts, marked Current (happening now) and Next, like Humanity's dashboard.
function NextShifts({ data, me, now, lang, onMore }) {
  const w = say(lang)
  const today = dateKey(now)
  const minutes = now.getHours() * 60 + now.getMinutes()
  const coming = data.shifts
    .filter((s) => s.employeeId === me.id && (s.date > today || (s.date === today && s.end > minutes)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
    .slice(0, UPCOMING)
  if (!coming.length) return null
  const isNow = (s) => s.date === today && s.start <= minutes
  const next = coming.find((s) => !isNow(s))
  return (
    <section className="tm-card tm-next">
      <h2>{w.nextShifts}</h2>
      {coming.map((s) => {
        const day = new Date(`${s.date}T12:00`)
        return (
          <div key={s.id} className="tm-next-row">
            <div className="tm-datebox">
              <small>{day.toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { weekday: 'short' }).replace('.', '').toUpperCase()}</small>
              <b>{day.getDate()}</b>
            </div>
            <div className="tm-next-body">
              {s.title && <span>{s.title}</span>}
              <b>{shiftTimes(s)}</b>
              {s.note && <small className="tm-muted">{s.note}</small>}
            </div>
            {isNow(s) ? <span className="tm-tag now">{w.current}</span> : s === next && <span className="tm-tag next">{w.next}</span>}
          </div>
        )
      })}
      <button type="button" className="tm-link small mt-1" onClick={onMore}>{w.seeSchedule}</button>
    </section>
  )
}

// Managers: who's clocked in now, and who's scheduled today but isn't.
function WhoIsIn({ data, now, today }) {
  const name = (id) => data.employees.find((e) => e.id === id)?.name ?? '?'
  const open = data.punches.filter((p) => !p.clockOut).sort((a, b) => new Date(a.clockIn) - new Date(b.clockIn))
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const clocks = (id) => !scheduleOnly(data.employees.find((e) => e.id === id))
  const missing = data.shifts.filter(
    (s) => clocks(s.employeeId) && s.date === today && s.start <= nowMinutes && s.end > nowMinutes && !open.some((p) => p.employeeId === s.employeeId),
  )
  return (
    <section className="tm-card">
      <h2>Who's in now</h2>
      {open.length ? (
        open.map((p) => (
          <div key={p.id} className="tm-row">
            <span>{name(p.employeeId)}</span>
            <span className={dateKey(new Date(p.clockIn)) === today ? 'tm-muted' : 'tm-bad'}>
              since {dateKey(new Date(p.clockIn)) === today ? '' : `${dayLabel(dateKey(new Date(p.clockIn)))}, `}
              {formatClock(p.clockIn)} <SpotTag spot={p.inSpot} shop={data.shop} />
            </span>
          </div>
        ))
      ) : (
        <p className="tm-muted">Nobody is clocked in.</p>
      )}
      {!data.shop && <p className="tm-muted small">Set the shop's location in ⚙️ Settings → Business to see who clocked in at the shop.</p>}
      {missing.length > 0 && (
        <p className="tm-warn">
          Scheduled now but not clocked in: {missing.map((s) => `${firstName(name(s.employeeId))} (${shiftTimes(s)})`).join(', ')}
        </p>
      )}
    </section>
  )
}
