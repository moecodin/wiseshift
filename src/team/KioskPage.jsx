// The store-computer kiosk (update 025): a PIN keypad on a shared screen, no sign-in.
// Open the one-time link from Settings → Kiosk once on the computer; the page keeps the device token.
// Flow: PIN → "Hi Maria, clock in?" → Confirm → result, then back to the keypad.
import { useCallback, useEffect, useRef, useState } from 'react'
import { clockTime } from './format.js'
import { forgetKioskToken, kioskLookup, kioskPunch, saveKioskToken, savedKioskToken } from './kioskApi.js'
import { usingSupabase } from '../lib/supabase.js'
import './kiosk.css'

const MAX_PIN = 6
const MIN_PIN = 4
const RESULT_MS = 4000
const IDLE_MS = 30000

const initials = (name) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
const hoursSince = (iso) => `${(Math.max(0, Date.now() - new Date(iso)) / 3600000).toFixed(1)} hrs`
const timeOf = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const mmss = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function KioskPage() {
  // The link carries the token once; keep it on this computer and take it out of the address.
  const [token] = useState(() => {
    const fromLink = new URLSearchParams(location.search).get('kiosk')
    if (fromLink) {
      saveKioskToken(fromLink)
      history.replaceState(null, '', `${location.pathname}?kiosk`)
      return fromLink
    }
    return savedKioskToken()
  })
  const now = useNow()
  const [pin, setPin] = useState('')
  const [phase, setPhase] = useState('entry') // entry | confirm | early | done | locked | blocked | off
  const [who, setWho] = useState(null) // the lookup answer
  const [result, setResult] = useState(null) // the punch answer
  const [hint, setHint] = useState('')
  const [bad, setBad] = useState(false)
  const [busy, setBusy] = useState(false)
  const [lockedUntil, setLockedUntil] = useState(0)
  const timer = useRef(0)

  // The sample kiosk has no device token.
  const ready = Boolean(token) || !usingSupabase

  const reset = useCallback(() => {
    clearTimeout(timer.current)
    setPin('')
    setWho(null)
    setResult(null)
    setHint('')
    setBad(false)
    setPhase('entry')
  }, [])
  const after = (ms, fn) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(fn, ms)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  // Walk away mid-way and the screen clears itself.
  useEffect(() => {
    if (phase === 'entry' && pin) after(IDLE_MS, reset)
    if (phase === 'confirm' || phase === 'early' || phase === 'blocked') after(IDLE_MS, reset)
  }, [phase, pin, reset])

  const lock = (seconds) => {
    setLockedUntil(Date.now() + seconds * 1000)
    setPhase('locked')
  }
  // The lock ends by itself.
  const secondsLeft = Math.max(0, Math.ceil((lockedUntil - now.getTime()) / 1000))
  useEffect(() => {
    if (phase === 'locked' && secondsLeft === 0) reset()
  }, [phase, secondsLeft, reset])

  const next = async () => {
    if (pin.length < MIN_PIN || busy) return
    setBusy(true)
    const r = await kioskLookup(token, pin)
    setBusy(false)
    if (r.status === 'ok') {
      setWho(r)
      setPhase('confirm')
    } else if (r.status === 'locked') lock(r.retrySeconds ?? 300)
    else if (r.status === 'bad_pin') {
      setBad(true)
      setHint(r.triesLeft != null ? `That PIN did not match. ${r.triesLeft} ${r.triesLeft === 1 ? 'try' : 'tries'} left.` : 'That PIN did not match.')
      after(2200, reset)
    } else if (r.status === 'off') setPhase('off')
    else {
      setHint(r.message || 'Something went wrong. Try again.')
      after(3000, reset)
    }
  }

  const punch = async (anyway) => {
    if (busy) return
    setBusy(true)
    const r = await kioskPunch(token, pin, anyway)
    setBusy(false)
    if (r.status === 'ok') {
      setResult(r)
      setPhase('done')
      after(RESULT_MS, reset)
    } else if (r.status === 'too_early') setPhase('early')
    else if (r.status === 'not_allowed') setPhase('blocked')
    else if (r.status === 'just_now') {
      setResult({ ...r, justNow: true })
      setPhase('done')
      after(RESULT_MS, reset)
    } else if (r.status === 'locked') lock(r.retrySeconds ?? 300)
    else if (r.status === 'off') setPhase('off')
    else {
      setHint(r.message || 'Something went wrong. Try again.')
      reset()
    }
  }

  const press = (k) => {
    if (phase !== 'entry' || busy) return
    setBad(false)
    setHint('')
    if (k === 'back') setPin((p) => p.slice(0, -1))
    else if (k === 'clear') setPin('')
    else setPin((p) => (p.length < MAX_PIN ? p + k : p))
  }
  // A keyboard works too (a store computer often has one).
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('back')
      else if (e.key === 'Escape') reset()
      else if (e.key === 'Enter') {
        if (phase === 'entry') next()
        else if (phase === 'confirm') punch(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Same theme as the rest of the app: the device's light or dark.
  useEffect(() => {
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => (document.documentElement.dataset.bsTheme = dark.matches ? 'dark' : 'light')
    apply()
    dark.addEventListener('change', apply)
    document.title = 'WiseShift kiosk'
    return () => dark.removeEventListener('change', apply)
  }, [])

  const clock = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const date = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })

  let panel
  if (!ready || phase === 'off') {
    panel = (
      <div className="ks-card">
        <h2>{ready ? 'This kiosk is turned off' : 'This computer is not set up'}</h2>
        <p>{ready ? 'The kiosk was removed or switched off. A manager can add it again in Settings → Kiosk.' : 'A manager adds a kiosk in Settings → Kiosk and opens the link on this computer.'}</p>
        {ready && (
          <button type="button" className="ks-btn" onClick={() => { forgetKioskToken(); location.href = `${location.pathname}?kiosk` }}>
            Set up again
          </button>
        )}
      </div>
    )
  } else if (phase === 'confirm' && who) {
    const out = who.action === 'out'
    panel = (
      <div className="ks-card">
        <div className="ks-av" aria-hidden="true">{initials(who.person)}</div>
        <h2>Hi {who.person.split(' ')[0]}</h2>
        <p>
          {out
            ? `Clocked in since ${who.since ? timeOf(who.since) : 'earlier'}${who.since ? ` · ${hoursSince(who.since)}` : ''}`
            : who.shiftStart != null
              ? `Today ${clockTime(who.shiftStart)} – ${clockTime(who.shiftEnd)}`
              : 'No shift on the schedule today'}
        </p>
        <div className="ks-btns">
          <button type="button" className="ks-btn" onClick={reset}>Cancel</button>
          <button type="button" className="ks-btn primary" disabled={busy} onClick={() => punch(false)}>{out ? 'Clock out' : 'Clock in'}</button>
        </div>
      </div>
    )
  } else if (phase === 'early') {
    const noShift = who?.shiftStart == null
    panel = (
      <div className="ks-card">
        <div className="ks-av muted" aria-hidden="true">!</div>
        <h2>{noShift ? 'No shift on the schedule' : 'Too early to clock in'}</h2>
        <p>{noShift ? 'You are not scheduled today.' : `Your shift starts at ${clockTime(who.shiftStart)}.`}</p>
        <div className="ks-btns">
          <button type="button" className="ks-btn" onClick={reset}>OK</button>
          {who?.anywayOk !== false && (
            <button type="button" className="ks-btn primary" disabled={busy} onClick={() => punch(true)}>Clock in anyway</button>
          )}
        </div>
        {who?.anywayOk !== false && <small>A manager will see this punch in Hours review.</small>}
      </div>
    )
  } else if (phase === 'blocked') {
    panel = (
      <div className="ks-card">
        <div className="ks-av muted" aria-hidden="true">!</div>
        <h2>Can't clock in right now</h2>
        <p>You are not scheduled and clocking in without a shift is turned off. Ask a manager.</p>
        <div className="ks-btns"><button type="button" className="ks-btn primary" onClick={reset}>OK</button></div>
      </div>
    )
  } else if (phase === 'done' && result) {
    const inn = result.action === 'in'
    panel = (
      <div className="ks-card" role="status">
        <div className="ks-tick" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </div>
        <h2>{result.justNow ? 'Already done' : inn ? 'Clocked in' : 'Clocked out'}</h2>
        <div className="ks-big">{result.at ? timeOf(result.at) : ''}</div>
        <p>{result.person}</p>
        <div className="ks-drain" aria-hidden="true"><i /></div>
      </div>
    )
  } else if (phase === 'locked') {
    panel = (
      <div className="ks-card" role="alert">
        <div className="ks-av bad" aria-hidden="true">
          <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
        </div>
        <h2>Kiosk locked</h2>
        <p>Too many wrong PINs. Try again in</p>
        <div className="ks-big">{mmss(secondsLeft)}</div>
        <small>A manager can unlock it in Settings → Kiosk.</small>
      </div>
    )
  } else {
    panel = (
      <div className="ks-col">
        <div className={`ks-dots ${bad ? 'shake' : ''}`} role="img" aria-label={`${pin.length} digits entered`}>
          {Array.from({ length: Math.max(pin.length, MIN_PIN) }, (_, i) => <i key={i} className={i < pin.length ? 'f' : ''} />)}
        </div>
        <p className={`ks-hint ${bad ? 'bad' : ''}`} aria-live="polite">{hint || (pin.length === 0 ? 'Enter your PIN' : pin.length >= MIN_PIN ? 'Press Next' : '')}</p>
        <div className="ks-pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
            <button key={k} type="button" onClick={() => press(k)}>{k}</button>
          ))}
          <button type="button" className="fn" onClick={() => press('clear')}>Clear</button>
          <button type="button" onClick={() => press('0')}>0</button>
          <button type="button" className="fn" aria-label="Backspace" onClick={() => press('back')}>⌫</button>
        </div>
        <button type="button" className="ks-btn primary wide" disabled={pin.length < MIN_PIN || busy} onClick={next}>Next</button>
      </div>
    )
  }

  return (
    <div className="tm ks">
      <div className="ks-left">
        <div className="ks-brand"><span className="ks-mark" aria-hidden="true" />WiseShift</div>
        <div>
          <div className="ks-clock">{clock}</div>
          <div className="ks-date">{date}</div>
        </div>
        <div className="ks-foot">{usingSupabase ? 'Kiosk' : 'Kiosk · sample (try 4821, 7305 or 6100)'}</div>
      </div>
      <div className="ks-right">{panel}</div>
    </div>
  )
}
