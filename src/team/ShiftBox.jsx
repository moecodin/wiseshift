import { formatHours, shiftMinutes } from './paycheck.js'
import { shiftTimes } from './format.js'
import RoleBadge from './RoleBadge.jsx'
import { tagClass } from './tags.js'

// One shift in the week grid: the time, its type and hours, role, a cover? tag and any note.
export default function ShiftBox({ shift, roles, presets, flash, cover, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  // The shift type's color (Open, Close…) tints the box; no type means a plain cream box.
  const tint = shift.title ? tagClass(shift.title, presets).match(/t\d/)?.[0] : ''
  return (
    <Tag type={onClick ? 'button' : undefined} className={`tm-shift ${tint} ${shift.published ? '' : 'draft'} ${flash ? 'flash' : ''}`} onClick={onClick}>
      <b>{shiftTimes(shift)}</b>
      <span className="gr-meta">{shift.title ? `${shift.title} · ` : ''}{formatHours(shiftMinutes(shift))} hrs</span>
      {shift.role && <RoleBadge role={shift.role} roles={roles} />}
      {cover && <span className="cv-tag">cover?</span>}
      {shift.note && <span className="tm-shift-note">{shift.note}</span>}
    </Tag>
  )
}

