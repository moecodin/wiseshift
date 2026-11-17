import { useState } from 'react'
import { dateKey, formatClock } from '../lib/dates.js'
import { formatHours, payPeriodOf, periodHours, punchMinutes, scheduleWeekOf } from './paycheck.js'
import { dayLabel, firstName, offOn, scheduleOnly, shiftTimes, useNow } from './format.js'
import { currentSpot, streetAddress } from './location.js'
import RoleBadge from './RoleBadge.jsx'
import { OpenShifts } from './CoverUI.jsx'
import { useFeatures } from './features.js'
import { MyPunchNotes } from './PunchNotes.jsx'
import { Countdown, MyRequests, TodayTeam } from './TodayExtras.jsx'
import SpotTag from './SpotTag.jsx'
import { WeekTotal } from './ScheduleTab.jsx'
import ReviewList from './ReviewList.jsx'
import ClockHero from './themes/ClockHero.jsx'
import ManagerToday from './ManagerToday.jsx'
import { dayName, rangeName, say } from './words.js'

const UPCOMING = 4 // shifts listed under "My next shifts"

// The Clock tab. Managers get a Today screen (what needs them, who is in) and
// open their own clock or Review from there.
export default function ClockTab({ data, me, boss, look, lang, onGoTo }) {
  const [view, setView] = useState('today')
  if (!boss) return <MyClock data={data} me={me} boss={boss} look={look} lang={lang} onGoTo={onGoTo} />
  if (view === 'today') return <ManagerToday data={data} me={me} lang={lang} onView={setView} />
  return (
    <>
      <div className="tm-narrow">
        <button type="button" className="tm-back" onClick={() => setView('today')}>‹ {lang === 'es' ? 'Hoy' : 'Today'}</button>
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
  const w = say(lang)
  const f = useFeatures()
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
    // Without the location feature the punch is saved with no place.
    const where = f.location ? await currentSpot() : {}
    // The street too, for the punch's details (skipped if it takes too long).
    if (f.location && !where.error) where.address = await streetAddress(where)
    setBusy('saving')
    const problem = open ? await data.actions.clockOut(where) : await data.actions.clockIn(where)
    setBusy('')
    if (problem) return setError(problem)
    if (where.error) setNoSpot(where.error)
  }

  return (
    <div className="tm-narrow desk td-grid">
      <div className="td-col">
      {f.timeClock && (
      <section className="tm-card tm-clock">
        <ClockHero lang={lang} open={open} busy={busy} onPunch={punch} now={now} data={data} me={me} staleOpen={staleOpen} todayMinutes={todayMinutes} onGoTo={onGoTo} />
        {staleOpen && <p className="tm-warn">{w.stale(dayName(dateKey(new Date(open.clockIn)), lang))}</p>}
        {noSpot && <p className="tm-warn">{noSpot === 'denied' ? w.noSpotDenied : w.noSpot}</p>}
        {error && <p className="tm-error" role="alert">{error}</p>}
        {!boss && <MyPunchNotes data={data} me={me} lang={lang} />}
        {!boss && <Countdown data={data} me={me} now={now} open={open} lang={lang} />}
        {f.location && <p className="tm-muted small mt-3 mb-0">{w.locationNote}</p>}
      </section>
      )}

      {!boss && <OpenShifts data={data} me={me} lang={lang} />}

      <section className="tm-card">
        <h2>{lang === 'es' ? 'Tu día' : 'Your day'}</h2>
        {off && <p className="tm-offline">{w.timeOffToday}</p>}
        {todayShifts.length ? (
          todayShifts.map((s) => (
            <div key={s.id} className="tm-row">
              <span>{s.title || w.shift}{s.role && <> <RoleBadge role={s.role} roles={data.settings?.roles} /></>}</span>
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
        {!f.timeClock && !boss && <Countdown data={data} me={me} now={now} open={undefined} lang={lang} />}
      </section>

      </div>
      <div className="td-col">
      {!boss && <TodayTeam data={data} me={me} today={today} now={now} lang={lang} onMore={() => onGoTo('schedule')} />}

      {!boss && <MyRequests data={data} me={me} now={now} lang={lang} onGoTo={onGoTo} />}

      <NextShifts data={data} me={me} now={now} lang={lang} onMore={() => onGoTo('schedule')} />

      <WeekTotal data={data} me={me} lang={lang} week={scheduleWeekOf(now)} onClick={() => onGoTo('schedule')} />

      {f.timeClock && (
      <button type="button" className="tm-card tm-summary" onClick={() => onGoTo('hours')}>
        <span>
          {w.workedPeriod} <small>{rangeName(period, lang)}</small>
        </span>
        <b>{formatHours(hours.total)} {w.hrs}</b>
      </button>
      )}

      {boss && <WhoIsIn data={data} now={now} today={today} />}
      </div>
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
      <h2>{lang === 'es' ? 'Próximamente' : 'Coming up'}</h2>
      {coming.map((s) => {
        const day = new Date(`${s.date}T12:00`)
        return (
          <div key={s.id} className="tm-next-row">
            <div className="tm-datebox">
              <small>{day.toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { weekday: 'short' }).replace('.', '').toUpperCase()}</small>
              <b>{day.getDate()}</b>
            </div>
            <div className="tm-next-body">
              {(s.title || s.role) && <span>{s.title}{s.role && <> <RoleBadge role={s.role} roles={data.settings?.roles} /></>}</span>}
              <b>{shiftTimes(s)}</b>
              {s.note && <small className="tm-muted">{s.note}</small>}
            </div>
            {isNow(s) ? <span className="tm-tag now">{w.current}</span> : s === next && <span className="tm-tag next">{w.next}</span>}
          </div>
        )
      })}
      <button type="button" className="td-more" onClick={onMore}>{w.seeSchedule}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg></button>
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
