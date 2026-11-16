import { useEffect, useState } from 'react'
import Modal from '../components/Modal.jsx'
import { pushIsOn, pushSupport, tellPush, turnOffPush, turnOnPush } from './app.js'
import { clockTime } from './format.js'

// The kinds of notifications (send-push function, update 017).
// Everyone gets the first seven; managers also get the last three.
const KINDS = [
  { id: 'published', label: 'New schedule published', example: '“Your schedule for Oct 25–31 is up: 3 shifts, 24 hrs”' },
  { id: 'changed', label: 'My shift changed or was removed', example: '“Your Tue shift changed: now 8 AM – 2 PM”' },
  { id: 'timeoff', label: 'Time off approved or declined', example: '“Time off approved: Nov 12–14”' },
  { id: 'shift', label: (t) => `Shift reminder, ${t.remindBefore} min before`, example: '“Shift at 8:00 AM. Don’t forget to clock in!”' },
  { id: 'stillin', label: 'Still clocked in after my shift', example: '“Your shift ended at 2:00 PM. Clock out if you’re done.”' },
  { id: 'request', label: 'Time-off requests', example: '“Sam asked for Nov 12–14 off”', managers: true },
  { id: 'away', label: 'Clocked in away from the shop', example: '“Sam clocked in 2.0 mi away”', managers: true },
  { id: 'late', label: (t) => `Someone hasn’t clocked in, ${t.lateAfter} min into a shift`, example: '“Maria hasn’t clocked in for the 8:00 AM shift”', managers: true },
]

// 🔔 Turn notifications on or off for this phone, and choose which kinds.
export default function NotifySettings({ data, boss, onClose }) {
  return (
    <Modal title="Notifications" onClose={onClose}>
      <NotifyOptions data={data} boss={boss} />
    </Modal>
  )
}

// The same, inside ⚙️ Settings.
export function NotifyOptions({ data, boss }) {
  const support = pushSupport()
  const [on, setOn] = useState(null) // null while checking
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const off = data.pushOff ?? []

  useEffect(() => {
    let alive = true
    pushIsOn().then((yes) => alive && setOn(yes), () => alive && setOn(false))
    return () => {
      alive = false
    }
  }, [])

  const toggleThisPhone = async () => {
    setBusy(true)
    setMessage('')
    const problem = on ? await turnOffPush() : await turnOnPush()
    setBusy(false)
    if (problem === 'blocked') setMessage('Notifications are blocked for this app. Turn them on in your phone’s Settings → Notifications → RI Sched (or the browser), then try again.')
    else if (problem) setMessage(problem)
    else setOn(!on)
  }
  const test = async () => {
    setMessage('Sending…')
    const result = await tellPush('test')
    setMessage(result?.sent ? 'Sent! It should arrive in a few seconds.' : result?.error ? `Couldn’t send: ${result.error}` : 'Nothing was sent. Is this phone turned on above?')
  }
  const toggleKind = (id) => data.actions.setPushOff(off.includes(id) ? off.filter((k) => k !== id) : [...off, id])

  return (
    <>
      {support === 'install-first' && (
        <p className="tm-warn">On iPhone, notifications only work in the installed app. Add <b>WiseShift</b> to your home screen (Safari → Share → Add to Home Screen), open it from the <b>RI Sched</b> icon, then come back here.</p>
      )}
      {support === 'blocked' && <p className="tm-warn">Notifications are blocked for this app. Turn them on in your phone’s settings, then come back here.</p>}
      {support === 'unsupported' && <p className="tm-warn">This phone or browser can’t get notifications. On iPhone, update to iOS 16.4 or newer.</p>}
      {support === 'not-ready' && <p className="tm-muted small">Notifications work on the live site (your WiseShift site), not while trying things out here.</p>}

      {support === 'ok' && (
        <div className="nt-phone">
          <div>
            <b>This phone</b>
            <small>{on === null ? 'Checking…' : on ? 'Notifications are on' : 'Notifications are off'}</small>
          </div>
          <button type="button" className={`btn ${on ? 'btn-outline-secondary' : 'btn-brand'}`} disabled={busy || on === null} onClick={toggleThisPhone}>
            {busy ? '…' : on ? 'Turn off' : '🔔 Turn on'}
          </button>
        </div>
      )}
      {on && <button type="button" className="tm-link small" onClick={test}>Send me a test notification</button>}
      {message && <p className="tm-msg small mt-2" role="status">{message}</p>}

      <h3 className="tm-h3">What to tell me about</h3>
      <div className="nt-kinds">
        {KINDS.filter((k) => !k.managers || boss).map((k) => (
          <label key={k.id} className="form-check form-switch nt-kind">
            <input type="checkbox" className="form-check-input" checked={!off.includes(k.id)} onChange={() => toggleKind(k.id)} />
            <span>
              {typeof k.label === 'function' ? k.label(data.settings) : k.label}
              <small>{k.example}</small>
            </span>
          </label>
        ))}
      </div>
      <p className="tm-muted small mt-3 mb-0">
        Quiet hours {clockTime(data.settings.quietFrom)} – {clockTime(data.settings.quietTo)}: nothing buzzes then except “still clocked in”. Other news waits until {clockTime(data.settings.quietTo)}.
      </p>
    </>
  )
}
