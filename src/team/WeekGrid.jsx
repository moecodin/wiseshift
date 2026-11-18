import { fromKey } from '../lib/dates.js'
import { formatHours, shiftMinutes } from './paycheck.js'
import { dayLabel, offOn, rangeLabel, scheduleOnly } from './format.js'
import { activeCover } from './CoverUI.jsx'
import Avatar from './Avatar.jsx'
import SeenTick from './SeenTick.jsx'
import ShiftBox from './ShiftBox.jsx'
import { useFeatures } from './features.js'
import WeekCards from './WeekCards.jsx'

// The week: people down the side, days across. Managers (editable) tap a box to change
// a shift and + to add one. Staff get a read-only copy. Tapping a day's heading calls onPickDay.
export default function WeekGrid({ data, me, week, today, people, shifts, editable = false, showSeen = false, flash = new Set(), onEdit, onPickDay, className = '' }) {
  const f = useFeatures()
  // With staff groups set up, people sit under a heading row per group (the rest under "No group").
  const groups = data.settings?.groups ?? []
  const known = new Set(groups.map((g) => g.name))
  const ordered = groups.length
    ? [...groups.map((g) => ({ name: g.name, color: g.color ?? 7, members: people.filter((p) => p.group === g.name) })), { name: 'No group', color: 7, members: people.filter((p) => !known.has(p.group)) }]
        .filter((sec) => sec.members.length > 0)
        .flatMap((sec) => [{ head: true, name: sec.name, color: sec.color, count: sec.members.length }, ...sec.members.map((person) => ({ person }))])
    : people.map((person) => ({ person }))
  return (
    <>
    {/* On a phone the week is a card per day (WeekCards); a computer keeps the grid. */}
    <WeekCards data={data} me={me} week={week} today={today} people={people} shifts={shifts} editable={editable} showSeen={showSeen} flash={flash} onEdit={onEdit} onPickDay={onPickDay} phone={className.includes('show-phone')} />
    <div className={`tm-gridwrap wk-table sc-up ${className}`}>
      <table className="tm-grid">
        <thead>
          <tr>
            <th scope="col">{rangeLabel(week)}</th>
            {week.map((d) => (
              <th key={d} scope="col" className={d === today ? 'today' : ''}>
                {onPickDay ? (
                  <button type="button" className="gr-dayhead" aria-label={dayLabel(d)} onClick={() => onPickDay(d)}>
                    <span className="gr-dow">{fromKey(d).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    <span className="gr-date">{fromKey(d).getDate()}</span>
                  </button>
                ) : (
                  <>
                    <span className="gr-dow">{fromKey(d).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    <span className="gr-date">{fromKey(d).getDate()}</span>
                  </>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordered.map((item) => {
            if (item.head) {
              return (
                <tr key={`g-${item.name}`} className="gr-group">
                  <th scope="colgroup" colSpan={8}><i className={`rl-dot t${item.color}`} aria-hidden="true" /><b>{item.name}</b><small>{item.count} {item.count === 1 ? 'person' : 'people'}</small></th>
                </tr>
              )
            }
            const person = item.person
            const theirs = shifts.filter((s) => s.employeeId === person.id)
            return (
              <tr key={person.id} className={person.id === me.id ? 'me' : ''}>
                <th scope="row">
                  <div className="gr-person">
                    <Avatar employee={person} size={34} />
                    <div>
                      <b>
                        {person.name}
                        {showSeen && person.id !== me.id && !scheduleOnly(person) && <SeenTick shifts={theirs} seenAt={data.seenById?.[person.id]} ready={data.seenById != null} />}
                      </b>
                      <small>{person.position}</small>
                      <small className="tm-hrs">{formatHours(theirs.reduce((sum, s) => sum + shiftMinutes(s), 0))} hrs</small>
                    </div>
                  </div>
                </th>
                {week.map((d) => {
                  const dayShifts = theirs.filter((s) => s.date === d)
                  const off = offOn(data.teamOff, person.id, d)
                  return (
                    <td key={d} className={d === today ? 'today' : ''}>
                      {off && <div className="tm-off">{editable ? 'Time off' : 'Off'}</div>}
                      {dayShifts.map((s) => (
                        <ShiftBox key={s.id} cover={f.cover ? activeCover(data.cover, s.id) : undefined} flash={flash.has(s.id)} shift={s} roles={data.settings?.roles} presets={data.settings?.shiftPresets} onClick={editable ? () => onEdit(s) : undefined} />
                      ))}
                      {editable && (
                        <button type="button" className="tm-add" aria-label={`Add a shift for ${person.name} on ${dayLabel(d)}`} onClick={() => onEdit({ employeeId: person.id, date: d, start: 480, end: 840, breakMin: 0, title: '', role: '', note: '', published: false })}>
                          +
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Hours</th>
            {week.map((d) => (
              <td key={d}>{formatHours(shifts.filter((s) => s.date === d).reduce((sum, s) => sum + shiftMinutes(s), 0))}</td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
    </>
  )
}
