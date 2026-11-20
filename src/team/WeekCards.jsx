import { fromKey } from '../lib/dates.js'
import { formatHours, shiftMinutes } from './paycheck.js'
import { offOn, scheduleOnly, shiftTimes } from './format.js'
import { activeCover } from './CoverUI.jsx'
import Avatar from './Avatar.jsx'
import RoleBadge from './RoleBadge.jsx'
import SeenTick from './SeenTick.jsx'
import { useFeatures } from './features.js'
import { tagClass } from './tags.js'

// The week on a phone: one card per day, newest day first being the top of the week. Each card
// lists who works that day (name, times, type · hours, role). Managers tap a row to change a
// shift and + to add one; staff get a read-only copy. Tapping the date opens that day.
// A computer shows the grid instead (WeekGrid), so this is hidden there.
export default function WeekCards({ data, me, week, today, people, shifts, editable = false, showSeen = false, flash = new Set(), onEdit, onPickDay, phone = false }) {
  const f = useFeatures()
  const person = (id) => people.find((p) => p.id === id) ?? data.employees.find((e) => e.id === id)
  const groups = data.settings?.groups ?? []
  const groupOf = (id) => {
    const g = person(id)?.group
    return groups.some((x) => x.name === g) ? g : ''
  }
  // Today and the days ahead come first; days already gone sit at the bottom, dimmed. Other weeks keep their order.
  const ordered = week.includes(today) ? [...week.filter((d) => d >= today), ...week.filter((d) => d < today)] : week
  return (
    <div className={`wk-cards sc-up ${phone ? 'show-phone' : ''}`}>
      {ordered.map((d) => {
        const day = shifts.filter((s) => s.date === d).sort((a, b) => a.start - b.start || (person(a.employeeId)?.name ?? '').localeCompare(person(b.employeeId)?.name ?? ''))
        const minutes = day.reduce((sum, s) => sum + shiftMinutes(s), 0)
        const working = new Set(day.map((s) => s.employeeId)).size
        const off = people.filter((p) => offOn(data.teamOff, p.id, d))
        const date = fromKey(d)
        const Head = onPickDay ? 'button' : 'div'
        // With staff groups set up (Settings → Business → Groups) the day's shifts are listed under each group.
        const sections = groups.length
          ? [...groups.map((g) => ({ name: g.name, color: g.color ?? 7, rows: day.filter((s) => groupOf(s.employeeId) === g.name) })), { name: 'No group', color: 7, rows: day.filter((s) => groupOf(s.employeeId) === '') }].filter((sec) => sec.rows.length > 0)
          : null
            const renderRow = (s) => {
              const p = person(s.employeeId)
              const Row = editable ? 'button' : 'div'
              const tint = s.title ? tagClass(s.title, data.settings?.shiftPresets).match(/t\d/)?.[0] : ''
              const theirs = shifts.filter((x) => x.employeeId === s.employeeId)
              return (
                <Row key={s.id} type={editable ? 'button' : undefined} className={`wk-row ${tint ?? ''} ${s.published ? '' : 'draft'} ${flash.has(s.id) ? 'flash' : ''} ${s.employeeId === me.id ? 'me' : ''}`} onClick={editable ? () => onEdit(s) : undefined}>
                  <Avatar employee={p} size={30} />
                  <span className="wk-who">
                    <b>
                      {p?.name ?? '?'}
                      {showSeen && p && p.id !== me.id && !scheduleOnly(p) && <SeenTick shifts={theirs} seenAt={data.seenById?.[p.id]} ready={data.seenById != null} />}
                    </b>
                    <small>
                      {s.title ? `${s.title} · ` : ''}{formatHours(shiftMinutes(s))} hrs
                      {s.role && <> <RoleBadge role={s.role} roles={data.settings?.roles} /></>}
                      {f.cover && activeCover(data.cover, s.id) && <span className="cv-tag">cover?</span>}
                    </small>
                    {s.note && <small className="wk-note">{s.note}</small>}
                  </span>
                  <span className="wk-time">{shiftTimes(s)}</span>
                </Row>
              )
            }
        return (
          <section key={d} className={`wk-day ${d === today ? 'today' : ''} ${d < today ? 'past' : ''} ${sections ? 'grouped' : ''}`}>
            <div className="wk-head">
              <Head type={onPickDay ? 'button' : undefined} className="wk-date" onClick={onPickDay ? () => onPickDay(d) : undefined} aria-label={date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}>
                <small>{date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</small>
                <b>{date.getDate()}</b>
              </Head>
              <div className="wk-sum">
                <b>{d === today ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'long' })}</b>
                <small>{working ? `${working} working · ${formatHours(minutes)} hrs` : 'Nobody scheduled'}</small>
              </div>
              {editable && (
                <button type="button" className="wk-add" aria-label={`Add a shift on ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`} onClick={() => onEdit({ employeeId: me.id, date: d, start: 480, end: 840, breakMin: 0, title: '', role: '', note: '', published: false })}>+</button>
              )}
            </div>
            {sections ? sections.map((sec) => (
              <div key={sec.name} className="wk-sec">
                <div className="wk-group">
                  <i className={`rl-dot t${sec.color}`} aria-hidden="true" />
                  <b>{sec.name}</b>
                  <small>{sec.rows.length} {sec.rows.length === 1 ? 'shift' : 'shifts'} · {formatHours(sec.rows.reduce((sum, s) => sum + shiftMinutes(s), 0))} hrs</small>
                </div>
                {sec.rows.map(renderRow)}
              </div>
            )) : day.map(renderRow)}
            {off.map((p) => (
              <div key={p.id} className="wk-off"><Avatar employee={p} size={22} /><span>{p.name}</span><em>{editable ? 'Time off' : 'Off'}</em></div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
