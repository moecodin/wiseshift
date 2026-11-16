import { useState } from 'react'
import { dateKey } from '../lib/dates.js'
import { datesLabel, useNow } from './format.js'

const STATUS = { pending: 'Waiting for a manager', approved: 'Approved', declined: 'Declined' }

// Ask for time off and see your requests. Managers approve or decline, and see
// everyone's upcoming time off.
export default function TimeOffTab({ data, me, boss, look }) {
  const today = dateKey(useNow())
  const name = (id) => data.employees.find((e) => e.id === id)?.name ?? '?'
  const mine = data.timeOff.filter((t) => t.employeeId === me.id).sort((a, b) => b.start.localeCompare(a.start))
  const waiting = boss ? data.timeOff.filter((t) => t.status === 'pending').sort((a, b) => a.start.localeCompare(b.start)) : []
  const upcoming = data.teamOff.filter((t) => t.end >= today).sort((a, b) => a.start.localeCompare(b.start))

  return (
    <div className="tm-narrow">
      <RequestForm data={data} today={today} title={look?.timeOff?.ask} />

      {boss && (
        <section className="tm-card">
          <h2>Waiting for you {waiting.length > 0 && <span className="tm-badge">{waiting.length}</span>}</h2>
          {waiting.length ? waiting.map((t) => <Decide key={t.id} request={t} who={name(t.employeeId)} data={data} />) : <p className="tm-muted mb-0">No requests waiting.</p>}
        </section>
      )}

      <section className="tm-card">
        <h2>{look?.timeOff?.title ?? 'My requests'}</h2>
        {mine.length ? (
          mine.map((t) => (
            <div key={t.id} className="tm-req">
              <div>
                <b>{datesLabel(t.start, t.end)}</b>
                {t.reason && <div className="tm-muted small">“{t.reason}”</div>}
              </div>
              <span className={`tm-chip ${t.status}`}>{STATUS[t.status]}</span>
              {t.status !== 'approved' && (
                <button type="button" className="tm-link small" onClick={() => data.actions.withdrawTimeOff(t.id)}>
                  {t.status === 'pending' ? 'Take back' : 'Clear'}
                </button>
              )}
            </div>
          ))
        ) : (
          <p className="tm-muted mb-0">No requests yet.</p>
        )}
      </section>

      <section className="tm-card">
        <h2>Who's off</h2>
        {upcoming.length ? (
          upcoming.map((t) => (
            <div key={t.id} className="tm-row">
              <span>{name(t.employeeId)}</span>
              <span className="tm-muted">{datesLabel(t.start, t.end)}</span>
              {boss && (
                <button type="button" className="tm-link small" onClick={() => window.confirm(`Cancel ${name(t.employeeId)}'s approved time off?`) && data.actions.deleteTimeOff(t.id)}>
                  Cancel
                </button>
              )}
            </div>
          ))
        ) : (
          <p className="tm-muted mb-0">Nobody has upcoming time off.</p>
        )}
      </section>
    </div>
  )
}

function RequestForm({ data, today, title = 'Ask for time off' }) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const send = async (e) => {
    e.preventDefault()
    const last = end || start
    if (!start) return setError('Pick the first day off.')
    if (last < start) return setError('The last day has to be on or after the first day.')
    const problem = await data.actions.requestTimeOff(start, last, reason.trim())
    if (problem) return setError(problem)
    setStart('')
    setEnd('')
    setReason('')
    setError('')
    setMessage('Sent. A manager will approve or decline it here.')
  }

  return (
    <form className="tm-card" onSubmit={send}>
      <h2>{title}</h2>
      <div className="row g-2">
        <div className="col-6">
          <label className="form-label" htmlFor="to-start">First day</label>
          <input id="to-start" type="date" className="form-control" min={today} value={start} onChange={(e) => { setStart(e.target.value); setMessage(''); setError('') }} />
        </div>
        <div className="col-6">
          <label className="form-label" htmlFor="to-end">Last day</label>
          <input id="to-end" type="date" className="form-control" min={start || today} value={end} placeholder="Same day" onChange={(e) => { setEnd(e.target.value); setError('') }} />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="to-reason">Reason (optional)</label>
          <input id="to-reason" className="form-control" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
      <button type="submit" className="btn btn-brand mt-3">Send request</button>
      {message && <p className="tm-msg mt-2 mb-0" role="status">{message}</p>}
      {error && <p className="tm-error mt-2 mb-0" role="alert">{error}</p>}
    </form>
  )
}

function Decide({ request, who, data }) {
  const [busy, setBusy] = useState(false)
  const decide = async (status) => {
    setBusy(true)
    await data.actions.decideTimeOff(request.id, status)
    setBusy(false)
  }
  return (
    <div className="tm-req">
      <div>
        <b>{who}</b> · {datesLabel(request.start, request.end)}
        {request.reason && <div className="tm-muted small">“{request.reason}”</div>}
      </div>
      <button type="button" className="btn btn-success btn-sm" disabled={busy} onClick={() => decide('approved')}>Approve</button>
      <button type="button" className="btn btn-outline-danger btn-sm" disabled={busy} onClick={() => decide('declined')}>Decline</button>
    </div>
  )
}
