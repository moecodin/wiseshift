// The clock-in area at the top of the Clock tab: the time, the status, and one
// button that clocks in or out (onPunch).
import { useEffect, useRef, useState } from 'react'
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
  const f = clockFacts(props)
  const outside = !props.open && !f.windowShift // not within a shift window
  const canAnyway = props.data.settings?.allowAnyway !== false
  // Outside a shift the real button still works (the punch is flagged for review), unless a manager turned that off.
  const disabled = outside && !canAnyway
  return (
    <>
      <ClassicHero {...props} locked={disabled} lockedHint={lockedHint(f, props.lang)} />
      {outside && <ClockLocked f={f} lang={props.lang} doneToday={props.todayMinutes > 0} canAnyway={canAnyway} />}
    </>
  )
}

// "Opens at 1:30 PM" / "Opens Thu at 1:30 PM", for the dimmed button's caption.
function lockedHint(f, lang) {
  const w = say(lang)
  const next = f.nextShift
  if (!next) return w.noUpcoming
  const opens = clockTime(Math.max(0, next.start - f.early))
  return next.date === f.today ? w.opensAt(opens) : w.opensOn(dayName(next.date, lang), opens)
}

function ClockLocked({ f, lang, doneToday, canAnyway }) {
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
      {canAnyway && <p className="tm-locked-note">{w.flagNote}</p>}
    </div>
  )
}

const clock = (m) => clockTime(m)

const HOLD_MS = 1000 // how long to press and hold

// The round button: press and hold to clock in or out. A ring fills while you
// hold; letting go early cancels. Keyboard and screen-reader users can just
// activate it (a click with no pointer), since holding isn't possible for everyone.
function HoldButton({ open, busy, onPunch, w }) {
  const [progress, setProgress] = useState(0) // 0 to 1
  const [pulse, setPulse] = useState(false)
  const frame = useRef(0)
  const startedAt = useRef(0)
  const finish = () => {
    stop()
    navigator.vibrate?.(40)
    setPulse(true)
    setTimeout(() => setPulse(false), 700)
    onPunch()
  }
  const tick = () => {
    const p = Math.min(1, (performance.now() - startedAt.current) / HOLD_MS)
    setProgress(p)
    if (p >= 1) finish()
    else frame.current = requestAnimationFrame(tick)
  }
  const start = (e) => {
    if (busy || e.button > 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    startedAt.current = performance.now()
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(tick)
  }
  function stop() {
    cancelAnimationFrame(frame.current)
    frame.current = 0
    setProgress(0)
  }
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const holding = progress > 0 && progress < 1
  const R = 54 // ring radius in the 120 x 120 box
  const C = 2 * Math.PI * R
  return (
    <div className={`tm-holdwrap ${holding ? 'holding' : ''} ${pulse ? 'pulse' : ''}`}>
      <svg className="tm-ring" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={R} className="tm-ring-track" />
        <circle cx="60" cy="60" r={R} className="tm-ring-fill" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
      </svg>
      <button
        type="button"
        className={`tm-punch ${open ? 'out' : 'in'}`}
        disabled={busy}
        aria-label={open ? w.clockOut : w.clockIn}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerCancel={stop}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => { if (e.detail === 0) onPunch() }}
      >
        {busy === 'locating' ? w.finding : busy ? '…' : pulse ? w.done : holding ? w.keepHolding : open ? w.clockOut : w.clockIn}
      </button>
    </div>
  )
}

function ClassicHero({ open, busy, onPunch, now, staleOpen, data, todayMinutes, locked, lockedHint, lang }) {
  const w = say(lang)
  return (
    <>
      <div className="tm-now">{now.toLocaleTimeString(lang === 'es' ? 'es-US' : 'en-US', { hour: 'numeric', minute: '2-digit' })}</div>
      <div className="tm-date">{dayName(dateKey(now), lang)}</div>
      {!locked && (
        <>
          <HoldButton open={open} busy={busy} onPunch={onPunch} w={w} />
          <div className="tm-holdhint">{open ? w.holdOut : w.holdIn}</div>
        </>
      )}
      {locked && (
        <>
          {/* A manager turned "clock in anyway" off and it is not this person's shift yet: the button stays, dimmed, and says when it opens. */}
          <div className="tm-holdwrap locked">
            <button type="button" className="tm-punch in locked" aria-disabled="true" aria-label={`${w.clockIn}. ${lockedHint}`}>{w.clockIn}</button>
          </div>
          <div className="tm-holdhint">{lockedHint}</div>
        </>
      )}
      <div className="tm-status" role="status">
        {open ? (
          <>
            {w.since} <b>{formatClock(open.clockIn)}</b>
            {staleOpen && w.on(dayName(dateKey(new Date(open.clockIn)), lang))} · {formatHours(punchMinutes(open, now))} {w.hrs}
            <div><SpotTag quiet spot={open.inSpot} shop={data.shop} lang={lang} /></div>
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
