import { useState } from 'react'
import Modal from '../components/Modal.jsx'
import PunchDetails from './PunchDetails.jsx'
import { punchStatus } from './review.js'

// Review one by one: a day's pending punches as full cards in the Details pop-up. Approve saves the punch and
// moves to the next person; Skip leaves it pending and moves on; Back steps back (Edit times fixes a punch
// first). At the end a summary offers Undo last, going through the skipped ones, and the next day.
export default function PunchStepper({ ids, data, onClose, nextDay, onNextDay }) {
  const [queue, setQueue] = useState(ids)
  const [index, setIndex] = useState(0)
  const [approvedIds, setApprovedIds] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const byId = (id) => data.punches.find((p) => p.id === id)
  const left = queue.filter((id) => byId(id) && punchStatus(byId(id)) === 'pending')
  const current = byId(queue[index])

  // A punch that disappeared (deleted) or was approved elsewhere: just move on.
  const go = (i) => setIndex(Math.max(0, Math.min(queue.length, i)))
  const restart = (list) => {
    setQueue(list)
    setIndex(0)
    setApprovedIds([])
    setError('')
  }
  const undoLast = async () => {
    const last = approvedIds.at(-1)
    if (!last) return
    setBusy(true)
    const problem = await data.actions.approvePunches([last], false)
    setBusy(false)
    if (problem) return setError(problem)
    setApprovedIds((a) => a.slice(0, -1))
    go(queue.indexOf(last))
  }

  if (index >= queue.length || !current) {
    const approved = approvedIds.filter((id) => byId(id) && punchStatus(byId(id)) === 'approved').length
    return (
      <Modal
        title={left.length ? 'End of the list' : 'All done'}
        onClose={onClose}
        footer={
          <>
            {approvedIds.length > 0 && <button type="button" className="btn btn-outline-secondary me-auto" disabled={busy} onClick={undoLast}>Undo last</button>}
            {left.length > 0 && <button type="button" className="btn btn-outline-secondary" onClick={() => restart(left)}>Go through the {left.length} skipped</button>}
            {nextDay && <button type="button" className="btn btn-outline-secondary" onClick={() => onNextDay(nextDay)}>Next day ({nextDay.length})</button>}
            <button type="button" className="btn btn-brand" onClick={onClose}>Done</button>
          </>
        }
      >
        <p className="pd-done"><b>{approved}</b> approved{left.length > 0 && <>, <b>{left.length}</b> still waiting</>}.</p>
        <p className="tm-muted small mb-0">{left.length > 0 ? 'The skipped ones stay in the list as pending.' : 'Nothing else is waiting in this list.'}</p>
        {error && <p className="tm-error mt-2 mb-0" role="alert">{error}</p>}
      </Modal>
    )
  }

  const stepper = {
    index,
    total: queue.length,
    approved: approvedIds.length,
    skipped: queue.slice(0, index).filter((id) => byId(id) && punchStatus(byId(id)) === 'pending').length,
    canBack: index > 0,
    onApprove: (p) => {
      setApprovedIds((a) => [...a, p.id])
      go(index + 1)
    },
    onSkip: () => go(index + 1),
    onBack: () => go(index - 1),
  }
  return <PunchDetails key={current.id} punch={current} data={data} onClose={onClose} stepper={stepper} />
}
