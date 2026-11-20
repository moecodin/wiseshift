import { useEffect, useMemo, useState } from 'react'
import { dateKey, formatClock } from '../lib/dates.js'
import { formatHours, grossPay, payPeriodOf, periodHours, punchMinutes, scheduleWeekOf } from './paycheck.js'
import { dayLabel, datesLabel, money, rangeLabel, scheduleOnly, shiftTimes } from './format.js'
import { isLateWarning, punchStatus, punchWarnings, STATUS_LABEL } from './review.js'
import { kioskPinOwners } from './kioskApi.js'
import { useFeatures } from './features.js'
import Avatar from './Avatar.jsx'
import Icon from './Icon.jsx'
import { PayHistory, PersonNotes } from './PersonExtras.jsx'

// One person, for managers: who they are, this pay period in numbers, this week's shifts, recent punches, contact details
// and time off. Edit opens the edit form (where a person can also be made inactive).
export default function PersonPage({ person, data, onBack, onEdit, onPunches, onSchedule }) {
  const f = useFeatures()
  const now = useMemo(() => new Date(), [])
  const none = scheduleOnly(person)
  const period = payPeriodOf(now)
  const week = scheduleWeekOf(now)
  const priv = data.privateById[person.id]
  const pay = data.payById[person.id]
  const [pinSet, setPinSet] = useState(null)
  useEffect(() => {
    if (!f.kioskClock || none) return undefined
    let alive = true
    kioskPinOwners().then((r) => alive && setPinSet(r.owners.has(person.id)))
    return () => { alive = false }
  }, [f.kioskClock, none, person.id])

  const mine = data.punches.filter((p) => p.employeeId === person.id)
  const hours = periodHours(data.punches, person.id, period, now)
  const toApprove = mine.filter((p) => punchStatus(p) === 'pending').length
  const late = mine.filter((p) => period.includes(dateKey(new Date(p.clockIn))) && punchWarnings(p, data.shifts, data.shop, now).some(isLateWarning)).length
  const estimate = f.payRates && pay?.hourlyRate ? grossPay(hours, pay.hourlyRate).gross : null
  const shifts = data.shifts.filter((s) => s.employeeId === person.id && week.includes(s.date)).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
  const recent = [...mine].sort((a, b) => new Date(b.clockIn) - new Date(a.clockIn)).slice(0, 8)
  const off = data.timeOff.filter((t) => t.employeeId === person.id).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 5)

  return (
    <div className="tm-narrow desk pf">
      <button type="button" className="tm-back" onClick={onBack}><Icon name="left" /> Team</button>
      <header className="pf-head">
        <Avatar employee={person} size={64} />
        <div className="pf-who">
          <h2>
            {person.name}
            {person.isManager && <span className="pt-chip">Manager</span>}
            {!person.active && <span className="pt-chip off">Not active</span>}
          </h2>
          <p>{[person.position || 'No position', person.group, person.startedOn && `Started ${dayLabel(person.startedOn)}`, person.staffNo && `Staff no. ${person.staffNo}`, pay?.payrollId && `Payroll ID ${pay.payrollId}`].filter(Boolean).join(' · ')}</p>
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onEdit}>Edit</button>
      </header>

      {f.timeClock && !none && (
        <section className="pf-strip" aria-label="This pay period">
          <div><small>Hours this pay period</small><b>{formatHours(hours.total)}</b><span>{rangeLabel(period)}</span></div>
          <div><small>Overtime</small><b>{formatHours(hours.overtime)}</b><span>after 40 hours a week</span></div>
          <div><small>To approve</small><b>{toApprove}</b><span>{toApprove === 1 ? 'punch' : 'punches'} waiting</span></div>
          <div><small>Late clock-ins</small><b>{late}</b><span>this pay period</span></div>
          {estimate !== null && <div><small>Paycheck estimate</small><b>{money(estimate)}</b><span>before tax</span></div>}
        </section>
      )}

      <section className="pf-sec">
        <h3 className="tm-h3">This week</h3>
        {shifts.length ? (
          <ul className="pf-list">
            {shifts.map((s) => <li key={s.id}><span>{dayLabel(s.date)}</span><b>{shiftTimes(s)}</b><small>{[s.title, f.roles && s.role].filter(Boolean).join(' · ')}</small></li>)}
          </ul>
        ) : <p className="tm-muted">No shifts this week.</p>}
        <button type="button" className="tm-link small" onClick={onSchedule}>Open the schedule</button>
      </section>

      {f.timeClock && !none && (
        <section className="pf-sec">
          <h3 className="tm-h3">Recent punches</h3>
          {recent.length ? (
            <ul className="pf-list">
              {recent.map((p) => (
                <li key={p.id}>
                  <span>{dayLabel(dateKey(new Date(p.clockIn)))}</span>
                  <b>{formatClock(p.clockIn)} – {p.clockOut ? formatClock(p.clockOut) : 'still in'}</b>
                  <small>{formatHours(punchMinutes(p, now))} hrs · {STATUS_LABEL[punchStatus(p)]}</small>
                </li>
              ))}
            </ul>
          ) : <p className="tm-muted">No punches in the loaded period.</p>}
          <button type="button" className="tm-link small" onClick={onPunches}>All their punches in Hours</button>
        </section>
      )}

      <section className="pf-sec">
        <h3 className="tm-h3">Contact</h3>
        <dl className="pf-dl">
          <dt>Sign-in email</dt><dd>{none ? 'No login (schedule only)' : person.email || '—'}</dd>
          <dt>Phone</dt><dd>{priv?.phone ? <a href={`tel:${priv.phone}`}>{priv.phone}</a> : '—'}</dd>
          <dt>Emergency contact</dt><dd>{priv?.emergencyName || priv?.emergencyPhone ? <>{priv.emergencyName}{priv.emergencyPhone && <> · <a href={`tel:${priv.emergencyPhone}`}>{priv.emergencyPhone}</a></>}</> : '—'}</dd>
          {f.kioskClock && !none && <><dt>Kiosk PIN</dt><dd>{pinSet === null ? '…' : pinSet ? 'Set' : 'Not set'}</dd></>}
        </dl>
      </section>

      {f.timeOff && (
        <section className="pf-sec">
          <h3 className="tm-h3">Time off</h3>
          {off.length ? (
            <ul className="pf-list">
              {off.map((t) => <li key={t.id}><span>{datesLabel(t.start, t.end)}</span><b>{t.status === 'approved' ? 'Approved' : t.status === 'declined' ? 'Declined' : 'Pending'}</b><small>{t.reason}</small></li>)}
            </ul>
          ) : <p className="tm-muted">No time-off requests.</p>}
        </section>
      )}

      {!none && <PayHistory person={person} data={data} />}
      <PersonNotes person={person} data={data} />
    </div>
  )
}
