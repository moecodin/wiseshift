import { useState } from 'react'
import Modal from '../components/Modal.jsx'
import { fromKey } from '../lib/dates.js'
import { formatHours, shiftMinutes } from './paycheck.js'
import { shiftTimes, useNow } from './format.js'
import Avatar from './Avatar.jsx'
import RoleBadge from './RoleBadge.jsx'

// Cover requests (give a shift away): the pieces employees see. A request goes
// open → taken (a coworker says yes) → approved or declined by a manager.
const WORDS = {
  en: {
    ask: 'Ask for cover', askTitle: 'Ask for cover', askText: 'Your team will see this shift as open. When someone takes it, a manager approves the change.', note: 'Note (optional)', notePlaceholder: 'Doctor appointment…', send: 'Ask the team', cancel: 'Cancel',
    open: 'Cover requested. Waiting for a coworker.', taken: (n) => `${n} will cover this. Waiting for a manager.`, withdraw: 'Withdraw',
    openShifts: 'Open shifts', needs: (n) => `${n} needs cover`, take: 'Take it', yours: 'You offered to cover', waitingMgr: 'Waiting for a manager', for: (n) => `For ${n}`,
    hrs: 'hrs', approved: 'approved', coverTag: 'cover?',
  },
  es: {
    ask: 'Pedir cobertura', askTitle: 'Pedir cobertura', askText: 'Tu equipo verá este turno como disponible. Cuando alguien lo tome, un gerente aprueba el cambio.', note: 'Nota (opcional)', notePlaceholder: 'Cita médica…', send: 'Preguntar al equipo', cancel: 'Cancelar',
    open: 'Cobertura pedida. Esperando a un compañero.', taken: (n) => `${n} cubrirá este turno. Esperando a un gerente.`, withdraw: 'Retirar',
    openShifts: 'Turnos disponibles', needs: (n) => `${n} necesita cobertura`, take: 'Tomarlo', yours: 'Ofreciste cubrir', waitingMgr: 'Esperando a un gerente', for: (n) => `Para ${n}`,
    hrs: 'hrs', approved: 'aprobado', coverTag: '¿cubrir?',
  },
}
export const coverWords = (lang) => WORDS[lang === 'es' ? 'es' : 'en']

export const isActive = (c) => c.status === 'open' || c.status === 'taken'
export const activeCover = (cover, shiftId) => (cover ?? []).find((c) => c.shiftId === shiftId && isActive(c))
const ended = (shift, now) => new Date(fromKey(shift.date).getTime() + shift.end * 60000) < now
const locale = (lang) => (lang === 'es' ? 'es-US' : 'en-US')
const dayText = (date, lang) => fromKey(date).toLocaleDateString(locale(lang), { weekday: 'short', month: 'short', day: 'numeric' })

// Under one of my shifts: ask for cover, or where the request stands.
export function CoverStatus({ data, shift, lang }) {
  const w = coverWords(lang)
  const now = useNow()
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState('')
  const c = activeCover(data.cover, shift.id)
  if (!shift.published || ended(shift, now)) return null
  const withdraw = async () => setError(await data.actions.cancelCover(c.id))
  const taker = c?.takerId && data.employees.find((e) => e.id === c.takerId)
  return (
    <div className="cv-status">
      {!c && <button type="button" className="cv-btn" onClick={() => setAsking(true)}>{w.ask}</button>}
      {c && (
        <p>
          {c.status === 'taken' ? w.taken(taker?.name ?? '?') : w.open}{' '}
          <button type="button" className="cv-link" onClick={withdraw}>{w.withdraw}</button>
        </p>
      )}
      {error && <p className="tm-error" role="alert">{error}</p>}
      {asking && <CoverAsk data={data} shift={shift} lang={lang} onClose={() => setAsking(false)} />}
    </div>
  )
}

function CoverAsk({ data, shift, lang, onClose }) {
  const w = coverWords(lang)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const send = async () => {
    setBusy(true)
    const problem = await data.actions.requestCover(shift.id, note)
    setBusy(false)
    if (problem) setError(problem)
    else onClose()
  }
  return (
    <Modal
      title={w.askTitle}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{w.cancel}</button>
          <button type="button" className="btn btn-brand" disabled={busy} onClick={send}>{w.send}</button>
        </>
      }
    >
      <p className="cv-shiftline"><b>{dayText(shift.date, lang)}</b> · {shiftTimes(shift)}{shift.title ? ` · ${shift.title}` : ''} <RoleBadge role={shift.role} roles={data.settings?.roles} /></p>
      <p className="tm-muted small">{w.askText}</p>
      <label className="form-label" htmlFor="cv-note">{w.note}</label>
      <input id="cv-note" className="form-control" maxLength={200} placeholder={w.notePlaceholder} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <p className="tm-error mt-2" role="alert">{error}</p>}
    </Modal>
  )
}

// Shifts coworkers have offered, with Take it; plus the ones I've taken and am waiting on.
export function OpenShifts({ data, me, lang }) {
  const w = coverWords(lang)
  const now = useNow()
  const [errors, setErrors] = useState({})
  const shiftOf = (c) => data.shifts.find((s) => s.id === c.shiftId)
  const person = (id) => data.employees.find((e) => e.id === id)
  const live = (data.cover ?? []).filter((c) => shiftOf(c) && !ended(shiftOf(c), now))
  const open = live.filter((c) => c.status === 'open' && c.requesterId !== me.id).sort((a, b) => shiftOf(a).date.localeCompare(shiftOf(b).date))
  const mineTaken = live.filter((c) => c.status === 'taken' && c.takerId === me.id)
  if (!open.length && !mineTaken.length) return null
  const take = async (id) => setErrors({ ...errors, [id]: await data.actions.takeCover(id) })
  return (
    <section className="cv-open">
      <h2 className="sc-h">{w.openShifts} <span className="tm-badge">{open.length || mineTaken.length}</span></h2>
      {open.map((c) => {
        const s = shiftOf(c)
        const who = person(c.requesterId)
        return (
          <div key={c.id} className="sc-row person cv-row">
            <Avatar employee={who} size={42} />
            <div className="sc-body">
              <b>{w.needs(who?.name?.split(' ')[0] ?? '?')}</b>
              <div><span className="sc-time">{dayText(s.date, lang)} · {shiftTimes(s)}</span> <RoleBadge role={s.role} roles={data.settings?.roles} /></div>
              <small>{formatHours(shiftMinutes(s))} {w.hrs}{c.note ? ` · ${c.note}` : ''}</small>
              {errors[c.id] && <small className="cv-err" role="alert">{errors[c.id]}</small>}
            </div>
            <button type="button" className="cv-take" onClick={() => take(c.id)}>{w.take}</button>
          </div>
        )
      })}
      {mineTaken.map((c) => {
        const s = shiftOf(c)
        return (
          <div key={c.id} className="sc-row person cv-row cv-wait">
            <Avatar employee={person(c.requesterId)} size={42} />
            <div className="sc-body">
              <b>{w.yours}</b>
              <div><span className="sc-time">{dayText(s.date, lang)} · {shiftTimes(s)}</span></div>
              <small>{w.waitingMgr} · {w.for(person(c.requesterId)?.name ?? '?')}</small>
            </div>
          </div>
        )
      })}
    </section>
  )
}
