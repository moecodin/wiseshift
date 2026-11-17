import { useState } from 'react'
import Modal from '../components/Modal.jsx'
import { dateKey } from '../lib/dates.js'
import { datesLabel, scheduleOnly, useNow } from './format.js'
import { TEXTING_AVAILABLE } from './features.js'
import Avatar from './Avatar.jsx'

// Managers' sticky notes and to-do tasks, on the manager Today screen. Tasks have a check box
// and an optional due date; notes are colored sticky squares. Staff never see any of this.
const COLORS = ['Butter', 'Sage', 'Rose', 'Sky']

export default function ManagerNotes({ data }) {
  const now = useNow()
  const today = dateKey(now)
  const [editing, setEditing] = useState(null) // a note, or a new one
  const [showDone, setShowDone] = useState(false)
  const notes = data.notes ?? []
  const tasks = notes.filter((n) => n.kind === 'task' && !n.done).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
  const done = notes.filter((n) => n.kind === 'task' && n.done)
  const stickies = notes.filter((n) => n.kind === 'note')
  const blank = (kind) => ({ kind, text: '', color: 0, dueDate: '', assignees: [] })
  const names = (ids) => ids.map((id) => (data.employees.find((e) => e.id === id)?.name ?? '?').split(' ')[0]).join(', ')

  return (
    <section className="mt-card nt-card">
      <div className="mt-line">
        <b>Tasks and notes</b>
        <span className="nt-add">
          <button type="button" onClick={() => setEditing(blank('task'))}>+ Task</button>
          <button type="button" onClick={() => setEditing(blank('note'))}>+ Note</button>
        </span>
      </div>

      {tasks.length === 0 && stickies.length === 0 && done.length === 0 && <p className="tm-muted mb-0">Nothing here yet. Add a task for yourself or a note for the team.</p>}

      {tasks.map((n) => (
        <div key={n.id} className="nt-task">
          <input type="checkbox" className="form-check-input" aria-label={`Done: ${n.text}`} onChange={() => data.actions.updateNote(n.id, { done: true })} />
          <button type="button" className="nt-text" onClick={() => setEditing(n)}>
            {n.text}
            {n.assignees?.length > 0 && <small className="for">For {names(n.assignees)}</small>}
            {n.dueDate && <small className={n.dueDate < today ? 'late' : ''}>{n.dueDate < today ? 'Overdue · ' : n.dueDate === today ? 'Due today · ' : 'Due '}{datesLabel(n.dueDate, n.dueDate)}</small>}
          </button>
        </div>
      ))}

      {stickies.length > 0 && (
        <div className="nt-stickies">
          {stickies.map((n) => (
            <button key={n.id} type="button" className={`nt-sticky c${n.color}`} onClick={() => setEditing(n)}>
              {n.text}
              {n.assignees?.length > 0 && <small>For {names(n.assignees)}</small>}
            </button>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="nt-done">
          <button type="button" className="tm-link small" onClick={() => setShowDone(!showDone)}>{showDone ? 'Hide' : 'Show'} done ({done.length})</button>
          {showDone && (
            <>
              {done.map((n) => (
                <div key={n.id} className="nt-task is-done">
                  <input type="checkbox" className="form-check-input" checked aria-label={`Not done: ${n.text}`} onChange={() => data.actions.updateNote(n.id, { done: false })} />
                  <span className="nt-text">{n.text}{n.doneBy && <small>Done by {n.doneBy}</small>}</span>
                </div>
              ))}
              <button type="button" className="tm-link small" onClick={() => done.forEach((n) => data.actions.deleteNote(n.id))}>Clear done</button>
            </>
          )}
        </div>
      )}
      {editing && <NoteEditor note={editing} data={data} onClose={() => setEditing(null)} />}
    </section>
  )
}

function NoteEditor({ note, data, onClose }) {
  const [n, setN] = useState({ assignees: [], notify: true, sendText: false, ...note })
  // Staff who can be tagged: anyone else on the team who uses the app.
  const people = data.employees.filter((e) => e.active && !scheduleOnly(e) && e.id !== data.me?.id)
  const toggle = (id) => setN((prev) => ({ ...prev, assignees: prev.assignees.includes(id) ? prev.assignees.filter((x) => x !== id) : [...prev.assignees, id] }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isNew = !note.id
  const save = async () => {
    setBusy(true)
    const problem = isNew
      ? await data.actions.addNote({ text: n.text, kind: n.kind, color: n.color, dueDate: n.dueDate, assignees: n.assignees, notify: n.notify, sendText: n.sendText })
      : await data.actions.updateNote(note.id, { text: n.text.trim(), kind: n.kind, color: n.color, dueDate: n.kind === 'task' ? n.dueDate : '', assignees: n.assignees, notify: n.assignees.length > 0 && n.notify, sendText: n.assignees.length > 0 && n.sendText })
    setBusy(false)
    if (problem) setError(problem)
    else onClose()
  }
  const remove = async () => {
    await data.actions.deleteNote(note.id)
    onClose()
  }
  return (
    <Modal
      title={isNew ? (n.kind === 'task' ? 'Add a task' : 'Add a note') : n.kind === 'task' ? 'Change task' : 'Change note'}
      onClose={onClose}
      footer={
        <>
          {!isNew && <button type="button" className="btn btn-outline-danger me-auto" onClick={remove}>Delete</button>}
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-brand" disabled={busy} onClick={save}>Save</button>
        </>
      }
    >
      <div className="rl-picks mb-2" role="group" aria-label="Kind">
        <button type="button" className="rl-pick" aria-pressed={n.kind === 'task'} onClick={() => setN({ ...n, kind: 'task' })}>Task</button>
        <button type="button" className="rl-pick" aria-pressed={n.kind === 'note'} onClick={() => setN({ ...n, kind: 'note' })}>Sticky note</button>
      </div>
      <label className="form-label" htmlFor="nt-text">{n.kind === 'task' ? 'What needs doing?' : 'Note'}</label>
      <textarea id="nt-text" className="form-control" rows={3} maxLength={300} autoFocus value={n.text} onChange={(e) => setN({ ...n, text: e.target.value })} />
      {n.kind === 'task' ? (
        <div className="mt-3">
          <label className="form-label" htmlFor="nt-due">Due date (optional)</label>
          <input id="nt-due" type="date" className="form-control" value={n.dueDate} onChange={(e) => setN({ ...n, dueDate: e.target.value })} />
        </div>
      ) : (
        <div className="mt-3">
          <span className="form-label d-block">Color</span>
          <div className="nt-colors" role="group" aria-label="Color">
            {COLORS.map((name, i) => (
              <button key={name} type="button" className={`nt-swatch c${i}`} aria-label={name} aria-pressed={n.color === i} onClick={() => setN({ ...n, color: i })} />
            ))}
          </div>
        </div>
      )}
      <div className="mt-3">
        <span className="form-label d-block">Tag staff (optional)</span>
        <div className="nt-people" role="group" aria-label="Tag staff">
          <button type="button" className="rl-pick" aria-pressed={people.length > 0 && n.assignees.length === people.length} onClick={() => setN((prev) => ({ ...prev, assignees: prev.assignees.length === people.length ? [] : people.map((e) => e.id) }))}>Everyone</button>
          {people.map((e) => (
            <button key={e.id} type="button" className="rl-pick nt-person" aria-pressed={n.assignees.includes(e.id)} onClick={() => toggle(e.id)}>
              <Avatar employee={e} size={22} />{e.name.split(' ')[0]}
            </button>
          ))}
        </div>
        {n.assignees.length > 0 && (
          <div className="nt-notify">
            <label className="ex-check"><input type="checkbox" className="form-check-input" checked={n.notify} onChange={(e) => setN({ ...n, notify: e.target.checked })} /><span>Notify them in the app<small>They get a notification once online sync is set up. Nothing is sent in this demo.</small></span></label>
            <label className={`ex-check ${TEXTING_AVAILABLE ? '' : 'nt-off'}`}><input type="checkbox" className="form-check-input" disabled={!TEXTING_AVAILABLE} checked={TEXTING_AVAILABLE && n.sendText} onChange={(e) => setN({ ...n, sendText: e.target.checked })} /><span>Also send it as a text<small>{TEXTING_AVAILABLE ? 'Sent to their phone number.' : "Texting isn't available yet."}</small></span></label>
          </div>
        )}
      </div>
      {error && <p className="tm-error mt-2" role="alert">{error}</p>}
    </Modal>
  )
}

// Staff: the tasks and notes a manager tagged them on. They can tick off a task.
const STAFF = {
  en: { title: 'From your manager', from: (n) => `From ${n}`, due: 'Due', overdue: 'Overdue', done: 'Done', doneBy: (n) => `Done by ${n}` },
  es: { title: 'De tu gerente', from: (n) => `De ${n}`, due: 'Vence', overdue: 'Vencida', done: 'Hecha', doneBy: (n) => `Hecha por ${n}` },
}
export function TaggedForMe({ data, lang }) {
  const w = STAFF[lang === 'es' ? 'es' : 'en']
  const now = useNow()
  const today = dateKey(now)
  const mine = (data.notes ?? []).filter((n) => !(n.kind === 'task' && n.done))
  if (!mine.length) return null
  const first = (name) => (name || '').split(' ')[0]
  return (
    <section className="tm-card nt-mine">
      <h2>{w.title}</h2>
      {mine.map((n) =>
        n.kind === 'task' ? (
          <div key={n.id} className="nt-task">
            <input type="checkbox" className="form-check-input" aria-label={n.text} onChange={() => data.actions.updateNote(n.id, { done: true })} />
            <span className="nt-text">
              {n.text}
              <small className={n.dueDate && n.dueDate < today ? 'late' : ''}>{w.from(first(n.createdBy))}{n.dueDate ? ` · ${n.dueDate < today ? w.overdue : w.due} ${datesLabel(n.dueDate, n.dueDate)}` : ''}</small>
            </span>
          </div>
        ) : (
          <div key={n.id} className={`nt-sticky nt-flat c${n.color}`}>
            {n.text}
            <small>{w.from(first(n.createdBy))}</small>
          </div>
        ),
      )}
    </section>
  )
}
