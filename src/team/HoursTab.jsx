import { useEffect, useRef, useState } from 'react'
import Modal from '../components/Modal.jsx'
import { dateKey, formatClock, fromKey } from '../lib/dates.js'
import { formatHours, moveDays, payPeriodConfig, payPeriodOf } from './paycheck.js'
import { DAY_LONG } from './onboardingHelpers.js'
import { dayLabel, isoToTimeInput, money, rangeLabel, scheduleOnly, timeInputToIso, useNow } from './format.js'
import { describeSpot } from './location.js'
import MyHours from './MyHours.jsx'
import { useFeatures } from './features.js'
import TimesheetCards, { PersonHours } from './TimesheetCards.jsx'
import ReviewList from './ReviewList.jsx'
import Icon from './Icon.jsx'
import PrintWeeks, { shortTime } from './PrintWeeks.jsx'
import { DEFAULT_FILTERS, deptLabel, groupRows, reportRows, unapprovedCount } from './reportFilters.js'
import { tr } from './i18n.js'

// Hours. A manager sees the punches (review, approve, fix, add). Everyone else sees their own hours for the pay period
// and the paycheck estimate. Timesheets and exports live in the Reports tab.
export default function HoursTab({ data, me, boss, lang, period, onPeriod, focus, onProfile }) {
  const now = useNow()
  const current = payPeriodOf(now)[0] === period[0]
  if (boss) return <div className="tm-narrow desk"><ReviewList data={data} focus={focus} onProfile={onProfile} /></div>
  return (
    <div>
      <div className="tm-toolbar">
        <div className="tm-weeknav nav-center">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onPeriod(moveDays(period, -1))} aria-label="Pay period before"><Icon name="left" /></button>
          <b>{rangeLabel(period)}</b>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onPeriod(moveDays(period, 1))} aria-label="Pay period after"><Icon name="right" /></button>
          {!current && <button type="button" className="btn btn-link btn-sm" onClick={() => onPeriod(payPeriodOf(new Date()))}>{tr("This pay period", "Este período de pago")}</button>}
        </div>
      </div>
      <MyHours data={data} me={me} period={period} now={now} lang={lang} />
    </div>
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
  // Adding from Review: pick who the punch is for (`chooseWho`). Other callers already know the person.
  const [who, setWho] = useState(punch.employeeId ?? '')
  const person = data.employees.find((e) => e.id === who)

  const save = async () => {
    const clockIn = timeInputToIso(date, timeIn)
    const clockOut = timeOut ? timeInputToIso(date, timeOut) : null
    if (!who) return setError(tr('Pick who this punch is for.', 'Elige para quién es este registro.'))
    if (!clockIn) return setError(tr('Type the clock-in time.', 'Escribe la hora de entrada.'))
    if (clockOut && clockOut <= clockIn) return setError(tr('Clock-out has to be after clock-in.', 'La salida debe ser después de la entrada.'))
    if (!clockOut && data.punches.some((p) => p.employeeId === who && !p.clockOut && p.id !== punch.id)) {
      return setError(`${person?.name} is already clocked in. Add a clock-out time.`)
    }
    // Same rule the database enforces (update 027): one person can't have two punches at the same time.
    const end = clockOut ?? '9999'
    const clash = data.punches.find((p) => p.employeeId === who && p.id !== punch.id && p.clockIn < end && clockIn < (p.clockOut ?? '9999'))
    if (clash) return setError(tr(`This overlaps another punch for ${person?.name} (${formatClock(clash.clockIn)} – ${clash.clockOut ? formatClock(clash.clockOut) : 'still in'}).`, `Esto se cruza con otro registro de ${person?.name} (${formatClock(clash.clockIn)} – ${clash.clockOut ? formatClock(clash.clockOut) : 'sigue dentro'}).`))
    setBusy(true)
    const problem = await data.actions.savePunch({ id: punch.id, employeeId: who, clockIn, clockOut, actualIn: punch.actualIn, actualOut: punch.actualOut, note: note.trim() })
    setBusy(false)
    if (problem) setError(problem)
    else onClose()
  }
  const remove = async () => {
    if (!window.confirm(tr('Delete this punch? This can’t be undone.', '¿Borrar este registro? No se puede deshacer.'))) return
    setBusy(true)
    const problem = await data.actions.deletePunch(punch.id)
    setBusy(false)
    if (problem) setError(problem)
    else onClose()
  }

  return (
    <Modal
      title={`${punch.isNew ? tr('Add punch', 'Agregar registro') : tr('Fix punch', 'Arreglar registro')}${person ? `: ${person.name}` : ''}`}
      onClose={onClose}
      footer={
        <>
          {!punch.isNew && <button type="button" className="btn btn-outline-danger me-auto" disabled={busy} onClick={remove}>{tr("Delete", "Borrar")}</button>}
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{tr("Cancel", "Cancelar")}</button>
          <button type="button" className="btn btn-brand" disabled={busy} onClick={save}>{tr("Save", "Guardar")}</button>
        </>
      }
    >
      <div className="row g-2">
        {punch.chooseWho && (
          <div className="col-12">
            <label className="form-label" htmlFor="pu-who">{tr("Who", "Quién")}</label>
            <select id="pu-who" className="form-select" value={who} onChange={(e) => { setWho(e.target.value); setError('') }}>
              <option value="">{tr("Choose a person…", "Elige una persona…")}</option>
              {data.employees.filter((e) => !scheduleOnly(e) && e.active).sort((a, b) => a.name.localeCompare(b.name)).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        )}
        <div className="col-12">
          <label className="form-label" htmlFor="pu-date">{tr("Day", "Día")}</label>
          <input id="pu-date" type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="col-6">
          <label className="form-label" htmlFor="pu-in">{tr("Clock in", "Marcar entrada")}</label>
          <input id="pu-in" type="time" className="form-control" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} />
        </div>
        <div className="col-6">
          <label className="form-label" htmlFor="pu-out">{tr("Clock out", "Marcar salida")}</label>
          <input id="pu-out" type="time" className="form-control" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="pu-note">{tr("Why (shows on the timesheet)", "Por qué (aparece en la hoja de horas)")}</label>
          <input id="pu-note" className="form-control" value={note} maxLength={200} placeholder={tr('e.g. Forgot to clock out…', 'p. ej., Olvidó marcar salida…')} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <p className="tm-muted small mt-3 mb-0">{tr("Leave Clock out empty if they're still working. The punch is marked as fixed by you.", "Deja la salida vacía si sigue trabajando. El registro queda marcado como arreglado por ti.")}</p>
      {error && <p className="tm-error mt-2" role="alert">{error}</p>}
    </Modal>
  )
}

// Managers: everyone's hours for the pay period, like the Humanity timesheet summary.
export function Timesheet({ data, period, now, focus, filters = DEFAULT_FILTERS }) {
  const weekStart = fromKey(payPeriodConfig().anchor).getDay() // overtime weeks begin on the pay period's first day
  const f = useFeatures()
  const [openRow, setOpenRow] = useState(null) // a person's days and paycheck estimate, from their name
  const focusedRow = useRef(0)
  useEffect(() => {
    if (focus?.tab === 'reports' && focus.n !== focusedRow.current) {
      focusedRow.current = focus.n
      setOpenRow(focus.id)
    }
  }, [focus])
  const pay = f.payRates // rate and gross columns only when the business uses pay rates
  const { approvedOnly, hoursOnly, staffNo, groupBy, dept } = { ...DEFAULT_FILTERS, ...filters }
  const rows = reportRows(data, period, now, filters)
  const sections = groupRows(rows, groupBy)
  const sumOf = (list, fn) => list.reduce((sum, r) => sum + fn(r), 0)
  const total = (fn) => sumOf(rows, fn)
  const stillIn = approvedOnly ? [] : rows.filter((r) => r.hours.open)
  // Finished punches nobody has approved yet (Hours → Review). With "Approved only" they are left out of the numbers.
  const unapproved = unapprovedCount(data, rows, period)
  const span = 4 + (staffNo ? 1 : 0) + period.length + (pay ? 2 : 0)

  return (
    <div className="ts-print">
      <div className="ts-print-head">
        <b>{tr("Timesheet", "Hoja de horas")}</b>
        <span>{dayLabel(period[0])} to {dayLabel(period.at(-1))}{dept !== 'all' ? ` · ${deptLabel(dept)}` : ''}{approvedOnly ? ' · Approved punches only' : ''}</span>
        <small>Printed {now.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</small>
      </div>
      {stillIn.length > 0 && (
        <p className="tm-warn no-print">{tr(`Still clocked in: ${stillIn.map((r) => r.e.name).join(', ')}. Fix any forgotten clock-outs before payroll.`, `Siguen con entrada marcada: ${stillIn.map((r) => r.e.name).join(', ')}. Arregla las salidas olvidadas antes de la nómina.`)}</p>
      )}
      {unapproved > 0 && (
        <p className="tm-warn no-print">{approvedOnly ? `Showing approved punches only: ${unapproved} not approved yet ${unapproved === 1 ? 'is' : 'are'} left out.` : `${unapproved} punch${unapproved === 1 ? '' : 'es'} not approved yet. Approve them on Hours → Review before payroll.`}</p>
      )}
      {rows.length === 0 && <p className="tm-muted">{tr("Nobody matches these filters.", "Nadie coincide con estos filtros.")}</p>}
      <TimesheetCards rows={rows} data={data} pay={pay} total={total} />
      {openRow && rows.find((r) => r.e.id === openRow) && (
        <Modal title={`${rows.find((r) => r.e.id === openRow).e.name} · ${rangeLabel(period)}`} onClose={() => setOpenRow(null)}>
          <PersonHours row={rows.find((r) => r.e.id === openRow)} data={data} pay={pay} />
        </Modal>
      )}
      <PrintWeeks days={period} sections={sections} staffNo={staffNo} overtime
        day={(r, i) => { const d = r.hours.byDay[i]; return { lines: hoursOnly ? [] : d.punches.map((p) => `${shortTime(p.clockIn)}–${p.clockOut ? shortTime(p.clockOut) : 'in'}`), minutes: d.minutes } }} />
      <div className="tm-gridwrap ts-table screen-only">
        <table className={`tm-sheet ${hoursOnly ? 'ts-hours-only' : ''}`}>
          <thead>
            <tr>
              <th scope="col">{tr("Name", "Nombre")}</th>
              {staffNo && <th scope="col">{tr("No.", "N.º")}</th>}
              <th scope="col">{tr("Total", "Total")}</th>
              <th scope="col">{tr("Regular", "Normales")}</th>
              <th scope="col">{tr("Overtime", "Horas extra")}</th>
              {period.map((d) => <th key={d} scope="col">{dayLabel(d)}</th>)}
              {pay && <th scope="col">{tr("Rate", "Tarifa")}</th>}
              {pay && <th scope="col">{tr("Gross (est.)", "Bruto (est.)")}</th>}
            </tr>
          </thead>
          {sections.map((sec) => (
            <tbody key={sec.name || 'all'}>
              {sec.name && <tr className="ts-group"><th scope="rowgroup" colSpan={span}>{sec.name} <small>{sec.rows.length} {sec.rows.length === 1 ? tr('person', 'persona') : tr('people', 'personas')}</small></th></tr>}
              {sec.rows.map(({ e, hours, rate, gross }) => (
                <tr key={e.id}>
                  <th scope="row"><button type="button" className="ts-name" onClick={() => setOpenRow(e.id)}>{e.name}</button></th>
                  {staffNo && <td className="ts-no">{e.staffNo ?? '—'}</td>}
                  <td><b>{formatHours(hours.total)}</b></td>
                  <td>{formatHours(hours.regular)}</td>
                  <td className={hours.overtime ? 'tm-ot' : ''}>{formatHours(hours.overtime)}</td>
                  {hours.byDay.map((d) => (
                    <td key={d.date} className="tm-cell">
                      {!hoursOnly && d.punches.map((p) => {
                        const away = [p.inSpot, p.clockOut && p.outSpot].some((x) => x && describeSpot(x, data.shop).far)
                        return (
                          <div key={p.id} className={away ? 'tm-away' : ''} title={away ? 'Clocked in or out away from the shop' : undefined}>
                            {formatClock(p.clockIn)}–{p.clockOut ? formatClock(p.clockOut) : 'in'}{away && <small className="ts-away"> {tr("away", "lejos")}</small>}
                          </div>
                        )
                      })}
                      {d.minutes > 0 && <b>{formatHours(d.minutes)}</b>}
                    </td>
                  ))}
                  {pay && <td>{e.payType === 'hourly' ? money(rate) : tr('Commission', 'Comisión')}</td>}
                  {pay && <td>{gross === null ? '—' : money(gross)}</td>}
                </tr>
              ))}
              {sec.name && (
                <tr className="ts-subtotal">
                  <th scope="row">{tr("Subtotal", "Subtotal")}</th>
                  {staffNo && <td />}
                  <td><b>{formatHours(sumOf(sec.rows, (r) => r.hours.total))}</b></td>
                  <td>{formatHours(sumOf(sec.rows, (r) => r.hours.regular))}</td>
                  <td>{formatHours(sumOf(sec.rows, (r) => r.hours.overtime))}</td>
                  {period.map((d, i) => <td key={d}>{formatHours(sumOf(sec.rows, (r) => r.hours.byDay[i].minutes))}</td>)}
                  {pay && <td />}
                  {pay && <td>{money(sumOf(sec.rows, (r) => r.gross ?? 0))}</td>}
                </tr>
              )}
            </tbody>
          ))}
          <tfoot>
            <tr>
              <th scope="row">{tr("Total", "Total")}</th>
              {staffNo && <td />}
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
        <button type="button" className="btn btn-outline-secondary btn-sm desk-only" data-search="print" onClick={() => window.print()}>{tr("Print", "Imprimir")}</button>
      </div>
      <p className="tm-muted small mt-2">{tr(`Hours are exact, to the minute. Overtime is time and a half after 40 hours in each ${DAY_LONG.en[weekStart]}–${DAY_LONG.en[(weekStart + 6) % 7]} week.`, `Las horas son exactas, al minuto. Las horas extra se pagan a tiempo y medio después de 40 horas en cada semana de ${DAY_LONG.es[weekStart]} a ${DAY_LONG.es[(weekStart + 6) % 7]}.`)}</p>
    </div>
  )
}
