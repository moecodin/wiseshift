import { useState } from 'react'
import { money } from './format.js'
import { useFeatures } from './features.js'

const when = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// Private notes a manager keeps about someone (update 034). Only managers ever receive them, not even the person they are about.
export function PersonNotes({ person, data }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const notes = data.personNotes.filter((n) => n.employeeId === person.id)
  const author = (id) => data.employees.find((e) => e.id === id)?.name ?? 'A manager'
  const add = async (e) => {
    e.preventDefault()
    setBusy(true)
    const problem = await data.actions.addPersonNote(person.id, text)
    setBusy(false)
    setError(problem || '')
    if (!problem) setText('')
  }
  return (
    <section className="pf-sec pf-notes" data-search="person-notes">
      <h3 className="tm-h3">Private notes</h3>
      <p className="tm-muted pf-lock">Only managers can see these. {person.name.split(' ')[0]} can't.</p>
      <form className="pf-note-form" onSubmit={add}>
        <textarea className="form-control" rows={2} maxLength={2000} placeholder="A conversation, a reminder, praise…" aria-label="New note" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="btn btn-brand btn-sm" disabled={busy || !text.trim()}>Add note</button>
      </form>
      {error && <p className="tm-error" role="alert">{error}</p>}
      {notes.length ? (
        <ul className="pf-notes-list">
          {notes.map((n) => (
            <li key={n.id}>
              <p>{n.body}</p>
              <small>{author(n.authorId)} · {when(n.createdAt)} <button type="button" className="tm-link small" onClick={() => window.confirm('Delete this note?') && data.actions.deletePersonNote(n.id)}>Delete</button></small>
            </li>
          ))}
        </ul>
      ) : <p className="tm-muted">No notes yet.</p>}
    </section>
  )
}

// Every change to an hourly rate, newest first. The database writes it, so it can't be edited. A person sees their own; managers see everyone's.
export function PayHistory({ person, data }) {
  const f = useFeatures()
  if (!f.payRates) return null
  const rows = data.payHistory.filter((h) => h.employeeId === person.id)
  const author = (id) => data.employees.find((e) => e.id === id)?.name
  return (
    <section className="pf-sec" data-search="pay-history">
      <h3 className="tm-h3">Pay history</h3>
      {rows.length ? (
        <ul className="pf-list">
          {rows.map((h) => (
            <li key={h.id}>
              <span>{when(h.changedAt)}</span>
              <b>{money(h.rate)} / hr</b>
              <small>{h.previous === null ? 'Rate set' : `${h.rate > h.previous ? 'Raised' : 'Lowered'} from ${money(h.previous)}`}{author(h.changedBy) ? ` · by ${author(h.changedBy)}` : ''}</small>
            </li>
          ))}
        </ul>
      ) : <p className="tm-muted">No rate changes recorded yet.</p>}
    </section>
  )
}
