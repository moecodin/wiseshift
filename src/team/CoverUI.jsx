import { useState } from 'react'
import Modal from '../components/Modal.jsx'
import { dateKey, fromKey } from '../lib/dates.js'
import { formatHours, shiftMinutes } from './paycheck.js'
import { shiftTimes, useNow } from './format.js'
import Avatar from './Avatar.jsx'
import RoleBadge from './RoleBadge.jsx'
import { useFeature } from './features.js'

// Cover requests: give a shift away (to the whole team or one person) or swap it
// for a coworker's. A request goes open → taken (a coworker says yes) → approved
// or declined by a manager. "Not now" from the asked person ends it (passed).
const WORDS = {
  en: {
    ask: 'Ask for cover', askTitle: 'Ask for cover', note: 'Note (optional)', notePlaceholder: 'Doctor appointment…', send: 'Send', cancel: 'Cancel',
    modeTeam: 'Whole team', modePerson: 'One person', modeSwap: 'Swap',
    askTeam: 'Your team will see this shift as open. When someone takes it, a manager approves the change.',
    askPerson: 'Only this person will see the request. If they say yes, a manager approves the change.',
    askSwap: "Trade this shift for one of theirs. If they agree, a manager approves both changes.",
    who: 'Who', pickOne: 'Pick a coworker', theirShift: 'Their shift to take', noShifts: 'They have no upcoming shifts to swap.',
    open: 'Cover requested. Waiting for a coworker.', openTo: (n) => `Asked ${n} to cover. Waiting for a reply.`, openSwap: (n) => `Swap offered to ${n}. Waiting for a reply.`,
    taken: (n) => `${n} will cover this. Waiting for a manager.`, takenSwap: (n) => `${n} agreed to swap. Waiting for a manager.`, passed: (n) => `${n} can't do it.`, withdraw: 'Withdraw',
    openShifts: 'Open shifts', requestsForYou: 'Requests for you', needs: (n) => `${n} needs cover`, asksYou: (n) => `${n} asks you to cover`, swapWith: (n) => `${n} wants to swap`,
    take: 'Take it', accept: 'Accept', notNow: 'Not now', give: 'You take', get: 'You give',
    yours: 'You offered to cover', yoursSwap: 'You agreed to swap', waitingMgr: 'Waiting for a manager', for: (n) => `For ${n}`, hrs: 'hrs',
  },
  es: {
    ask: 'Pedir cobertura', askTitle: 'Pedir cobertura', note: 'Nota (opcional)', notePlaceholder: 'Cita médica…', send: 'Enviar', cancel: 'Cancelar',
    modeTeam: 'Todo el equipo', modePerson: 'Una persona', modeSwap: 'Cambio',
    askTeam: 'Tu equipo verá este turno como disponible. Cuando alguien lo tome, un gerente aprueba el cambio.',
    askPerson: 'Solo esta persona verá la solicitud. Si acepta, un gerente aprueba el cambio.',
    askSwap: 'Cambia este turno por uno de esa persona. Si acepta, un gerente aprueba ambos cambios.',
    who: 'Quién', pickOne: 'Elige un compañero', theirShift: 'Su turno que tomarías', noShifts: 'No tiene turnos próximos para cambiar.',
    open: 'Cobertura pedida. Esperando a un compañero.', openTo: (n) => `Le pediste a ${n} que cubra. Esperando respuesta.`, openSwap: (n) => `Cambio ofrecido a ${n}. Esperando respuesta.`,
    taken: (n) => `${n} cubrirá este turno. Esperando a un gerente.`, takenSwap: (n) => `${n} aceptó el cambio. Esperando a un gerente.`, passed: (n) => `${n} no puede.`, withdraw: 'Retirar',
    openShifts: 'Turnos disponibles', requestsForYou: 'Solicitudes para ti', needs: (n) => `${n} necesita cobertura`, asksYou: (n) => `${n} te pide cubrir`, swapWith: (n) => `${n} quiere cambiar turno`,
    take: 'Tomarlo', accept: 'Aceptar', notNow: 'Ahora no', give: 'Tú tomas', get: 'Tú das',
    yours: 'Ofreciste cubrir', yoursSwap: 'Aceptaste el cambio', waitingMgr: 'Esperando a un gerente', for: (n) => `Para ${n}`, hrs: 'hrs',
  },
}
export const coverWords = (lang) => WORDS[lang === 'es' ? 'es' : 'en']

export const isActive = (c) => c.status === 'open' || c.status === 'taken'
// The live request touching a shift, as the one being given away or the one asked for in a swap.
export const activeCover = (cover, shiftId) => (cover ?? []).find((c) => isActive(c) && (c.shiftId === shiftId || c.swapShiftId === shiftId))
const ended = (shift, now) => new Date(fromKey(shift.date).getTime() + shift.end * 60000) < now
const locale = (lang) => (lang === 'es' ? 'es-US' : 'en-US')
const dayText = (date, lang) => fromKey(date).toLocaleDateString(locale(lang), { weekday: 'short', month: 'short', day: 'numeric' })
const first = (name) => (name || '?').split(' ')[0]

// Under one of my shifts: ask for cover, or where the request stands.
export function CoverStatus({ data, shift, lang }) {
  const w = coverWords(lang)
  const on = useFeature('cover')
  const now = useNow()
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState('')
  const c = (data.cover ?? []).find((x) => x.shiftId === shift.id && isActive(x))
  // The last request on this shift that the asked person turned down.
  const passed = !c && [...(data.cover ?? [])].reverse().find((x) => x.shiftId === shift.id && x.status === 'passed')
  if (!on || !shift.published || ended(shift, now)) return null
  if (!c && (data.cover ?? []).some((x) => isActive(x) && x.swapShiftId === shift.id)) return null // someone asked to swap for this shift
  const withdraw = async () => setError(await data.actions.cancelCover(c.id))
  const who = (id) => first(data.employees.find((e) => e.id === id)?.name)
  const line = c && (c.status === 'taken' ? (c.kind === 'swap' ? w.takenSwap(who(c.takerId)) : w.taken(who(c.takerId))) : c.kind === 'swap' ? w.openSwap(who(c.targetId)) : c.targetId ? w.openTo(who(c.targetId)) : w.open)
  return (
    <div className="cv-status">
      {passed && <p>{w.passed(who(passed.targetId))}</p>}
      {!c && <button type="button" className="cv-btn" onClick={() => setAsking(true)}>{w.ask}</button>}
      {c && (
        <p>
          {line}{' '}
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
  const now = useNow()
  const [mode, setMode] = useState('team') // team | person | swap
  const [personId, setPersonId] = useState('')
  const [swapId, setSwapId] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const people = data.employees.filter((e) => e.active && e.id !== shift.employeeId && e.payType !== 'none')
  // Their shifts I could take in a swap: published, still ahead, in the next two weeks, not already in a request.
  const horizon = dateKey(new Date(now.getTime() + 14 * 86400000))
  const theirs = data.shifts
    .filter((s) => s.employeeId === personId && s.published && s.date <= horizon && !ended(s, now) && !activeCover(data.cover, s.id))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)

  const pick = (next) => {
    setMode(next)
    setError('')
    setSwapId('')
  }
  const send = async () => {
    if (mode !== 'team' && !personId) return setError(w.pickOne)
    if (mode === 'swap' && !swapId) return setError(w.theirShift)
    setBusy(true)
    const problem = await data.actions.requestCover(shift.id, note, { targetId: mode === 'team' ? null : personId, swapShiftId: mode === 'swap' ? swapId : null })
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
      <div className="rl-picks mb-2" role="group" aria-label={w.who}>
        {[['team', w.modeTeam], ['person', w.modePerson], ['swap', w.modeSwap]].map(([id, label]) => (
          <button key={id} type="button" className="rl-pick" aria-pressed={mode === id} onClick={() => pick(id)}>{label}</button>
        ))}
      </div>
      <p className="tm-muted small">{mode === 'team' ? w.askTeam : mode === 'person' ? w.askPerson : w.askSwap}</p>

      {mode !== 'team' && (
        <div className="cv-slide" key={`who-${mode}`}><div className="mb-2">
          <label className="form-label" htmlFor="cv-who">{w.who}</label>
          <select id="cv-who" className="form-select" value={personId} onChange={(e) => { setPersonId(e.target.value); setSwapId('') }}>
            <option value="">{w.pickOne}</option>
            {people.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div></div>
      )}

      {mode === 'swap' && personId && (
        <div className="cv-slide" key={`swap-${personId}`}><div className="mb-2">
          <span className="form-label d-block">{w.theirShift}</span>
          {theirs.length === 0 && <p className="tm-muted small">{w.noShifts}</p>}
          {theirs.map((s) => (
            <button key={s.id} type="button" className="cv-choice" aria-pressed={swapId === s.id} onClick={() => setSwapId(s.id)}>
              <b>{dayText(s.date, lang)}</b> {shiftTimes(s)}{s.title ? ` · ${s.title}` : ''} <RoleBadge role={s.role} roles={data.settings?.roles} />
            </button>
          ))}
        </div></div>
      )}

      <label className="form-label" htmlFor="cv-note">{w.note}</label>
      <input id="cv-note" className="form-control" maxLength={200} placeholder={w.notePlaceholder} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <p className="tm-error mt-2" role="alert">{error}</p>}
    </Modal>
  )
}

// Requests to me, shifts the whole team can take, and the ones I've said yes to and am waiting on.
export function OpenShifts({ data, me, lang }) {
  const w = coverWords(lang)
  const on = useFeature('cover')
  const now = useNow()
  const [errors, setErrors] = useState({})
  const shiftOf = (id) => data.shifts.find((s) => s.id === id)
  const person = (id) => data.employees.find((e) => e.id === id)
  const live = (data.cover ?? []).filter((c) => shiftOf(c.shiftId) && !ended(shiftOf(c.shiftId), now) && (!c.swapShiftId || shiftOf(c.swapShiftId)))
  const forMe = live.filter((c) => c.status === 'open' && c.requesterId !== me.id && (c.targetId === me.id || !c.targetId))
  const waiting = live.filter((c) => c.status === 'taken' && c.takerId === me.id)
  if (!on || (!forMe.length && !waiting.length)) return null
  forMe.sort((a, b) => shiftOf(a.shiftId).date.localeCompare(shiftOf(b.shiftId).date))
  const act = async (id, fn) => setErrors({ ...errors, [id]: await fn(id) })
  const directed = forMe.some((c) => c.targetId === me.id)
  return (
    <section className="cv-open">
      <h2 className="sc-h">{directed ? w.requestsForYou : w.openShifts} <span className="tm-badge">{forMe.length || waiting.length}</span></h2>
      {forMe.map((c) => {
        const s = shiftOf(c.shiftId)
        const other = c.swapShiftId ? shiftOf(c.swapShiftId) : null
        const who = person(c.requesterId)
        const name = first(who?.name)
        const title = c.kind === 'swap' ? w.swapWith(name) : c.targetId ? w.asksYou(name) : w.needs(name)
        return (
          <div key={c.id} className="sc-row person cv-row">
            <Avatar employee={who} size={42} />
            <div className="sc-body">
              <b>{title}</b>
              <div>
                {other && <small className="cv-lab">{w.give}</small>}
                <span className="sc-time">{dayText(s.date, lang)} · {shiftTimes(s)}</span> <RoleBadge role={s.role} roles={data.settings?.roles} />
              </div>
              {other && (
                <div>
                  <small className="cv-lab">{w.get}</small>
                  <span className="sc-time">{dayText(other.date, lang)} · {shiftTimes(other)}</span> <RoleBadge role={other.role} roles={data.settings?.roles} />
                </div>
              )}
              <small>{formatHours(shiftMinutes(s))} {w.hrs}{c.note ? ` · ${c.note}` : ''}</small>
              {errors[c.id] && <small className="cv-err" role="alert">{errors[c.id]}</small>}
            </div>
            <div className="cv-acts">
              <button type="button" className="cv-take" onClick={() => act(c.id, data.actions.takeCover)}>{c.targetId ? w.accept : w.take}</button>
              {c.targetId === me.id && <button type="button" className="cv-pass" onClick={() => act(c.id, data.actions.passCover)}>{w.notNow}</button>}
            </div>
          </div>
        )
      })}
      {waiting.map((c) => {
        const s = shiftOf(c.shiftId)
        return (
          <div key={c.id} className="sc-row person cv-row cv-wait">
            <Avatar employee={person(c.requesterId)} size={42} />
            <div className="sc-body">
              <b>{c.kind === 'swap' ? w.yoursSwap : w.yours}</b>
              <div><span className="sc-time">{dayText(s.date, lang)} · {shiftTimes(s)}</span></div>
              <small>{w.waitingMgr} · {w.for(person(c.requesterId)?.name ?? '?')}</small>
            </div>
          </div>
        )
      })}
    </section>
  )
}
