import { lazy, Suspense, useEffect, useState } from 'react'
import Modal from '../components/Modal.jsx'
import { dateKey, DAY_NAMES, formatClock, fromKey } from '../lib/dates.js'
import Avatar from './Avatar.jsx'
import { PunchEditor } from './HoursTab.jsx'
import { punchMinutes } from './paycheck.js'
import { punchStatus, punchWarnings, shiftFor, STATUS_LABEL } from './review.js'
import { shiftTimes, useNow } from './format.js'
import { streetAddress } from './location.js'
import SpotTag from './SpotTag.jsx'

// The map library is only downloaded when someone opens a punch.
const PunchMap = lazy(() => import('./PunchMap.jsx'))

const EVENT = {
  in: { dot: 'in', text: () => 'Clocked in' },
  out: { dot: 'out', text: () => 'Clocked out' },
  added: { dot: 'edit', text: (e) => `Added by ${e.by || 'a manager'}${e.detail ? `: ${e.detail}` : ''}` },
  changed: { dot: 'edit', text: (e) => `Times changed by ${e.by || 'a manager'}${e.detail ? `: ${e.detail}` : ''}` },
  approved: { dot: 'ok', text: (e) => `Approved${e.by ? ` by ${e.by}` : ''}` },
  unapproved: { dot: 'edit', text: (e) => `Unapproved${e.by ? ` by ${e.by}` : ''}` },
}

// "5h 52m"
const duration = (minutes) => `${Math.floor(minutes / 60)}h ${String(Math.round(minutes % 60)).padStart(2, '0')}m`

// One punch, like Humanity's Time Clock Details: how long, the shift it was for,
// when and where they clocked in and out (street and map), its history, and
// Approve / Edit for the manager.
export default function PunchDetails({ punch: start, data, onClose }) {
  const now = useNow()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [events, setEvents] = useState(null)
  // The map is big, so it starts closed; Show map opens it.
  const [showMap, setShowMap] = useState(false)
  const [showAll, setShowAll] = useState(false)
  // Follow the punch as it changes (after Approve or Edit), by its id.
  const punch = data.punches.find((p) => p.id === start.id) ?? start
  const person = data.employees.find((e) => e.id === punch.employeeId)
  const shift = shiftFor(punch, data.shifts)
  const warnings = punchWarnings(punch, data.shifts, data.shop, now)
  const status = punchStatus(punch)
  const day = fromKey(dateKey(new Date(punch.clockIn)))
  const hasSpot = Boolean(punch.inSpot || punch.outSpot)

  const { punchEvents } = data.actions
  const eventsKey = `${punch.id}|${punch.clockIn}|${punch.clockOut}|${punch.approvedAt}`
  useEffect(() => {
    let alive = true
    punchEvents(punch).then((list) => alive && setEvents(list))
    return () => {
      alive = false
    }
    // Reload the history whenever the punch changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsKey])

  const approve = async (yes) => {
    setBusy(true)
    const problem = await data.actions.approvePunches([punch.id], yes)
    setBusy(false)
    if (problem) setError(problem)
    // Approving is the end of the job, so the pop-up closes (Unapprove stays open).
    else if (yes) onClose()
  }

  if (editing) return <PunchEditor punch={punch} data={data} onClose={() => setEditing(false)} />

  return (
    <Modal
      title="Punch details"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary me-auto" onClick={() => setEditing(true)}>Edit times</button>
          {status === 'approved' ? (
            <button type="button" className="btn btn-outline-danger" disabled={busy} onClick={() => approve(false)}>Unapprove</button>
          ) : (
            <button type="button" className="btn btn-success" disabled={busy || status === 'progress'} onClick={() => approve(true)}>
              {status === 'progress' ? 'Still clocked in' : 'Approve'}
            </button>
          )}
        </>
      }
    >
      <div className="pd-top">
        <Avatar employee={person} size={44} />
        <div className="pd-who">
          <b>{person?.name}</b>
          <small>
            {person?.position ? `${person.position} · ` : ''}{DAY_NAMES[day.getDay()].slice(0, 3)}, {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </small>
          <small>{shift ? `${shift.title ? `${shift.title} · ` : ''}${shiftTimes(shift)} scheduled` : 'No shift scheduled that day'}</small>
        </div>
        <div className="pd-dur">
          <b>{duration(punchMinutes(punch, now))}</b>
          <span className={`tm-chip st-${status}`}>{STATUS_LABEL[status]}</span>
        </div>
      </div>

      {warnings.length > 0 && (
        <ul className="tm-pd-warn">
          {warnings.map((w) => <li key={w}>⚠️ {w}</li>)}
        </ul>
      )}

      <div className="pd-grid">
        <div className="pd-times">
          <Side label="Clock in" at={punch.clockIn} actual={punch.actualIn} spot={punch.inSpot} address={punch.inAddress} shop={data.shop} typed={punch.editedBy && !punch.inSpot} />
          <Side label="Clock out" at={punch.clockOut} actual={punch.actualOut} spot={punch.outSpot} address={punch.outAddress} shop={data.shop} typed={punch.editedBy && !punch.outSpot} />
        </div>
        {hasSpot && (
          <div className="pd-map">
            <button type="button" className="pd-mapbtn" aria-expanded={showMap} onClick={() => setShowMap(!showMap)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.4" /></svg>
              {showMap ? 'Hide map' : 'Show map'}
            </button>
            {showMap && (
              <Suspense fallback={<div className="tm-map" />}>
                <PunchMap inSpot={punch.inSpot} outSpot={punch.clockOut ? punch.outSpot : null} shop={data.shop} />
              </Suspense>
            )}
          </div>
        )}
      </div>

      {punch.note && <p className="tm-muted small">Note: {punch.note}</p>}

      <div className="pd-history">
        <h3 className="tm-h3">History</h3>
        {events === null ? (
          <p className="tm-muted small">Loading…</p>
        ) : events.length ? (
          <>
            <ol className="tm-timeline">
              {(showAll ? events : events.slice(-3)).map((e) => (
                <li key={e.id}>
                  <i className={`tm-dot ${EVENT[e.kind]?.dot ?? 'edit'}`} aria-hidden="true" />
                  <span>{EVENT[e.kind]?.text(e) ?? e.kind}</span>
                  <time>{formatClock(e.at)}{dateKey(new Date(e.at)) !== dateKey(new Date(punch.clockIn)) ? `, ${new Date(e.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</time>
                </li>
              ))}
            </ol>
            {events.length > 3 && <button type="button" className="tm-link small" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show less' : `Show all (${events.length})`}</button>}
          </>
        ) : (
          <p className="tm-muted small">No history saved for this punch (from before update 015).</p>
        )}
      </div>
      {error && <p className="tm-error" role="alert">{error}</p>}
    </Modal>
  )
}

// One side of the punch: the time, the day, and the street it happened on.
function Side({ label, at, actual, spot, address, shop, typed }) {
  const [found, setFound] = useState(null) // null while looking it up, '' if not found
  // Punches saved before addresses were: look the street up just for showing it.
  useEffect(() => {
    if (address || !spot) return
    let alive = true
    streetAddress(spot).then((a) => alive && setFound(a))
    return () => {
      alive = false
    }
  }, [address, spot])

  return (
    <div>
      <small className="tm-muted">{label}</small>
      {at ? (
        <>
          <b className="tm-pd-time">{formatClock(at)}</b>
          {actual && actual !== at && <div className="tm-muted small">Rounded from {formatClock(actual)}</div>}
          <div>{new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          {spot ? (
            <>
              {(address || found !== '') && <div className="tm-pd-addr">{address || found || 'Looking up the street…'}</div>}
              <SpotTag spot={spot} shop={shop} />
            </>
          ) : (
            <div className="tm-muted small">{typed ? 'Typed in by a manager' : 'No location'}</div>
          )}
        </>
      ) : (
        <b className="tm-pd-time tm-muted">Still in</b>
      )}
    </div>
  )
}
