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
import { tr } from './i18n.js'

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
      <button type="button" className="tm-back" onClick={onBack}><Icon name="left" /> {tr("Team", "Equipo")}</button>
      <header className="pf-head">
        <Avatar employee={person} size={64} />
        <div className="pf-who">
          <h2>
            {person.name}
            {person.isManager && <span className="pt-chip">{tr("Manager", "Gerente")}</span>}
            {!person.active && <span className="pt-chip off">{tr("Not active", "Inactivo")}</span>}
          </h2>
          <p>{[person.position || tr('No position', 'Sin puesto'), person.group, person.startedOn && `${tr('Started', 'Desde')} ${dayLabel(person.startedOn)}`, person.staffNo && `${tr('Staff no.', 'N.º')} ${person.staffNo}`, pay?.payrollId && `${tr('Payroll ID', 'ID de nómina')} ${pay.payrollId}`].filter(Boolean).join(' · ')}</p>
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onEdit}>{tr("Edit", "Editar")}</button>
      </header>

      {f.timeClock && !none && (
        <section className="pf-strip" aria-label={tr('This pay period', 'Este período')}>
          <div><small>{tr("Hours this pay period", "Horas este período")}</small><b>{formatHours(hours.total)}</b><span>{rangeLabel(period)}</span></div>
          <div><small>{tr("Overtime", "Horas extra")}</small><b>{formatHours(hours.overtime)}</b><span>{tr("after 40 hours a week", "después de 40 horas por semana")}</span></div>
          <div><small>{tr("To approve", "Por aprobar")}</small><b>{toApprove}</b><span>{toApprove === 1 ? tr('punch waiting', 'registro en espera') : tr('punches waiting', 'registros en espera')}</span></div>
          <div><small>{tr("Late clock-ins", "Entradas tarde")}</small><b>{late}</b><span>{tr("this pay period", "este período de pago")}</span></div>
          {estimate !== null && <div><small>{tr("Paycheck estimate", "Pago estimado")}</small><b>{money(estimate)}</b><span>{tr("before tax", "antes de impuestos")}</span></div>}
        </section>
      )}

      <section className="pf-sec">
        <h3 className="tm-h3">{tr("This week", "Esta semana")}</h3>
        {shifts.length ? (
          <ul className="pf-list">
            {shifts.map((s) => <li key={s.id}><span>{dayLabel(s.date)}</span><b>{shiftTimes(s)}</b><small>{[s.title, f.roles && s.role].filter(Boolean).join(' · ')}</small></li>)}
          </ul>
        ) : <p className="tm-muted">{tr("No shifts this week.", "Sin turnos esta semana.")}</p>}
        <button type="button" className="tm-link small" onClick={onSchedule}>{tr("Open the schedule", "Abrir el horario")}</button>
      </section>

      {f.timeClock && !none && (
        <section className="pf-sec">
          <h3 className="tm-h3">{tr("Recent punches", "Registros recientes")}</h3>
          {recent.length ? (
            <ul className="pf-list">
              {recent.map((p) => (
                <li key={p.id}>
                  <span>{dayLabel(dateKey(new Date(p.clockIn)))}</span>
                  <b>{formatClock(p.clockIn)} – {p.clockOut ? formatClock(p.clockOut) : tr('still in', 'sigue dentro')}</b>
                  <small>{formatHours(punchMinutes(p, now))} hrs · {STATUS_LABEL[punchStatus(p)]}</small>
                </li>
              ))}
            </ul>
          ) : <p className="tm-muted">{tr("No punches in the loaded period.", "Sin registros en el período cargado.")}</p>}
          <button type="button" className="tm-link small" onClick={onPunches}>{tr("All their punches in Hours", "Todos sus registros en Horas")}</button>
        </section>
      )}

      <section className="pf-sec">
        <h3 className="tm-h3">{tr("Contact", "Contacto")}</h3>
        <dl className="pf-dl">
          <dt>{tr("Sign-in email", "Correo para entrar")}</dt><dd>{none ? tr('No login (schedule only)', 'Sin acceso (solo horario)') : person.email || '—'}</dd>
          <dt>{tr("Phone", "Teléfono")}</dt><dd>{priv?.phone ? <a href={`tel:${priv.phone}`}>{priv.phone}</a> : '—'}</dd>
          <dt>{tr("Emergency contact", "Contacto de emergencia")}</dt><dd>{priv?.emergencyName || priv?.emergencyPhone ? <>{priv.emergencyName}{priv.emergencyPhone && <> · <a href={`tel:${priv.emergencyPhone}`}>{priv.emergencyPhone}</a></>}</> : '—'}</dd>
          {f.kioskClock && !none && <><dt>{tr("Kiosk PIN", "PIN del quiosco")}</dt><dd>{pinSet === null ? '…' : pinSet ? tr('Set', 'Configurado') : tr('Not set', 'Sin configurar')}</dd></>}
        </dl>
      </section>

      {f.timeOff && (
        <section className="pf-sec">
          <h3 className="tm-h3">{tr("Time off", "Ausencias")}</h3>
          {off.length ? (
            <ul className="pf-list">
              {off.map((t) => <li key={t.id}><span>{datesLabel(t.start, t.end)}</span><b>{t.status === 'approved' ? tr('Approved', 'Aprobada') : t.status === 'declined' ? tr('Declined', 'Rechazada') : tr('Pending', 'Pendiente')}</b><small>{t.reason}</small></li>)}
            </ul>
          ) : <p className="tm-muted">{tr("No time-off requests.", "Sin solicitudes de ausencia.")}</p>}
        </section>
      )}

      {!none && <PayHistory person={person} data={data} />}
      <PersonNotes person={person} data={data} />
    </div>
  )
}
