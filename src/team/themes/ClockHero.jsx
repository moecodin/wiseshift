// The clock-in area at the top of the Clock tab: the time, the status, and one
// button that clocks in or out (onPunch).
import { useState } from 'react'
import { dateKey, formatClock } from '../../lib/dates.js'
import { formatHours, punchMinutes } from '../paycheck.js'
import { clockTime } from '../format.js'
import { clockFacts } from './facts.js'
import SpotTag from '../SpotTag.jsx'
import { dayName, say } from '../words.js'

// Clock out always shows while clocked in. Clock in only shows from 30 minutes
// (⚙️ → Business) before a shift until it ends; otherwise a note says when it
// opens, with a small "clock in anyway" for work that isn't on the schedule
// (Review flags it) unless a manager turned that off.
export default function ClockHero(props) {
  const [anyway, setAnyway] = useState(false)
  const f = clockFacts(props)
  const locked = !props.open && !f.windowShift && !anyway
  return (
    <>
      <ClassicHero {...props} locked={locked} />
      {locked && <ClockLocked f={f} lang={props.lang} doneToday={props.todayMinutes > 0} onAnyway={props.data.settings?.allowAnyway === false ? null : () => setAnyway(true)} />}
    </>
  )
}

function ClockLocked({ f, lang, doneToday, onAnyway }) {
  const w = say(lang)
  const next = f.nextShift
  const opens = next && clock(Math.max(0, next.start - f.early))
  return (
    <div className="tm-locked" role="status">
      {doneToday && <b className="tm-locked-done">{w.allDone}</b>}
      {next ? (
        <>
          <div>
            {w.nextShift}: <b>{next.date === f.today ? w.today : dayName(next.date, lang)}</b> · {next.title ? `${next.title} · ` : ''}
            {clockTime(next.start)} – {clockTime(next.end)}
          </div>
          <small>{next.date === f.today ? w.opensAt(opens) : w.opensOn(dayName(next.date, lang), opens)}</small>
        </>
      ) : (
        <div>{w.noUpcoming}</div>
      )}
      {onAnyway && <button type="button" className="tm-link small" onClick={onAnyway}>{w.anyway}</button>}
    </div>
  )
}

const clock = (m) => clockTime(m)

function ClassicHero({ open, busy, onPunch, now, staleOpen, data, todayMinutes, locked, lang }) {
  const w = say(lang)
  return (
    <>
      <div className="tm-now">{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
      <div className="tm-date">{dayName(dateKey(now), lang)}</div>
      {!locked && (
        <button type="button" className={`tm-punch ${open ? 'out' : 'in'}`} disabled={busy} onClick={onPunch}>
          {busy === 'locating' ? w.finding : busy ? '…' : open ? w.clockOut : w.clockIn}
        </button>
      )}
      <div className="tm-status" role="status">
        {open ? (
          <>
            {w.since} <b>{formatClock(open.clockIn)}</b>
            {staleOpen && w.on(dayName(dateKey(new Date(open.clockIn)), lang))} · {formatHours(punchMinutes(open, now))} {w.hrs}
            <div><SpotTag spot={open.inSpot} shop={data.shop} lang={lang} /></div>
          </>
        ) : todayMinutes ? (
          <>{w.clockedOut(formatHours(todayMinutes))}</>
        ) : (
          w.notIn
        )}
      </div>
    </>
  )
}
