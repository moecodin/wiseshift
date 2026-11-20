import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { searchPeople, searchPlaces } from './searchIndex.js'

// The site search: type what you are looking for ("password", "store hours", "export") and pick where to go.
// Opened from the menu's Search box, the header's magnifier on a phone, Ctrl/⌘+K, or "/" anywhere.
const WORDS = {
  en: { placeholder: 'Search pages, settings and actions', none: 'Nothing found. Try another word.', hint: 'Enter to go · Esc to close', label: 'Search', suggested: 'Pages' },
  es: { placeholder: 'Busca páginas, ajustes y acciones', none: 'No se encontró nada. Prueba otra palabra.', hint: 'Enter para ir · Esc para cerrar', label: 'Buscar', suggested: 'Páginas' },
}

export default function SearchPalette({ open, onClose, onPick, ctx }) {
  const w = WORDS[ctx.lang === 'es' ? 'es' : 'en']
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const input = useRef(null)
  const list = useRef(null)
  const results = useMemo(() => (open ? [...(query.trim() ? searchPeople(query, ctx, ctx.employees ?? []) : []), ...searchPlaces(query, ctx)] : []), [open, query, ctx])

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
      setTimeout(() => input.current?.focus(), 30)
    }
  }, [open])
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [index])

  if (!open) return null
  const key = (e) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && results[index]) { e.preventDefault(); onPick(results[index]) }
  }
  return createPortal(
    <div className="sr" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sr-card tm" role="dialog" aria-modal="true" aria-label={w.label}>
        <div className="sr-field">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
          <input ref={input} value={query} placeholder={w.placeholder} aria-label={w.label} role="combobox" aria-expanded="true" aria-controls="sr-list" onChange={(e) => { setQuery(e.target.value); setIndex(0) }} onKeyDown={key} />
          <button type="button" className="sr-esc" onClick={onClose} aria-label="Close">Esc</button>
        </div>
        <ul id="sr-list" ref={list} role="listbox" className="sr-list">
          {!query.trim() && results.length > 0 && <li className="sr-head" aria-hidden="true">{w.suggested}</li>}
          {results.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === index} className="sr-item" onMouseMove={() => setIndex(i)} onMouseDown={(e) => { e.preventDefault(); onPick(r) }}>
              <span className="sr-main"><b>{r.title}</b><small>{r.path}</small></span>
              {r.kind === 'person' && (
                <span className="sr-acts">
                  {r.actions.slice(1).map((a) => <button key={a.key} type="button" tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onPick({ ...r, ...a }) }}>{a.label}</button>)}
                </span>
              )}
            </li>
          ))}
          {query.trim() && results.length === 0 && <li className="sr-none">{w.none}</li>}
        </ul>
        <p className="sr-hint">{w.hint}</p>
      </div>
    </div>,
    document.body,
  )
}
