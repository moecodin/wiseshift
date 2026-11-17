import { useState } from 'react'
import Modal from '../components/Modal.jsx'
import { dateKey, fromKey } from '../lib/dates.js'
import { clockTime, timeInputToIso, useNow } from './format.js'
import Avatar from './Avatar.jsx'

// Notes about a day's punches. Staff can add one at any time (a forgotten clock-in, work
// outside the shop after clocking out, anything else) and managers see them on their Today screen.
const WORDS = {
  en: {
    add: 'Add a note', title: 'Note for your manager', hint: 'Forgot to clock in? Working outside the shop? Tell your manager here. It shows on their Today screen.',
    when: 'Which day', today: 'Today', yesterday: 'Yesterday', what: 'What happened', note: 'Your note', placeholder: 'I got here at 8:00 but forgot to clock in.', send: 'Send note', cancel: 'Cancel',
    tags: { forgotIn: 'Forgot to clock in', forgotOut: 'Forgot to clock out', outside: 'Working outside the shop', other: 'Something else' },
    yours: 'Your notes', seen: 'Seen', sent: 'Sent', remove: 'Remove',
    mgr: (n) => `Notes from staff (${n})`, gotIt: 'Got it', fix: 'Add the missing punch', for: 'for',
  },
  es: {
    add: 'Agregar una nota', title: 'Nota para tu gerente', hint: '¿Olvidaste marcar entrada? ¿Trabajas fuera de la tienda? Díselo a tu gerente aquí. Aparece en su pantalla de Hoy.',
    when: 'Qué día', today: 'Hoy', yesterday: 'Ayer', what: 'Qué pasó', note: 'Tu nota', placeholder: 'Llegué a las 8:00 pero olvidé marcar entrada.', send: 'Enviar nota', cancel: 'Cancelar',
    tags: { forgotIn: 'Olvidé marcar entrada', forgotOut: 'Olvidé marcar salida', outside: 'Trabajo fuera de la tienda', other: 'Otra cosa' },
    yours: 'Tus notas', seen: 'Vista', sent: 'Enviada', remove: 'Quitar',
    mgr: (n) => `Notas del personal (${n})`, gotIt: 'Entendido', fix: 'Agregar el registro que falta', for: 'para',
  },
}
export const noteWords = (lang) => WORDS[lang === 'es' ? 'es' : 'en']
const locale = (lang) => (lang === 'es' ? 'es-US' : 'en-US')
const dayName = (date, lang) => fromKey(date).toLocaleDateString(locale(lang), { weekday: 'short', month: 'short', day: 'numeric' })

// Staff: the Add a note button (open all day) and what they've sent recently.
export function MyPunchNotes({ data, me, lang }) {
  const w = noteWords(lang)
  const now = useNow()
  const [adding, setAdding] = useState(false)
  const today = dateKey(now)
  const yesterday = dateKey(new Date(now.getTime() - 86400000))
  const mine = (data.punchNotes ?? []).filter((n) => n.employeeId === me.id && (n.date === today || n.date === yesterday)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <div className="pn-mine">
      <button type="button" className="td-more pn-add" onClick={() => setAdding(true)}>{w.add}</button>
      {mine.length > 0 && (
        <ul className="pn-list">
          {mine.map((n) => (
            <li key={n.id}>
              <span className="pn-chip">{w.tags[n.tag] ?? n.tag}</span>
              <span className="pn-text">{n.text}</span>
              <small>
                {n.date === today ? w.today : w.yesterday} · {n.ackAt ? `${w.seen} ✓` : w.sent}
                {!n.ackAt && <> · <button type="button" className="tm-link small" onClick={() => data.actions.deletePunchNote(n.id)}>{w.remove}</button></>}
              </small>
            </li>
          ))}
        </ul>
      )}
      {adding && <NoteForm data={data} lang={lang} today={today} yesterday={yesterday} onClose={() => setAdding(false)} />}
    </div>
  )
}

function NoteForm({ data, lang, today, yesterday, onClose }) {
  const w = noteWords(lang)
  const [date, setDate] = useState(today)
  const [tag, setTag] = useState('forgotIn')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const send = async () => {
    setBusy(true)
    const problem = await data.actions.addPunchNote({ text, tag, date })
    setBusy(false)
    if (problem) setError(problem)
    else onClose()
  }
  return (
    <Modal
      title={w.title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{w.cancel}</button>
          <button type="button" className="btn btn-brand" disabled={busy} onClick={send}>{w.send}</button>
        </>
      }
    >
      <p className="tm-muted small">{w.hint}</p>
      <span className="form-label d-block">{w.when}</span>
      <div className="rl-picks mb-2" role="group" aria-label={w.when}>
        <button type="button" className="rl-pick" aria-pressed={date === today} onClick={() => setDate(today)}>{w.today}</button>
        <button type="button" className="rl-pick" aria-pressed={date === yesterday} onClick={() => setDate(yesterday)}>{w.yesterday}</button>
      </div>
      <span className="form-label d-block">{w.what}</span>
      <div className="rl-picks mb-2" role="group" aria-label={w.what}>
        {Object.entries(w.tags).map(([id, label]) => (
          <button key={id} type="button" className="rl-pick" aria-pressed={tag === id} onClick={() => setTag(id)}>{label}</button>
        ))}
      </div>
      <label className="form-label" htmlFor="pn-text">{w.note}</label>
      <textarea id="pn-text" className="form-control" rows={3} maxLength={300} autoFocus placeholder={w.placeholder} value={text} onChange={(e) => setText(e.target.value)} />
      {error && <p className="tm-error mt-2" role="alert">{error}</p>}
    </Modal>
  )
}

// Managers: notes from staff that nobody has marked as seen. Got it marks one seen; Add the
// missing punch opens the punch editor for that person and day (for the forgot-to-clock notes).
export function StaffNotes({ data, lang, onFix }) {
  const w = noteWords(lang)
  const person = (id) => data.employees.find((e) => e.id === id)
  const open = (data.punchNotes ?? []).filter((n) => !n.ackAt && person(n.employeeId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  if (!open.length) return null
  return (
    <section className="mt-card pn-card">
      <div className="mt-line"><b>{w.mgr(open.length)}</b></div>
      {open.map((n) => {
        const who = person(n.employeeId)
        const missing = n.tag === 'forgotIn' || n.tag === 'forgotOut'
        return (
          <div key={n.id} className="pn-row">
            <Avatar employee={who} size={38} />
            <div className="pn-body">
              <b>{who.name}</b>
              <small>{dayName(n.date, lang)} · {clockTime(new Date(n.createdAt).getHours() * 60 + new Date(n.createdAt).getMinutes())}</small>
              <span className="pn-chip">{w.tags[n.tag] ?? n.tag}</span>
              <p>{n.text}</p>
              <div className="pn-acts">
                {missing && <button type="button" className="pn-fix" onClick={() => onFix(n, who)}>{w.fix}</button>}
                <button type="button" className="pn-got" onClick={() => data.actions.ackPunchNote(n.id)}>{w.gotIt}</button>
              </div>
            </div>
          </div>
        )
      })}
    </section>
  )
}

// A blank punch to fill in for a person on a day: used by "Add the missing punch".
export const missingPunch = (n) => ({ employeeId: n.employeeId, clockIn: timeInputToIso(n.date, '08:00'), clockOut: timeInputToIso(n.date, '14:00'), note: n.text, isNew: true })
