// The big clock-in area at the top of the Clock tab, drawn for each theme.
// Every version does the same thing: shows the time and status, and one button
// that clocks in or out (onPunch).
import { useState } from 'react'
import { dateKey, formatClock } from '../../lib/dates.js'
import { formatHours, punchMinutes } from '../paycheck.js'
import { clockTime, dayLabel, money } from '../format.js'
import { clockFacts, stopwatch } from './facts.js'
import SpotTag from '../SpotTag.jsx'
import { CannaLeaf, Cat, CatnipPlant, CatRolling, Paw, PixelIcon } from './art.jsx'
import TrainerHero from './TrainerHero.jsx'
import { dayName, say } from '../words.js'

const nextLabel = (s, today) => (s ? `${s.date === today ? 'Today' : dayLabel(s.date)} · ${s.title ? `${s.title} · ` : ''}${clockTime(s.start)} – ${clockTime(s.end)}` : 'Nothing scheduled yet')

const HEROES = { pixel: PixelHero, trainer: TrainerHero, cats: CatHero, catnip: NipHero, leaf: LeafHero }

// Clock out always shows while clocked in. Clock in only shows from 30 minutes
// (⚙️ → Business) before a shift until it ends; otherwise a note says when it
// opens, with a small "clock in anyway" for work that isn't on the schedule
// (Review flags it) unless a manager turned that off.
export default function ClockHero(props) {
  const [anyway, setAnyway] = useState(false)
  const f = clockFacts(props)
  const locked = !props.open && !f.windowShift && !anyway
  const Hero = HEROES[props.theme] ?? ClassicHero
  return (
    <>
      <Hero {...props} locked={locked} />
      {locked && <ClockLocked f={f} lang={props.lang} doneToday={props.todayMinutes > 0} onAnyway={props.data.settings?.allowAnyway === false ? null : () => setAnyway(true)} />}
    </>
  )
}

function ClockLocked({ f, lang, doneToday, onAnyway }) {
  const w = say(lang)
  const next = f.nextShift
  const opens = next && clock(Math.max(0, next.start - f.early))
  return (
    <div className="th-locked" role="status">
      {doneToday && <b className="th-locked-done">{w.allDone}</b>}
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

// ---------- Pixel ----------
function PixelHero({ open, busy, onPunch, now, data, me, locked }) {
  const f = clockFacts({ data, me, now, open })
  const heartIcon = { full: 'heart', half: 'heartHalf', empty: 'heartEmpty' }
  const done = f.hearts.filter((h) => h === 'full').length + (f.hearts.includes('half') ? 0.5 : 0)
  return (
    <div className="th-pixel-hero">
      <div className="px-panel">
        <div className="px-label"><span>SHIFTS THIS WEEK</span><span>{done}/{f.hearts.length || 0}</span></div>
        <div className="px-hearts">
          {f.hearts.length ? f.hearts.map((h, i) => <PixelIcon key={i} name={heartIcon[h]} size={3} />) : <span className="px-muted">No shifts this week</span>}
        </div>
      </div>
      {open ? (
        <>
          <div className="px-center"><span className="px-tag on">● ON SHIFT{f.spot ? ` · ${f.spot.label.toUpperCase()}` : ''}</span></div>
          <div className="px-big">{stopwatch(open, now)}</div>
          <div className="px-label"><span>SHIFT</span><span>{Math.round(f.progress * 100)}%</span></div>
          <div className="px-meter"><PixelIcon name="heart" size={2} /><div className="px-track"><i className="red" style={{ width: `${f.progress * 100}%` }} /></div></div>
          {f.rate > 0 && (
            <>
              <div className="px-label"><span>COINS TODAY</span><span>≈{money(f.earned)}</span></div>
              <div className="px-meter"><PixelIcon name="coin" size={2} /><div className="px-track"><i className="yellow" style={{ width: `${f.progress * 100}%` }} /></div></div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="px-big">{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
          <div className="px-center px-muted">{dayLabel(f.today).toUpperCase()}</div>
        </>
      )}
      {!locked && (
        <button type="button" className={`px-btn ${open ? 'red' : 'green'}`} disabled={busy} onClick={onPunch}>
          <PixelIcon name={open ? 'flag' : 'clock'} size={3} />
          {busy === 'locating' ? 'FINDING YOU…' : busy ? '…' : open ? 'END SHIFT' : 'START SHIFT'}
        </button>
      )}
      {!open && !locked && <div className="px-line"><PixelIcon name="star" size={2} /><span>NEXT: {nextLabel(f.nextShift, f.today)}</span></div>}
    </div>
  )
}

// ---------- Cat Café ----------
function catLine({ open, f }) {
  if (open) return f.progress >= 0.95 ? 'Almost done! Boop out soon 🐟' : f.progress > 0.5 ? 'More than halfway! 😺' : "Don't forget to boop out!"
  if (f.todayShift && f.todayShift.start > f.nowMin) return `Mrrp! Shift at ${clockTime(f.todayShift.start).replace(':00', '')}!`
  if (f.windowShift) return 'Mrrp! Time to boop in!'
  if (f.todayShift && f.todayShift.end <= f.nowMin) return 'All done! Nap time 😴'
  return 'No shift today. Nap time! 😴'
}

function CatHero({ open, busy, onPunch, now, data, me, locked }) {
  const f = clockFacts({ data, me, now, open })
  const worked = f.hearts.filter((h) => h === 'full').length
  return (
    <div className="th-cat-hero">
      <div className="cat-scene">
        <Cat kind="black" size={open ? 70 : 88} />
        <div className="cat-bubble">{catLine({ open, f })}</div>
        <Cat kind="tux" size={open ? 70 : 88} />
      </div>
      {open && (
        <div className="cat-timer">
          <b>{stopwatch(open, now)}</b>
          <small>on the clock{f.spot ? ` · 📍 ${f.spot.label.toLowerCase()}` : ''}</small>
          <div className="cat-yarn"><span className="thread" style={{ width: `${f.progress * 100}%` }} /><span className="ball" style={{ left: `calc(${f.progress * 100}% - 14px)` }} /></div>
          <div className="cat-lbl"><span>{f.todayShift ? clockTime(f.todayShift.start) : 'start'}</span><span>{Math.round(f.progress * 100)}% of the shift</span><span>{f.todayShift ? clockTime(f.todayShift.end) : ''}</span></div>
          {f.rate > 0 && <div className="cat-treats">🐟 {money(f.earned)} in treats so far</div>}
        </div>
      )}
      {!locked && (
        <button type="button" className="cat-boop" disabled={busy} onClick={onPunch} aria-label={open ? 'Clock out' : 'Clock in'}>
          <Paw out={Boolean(open)} />
          <span className="cat-boop-text">{busy === 'locating' ? 'Finding you…' : busy ? '…' : <>BOOP<br />to clock {open ? 'out' : 'in'}</>}</span>
        </button>
      )}
      <div className="cat-lbl"><span>Paw prints this week</span><span>{worked} of {f.hearts.length}</span></div>
      <div className="cat-paws">{f.hearts.map((h, i) => <span key={i} className={h}>🐾</span>)}</div>
    </div>
  )
}

// ---------- Catnip ----------
function NipHero({ open, busy, onPunch, now, data, me, locked }) {
  const f = clockFacts({ data, me, now, open })
  return (
    <div className="th-nip-hero">
      {open ? (
        <>
          <div className="nip-timer"><b>{stopwatch(open, now)}</b><small>{f.spot ? `📍 ${f.spot.label.toLowerCase()} · ` : ''}{Math.round(f.progress * 100)}% grown</small></div>
          <CatnipPlant grown={f.progress} />
          <div className="cat-lbl"><span>🌱 {f.todayShift ? clockTime(f.todayShift.start) : 'start'}</span><span>🌸 {f.todayShift ? clockTime(f.todayShift.end) : 'end'}</span></div>
          {f.rate > 0 && <div className="cat-treats">🐟 {money(f.earned)} in treats so far</div>}
        </>
      ) : (
        <div className="nip-scene">
          <div className="cat-bubble">mrrrow~ so relaxed</div>
          <CatRolling size={140} />
          <Cat kind="tux" eyes="hearts" size={80} />
          <span className="nip-heart h1">💕</span><span className="nip-heart h2">💚</span>
        </div>
      )}
      {!locked && (
        <button type="button" className={`nip-btn ${open ? 'out' : ''}`} disabled={busy} onClick={onPunch}>
          <span className="nip-wobble">{busy === 'locating' ? 'Finding you…' : busy ? '…' : open ? '🌿 TIME TO CHILL' : 'GET YOUR NIP'}</span>
          <small>{open ? '(clock out)' : '(clock in)'}</small>
        </button>
      )}
      {!open && !locked && <div className="cat-lbl"><span>Next</span><span>{nextLabel(f.nextShift, f.today)}</span></div>}
    </div>
  )
}

// ---------- Chill Leaf ----------
function LeafHero({ open, busy, onPunch, now, data, me, locked }) {
  const f = clockFacts({ data, me, now, open })
  return (
    <div className="th-leaf-hero">
      <span className="leaf-haze h1" /><span className="leaf-haze h2" />
      <div className="leaf-time">
        {open ? (
          <>
            <b>{stopwatch(open, now)}</b>
            <div className="leaf-bar"><i style={{ width: `${f.progress * 100}%` }} /></div>
            <small>{f.todayShift ? `${clockTime(f.todayShift.start)} · ${Math.round(f.progress * 100)}% · ${clockTime(f.todayShift.end)}` : 'in the zone'}</small>
          </>
        ) : (
          <>
            <b>{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</b>
            <small>{dayLabel(f.today)}</small>
          </>
        )}
      </div>
      {!locked && (
      <button type="button" className={`leaf-btn ${open ? 'out' : ''}`} disabled={busy} onClick={onPunch}>
        <CannaLeaf size={150} />
        <span>
          {busy === 'locating' ? 'Finding you…' : busy ? '…' : open ? 'Clock out' : 'Clock in'}
          <small>{open ? (f.rate > 0 ? `≈ ${money(f.earned)} so far` : f.spot?.label) : 'tap to start your shift'}</small>
        </span>
      </button>
      )}
      {!locked && <div className="leaf-note">{open ? (f.spot ? `📍 ${f.spot.label}` : 'stay chill') : nextLabel(f.nextShift, f.today)}</div>}
    </div>
  )
}
