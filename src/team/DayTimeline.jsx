import { useState } from 'react'
import { fromKey } from '../lib/dates.js'
import { formatHours, shiftMinutes } from './paycheck.js'
import { clockTime, offOn, useNow } from './format.js'
import Avatar from './Avatar.jsx'
import { tagClass } from './tags.js'

// One day as a timeline: an hour axis, a row for each person and a bar for each of their
// shifts. Positions are percentages of the visible hours, so it fits any width.
// Staff see published shifts, themselves first, and a "Your shift" card. Managers see drafts
// too, tap a bar to change it, and get a coverage strip with Copy yesterday and Publish.
// The visible hours are 6 AM to 10 PM, widened when a shift falls outside them.
// (Opening hours could become a setting later.)

const DEFAULT_START = 6 * 60
const DEFAULT_END = 22 * 60

const WORDS = {
  en: {
    you: 'You', off: 'Off', timeOff: 'Time off', nobody: 'Nobody is scheduled this day.', working: (n) => `${n} working`, add: 'Add a shift', addFor: 'Add a shift for this day', draft: 'draft',
    yourShift: 'Your shift', with: (names, t) => `With ${names} until ${t}`, takesOver: (names, t) => `Takes over from ${names} at ${t}`, alone: 'You are the only one on this shift.',
    coverage: 'Coverage', people: (n) => (n === 1 ? '1 person' : `${n} people`), only: (n, a, b) => `Only ${n} ${n === 1 ? 'person' : 'people'} from ${a} to ${b}.`, nobodyFrom: (a, b) => `Nobody scheduled from ${a} to ${b}.`, covered: 'Everyone on the schedule is covered.',
    copyYesterday: 'Copy yesterday', publish: 'Publish', copied: (n) => `Copied ${n} shift${n === 1 ? '' : 's'} from yesterday as drafts.`, nothingCopied: 'Nothing new to copy from yesterday.', published: (n) => `Published ${n} shift${n === 1 ? '' : 's'}.`,
  },
  es: {
    you: 'Tú', off: 'Libre', timeOff: 'Ausencia', nobody: 'Nadie está programado este día.', working: (n) => `${n} trabajan`, add: 'Agregar turno', addFor: 'Agregar un turno este día', draft: 'borrador',
    yourShift: 'Tu turno', with: (names, t) => `Con ${names} hasta las ${t}`, takesOver: (names, t) => `Relevas a ${names} a las ${t}`, alone: 'Eres la única persona en este turno.',
    coverage: 'Cobertura', people: (n) => (n === 1 ? '1 persona' : `${n} personas`), only: (n, a, b) => `Solo ${n} ${n === 1 ? 'persona' : 'personas'} de ${a} a ${b}.`, nobodyFrom: (a, b) => `Nadie programado de ${a} a ${b}.`, covered: 'Todo el horario está cubierto.',
    copyYesterday: 'Copiar ayer', publish: 'Publicar', copied: (n) => `Se copiaron ${n} turnos de ayer como borradores.`, nothingCopied: 'No hay nada nuevo que copiar de ayer.', published: (n) => `Se publicaron ${n} turnos.`,
  },
}

// "8–2" for a shift bar, "7 PM" or "7:30 PM" in sentences, "6a" on the axis.
const hour12 = (m) => Math.floor(m / 60) % 12 || 12
const range = (s) => {
  const f = (m) => (m % 60 ? `${hour12(m)}:${String(m % 60).padStart(2, '0')}` : `${hour12(m)}`)
  return `${f(s.start)}–${f(s.end)}`
}
const spoken = (m) => `${hour12(m)}${m % 60 ? `:${String(m % 60).padStart(2, '0')}` : ''} ${Math.floor(m / 60) % 24 < 12 ? 'AM' : 'PM'}`
// First name, plus a last initial when two people in the list share a first name.
const shortName = (p, rows) => {
  const [first, ...rest] = p.name.split(' ')
  const clash = rows.some((r) => r.p.id !== p.id && r.p.name.split(' ')[0] === first)
  return clash && rest.length ? `${first} ${rest.at(-1)[0]}.` : first
}
const axisLabel = (m) => `${hour12(m)}${Math.floor(m / 60) % 24 < 12 ? 'a' : 'p'}`

export default function DayTimeline({ data, me, date, today, lang, mode, onEdit, onAdd, flash = new Set() }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const manager = mode === 'manager'
  const now = useNow()
  const [message, setMessage] = useState('')
  const person = (id) => data.employees.find((e) => e.id === id)

  const shifts = data.shifts.filter((s) => s.date === date && (manager || s.published)).sort((a, b) => a.start - b.start)
  // Visible hours: 6 AM to 10 PM unless a shift needs more.
  const H0 = Math.min(DEFAULT_START, ...shifts.map((s) => Math.floor(s.start / 60) * 60))
  const H1 = Math.max(DEFAULT_END, ...shifts.map((s) => Math.ceil(s.end / 60) * 60))
  const span = H1 - H0
  const pct = (m) => `${((Math.min(H1, Math.max(H0, m)) - H0) / span) * 100}%`
  const ticks = []
  for (let m = Math.ceil(H0 / 180) * 180; m <= H1; m += 180) ticks.push(m)

  // Rows: everyone with a shift (or approved time off) that day. Staff see themselves first.
  const people = data.employees.filter((e) => e.active)
  const rows = people
    .map((p) => ({ p, list: shifts.filter((s) => s.employeeId === p.id), off: offOn(data.teamOff, p.id, date) }))
    .filter((r) => r.list.length || r.off)
    .sort((a, b) => {
      if (!manager && (a.p.id === me.id) !== (b.p.id === me.id)) return a.p.id === me.id ? -1 : 1
      const sa = a.list[0]?.start ?? 9999
      const sb = b.list[0]?.start ?? 9999
      return sa - sb || a.p.name.localeCompare(b.p.name)
    })

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const showNow = date === today && nowMin >= H0 && nowMin <= H1
  const workingCount = new Set(shifts.map((s) => s.employeeId)).size
  const dayHours = shifts.reduce((sum, s) => sum + shiftMinutes(s), 0)
  const heading = date === today ? (lang === 'es' ? 'Hoy' : 'Today') : fromKey(date).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  const drafts = manager ? shifts.filter((s) => !s.published) : []
  const copyYesterday = async () => {
    const y = new Date(fromKey(date).getTime() - 86400000)
    const key = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`
    const { error, copied } = await data.actions.copyWeek([key], [date])
    setMessage(error || (copied ? w.copied(copied) : w.nothingCopied))
  }
  const publish = async () => {
    const problem = await data.actions.publishWeek([date])
    setMessage(problem || w.published(drafts.length))
  }

  return (
    <section className="tl-card">
      <div className="tl-head">
        <h2 className="sc-h">{heading} <small className="mg-sum">{w.working(workingCount)} · {formatHours(dayHours)} hrs</small></h2>
        {manager && <button type="button" className="tl-plus" aria-label={w.addFor} title={w.addFor} onClick={onAdd}>+</button>}
      </div>

      {rows.length === 0 ? (
        <p className="tm-muted">{w.nobody}</p>
      ) : (
        <div className="tl">
          <div className="tl-axis" aria-hidden="true">
            <div className="tl-scale">
              {ticks.map((m) => <span key={m} style={{ left: pct(m) }}>{axisLabel(m)}</span>)}
              {showNow && <span className="tl-nowpill" style={{ left: pct(nowMin) }}>{clockTime(nowMin).replace(':00', '').replace(' AM', 'a').replace(' PM', 'p')}</span>}
            </div>
          </div>
          <div className="tl-body">
            <div className="tl-grid" aria-hidden="true">
              {ticks.map((m) => <i key={m} style={{ left: pct(m) }} />)}
              {showNow && <b style={{ left: pct(nowMin) }} />}
            </div>
            {rows.map(({ p, list, off }) => {
              const isMe = p.id === me.id
              return (
                <div key={p.id} className={`tl-row ${isMe && !manager ? 'me' : ''}`}>
                  <div className="tl-who">
                    <Avatar employee={p} size={26} />
                    <span>{isMe && !manager ? w.you : shortName(p, rows)}</span>
                  </div>
                  <div className="tl-lane">
                    {list.length === 0 && off && <span className="tl-off">{manager ? w.timeOff : w.off}</span>}
                    {list.map((s) => {
                      const tint = s.title ? tagClass(s.title, data.settings?.shiftPresets).match(/t\d/)?.[0] : 't-none'
                      const Tag = manager ? 'button' : 'div'
                      const label = `${p.name}: ${clockTime(s.start)} – ${clockTime(s.end)}${s.title ? ` · ${s.title}` : ''}${s.role ? ` · ${s.role}` : ''}`
                      return (
                        <Tag
                          key={s.id}
                          type={manager ? 'button' : undefined}
                          className={`tl-bar ${tint} ${s.published ? '' : 'draft'} ${isMe && !manager ? 'me' : ''} ${flash.has(s.id) ? 'flash' : ''}`}
                          style={{ left: pct(s.start), width: `calc(${pct(s.end)} - ${pct(s.start)})` }}
                          title={label}
                          aria-label={label}
                          onClick={manager ? () => onEdit(s) : undefined}
                        >
                          {range(s)}{!s.published && <small> {w.draft}</small>}
                        </Tag>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {manager ? (
        <>
          {renderCoverage(shifts, w)}
          <div className="tl-tools">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={copyYesterday}>{w.copyYesterday}</button>
            <button type="button" className="btn btn-success btn-sm" disabled={!drafts.length} onClick={publish}>{w.publish} ({drafts.length})</button>
          </div>
          {message && <p className="tm-msg" role="status">{message}</p>}
        </>
      ) : (
        <YourShift me={me} shifts={shifts} w={w} person={person} />
      )}
    </section>
  )

  // People on shift in each stretch of hours, flagging thin ones.
  function renderCoverage(list, words) {
    if (!list.length) return null
    const open = Math.min(...list.map((s) => s.start)) // while anyone is on, it's business hours
    const close = Math.max(...list.map((s) => s.end))
    const points = [...new Set([H0, H1, ...list.flatMap((s) => [s.start, s.end])])].filter((m) => m >= H0 && m <= H1).sort((a, b) => a - b)
    const stretches = []
    for (let i = 0; i < points.length - 1; i++) {
      const [a, b] = [points[i], points[i + 1]]
      const n = new Set(list.filter((s) => s.start <= a && s.end >= b).map((s) => s.employeeId)).size
      const last = stretches.at(-1)
      if (last && last.n === n) last.b = b
      else stretches.push({ a, b, n })
    }
    const thin = stretches.filter((t) => t.n <= 1 && t.a >= open && t.b <= close)
    return (
      <div className="tl-cover">
        <b className="tl-cover-title">{words.coverage}</b>
        <div className="tl-strip" role="img" aria-label={stretches.map((t) => `${spoken(t.a)} to ${spoken(t.b)}: ${words.people(t.n)}`).join('. ')}>
          {stretches.map((t) => (
            <span key={t.a} className={`tl-seg ${t.n <= 1 && t.a >= open && t.b <= close ? 'low' : ''} ${t.a < open || t.b > close ? 'idle' : ''}`} style={{ left: pct(t.a), width: `calc(${pct(t.b)} - ${pct(t.a)})` }}>
              {t.a >= open && t.b <= close ? t.n : ''}
            </span>
          ))}
        </div>
        {thin.length === 0 ? <p className="tl-ok">{words.covered}</p> : thin.map((t) => <p key={t.a} className="tl-warnline">{t.n === 0 ? words.nobodyFrom(spoken(t.a), spoken(t.b)) : words.only(t.n, spoken(t.a), spoken(t.b))}</p>)}
      </div>
    )
  }
}

// The signed-in person's shift that day, who they work with, and who they take over from.
function YourShift({ me, shifts, w, person }) {
  const mine = shifts.filter((s) => s.employeeId === me.id)
  if (!mine.length) return null
  const others = shifts.filter((s) => s.employeeId !== me.id && person(s.employeeId))
  const names = (list) => [...new Set(list.map((s) => (person(s.employeeId)?.name ?? '?').split(' ')[0]))].join(', ')
  return (
    <>
      {mine.map((s) => {
        const overlapping = others.filter((o) => o.start < s.end && s.start < o.end)
        // Coworkers whose shift ends as mine starts (within 15 minutes).
        const before = others.filter((o) => o.end <= s.start && s.start - o.end <= 15)
        // Group the people I work with by when they finish (or when mine does, if sooner).
        const untilGroups = new Map()
        for (const o of overlapping) {
          const until = Math.min(o.end, s.end)
          untilGroups.set(until, [...(untilGroups.get(until) ?? []), o])
        }
        return (
          <div key={s.id} className="tl-yours">
            <b>{w.yourShift}</b>
            <span>{clockTime(s.start)} – {clockTime(s.end)}{s.title ? ` · ${s.title}` : ''}</span>
            {overlapping.length === 0 && before.length === 0 && <small>{w.alone}</small>}
            {[...untilGroups].sort(([a], [b]) => a - b).map(([until, list]) => <small key={until}>{w.with(names(list), spoken(until))}</small>)}
            {before.length > 0 && <small>{w.takesOver(names(before), spoken(s.start))}</small>}
          </div>
        )
      })}
    </>
  )
}

