import { useState } from 'react'

// Managers: has this person opened the app since their shifts this week were
// posted? ✓ gray = posted, not yet; ✓✓ blue = yes (Humanity's "logged in since
// shift was posted"). Tap for the times. Same look in every theme.
export default function SeenTick({ shifts, seenAt, ready }) {
  const [open, setOpen] = useState(false)
  const posted = shifts.filter((s) => s.published && s.postedAt).map((s) => s.postedAt).sort().at(-1)
  if (!ready || !posted) return null
  const seen = Boolean(seenAt && new Date(seenAt) >= new Date(posted))
  const when = (iso) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const label = seen ? `Seen: logged in since shift was posted` : 'Posted, not logged in since'
  return (
    <>
      <button type="button" className={`rp-seen ${seen ? 'seen' : ''}`} aria-label={label} title={label} aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen(!open) }}>
        <svg viewBox="0 0 18 12" aria-hidden="true">
          {seen && <path d="M1 6.5l3 3L10.5 3" />}
          <path d={seen ? 'M6.5 8.5l1 1L14 3' : 'M4 6.5l3 3L13.5 3'} />
        </svg>
      </button>
      {open && (
        <span className="rp-seen-note" role="status">
          {seen ? <>✓✓ Logged in since shift was posted</> : <>✓ Not logged in since shift was posted</>}
          <span>Posted {when(posted)}</span>
          <span>Last opened the app: {seenAt ? when(seenAt) : 'never'}</span>
        </span>
      )}
    </>
  )
}

