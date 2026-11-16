// Pocket Trainer's clock screen: a handheld-RPG "top screen" (status, HP, EXP,
// a text box) and "touch screen" (big menu buttons). Original art and words only.
//   Clock in   a flash, then a town sign: THE SHOP (or ROUTE · 2.0 MI)
//   Clock out  "SAVING… Don't turn off the power", then "saved the game!"
//   Card       Trainer Card: ID, money, time played, start date, badges
//   Level up   at each new pay period (level = pay periods worked)
//   Day/night  the grass follows the real time of day
import { useEffect, useState } from 'react'
import Modal from '../../components/Modal.jsx'
import { dateKey, fromKey } from '../../lib/dates.js'
import { formatHours, grossPay, payPeriodOf, periodHours } from '../paycheck.js'
import { clockTime, dayLabel, money } from '../format.js'
import { clockFacts, stopwatch, trainerLevel } from './facts.js'
import { playSound } from './sfx.js'

const DAY_MS = 86400000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const timeOfDay = (now) => {
  const h = now.getHours()
  return h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'evening' : 'night'
}

export default function TrainerHero({ open, busy, onPunch, now, data, me, flash, onGoTo, locked }) {
  const f = clockFacts({ data, me, now, open })
  const [card, setCard] = useState(false)
  const level = trainerLevel(me, now)
  const name = me.name.split(' ')[0].toUpperCase()
  const tap = (fn) => () => {
    if (data.sounds) playSound('tap')
    fn()
  }
  // The text box: what just happened, or what's next.
  let text
  if (flash?.kind === 'out') text = flash.saved ? [`${name} saved the game!`, `Today: ${formatHours(flash.minutes)} HRS${f.rate ? ` · ≈ ${money((flash.minutes / 60) * f.rate)}` : ''}`] : ['SAVING…', "Don't turn off the power."]
  else if (flash?.kind === 'in') text = ['A new SHIFT has begun!', f.todayShift ? `${(f.todayShift.title || 'SHIFT').toUpperCase()} · ${clockTime(f.todayShift.start)} – ${clockTime(f.todayShift.end)}` : '']
  else if (open) text = [`${name} is working hard!`, f.rate ? `Earned about ${money(f.earned)} so far.` : `${Math.round(f.progress * 100)}% of the shift done.`]
  else if (locked && f.todayShift && f.todayShift.end <= f.nowMin) text = [`${name}'s shift is complete!`, f.nextShift ? `NEXT: ${dayLabel(f.nextShift.date)} · ${clockTime(f.nextShift.start)}` : 'Great work today.']
  else if (f.todayShift && f.todayShift.start > f.nowMin - 30) text = ['A shift is about to start!', `${(f.todayShift.title || 'SHIFT').toUpperCase()} · ${clockTime(f.todayShift.start)} – ${clockTime(f.todayShift.end)}`]
  else if (timeOfDay(now) === 'night') text = ["It's late. Get some rest!", f.nextShift ? `NEXT: ${dayLabel(f.nextShift.date)} · ${clockTime(f.nextShift.start)}` : '']
  else text = [`${timeOfDay(now) === 'morning' ? 'Good morning' : 'Hello'}, ${name}!`, f.nextShift ? `NEXT: ${dayLabel(f.nextShift.date)} · ${clockTime(f.nextShift.start)}` : 'No shifts coming up.']

  const hp = open ? 1 - f.progress : f.todayShift ? 1 : 0
  const periodNow = periodHours(data.punches, me.id, payPeriodOf(now), now)
  const exp = Math.min(1, periodNow.total / (80 * 60))

  return (
    <div className="th-trainer-hero">
      <div className={`tr-top ${timeOfDay(now)}`}>
        {flash?.kind === 'in' && <div className="tr-flash" />}
        {timeOfDay(now) === 'night' && <span className="tr-stars">✦ ✧ ✦</span>}
        {open && f.spot && (
          <div className={`tr-sign ${f.spot.far ? 'route' : ''} ${flash?.kind === 'in' ? 'drop' : ''}`}>
            {f.spot.far ? `ROUTE · ${f.spot.label.replace(' away', '').toUpperCase()}` : 'THE SHOP'}
            <small>{f.spot.far ? '📍 away from the shop' : '📍 at the shop'}</small>
          </div>
        )}
        <div className="tr-box">
          <div className="tr-name"><b>{name}</b><span>Lv. {level}</span></div>
          <div className="tr-hp"><span className="tag">HP</span><div className="bar"><i className={hp < 0.5 ? 'y' : ''} style={{ width: `${hp * 100}%` }} /></div></div>
          <div className="tr-num">{open ? `${stopwatch(open, now).slice(0, -3)} / ${formatHours(f.span).replace(/\.00$/, ':00')}` : f.todayShift ? `${formatHours(f.span)} HRS TODAY` : 'NO SHIFT TODAY'}</div>
          <div className="tr-exp"><span className="tag">EXP</span><div className="bar"><i style={{ width: `${exp * 100}%` }} /></div></div>
        </div>
        <div className="tr-clock">{open ? stopwatch(open, now) : `${dayLabel(f.today).toUpperCase()} · ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}</div>
        <div className="tr-text" role="status">{text[0]}{text[1] && <><br />{text[1]}</>}</div>
      </div>
      <div className="tr-hinge" />
      <div className="tr-bottom">
        {locked ? (
          <div className="tr-text tr-wait">REST at the PUP CENTER until your next shift.</div>
        ) : (
          <button type="button" className={`tr-btn big ${open ? 'stop' : 'go'}`} disabled={busy} onClick={onPunch}>
            {busy === 'locating' ? 'FINDING YOU…' : busy ? '…' : open ? '■ CLOCK OUT' : '▶ CLOCK IN'}
          </button>
        )}
        <button type="button" className="tr-btn blue" onClick={tap(() => onGoTo('schedule'))}>PARTY</button>
        <button type="button" className="tr-btn yel" onClick={tap(() => onGoTo('hours'))}>PAY</button>
        <button type="button" className="tr-btn gray" onClick={tap(() => onGoTo('off'))}>BAG</button>
        <button type="button" className="tr-btn gray" onClick={tap(() => setCard(true))}>CARD</button>
      </div>
      {card && <TrainerCard data={data} me={me} now={now} level={level} periodNow={periodNow} rate={f.rate} onClose={() => setCard(false)} />}
      <LevelUp data={data} me={me} now={now} level={level} rate={f.rate} />
    </div>
  )
}

// ---------- Trainer Card ----------
function TrainerCard({ data, me, now, level, periodNow, rate, onClose }) {
  const total = data.totalMinutes
  const months = me.startedOn ? (now - fromKey(me.startedOn)) / (30.44 * DAY_MS) : 0
  const hours = (total ?? 0) / 60
  const badges = [
    ['FIRST SHIFT', '1', hours > 0, ''],
    ['100 HRS', '100', hours >= 100, 's'],
    ['6 MONTHS', '6M', months >= 6, 'g'],
    ['1 YEAR', '1Y', months >= 12, ''],
    ['500 HRS', '500', hours >= 500, 's'],
    ['1,000 HRS', '1K', hours >= 1000, 's'],
    ['2 YEARS', '2Y', months >= 24, 'g'],
    ['5 YEARS', '5Y', months >= 60, ''],
  ]
  const started = me.startedOn ? `${MONTHS[fromKey(me.startedOn).getMonth()]} ${fromKey(me.startedOn).getFullYear()}` : '—'
  return (
    <Modal title="Trainer Card" onClose={onClose}>
      <div className="tr-card">
        <div className="tr-card-head"><span>TRAINER CARD</span><span>ID No. {String(me.staffNo ?? 0).padStart(5, '0')}</span></div>
        <div className="tr-card-inner">
          <div>
            <div className="row2"><b>NAME</b><span>{me.name.split(' ')[0].toUpperCase()}</span></div>
            <div className="row2"><b>LEVEL</b><span>{level}</span></div>
            <div className="row2"><b>MONEY</b><span>{rate ? money(grossPay(periodNow, rate).gross) : '—'}</span></div>
            <div className="row2"><b>TIME</b><span>{total === null ? '—' : `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`}</span></div>
            <div className="row2"><b>STARTED</b><span>{started}</span></div>
          </div>
          <div className="tr-portrait">{me.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</div>
        </div>
      </div>
      <div className="tr-badges">
        {badges.map(([label, glyph, got, tone]) => (
          <div key={label} className={`tr-badge ${got ? `got ${tone}` : 'no'}`}>
            <i>{got ? glyph : '?'}</i>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p className="tr-small">MONEY is this pay period so far. TIME is every hour you've clocked here. Badges are only earned, never lost.</p>
      <SoundSwitch data={data} />
    </Modal>
  )
}

export function SoundSwitch({ data }) {
  return (
    <label className="form-check form-switch mt-2">
      <input
        type="checkbox"
        className="form-check-input"
        checked={data.sounds}
        onChange={(e) => {
          if (e.target.checked) playSound('level')
          data.actions.setTheme(data.theme, e.target.checked)
        }}
      />{' '}
      Sound effects
    </label>
  )
}

// ---------- Level up, once per new pay period ----------
const LEVEL_KEY = 'wiseshift-trainer-period'

function LevelUp({ data, me, now, level, rate }) {
  const current = payPeriodOf(now)[0]
  const key = `${LEVEL_KEY}:${me.id}`
  const [show, setShow] = useState(false)
  useEffect(() => {
    let seen = null
    try {
      seen = localStorage.getItem(key)
      if (seen !== current) localStorage.setItem(key, current)
    } catch {
      return
    }
    // Only after a pay period has really changed, not the very first visit.
    if (seen && seen !== current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShow(true)
      if (data.sounds) playSound('level')
    }
  }, [key, current, data.sounds])
  if (!show) return null

  const previous = payPeriodOf(fromKey(dateKey(new Date(fromKey(current) - DAY_MS))))
  const hours = periodHours(data.punches, me.id, previous, now)
  const shifts = hours.byDay.filter((d) => d.minutes > 0).length
  return (
    <Modal title="Level up!" onClose={() => setShow(false)}>
      <div className="tr-text big">{me.name.split(' ')[0].toUpperCase()} grew to<br />Lv. {level}!</div>
      <div className="tr-stats">
        <div><span>HOURS</span><b>+{formatHours(hours.total)}</b></div>
        {rate > 0 && <div><span>MONEY</span><b>+{money(grossPay(hours, rate).gross)}</b></div>}
        <div><span>SHIFTS</span><b>+{shifts}</b></div>
      </div>
      <p className="tr-small">A new pay period started: {dayLabel(current)}. Level = pay periods worked.</p>
      <button type="button" className="tr-btn blue w-100" onClick={() => setShow(false)}>OK</button>
    </Modal>
  )
}
