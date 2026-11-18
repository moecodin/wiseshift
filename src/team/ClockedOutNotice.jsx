import { useState } from 'react'
import Modal from '../components/Modal.jsx'
import { dateKey, formatClock } from '../lib/dates.js'
import { NoteForm } from './PunchNotes.jsx'

// When a manager clocks someone out for them ("Clock out" on the manager's Today screen), the
// next time that person opens the app a pop-up says so, with a way to tell the manager it was a
// mistake. A punch counts as "clocked out by a manager" when someone else last edited it and
// the edit time is the clock-out time (the manager's button sets both to now), within two days.
// Dismissed per punch on this device (no database change), so it shows once per device.
const WORDS = {
  en: {
    title: (who) => `${who} clocked you out`,
    body: (who, time) => `${who} clocked you out at ${time}.`,
    ask: 'Was that a mistake? Send a note and your manager will see it on their Today screen.',
    ok: 'Got it', mistake: 'Mistake? Send a note', draft: (time) => `I wasn't done at ${time}. I was still working until `,
  },
  es: {
    title: (who) => `${who} registró tu salida`,
    body: (who, time) => `${who} registró tu salida a las ${time}.`,
    ask: '¿Fue un error? Envía una nota y tu gerente la verá en su pantalla de Hoy.',
    ok: 'Entendido', mistake: '¿Error? Enviar una nota', draft: (time) => `No había terminado a las ${time}. Seguí trabajando hasta `,
  },
}
const KEY = (p) => `ws-clockedout-${p.id}`
const seen = (p) => {
  try {
    return localStorage.getItem(KEY(p)) === p.editedAt
  } catch {
    return false
  }
}
const markSeen = (p) => {
  try {
    localStorage.setItem(KEY(p), p.editedAt)
  } catch {
    /* private window: it just shows again next time */
  }
}
const byManager = (p, me) =>
  p.employeeId === me.id && p.clockOut && p.editedBy && p.editedBy !== me.name && p.editedAt &&
  Date.now() - new Date(p.editedAt) < 2 * 86400000 &&
  Math.abs(new Date(p.clockOut) - new Date(p.editedAt)) < 120000

export default function ClockedOutNotice({ data, me, lang }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const [done, setDone] = useState([]) // punches dismissed this visit
  const [writing, setWriting] = useState(false)
  const punch = data.punches
    .filter((p) => byManager(p, me) && !seen(p) && !done.includes(p.id))
    .sort((a, b) => new Date(a.editedAt) - new Date(b.editedAt))[0]
  if (!punch) return null

  const time = formatClock(punch.clockOut)
  const close = () => {
    markSeen(punch)
    setDone((d) => [...d, punch.id])
    setWriting(false)
  }
  if (writing) {
    return <NoteForm data={data} lang={lang} lockDate={dateKey(new Date(punch.clockIn))} initialTag="forgotOut" initialText={w.draft(time)} onClose={close} />
  }
  return (
    <Modal
      title={w.title(punch.editedBy)}
      onClose={close}
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={() => setWriting(true)}>{w.mistake}</button>
          <button type="button" className="btn btn-brand" onClick={close}>{w.ok}</button>
        </>
      }
    >
      <p>{w.body(punch.editedBy, time)}</p>
      <p className="tm-muted small mb-0">{w.ask}</p>
    </Modal>
  )
}
