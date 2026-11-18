import { useState } from 'react'
import Modal from '../components/Modal.jsx'
import { dayLabel, offOn, shiftTimes } from './format.js'

// After a shift is dragged somewhere new: "Move or copy this shift?" Shows where it was and where it
// would go, warns about an overlapping shift or time off, and changes nothing until a button is pressed.
// Move updates the shift (a published one is posted again, as when editing). Copy adds a new unpublished
// draft at the new spot and leaves the original alone.
export default function ShiftDropDialog({ shift, target, data, onClose, onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const name = (id) => data.employees.find((e) => e.id === id)?.name ?? '?'
  const moved = { ...shift, ...target }
  const clash = (ignoreId) => data.shifts.find((x) => x.id !== ignoreId && x.employeeId === target.employeeId && x.date === target.date && x.start < target.end && target.start < x.end)
  const overlapOther = clash(shift.id) // another shift that would overlap, whichever button is pressed
  const overlapOriginal = !overlapOther && shift.employeeId === target.employeeId && shift.date === target.date && shift.start < target.end && target.start < shift.end // only a copy would overlap the original
  const off = offOn(data.teamOff, target.employeeId, target.date)

  const run = async (kind) => {
    setBusy(true)
    const next = kind === 'copy' ? { ...moved, id: undefined, published: false, postedAt: null } : moved
    const problem = await data.actions.saveShift(next)
    setBusy(false)
    if (problem) return setError(problem)
    const who = shift.employeeId === target.employeeId ? '' : ` to ${name(target.employeeId)}`
    const where = `${who}${who ? ',' : ' to'} ${dayLabel(target.date)} ${shiftTimes(target)}`
    onDone(kind === 'copy' ? `Copied ${name(shift.employeeId)}'s shift${where} (a draft).` : `Moved ${name(shift.employeeId)}'s shift${where}.`)
  }

  return (
    <Modal
      title="Move or copy this shift?"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => run('copy')}>Copy</button>
          <button type="button" className="btn btn-brand" disabled={busy} onClick={() => run('move')}>Move</button>
        </>
      }
    >
      <div className="sd-sum">
        <div>
          <small>From</small>
          <b>{name(shift.employeeId)}</b>
          <span>{dayLabel(shift.date)} · {shiftTimes(shift)}{shift.title ? ` · ${shift.title}` : ''}</span>
        </div>
        <i aria-hidden="true">→</i>
        <div className="to">
          <small>To</small>
          <b>{name(target.employeeId)}</b>
          <span>{dayLabel(target.date)} · {shiftTimes(target)}</span>
        </div>
      </div>
      <p className="tm-muted small mb-1"><b>Move</b> changes this shift{shift.published ? ' (it is posted again, and they are told)' : ''}. <b>Copy</b> adds a new draft and keeps this one.</p>
      {overlapOther && <p className="tm-warn mt-2 mb-0">{name(target.employeeId)} already works {shiftTimes(overlapOther)} that day, which overlaps.</p>}
      {overlapOriginal && <p className="tm-warn mt-2 mb-0">A copy here would overlap the original shift.</p>}
      {off && <p className="tm-warn mt-2 mb-0">{name(target.employeeId)} has approved time off that day.</p>}
      {error && <p className="tm-error mt-2 mb-0" role="alert">{error}</p>}
    </Modal>
  )
}
