import { useState } from 'react'
import Modal from '../components/Modal.jsx'
import { dateKey, formatClock, fromKey } from '../lib/dates.js'
import CountUp from './CountUp.jsx'
import { decimalHours, estimatePaycheck, formatHours, grossPay, moveDays, payPeriodOf, periodHours } from './paycheck.js'
import { dayLabel, isoToTimeInput, money, rangeLabel, scheduleOnly, timeInputToIso, useNow } from './format.js'
import { TAX_YEAR } from './taxRates.js'
import { describeSpot } from './location.js'
import SpotTag from './SpotTag.jsx'
import MyHours from './MyHours.jsx'
import { useFeatures } from './features.js'
import ExportHours from './ExportHours.jsx'
import PunchDetails from './PunchDetails.jsx'
import ReviewList from './ReviewList.jsx'
import { punchStatus } from './review.js'

// Hours for a pay period (Friday to Thursday, two weeks) and the paycheck
// estimate. Managers can look at anyone, fix punches, see everyone's timesheet
// and download it for the payroll service.
export default function HoursTab({ data, me, boss, lang, period, onPeriod }) {
  const now = useNow()
  const f = useFeatures()
  // Managers start on Review (punches to approve); staff only have their own hours.
  const [view, setView] = useState(boss ? 'review' : 'person')
  const [exporting, setExporting] = useState(false)
  const [who, setWho] = useState(me.id)
  const current = payPeriodOf(now)[0] === period[0]
  // Managers can also review (approve) everyone's punches here, like the Review list on Today.
  const reviewing = boss && view === 'review'
  const toReview = boss ? data.punches.filter((p) => punchStatus(p) === 'pending').length : 0

  return (
    <div>
      <div className="tm-toolbar">
        {!reviewing && (
        <div className="tm-weeknav">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onPeriod(moveDays(period, -1))} aria-label="Pay period before">‹</button>
          <b>{rangeLabel(period)}</b>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onPeriod(moveDays(period, 1))} aria-label="Pay period after">›</button>
          {!current && <button type="button" className="btn btn-link btn-sm" onClick={() => onPeriod(payPeriodOf(new Date()))}>This pay period</button>}
        </div>
        )}
        {boss && (
          <div className="tm-seg hr-seg" role="group" aria-label="Show">
            <button type="button" aria-pressed={view === 'review'} onClick={() => setView('review')}>Review{toReview > 0 && <span className="hr-count">{toReview}</span>}</button>
            <button type="button" aria-pressed={view === 'person'} onClick={() => setView('person')}>Employee</button>
            {f.timesheets && <button type="button" aria-pressed={view === 'all'} onClick={() => setView('all')}>Timesheet</button>}
          </div>
        )}
        {boss && f.timesheets && !reviewing && (
          <button type="button" className="btn btn-brand btn-sm ex-btn" onClick={() => setExporting(true)}>Export hours…</button>
        )}
        {boss && view === 'person' && (
          <select className="form-select form-select-sm tm-who" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Whose hours">
            {data.employees.filter((e) => !scheduleOnly(e)).map((e) => <option key={e.id} value={e.id}>{e.name}{e.active ? '' : ' (not active)'}</option>)}
          </select>
        )}
      </div>
      {reviewing ? (
        <div className="tm-narrow desk"><ReviewList data={data} /></div>
      ) : boss && f.timesheets && view === 'all' ? (
        <Timesheet data={data} period={period} now={now} />
      ) : !boss ? (
        <MyHours data={data} me={me} period={period} now={now} lang={lang} />
      ) : (
        <Person data={data} boss={boss} employee={data.employees.find((e) => e.id === who) ?? me} period={period} now={now} />
      )}
      {boss && f.timesheets && <p className="ex-note">Exports are available on a computer.</p>}
      {exporting && <ExportHours data={data} now={now} onClose={() => setExporting(false)} />}
    </div>
  )
}

function Person({ data, boss, employee, period, now }) {
  const f = useFeatures()
  const [editing, setEditing] = useState(null)
  const [details, setDetails] = useState(null)
  const [approving, setApproving] = useState(false)
  const hours = periodHours(data.punches, employee.id, period, now)
  const pay = data.payById[employee.id]
  const isMe = employee.id === data.me?.id
  const weeks = [hours.byDay.slice(0, 7), hours.byDay.slice(7)]
  // Finished punches nobody has approved yet: managers approve them here, one at a time or all at once.
  const pending = hours.byDay.flatMap((d) => d.punches).filter((p) => p.clockOut && !p.approvedAt)
  const approve = async (ids) => {
    setApproving(true)
    await data.actions.approvePunches(ids, true)
    setApproving(false)
  }

  return (
    <div className="tm-narrow desk hr-grid">
      <div className="hr-side">
      <section className="hr-hero">
        <small>{isMe ? 'Hours this pay period' : `${employee.name} · this pay period`}</small>
        <div><b><CountUp value={decimalHours(hours.total)} /></b> <span>hrs</span></div>
        <small>
          Regular {formatHours(hours.regular)}
          {hours.overtime > 0 && <> · <span className="hr-ot">Overtime {formatHours(hours.overtime)}</span></>}
        </small>
      </section>
      {boss && pending.length > 0 && (
        <div className="mh-pending">
          <span><b>{pending.length}</b> {pending.length === 1 ? 'punch' : 'punches'} to approve</span>
          <button type="button" disabled={approving} onClick={() => approve(pending.map((p) => p.id))}>Approve all</button>
        </div>
      )}
      {hours.open && <p className="tm-warn">{isMe ? "You're" : `${employee.name} is`} still clocked in, so these hours keep counting.</p>}
      </div>

      <div className="hr-weeks">

      {weeks.map((days, i) => {
        const worked = days.filter((d) => d.punches.length > 0).reverse()
        return (
          <div key={i}>
            <h2 className="sc-h">
              Week {i + 1} <small className="mg-sum">{rangeLabel(days.map((d) => d.date))} · {formatHours(days.reduce((sum, d) => sum + d.minutes, 0))} hrs</small>
            </h2>
            {worked.length === 0 && <p className="tm-muted">No punches this week.</p>}
            {worked.map((d) => {
              const date = fromKey(d.date)
              return (
                <div key={d.date} className="sc-row hr-day mh-day">
                  <div className="sc-date">
                    <small>{date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</small>
                    <b>{date.getDate()}</b>
                  </div>
                  <div className="sc-body">
                    {(data.punchNotes ?? []).filter((n) => n.employeeId === employee.id && n.date === d.date).map((n) => (
                      <small key={n.id} className="mh-staffnote">Note from staff: {n.text}</small>
                    ))}
                    {d.punches.map((p) => (
                      <div key={p.id} className="mh-punch">
                        <span className="hr-times">
                          {formatClock(p.clockIn)} – {p.clockOut ? formatClock(p.clockOut) : <i>still in</i>}
                          {p.approvedAt && <span className="hr-approved" title={`Approved${p.approvedBy ? ` by ${p.approvedBy}` : ''}`}>Approved</span>}
                          {p.editedBy && <span className="tm-edited" title={`Fixed by ${p.editedBy}`}>fixed</span>}
                        </span>
                        <div className="tm-spots">
                          {/* A time a manager typed in has no location; don't call it missing. */}
                          {(p.inSpot || !p.editedBy) && <SpotTag quiet spot={p.inSpot} shop={data.shop} prefix="In: " />}
                          {p.clockOut && (p.outSpot || !p.editedBy) && <SpotTag quiet spot={p.outSpot} shop={data.shop} prefix="Out: " />}
                        </div>
                        {p.note && <small>{p.note}</small>}
                        {boss && p.clockOut && !p.approvedAt && <button type="button" className="mh-approve" disabled={approving} onClick={() => approve([p.id])}>Approve</button>}
                        {boss && <button type="button" className="mh-edit" onClick={() => setDetails(p)}>Details</button>}
                        {boss && <button type="button" className="mh-edit" onClick={() => setEditing(p)}>Edit</button>}
                      </div>
                    ))}
                  </div>
                  <span className="sc-hrs hr-total">{d.minutes ? formatHours(d.minutes) : ''}</span>
                </div>
              )
            })}
            {boss && (
              <button type="button" className="mh-add" onClick={() => setEditing({ employeeId: employee.id, clockIn: timeInputToIso(days[0].date, '08:00'), clockOut: timeInputToIso(days[0].date, '14:00'), note: '', isNew: true })}>
                + Add a missing punch
              </button>
            )}
          </div>
        )
      })}

      </div>

      <div className="hr-pay">
      {f.payRates && <Paycheck employee={employee} pay={pay} hours={hours} isMe={isMe} />}
      </div>
      {editing && <PunchEditor punch={editing} data={data} onClose={() => setEditing(null)} />}
      {details && <PunchDetails punch={details} data={data} onClose={() => setDetails(null)} />}
    </div>
  )
}

// The paycheck estimate for one pay period.
function Paycheck({ employee, pay, hours, isMe }) {
  if (employee.payType === 'commission') {
    return <section className="tm-card"><h2>Paycheck estimate</h2><p className="tm-muted mb-0">Paid by commission: commission pay isn't calculated here yet.</p></section>
  }
  if (!pay || !pay.hourlyRate) {
    return (
      <section className="tm-card">
        <h2>Paycheck estimate</h2>
        <p className="tm-muted mb-0">{isMe ? "Your manager hasn't added your pay rate yet." : 'Add a pay rate on the Team tab to see an estimate.'}</p>
      </section>
    )
  }
  const { regularPay, overtimePay, gross } = grossPay(hours, pay.hourlyRate)
  const estimate = estimatePaycheck(gross, pay)
  return (
    <section className="tm-card tm-paycheck">
      <h2>Paycheck estimate</h2>
      <div className="tm-row"><span>Regular {formatHours(hours.regular)} hrs × {money(pay.hourlyRate)}</span><span>{money(regularPay)}</span></div>
      {hours.overtime > 0 && <div className="tm-row"><span>Overtime {formatHours(hours.overtime)} hrs × {money(pay.hourlyRate * 1.5)}</span><span>{money(overtimePay)}</span></div>}
      <div className="tm-row tm-strong"><span>Gross pay</span><span>{money(gross)}</span></div>
      {estimate.lines.map((l) => (
        <div key={l.key} className="tm-row tm-minus"><span>{l.label}</span><span>−{money(l.amount)}</span></div>
      ))}
      <div className="tm-row tm-net"><span>Estimated take-home</span><span>{money(estimate.net)}</span></div>
      <p className="tm-muted small mb-0">
        An estimate using {TAX_YEAR} tax tables and the W-4 and IT-2104 on file. Your real pay stub from payroll may differ by a few dollars.
      </p>
    </section>
  )
}

// Managers: add or fix one punch.
export function PunchEditor({ punch, data, onClose }) {
  const [date, setDate] = useState(dateKey(new Date(punch.clockIn)))
  const [timeIn, setTimeIn] = useState(isoToTimeInput(punch.clockIn))
  const [timeOut, setTimeOut] = useState(punch.clockOut ? isoToTimeInput(punch.clockOut) : '')
  const [note, setNote] = useState(punch.note ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const person = data.employees.find((e) => e.id === punch.employeeId)

  const save = async () => {
    const clockIn = timeInputToIso(date, timeIn)
    const clockOut = timeOut ? timeInputToIso(date, timeOut) : null
    if (!clockIn) return setError('Type the clock-in time.')
    if (clockOut && clockOut <= clockIn) return setError('Clock-out has to be after clock-in.')
    if (!clockOut && data.punches.some((p) => p.employeeId === punch.employeeId && !p.clockOut && p.id !== punch.id)) {
      return setError(`${person?.name} is already clocked in. Add a clock-out time.`)
    }
    setBusy(true)
    const problem = await data.actions.savePunch({ id: punch.id, employeeId: punch.employeeId, clockIn, clockOut, actualIn: punch.actualIn, actualOut: punch.actualOut, note: note.trim() })
    setBusy(false)
    if (problem) setError(problem)
    else onClose()
  }
  const remove = async () => {
    setBusy(true)
    const problem = await data.actions.deletePunch(punch.id)
    setBusy(false)
    if (problem) setError(problem)
    else onClose()
  }

  return (
    <Modal
      title={`${punch.isNew ? 'Add' : 'Fix'} punch: ${person?.name ?? ''}`}
      onClose={onClose}
      footer={
        <>
          {!punch.isNew && <button type="button" className="btn btn-outline-danger me-auto" disabled={busy} onClick={remove}>Delete</button>}
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-brand" disabled={busy} onClick={save}>Save</button>
        </>
      }
    >
      <div className="row g-2">
        <div className="col-12">
          <label className="form-label" htmlFor="pu-date">Day</label>
          <input id="pu-date" type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="col-6">
          <label className="form-label" htmlFor="pu-in">Clock in</label>
          <input id="pu-in" type="time" className="form-control" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} />
        </div>
        <div className="col-6">
          <label className="form-label" htmlFor="pu-out">Clock out</label>
          <input id="pu-out" type="time" className="form-control" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="pu-note">Why (shows on the timesheet)</label>
          <input id="pu-note" className="form-control" value={note} maxLength={200} placeholder="Forgot to clock out" onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <p className="tm-muted small mt-3 mb-0">Leave Clock out empty if they're still working. The punch is marked as fixed by you.</p>
      {error && <p className="tm-error mt-2" role="alert">{error}</p>}
    </Modal>
  )
}

// Managers: everyone's hours for the pay period, like the Humanity timesheet summary.
function Timesheet({ data, period, now }) {
  const f = useFeatures()
  const pay = f.payRates // rate and gross columns only when the business uses pay rates
  const rows = data.employees
    .filter((e) => !scheduleOnly(e))
    .map((e) => {
      const hours = periodHours(data.punches, e.id, period, now)
      const rate = data.payById[e.id]?.hourlyRate ?? 0
      return { e, hours, rate, gross: e.payType === 'hourly' ? grossPay(hours, rate).gross : null }
    })
    .filter((r) => r.e.active || r.hours.total > 0)
  const total = (fn) => rows.reduce((sum, r) => sum + fn(r), 0)
  const stillIn = rows.filter((r) => r.hours.open)
  // Finished punches nobody has approved yet (Hours → Review).
  const unapproved = rows.flatMap((r) => r.hours.byDay.flatMap((d) => d.punches)).filter((p) => p.clockOut && !p.approvedAt).length

  return (
    <div className="ts-print">
      <div className="ts-print-head">
        <b>Timesheet</b>
        <span>{dayLabel(period[0])} to {dayLabel(period.at(-1))}</span>
        <small>Printed {now.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</small>
      </div>
      {stillIn.length > 0 && (
        <p className="tm-warn no-print">Still clocked in: {stillIn.map((r) => r.e.name).join(', ')}. Fix any forgotten clock-outs before payroll.</p>
      )}
      {unapproved > 0 && (
        <p className="tm-warn no-print">{unapproved} punch{unapproved === 1 ? '' : 'es'} not approved yet. Approve them on Hours → Review before payroll.</p>
      )}
      <div className="tm-gridwrap">
        <table className="tm-sheet">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Total</th>
              <th scope="col">Regular</th>
              <th scope="col">Overtime</th>
              {period.map((d) => <th key={d} scope="col">{dayLabel(d)}</th>)}
              {pay && <th scope="col">Rate</th>}
              {pay && <th scope="col">Gross (est.)</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, hours, rate, gross }) => (
              <tr key={e.id}>
                <th scope="row">{e.name}</th>
                <td><b>{formatHours(hours.total)}</b></td>
                <td>{formatHours(hours.regular)}</td>
                <td className={hours.overtime ? 'tm-ot' : ''}>{formatHours(hours.overtime)}</td>
                {hours.byDay.map((d) => (
                  <td key={d.date} className="tm-cell">
                    {d.punches.map((p) => {
                      const away = [p.inSpot, p.clockOut && p.outSpot].some((x) => x && describeSpot(x, data.shop).far)
                      return (
                        <div key={p.id} className={away ? 'tm-away' : ''} title={away ? 'Clocked in or out away from the shop' : undefined}>
                          {formatClock(p.clockIn)}–{p.clockOut ? formatClock(p.clockOut) : 'in'}{away && <small className="ts-away"> away</small>}
                        </div>
                      )
                    })}
                    {d.minutes > 0 && <b>{formatHours(d.minutes)}</b>}
                  </td>
                ))}
                {pay && <td>{e.payType === 'hourly' ? money(rate) : 'Commission'}</td>}
                {pay && <td>{gross === null ? '—' : money(gross)}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td><b>{formatHours(total((r) => r.hours.total))}</b></td>
              <td>{formatHours(total((r) => r.hours.regular))}</td>
              <td>{formatHours(total((r) => r.hours.overtime))}</td>
              {period.map((d, i) => <td key={d}>{formatHours(total((r) => r.hours.byDay[i].minutes))}</td>)}
              {pay && <td />}
              {pay && <td>{money(total((r) => r.gross ?? 0))}</td>}
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="tm-tools mt-3">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => window.print()}>Print</button>
      </div>
      <p className="tm-muted small mt-2">Hours are exact, to the minute. Overtime is time and a half after 40 hours in each Friday–Thursday week.</p>
    </div>
  )
}
