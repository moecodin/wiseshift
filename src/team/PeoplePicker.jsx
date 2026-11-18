import { useEffect, useMemo, useRef, useState } from 'react'
import { autoFocusOnDesktop } from '../lib/focus.js'

// Choose which employees to look at: "All employees" until you tick some. A search box narrows
// the list (name, position or group), each group has a tick to take its whole crew, and the button
// shows who is picked. Used by the Hours review for managers with more than a handful of staff.
const shortName = (full = '') => {
  const [first, ...rest] = full.trim().split(/\s+/)
  return rest.length ? `${first} ${rest.at(-1)[0]}.` : first ?? '?'
}

export default function PeoplePicker({ people, groups = [], picked, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const box = useRef(null)

  // Close on a click outside, or Escape.
  useEffect(() => {
    if (!open) return undefined
    const away = (e) => box.current && !box.current.contains(e.target) && setOpen(false)
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('touchstart', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('touchstart', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const q = query.trim().toLowerCase()
  const shown = useMemo(
    () => people.filter((e) => !q || [e.name, e.position, e.group].some((v) => (v ?? '').toLowerCase().includes(q))),
    [people, q],
  )
  const sections = useMemo(() => {
    if (!groups.length) return [{ key: 'all', name: '', members: shown }]
    const known = new Set(groups.map((g) => g.name))
    return [...groups.map((g) => ({ key: g.name, name: g.name, color: g.color ?? 7, members: shown.filter((e) => e.group === g.name) })), { key: '', name: 'No group', color: 7, members: shown.filter((e) => !known.has(e.group)) }].filter((s) => s.members.length > 0)
  }, [shown, groups])

  const toggle = (ids, on) => {
    const next = new Set(picked)
    for (const id of ids) {
      if (on) next.add(id)
      else next.delete(id)
    }
    onChange(next)
  }
  const label = picked.size === 0 ? 'All employees' : picked.size <= 2 ? [...picked].map((id) => shortName(people.find((e) => e.id === id)?.name)).join(', ') : `${picked.size} employees`

  return (
    <div className="pp" ref={box}>
      <button type="button" className={`pp-btn ${picked.size ? 'on' : ''}`} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
        <span>{label}</span>
        <svg className="pp-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="pp-panel" role="group" aria-label="Choose employees">
          <input type="search" className="form-control form-control-sm" placeholder="Search name, position or group" aria-label="Search employees" autoFocus={autoFocusOnDesktop()} value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="pp-acts">
            <span>{picked.size ? `${picked.size} picked` : 'Everyone'}</span>
            <button type="button" className="tm-link small" onClick={() => toggle(shown.map((e) => e.id), true)}>Select {q ? 'these' : 'all'}</button>
            <button type="button" className="tm-link small" disabled={!picked.size} onClick={() => onChange(new Set())}>Clear</button>
          </div>
          <div className="pp-list">
            {sections.length === 0 && <p className="pp-none">No one matches “{query}”.</p>}
            {sections.map((sec) => {
              const ids = sec.members.map((e) => e.id)
              const all = ids.every((id) => picked.has(id))
              const some = !all && ids.some((id) => picked.has(id))
              return (
                <div key={sec.key} className="pp-sec">
                  {sec.name && (
                    <label className="pp-row pp-group">
                      <input type="checkbox" className="pp-in" checked={all} ref={(el) => el && (el.indeterminate = some)} onChange={() => toggle(ids, !all)} />
                      <span className="pp-box" aria-hidden="true" />
                      <i className={`rl-dot t${sec.color}`} aria-hidden="true" />
                      <b>{sec.name}</b>
                      <small>{ids.filter((id) => picked.has(id)).length}/{ids.length}</small>
                    </label>
                  )}
                  {sec.members.map((e) => (
                    <label key={e.id} className="pp-row">
                      <input type="checkbox" className="pp-in" checked={picked.has(e.id)} onChange={(ev) => toggle([e.id], ev.target.checked)} />
                      <span className="pp-box" aria-hidden="true" />
                      <span className="pp-name">{e.name}</span>
                      <small>{e.position}</small>
                    </label>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
