import { formatClock } from '../lib/dates.js'
import Avatar from './Avatar.jsx'
import { dayLabel, money } from './format.js'
import { formatHours } from './paycheck.js'
import { describeSpot } from './location.js'
import Paycheck from './Paycheck.jsx'

// The timesheet on a phone: a card per person instead of the 18-column table. The card shows
// their total (regular and overtime under it); tap to open the days they worked, with times.
// A computer, and printing, keep the table (see .ts-table / .ts-cards in team.css).
export default function TimesheetCards({ rows, data, pay, total }) {
  return (
    <div className="ts-cards">
      <div className="ts-sum">
        <span>Everyone</span>
        <b>{formatHours(total((r) => r.hours.total))} hrs</b>
        <small>
          Regular {formatHours(total((r) => r.hours.regular))}
          {total((r) => r.hours.overtime) > 0 && <> · Overtime {formatHours(total((r) => r.hours.overtime))}</>}
          {pay && <> · Gross {money(total((r) => r.gross ?? 0))}</>}
        </small>
      </div>
      {rows.map(({ e, hours, rate, gross }) => {
        return (
          <details key={e.id} className="ts-card">
            <summary>
              <Avatar employee={e} size={38} />
              <span className="ts-who">
                <b>{e.name}</b>
                <small>
                  Regular {formatHours(hours.regular)}
                  {hours.overtime > 0 && <> · <span className="tm-ot">Overtime {formatHours(hours.overtime)}</span></>}
                  {pay && <> · {e.payType === 'hourly' ? `${money(rate)}/hr` : 'Commission'}{gross !== null && ` · ${money(gross)}`}</>}
                </small>
              </span>
              <span className="ts-total">{formatHours(hours.total)}<small>hrs</small></span>
              <svg className="ts-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
            </summary>
            <PersonHours row={{ e, hours, rate, gross }} data={data} pay={pay} />
          </details>
        )
      })}
    </div>
  )
}

// One person's days this pay period (newest first) and, when pay rates are on, their paycheck
// estimate. Shown inside the person's card on a phone, and in a pop-up from their name on a computer.
export function PersonHours({ row, data, pay }) {
  const { e, hours } = row
  const days = hours.byDay.filter((d) => d.punches.length > 0).reverse()
  return (
    <>
      {days.length === 0 ? (
        <p className="ts-none">No punches this pay period.</p>
      ) : (
        <ul className="ts-days">
          {days.map((d) => (
            <li key={d.date}>
              <span className="ts-date">{dayLabel(d.date)}</span>
              <span className="ts-times">
                {d.punches.map((p) => {
                  const away = [p.inSpot, p.clockOut && p.outSpot].some((x) => x && describeSpot(x, data.shop).far)
                  return (
                    <span key={p.id} className={away ? 'tm-away' : ''}>
                      {formatClock(p.clockIn)} – {p.clockOut ? formatClock(p.clockOut) : 'still in'}{away && <small className="ts-away"> away</small>}
                    </span>
                  )
                })}
              </span>
              <b>{formatHours(d.minutes)}</b>
            </li>
          ))}
        </ul>
      )}
      {pay && <div className="ts-pay"><Paycheck employee={e} pay={data.payById[e.id]} hours={hours} isMe={e.id === data.me?.id} /></div>}
    </>
  )
}
