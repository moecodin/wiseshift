import { useState } from 'react'
import Modal from '../components/Modal.jsx'
import { dateKey } from '../lib/dates.js'
import { autoFocusOnDesktop } from '../lib/focus.js'
import { clockTime, firstName, fromTimeInput, useNow } from './format.js'
import Seg from './Seg.jsx'

// The Tasks tab: a day's to-do list for the whole team (update 029). Tasks during my shift come
// first. Anyone can take an open task with "I'll take it" (first tap wins) and give it back; the
// person who has it ticks it done. Managers add tasks, can hand one to someone, and delete.
const WORDS = {
  en: {
    today: 'Today', tomorrow: 'Tomorrow', add: '+ Add a task', yourShift: 'Your shift', noShift: 'No shift', onShift: 'On your shift', restOfDay: 'Rest of the day', anytime: 'Anytime', done: 'Done',
    tasksOnShift: (n) => `${n} ${n === 1 ? 'task' : 'tasks'} during your shift`, needSomeone: (n) => `${n} still open`,
    empty: 'No tasks for this day.', noneShift: 'Nothing during your shift.',
    take: "I'll take it", yours: 'Yours', giveBack: 'Give back', theirs: (n) => `${n} has it`, open: 'Open', markDone: 'Done', undo: 'Undo', handedBy: (n) => `Given to you by ${n}`, doneBy: (n) => `Done by ${n}`,
    handTo: 'Hand to', nobody: 'Open for anyone', remove: 'Delete', confirmDelete: 'Delete this task?',
    newTitle: 'New task', what: 'Task', note: 'Note (optional)', day: 'Day', time: 'Time (optional)', who: 'Who', save: 'Add task', cancel: 'Cancel', other: 'Another day',
  },
  es: {
    today: 'Hoy', tomorrow: 'Mañana', add: '+ Agregar tarea', yourShift: 'Tu turno', noShift: 'Sin turno', onShift: 'En tu turno', restOfDay: 'Resto del día', anytime: 'Cualquier hora', done: 'Hechas',
    tasksOnShift: (n) => `${n} ${n === 1 ? 'tarea' : 'tareas'} durante tu turno`, needSomeone: (n) => `${n} sin tomar`,
    empty: 'No hay tareas este día.', noneShift: 'Nada durante tu turno.',
    take: 'Yo la hago', yours: 'Tuya', giveBack: 'Devolver', theirs: (n) => `La tiene ${n}`, open: 'Libre', markDone: 'Hecha', undo: 'Deshacer', handedBy: (n) => `Te la dio ${n}`, doneBy: (n) => `Hecha por ${n}`,
    handTo: 'Dar a', nobody: 'Libre para cualquiera', remove: 'Borrar', confirmDelete: '¿Borrar esta tarea?',
    newTitle: 'Tarea nueva', what: 'Tarea', note: 'Nota (opcional)', day: 'Día', time: 'Hora (opcional)', who: 'Quién', save: 'Agregar tarea', cancel: 'Cancelar', other: 'Otro día',
  },
}

// My published shift on a day: the earliest start to the latest end, or null.
function shiftOn(data, me, date) {
  const mine = data.shifts.filter((s) => s.employeeId === me.id && s.date === date && s.published !== false)
  if (!mine.length) return null
  return { start: Math.min(...mine.map((s) => s.start)), end: Math.max(...mine.map((s) => s.end)), title: mine.find((s) => s.title)?.title ?? '' }
}
const during = (task, shift) => Boolean(shift && task.time != null && task.time >= shift.start && task.time < shift.end)
const byTime = (a, b) => (a.time ?? 1440) - (b.time ?? 1440) || a.createdAt.localeCompare(b.createdAt)

export default function TasksTab({ data, me, boss, lang }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const now = useNow()
  const today = dateKey(now)
  const tomorrow = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  const [day, setDay] = useState('today')
  const [problem, setProblem] = useState('')
  const [adding, setAdding] = useState(false)
  const date = day === 'today' ? today : tomorrow
  const shift = shiftOn(data, me, date)
  const all = (data.tasks ?? []).filter((t) => t.date === date).sort(byTime)
  const open = all.filter((t) => !t.doneAt)
  const finished = all.filter((t) => t.doneAt)
  const mine = open.filter((t) => during(t, shift))
  const rest = open.filter((t) => !during(t, shift))
  const nameOf = (id) => firstName(data.employees.find((e) => e.id === id)?.name) || '?'

  const act = async (promise) => {
    setProblem('')
    const result = await promise
    if (result) setProblem(result)
  }
  const cardProps = { data, me, boss, w, nameOf, act }

  return (
    <div className="tm-narrow tq">
      <h2 className="sc-h desk-title">{lang === 'es' ? 'Tareas' : 'Tasks'}</h2>
      <div className="tq-top">
        <Seg className="tm-seg" role="group" aria-label={w.today}>
          <button type="button" aria-pressed={day === 'today'} onClick={() => setDay('today')}>{w.today}</button>
          <button type="button" aria-pressed={day === 'tomorrow'} onClick={() => setDay('tomorrow')}>{w.tomorrow}</button>
        </Seg>
        {boss && <button type="button" className="btn btn-brand btn-sm" onClick={() => setAdding(true)}>{w.add}</button>}
      </div>

      <div className="tm-card tq-band">
        {shift ? (
          <>
            <b>{w.yourShift}: {shift.title ? `${shift.title} · ` : ''}{clockTime(shift.start)} – {clockTime(shift.end)}</b>
            <small>{w.tasksOnShift(mine.length + finished.filter((t) => during(t, shift)).length)}{mine.some((t) => !t.claimedBy) ? ` · ${w.needSomeone(mine.filter((t) => !t.claimedBy).length)}` : ''}</small>
          </>
        ) : (
          <b>{w.noShift} · {day === 'today' ? w.today : w.tomorrow}</b>
        )}
      </div>
      {problem && <p className="tm-error" role="alert">{problem}</p>}

      {shift && (
        <>
          <h3 className="tq-when"><span>{w.onShift}</span></h3>
          {mine.length ? mine.map((t) => <TaskCard key={t.id} task={t} {...cardProps} />) : <p className="tm-muted">{w.noneShift}</p>}
        </>
      )}
      {rest.length > 0 && (
        <>
          <h3 className="tq-when"><span>{shift ? w.restOfDay : day === 'today' ? w.today : w.tomorrow}</span></h3>
          {rest.map((t) => <TaskCard key={t.id} task={t} {...cardProps} />)}
        </>
      )}
      {!all.length && <p className="tm-muted">{w.empty}</p>}
      {finished.length > 0 && (
        <>
          <h3 className="tq-when"><span>{w.done}</span><span>{finished.length}</span></h3>
          {finished.map((t) => <TaskCard key={t.id} task={t} {...cardProps} faded />)}
        </>
      )}
      {adding && <AddTask data={data} w={w} today={today} initialDate={date} onClose={() => setAdding(false)} />}
    </div>
  )
}

function TaskCard({ task, data, me, boss, w, nameOf, act, faded }) {
  const holder = task.claimedBy
  const iHave = holder === me.id
  const [hm, ampm] = task.time == null ? [w.anytime, ''] : clockTime(task.time).split(' ')
  const people = data.employees.filter((e) => e.active)
  return (
    <div className={`tm-card tq-task ${faded ? 'faded' : ''} ${iHave ? 'mine' : ''}`}>
      <div className={`tq-time ${task.time == null ? 'any' : ''}`}><b>{hm}</b>{ampm && <small>{ampm}</small>}</div>
      <div className="tq-body">
        <div className="tq-title">{task.title}</div>
        {task.note && <div className="tq-note">{task.note}</div>}
        <div className="tq-who">
          {task.doneAt ? w.doneBy(firstName(task.doneBy) || '?') : holder ? (iHave ? (task.assigned ? w.handedBy(firstName(task.assignedBy) || '?') : w.yours) : w.theirs(nameOf(holder))) : w.open}
        </div>
        <div className="tq-acts">
          {!task.doneAt && !holder && <button type="button" className="btn btn-brand btn-sm" onClick={() => act(data.actions.setTaskHolder(task.id, me.id))}>{w.take}</button>}
          {!task.doneAt && (iHave || (boss && holder)) && <button type="button" className="btn btn-success btn-sm" onClick={() => act(data.actions.finishTask(task.id, true))}>{w.markDone}</button>}
          {!task.doneAt && holder && (boss || (iHave && !task.assigned)) && <button type="button" className="tm-link small" onClick={() => act(data.actions.setTaskHolder(task.id, null))}>{w.giveBack}</button>}
          {task.doneAt && (iHave || boss) && <button type="button" className="tm-link small" onClick={() => act(data.actions.finishTask(task.id, false))}>{w.undo}</button>}
        </div>
        {boss && !task.doneAt && (
          <div className="tq-boss">
            <select className="form-select form-select-sm" aria-label={w.handTo} value={holder ?? ''} onChange={(e) => act(data.actions.setTaskHolder(task.id, e.target.value || null))}>
              <option value="">{w.nobody}</option>
              {people.map((e) => <option key={e.id} value={e.id}>{w.handTo} {e.name}</option>)}
            </select>
            <button type="button" className="tm-link small" onClick={() => window.confirm(w.confirmDelete) && act(data.actions.deleteTask(task.id))}>{w.remove}</button>
          </div>
        )}
      </div>
    </div>
  )
}

function AddTask({ data, w, today, initialDate, onClose }) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(initialDate)
  const [time, setTime] = useState('')
  const [who, setWho] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const people = data.employees.filter((e) => e.active)
  const save = async () => {
    setBusy(true)
    const minutes = time ? fromTimeInput(time) : null
    const problem = await data.actions.addTask({ title, note, date, time: minutes, assigneeId: who })
    setBusy(false)
    if (problem) setError(problem)
    else onClose()
  }
  return (
    <Modal
      title={w.newTitle}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{w.cancel}</button>
          <button type="button" className="btn btn-brand" disabled={busy} onClick={save}>{w.save}</button>
        </>
      }
    >
      <label className="form-label" htmlFor="tq-title">{w.what}</label>
      <input id="tq-title" className="form-control mb-2" maxLength={120} autoFocus={autoFocusOnDesktop()} value={title} onChange={(e) => { setTitle(e.target.value); setError('') }} />
      <label className="form-label" htmlFor="tq-note">{w.note}</label>
      <input id="tq-note" className="form-control mb-2" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="row g-2 mb-2">
        <div className="col-7">
          <label className="form-label" htmlFor="tq-date">{w.day}</label>
          <input id="tq-date" type="date" className="form-control" min={today} value={date} onChange={(e) => setDate(e.target.value || initialDate)} />
        </div>
        <div className="col-5">
          <label className="form-label" htmlFor="tq-time">{w.time}</label>
          <input id="tq-time" type="time" className="form-control" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <label className="form-label" htmlFor="tq-who">{w.who}</label>
      <select id="tq-who" className="form-select" value={who} onChange={(e) => setWho(e.target.value)}>
        <option value="">{w.nobody}</option>
        {people.map((e) => <option key={e.id} value={e.id}>{w.handTo} {e.name}</option>)}
      </select>
      {error && <p className="tm-error mt-2 mb-0" role="alert">{error}</p>}
    </Modal>
  )
}
