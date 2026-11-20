import { useState } from 'react'
import { dateKey } from '../lib/dates.js'
import { datesLabel, useNow } from './format.js'
import Modal from '../components/Modal.jsx'

const WORDS = {
  en: {
    ask: '+ Request time off', cancelAsk: 'Close', waitingYou: 'Waiting for you', none: 'No requests waiting.', waiting: 'Waiting for a reply', coming: 'Coming up', earlier: 'Earlier', whoOff: "Who's off soon", nobodyOff: 'Nobody has upcoming time off.', empty: 'No requests yet.',
    status: { pending: 'Waiting', approved: 'Approved', declined: 'Declined' }, withdraw: 'Withdraw request', clear: 'Clear', approve: 'Approve', decline: 'Decline', cancel: 'Cancel',
    first: 'First day', last: 'Last day', reason: 'Reason (optional)', send: 'Send request', sent: 'Sent. A manager will approve or decline it here.', pickFirst: 'Pick the first day off.', lastBefore: 'The last day has to be on or after the first day.', confirm: (n) => `Cancel ${n}'s approved time off?`,
  },
  es: {
    ask: '+ Pedir ausencia', cancelAsk: 'Cerrar', waitingYou: 'Esperan tu respuesta', none: 'No hay solicitudes.', waiting: 'Esperando respuesta', coming: 'Próximamente', earlier: 'Antes', whoOff: 'Quién falta pronto', nobodyOff: 'Nadie tiene ausencias próximas.', empty: 'Aún no hay solicitudes.',
    status: { pending: 'Esperando', approved: 'Aprobada', declined: 'Rechazada' }, withdraw: 'Retirar solicitud', clear: 'Borrar', approve: 'Aprobar', decline: 'Rechazar', cancel: 'Cancelar',
    first: 'Primer día', last: 'Último día', reason: 'Motivo (opcional)', send: 'Enviar solicitud', sent: 'Enviada. Un gerente la aprobará o rechazará aquí.', pickFirst: 'Elige el primer día libre.', lastBefore: 'El último día debe ser igual o posterior al primero.', confirm: (n) => `¿Cancelar la ausencia aprobada de ${n}?`,
  },
}

// Ask for time off and see your requests. Managers approve or decline, and see
// everyone's upcoming time off. Staff see only their own (update 028).
export default function TimeOffTab({ data, me, boss, lang }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const today = dateKey(useNow())
  const [asking, setAsking] = useState(false)
  const name = (id) => data.employees.find((e) => e.id === id)?.name ?? '?'
  const mine = data.timeOff.filter((t) => t.employeeId === me.id).sort((a, b) => a.start.localeCompare(b.start))
  const waitingMine = mine.filter((t) => t.status === 'pending')
  const comingMine = mine.filter((t) => t.status === 'approved' && t.end >= today)
  const earlier = mine.filter((t) => t.status === 'declined' || (t.status === 'approved' && t.end < today)).sort((a, b) => b.start.localeCompare(a.start))
  const waitingBoss = boss ? data.timeOff.filter((t) => t.status === 'pending').sort((a, b) => a.start.localeCompare(b.start)) : []
  const upcoming = data.teamOff.filter((t) => t.end >= today).sort((a, b) => a.start.localeCompare(b.start))

  return (
    <div className="tm-narrow">
      <button type="button" className="to-ask" onClick={() => setAsking(!asking)}>{asking ? w.cancelAsk : w.ask}</button>
      {asking && <RequestForm data={data} today={today} w={w} onDone={() => setAsking(false)} />}

      {boss && (
        <>
          <h2 className="sc-h">{w.waitingYou} {waitingBoss.length > 0 && <span className="tm-badge">{waitingBoss.length}</span>}</h2>
          {waitingBoss.length ? waitingBoss.map((t) => <Decide key={t.id} request={t} who={name(t.employeeId)} data={data} w={w} lang={lang} />) : <p className="tm-muted">{w.none}</p>}
        </>
      )}

      {waitingMine.length > 0 && <h2 className="sc-h">{w.waiting}</h2>}
      {waitingMine.map((t) => <Request key={t.id} t={t} w={w} data={data} link={w.withdraw} />)}

      {comingMine.length > 0 && <h2 className="sc-h">{w.coming}</h2>}
      {comingMine.map((t) => <Request key={t.id} t={t} w={w} data={data} />)}

      {earlier.length > 0 && <h2 className="sc-h">{w.earlier}</h2>}
      {earlier.map((t) => <Request key={t.id} t={t} w={w} data={data} link={t.status === 'declined' ? w.clear : null} faded />)}

      {mine.length === 0 && <p className="tm-muted">{w.empty}</p>}

      {boss && (
      <section className="to-card to-off">
        <b className="to-eyebrow">{w.whoOff.toUpperCase()}</b>
        {upcoming.length ? (
          upcoming.map((t) => (
            <div key={t.id} className="to-offrow">
              <b>{name(t.employeeId)}</b>
              <span>{t.start <= today && t.end >= today ? (lang === 'es' ? 'Hoy' : 'Today') : datesLabel(t.start, t.end)}</span>
              {boss && (
                <button type="button" className="tm-link small" onClick={() => window.confirm(w.confirm(name(t.employeeId))) && data.actions.deleteTimeOff(t.id)}>{w.cancel}</button>
              )}
            </div>
          ))
        ) : (
          <p className="tm-muted mb-0">{w.nobodyOff}</p>
        )}
      </section>
      )}
    </div>
  )
}

// One of my requests.
function Request({ t, w, data, link, faded }) {
  const days = Math.round((new Date(`${t.end}T12:00`) - new Date(`${t.start}T12:00`)) / 86400000) + 1
  return (
    <div className={`to-card ${faded ? 'faded' : ''}`}>
      <div className="to-top">
        <b>{datesLabel(t.start, t.end)}</b>
        <span className={`to-chip ${t.status}`}>{w.status[t.status]}</span>
      </div>
      <small>{days} {days === 1 ? 'day' : 'days'}{t.reason ? ` · ${t.reason}` : ''}</small>
      {link && <button type="button" className="to-link" onClick={() => data.actions.withdrawTimeOff(t.id)}>{link}</button>}
    </div>
  )
}

function RequestForm({ data, today, w, onDone }) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const send = async (e) => {
    e.preventDefault()
    const last = end || start
    if (!start) return setError(w.pickFirst)
    if (last < start) return setError(w.lastBefore)
    const problem = await data.actions.requestTimeOff(start, last, reason.trim())
    if (problem) return setError(problem)
    onDone()
  }

  return (
    <form className="to-card" onSubmit={send}>
      <div className="row g-2">
        <div className="col-6">
          <label className="form-label" htmlFor="to-start">{w.first}</label>
          <input id="to-start" type="date" className="form-control" min={today} value={start} onChange={(e) => { setStart(e.target.value); setError('') }} />
        </div>
        <div className="col-6">
          <label className="form-label" htmlFor="to-end">{w.last}</label>
          <input id="to-end" type="date" className="form-control" min={start || today} value={end} onChange={(e) => { setEnd(e.target.value); setError('') }} />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="to-reason">{w.reason}</label>
          <input id="to-reason" className="form-control" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
      <button type="submit" className="btn btn-brand mt-3">{w.send}</button>
      {error && <p className="tm-error mt-2 mb-0" role="alert">{error}</p>}
    </form>
  )
}

// A manager's card for one waiting request.
function Decide({ request, who, data, w, lang }) {
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const decide = async (status) => {
    setBusy(true)
    await data.actions.decideTimeOff(request.id, status)
    setBusy(false)
    setAsking(false)
  }
  const dates = datesLabel(request.start, request.end)
  return (
    <div className="to-card">
      <div className="to-top"><b>{who}</b><span className="to-chip pending">{dates}</span></div>
      {request.reason && <small>“{request.reason}”</small>}
      <div className="to-actions">
        <button type="button" className="to-btn" disabled={busy} onClick={() => decide('declined')}>{w.decline}</button>
        <button type="button" className="to-btn yes" disabled={busy} onClick={() => setAsking(true)}>{w.approve}</button>
      </div>
      {asking && (
        <Modal
          title={w.approve}
          onClose={() => !busy && setAsking(false)}
          footer={
            <>
              <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => setAsking(false)}>{w.cancel}</button>
              <button type="button" className="btn btn-brand" disabled={busy} onClick={() => decide('approved')}>{w.approve}</button>
            </>
          }
        >
          <p className="mb-0">{lang === 'es' ? `¿Aprobar a ${who} para ${dates}?` : `Approve ${who} for ${dates}?`}</p>
        </Modal>
      )}
    </div>
  )
}
