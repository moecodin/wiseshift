import { useMemo, useState } from 'react'
import Modal from '../components/Modal.jsx'
import { dateKey, formatClock } from '../lib/dates.js'
import { decimalHours, formatHours, moveDays, payPeriodOf, punchMinutes, scheduleWeekOf } from './paycheck.js'
import { missingIds, payrollCsv, payrollLayout } from './payroll.js'
import { DEFAULT_FILTERS, daysBetween, downloadCsv, deptLabel, departments, groupRows, inDept, MAX_DAYS, reportRows, unapprovedCount } from './reportFilters.js'
import { dayLabel, money, scheduleOnly } from './format.js'
import { describeSpot } from './location.js'
import { useFeatures } from './features.js'
import { tr } from './i18n.js'

// Export hours (managers, on a computer): pick a timeline, who to include and a format, see
// the numbers, then download a CSV. Summary is one line per person; detailed is one line per
// punch. Pay columns only appear when the Pay rates feature is on, and location columns only
// when Location on punches is on.

const TIMELINES = [
  { id: 'period', get label() { return tr('This pay period', 'Este período de pago') } },
  { id: 'lastPeriod', get label() { return tr('Last pay period', 'Período anterior') } },
  { id: 'week', get label() { return tr('This week', 'Esta semana') } },
  { id: 'lastWeek', get label() { return tr('Last week', 'Semana pasada') } },
  { id: 'custom', get label() { return tr('Custom dates', 'Otras fechas') } },
]
function timelineDays(id, now, start, end) {
  const period = payPeriodOf(now)
  const week = scheduleWeekOf(now)
  if (id === 'period') return period
  if (id === 'lastPeriod') return moveDays(period, -1)
  if (id === 'week') return week
  if (id === 'lastWeek') return moveDays(week, -1)
  return daysBetween(start, end)
}

// Which timeline a list of days is, so the pop-up opens on what the Reports page shows.
function timelineOf(days, now) {
  for (const t of ['period', 'lastPeriod', 'week', 'lastWeek']) {
    const d = timelineDays(t, now)
    if (d[0] === days[0] && d.at(-1) === days.at(-1)) return t
  }
  return 'custom'
}

export default function ExportHours({ data, now, onClose, preset }) {
  const start0 = preset?.filters ?? DEFAULT_FILTERS
  const f = useFeatures()
  const [timeline, setTimeline] = useState(() => (preset?.days ? timelineOf(preset.days, now) : 'period'))
  const [customStart, setCustomStart] = useState(() => preset?.days?.[0] ?? dateKey(now))
  const [customEnd, setCustomEnd] = useState(() => preset?.days?.at(-1) ?? dateKey(now))
  const [dept, setDept] = useState(start0.dept)
  const [excluded, setExcluded] = useState(() => new Set(start0.picked ? data.employees.filter((e) => !start0.picked.includes(e.id)).map((e) => e.id) : [])) // people unticked in the list
  const [groupBy, setGroupBy] = useState(start0.groupBy)
  const [approvedOnly, setApprovedOnly] = useState(start0.approvedOnly)
  const [staffNo, setStaffNo] = useState(start0.staffNo)
  const group = groupBy !== 'none'
  const [format, setFormat] = useState('summary')
  const [withPay, setWithPay] = useState(false)
  const [making, setMaking] = useState(false) // building the PDF

  const days = useMemo(() => timelineDays(timeline, now, customStart, customEnd), [timeline, now, customStart, customEnd])
  const start = days[0] ?? ''
  const end = days.at(-1) ?? ''

  // Everyone who clocks in, narrowed by department, the people ticked in the list and "Approved only" (the same rules as the Reports page).
  const people = data.employees.filter((e) => !scheduleOnly(e)).sort((a, b) => a.name.localeCompare(b.name))
  const { groups: groupNames, positions } = departments(data)
  const rows = useMemo(
    () => reportRows(data, days, now, { dept, picked: people.filter((e) => !excluded.has(e.id)).map((e) => e.id), groupBy, approvedOnly }),
    // people comes from data.employees, which changes identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.employees, data.punches, data.payById, days, dept, excluded, groupBy, approvedOnly, now],
  )

  const sum = (list, fn) => list.reduce((total, r) => total + fn(r), 0)
  const stillIn = rows.filter((r) => r.hours.open)
  const unapproved = approvedOnly ? 0 : unapprovedCount(data, rows, days)
  const groups = groupRows(rows, groupBy)
  const showPay = f.payRates && withPay

  const toggle = (id) => {
    const next = new Set(excluded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExcluded(next)
  }

  // Both downloads first check that there is something to export and that unapproved punches are OK.
  const ready = () => {
    if (!days.length || !rows.length) return false
    return !unapproved || window.confirm(tr(`${unapproved} punch${unapproved === 1 ? '' : 'es'} in this range ${unapproved === 1 ? "isn't" : "aren't"} approved yet (Hours → Review). Download anyway?`, `${unapproved} registro${unapproved === 1 ? '' : 's'} de estas fechas sin aprobar (Horas → Revisar). ¿Descargar de todos modos?`))
  }

  const exportPdf = async () => {
    if (!ready()) return
    setMaking(true)
    try {
      const { downloadPdf } = await import('./exportPdf.js')
      const place = (spot) => (spot ? describeSpot(spot, data.shop).label : 'No location')
      const filters = [deptLabel(dept), ...(approvedOnly ? ['Approved punches only'] : []), `${rows.length} ${rows.length === 1 ? 'person' : 'people'}`, format === 'summary' ? 'Summary' : 'Detailed']
      let tables
      if (format === 'summary') {
        const head = ['Employee', ...(staffNo ? ['Staff no.'] : []), 'Position', 'Regular', 'Overtime', 'Total', ...(showPay ? ['Rate', 'Gross (est.)'] : [])]
        const body = []
        const boldRows = []
        for (const g of groups) {
          for (const r of g.rows) {
            body.push([r.e.name, ...(staffNo ? [r.e.staffNo ?? ''] : []), r.e.position || '', formatHours(r.hours.regular), formatHours(r.hours.overtime), formatHours(r.hours.total), ...(showPay ? [r.e.payType === 'hourly' ? money(r.rate) : 'Commission', r.gross === null ? '' : money(r.gross)] : [])])
          }
          if (group) {
            boldRows.push(body.length)
            body.push([`Subtotal: ${g.name}`, ...(staffNo ? [''] : []), '', formatHours(sum(g.rows, (r) => r.hours.regular)), formatHours(sum(g.rows, (r) => r.hours.overtime)), formatHours(sum(g.rows, (r) => r.hours.total)), ...(showPay ? ['', money(sum(g.rows, (r) => r.gross ?? 0))] : [])])
          }
        }
        const foot = ['Total', ...(staffNo ? [''] : []), '', formatHours(sum(rows, (r) => r.hours.regular)), formatHours(sum(rows, (r) => r.hours.overtime)), formatHours(sum(rows, (r) => r.hours.total)), ...(showPay ? ['', money(sum(rows, (r) => r.gross ?? 0))] : [])]
        tables = [{ head, body, boldRows, foot }]
      } else {
        tables = rows
          .filter((r) => r.hours.byDay.some((d) => d.punches.length))
          .map((r) => ({
            heading: `${r.e.name}${staffNo && r.e.staffNo ? ` (no. ${r.e.staffNo})` : ''}${r.e.position ? ` · ${r.e.position}` : ''}`,
            head: ['Date', 'Clock in', 'Clock out', 'Hours', ...(f.location ? ['Clocked in at', 'Clocked out at'] : []), 'Approved', 'Note'],
            body: r.hours.byDay.flatMap((d) =>
              d.punches.map((p) => [
                dayLabel(d.date), formatClock(p.clockIn), p.clockOut ? formatClock(p.clockOut) : 'still in', formatHours(punchMinutes(p, now)),
                ...(f.location ? [place(p.inSpot), p.clockOut ? place(p.outSpot) : ''] : []),
                p.approvedAt ? 'Yes' : 'No', [p.editedBy ? `Fixed by ${p.editedBy}` : '', p.note].filter(Boolean).join(' · '),
              ]),
            ),
            foot: ['Total', '', '', formatHours(r.hours.total), ...(f.location ? ['', ''] : []), '', ''],
          }))
      }
      await downloadPdf({
        fileName: `wiseshift-hours-${format}-${start}-to-${end}.pdf`,
        title: 'Hours report',
        subtitle: `${dayLabel(start)} to ${dayLabel(end)}`,
        notes: [filters.join(' · '), ...(stillIn.length ? [`Still clocked in: ${stillIn.map((r) => r.e.name).join(', ')}`] : [])],
        tables,
        landscape: format === 'detailed' && f.location,
      })
    } finally {
      setMaking(false)
    }
  }

  const layout = payrollLayout(data.settings.payrollExport)
  const missing = format === 'payroll' ? missingIds(rows, data, layout) : []
  const exportFile = () => {
    if (!ready()) return
    if (format === 'payroll') {
      if (missing.length && !window.confirm(tr(`${missing.length} ${missing.length === 1 ? 'person has' : 'people have'} no ID for payroll: ${missing.join(', ')}. Download anyway?`, `${missing.length} ${missing.length === 1 ? 'persona no tiene' : 'personas no tienen'} ID de nómina: ${missing.join(', ')}. ¿Descargar de todos modos?`))) return
      return downloadCsv(`payroll-${start}-to-${end}.csv`, payrollCsv(rows, days, data, layout))
    }
    const name = `wiseshift-hours-${format}-${start}-to-${end}.csv`
    if (format === 'summary') {
      const header = ['Employee', ...(staffNo ? ['Staff no.'] : []), 'Position', 'Email', 'Start', 'End', 'Regular hours', 'Overtime hours', 'Total hours', ...(showPay ? ['Hourly rate', 'Gross pay (estimate)'] : [])]
      const line = (r) => [r.e.name, ...(staffNo ? [r.e.staffNo ?? ''] : []), r.e.position, r.e.email, start, end, decimalHours(r.hours.regular), decimalHours(r.hours.overtime), decimalHours(r.hours.total), ...(showPay ? [r.e.payType === 'hourly' ? r.rate : 'commission', r.gross ?? ''] : [])]
      const lines = groups.flatMap((g) => [
        ...g.rows.map(line),
        ...(group ? [[`Subtotal: ${g.name}`, ...(staffNo ? [''] : []), '', '', '', '', decimalHours(sum(g.rows, (r) => r.hours.regular)), decimalHours(sum(g.rows, (r) => r.hours.overtime)), decimalHours(sum(g.rows, (r) => r.hours.total)), ...(showPay ? ['', sum(g.rows, (r) => r.gross ?? 0)] : [])]] : []),
      ])
      downloadCsv(name, [header, ...lines])
    } else {
      const place = (spot) => (spot ? describeSpot(spot, data.shop).label : 'No location')
      const header = ['Employee', ...(staffNo ? ['Staff no.'] : []), 'Position', 'Date', 'Clock in', 'Clock out', 'Hours', ...(f.location ? ['Clocked in at', 'Clocked out at'] : []), 'Approved', 'Fixed', 'Note']
      const lines = rows.flatMap((r) =>
        r.hours.byDay.flatMap((d) =>
          d.punches.map((p) => [
            r.e.name, ...(staffNo ? [r.e.staffNo ?? ''] : []), r.e.position, d.date, formatClock(p.clockIn), p.clockOut ? formatClock(p.clockOut) : 'still in', decimalHours(punchMinutes(p, now)),
            ...(f.location ? [place(p.inSpot), p.clockOut ? place(p.outSpot) : ''] : []),
            p.approvedAt ? 'Yes' : 'No', p.editedBy ? `Fixed by ${p.editedBy}` : '', p.note,
          ]),
        ),
      )
      downloadCsv(name, [header, ...lines])
    }
  }

  return (
    <Modal
      title={tr('Export hours', 'Exportar horas')}
      size="xl"
      onClose={onClose}
      footer={
        <>
          <span className="ex-count me-auto">{rows.length} {rows.length === 1 ? tr('person', 'persona') : tr('people', 'personas')} · {formatHours(sum(rows, (r) => r.hours.total))} hrs</span>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{tr("Close", "Cerrar")}</button>
          <button type="button" className="btn btn-outline-secondary" disabled={!days.length || !rows.length || making || format === 'payroll'} onClick={exportPdf}>{making ? tr('Making PDF…', 'Creando PDF…') : tr('Download PDF', 'Descargar PDF')}</button>
          <button type="button" className="btn btn-brand" disabled={!days.length || !rows.length} onClick={exportFile}>{tr("Download CSV", "Descargar CSV")}</button>
        </>
      }
    >
      <div className="ex-filters">
        <div>
          <label className="form-label" htmlFor="ex-timeline">{tr("Timeline", "Fechas")}</label>
          <select id="ex-timeline" className="form-select" value={timeline} onChange={(e) => setTimeline(e.target.value)}>
            {TIMELINES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="ex-start">{tr("Start date", "Fecha de inicio")}</label>
          <input id="ex-start" type="date" className="form-control" value={timeline === 'custom' ? customStart : start} disabled={timeline !== 'custom'} onChange={(e) => setCustomStart(e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor="ex-end">{tr("End date", "Fecha final")}</label>
          <input id="ex-end" type="date" className="form-control" value={timeline === 'custom' ? customEnd : end} disabled={timeline !== 'custom'} onChange={(e) => setCustomEnd(e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor="ex-position">{tr("Department", "Departamento")}</label>
          <select id="ex-position" className="form-select" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="all">{tr("Everyone", "Todos")}</option>
            {groupNames.length > 0 && <optgroup label={tr('Staff groups', 'Grupos')}>{groupNames.map((g) => <option key={g} value={`g:${g}`}>{g}</option>)}</optgroup>}
            {positions.length > 0 && <optgroup label={tr('Positions', 'Puestos')}>{positions.map((p) => <option key={p} value={`p:${p}`}>{p}</option>)}</optgroup>}
          </select>
        </div>
      </div>
      {timeline === 'custom' && days.length === 0 && <p className="tm-warn">{tr("The end date has to be on or after the start date.", "La fecha final debe ser igual o posterior a la de inicio.")}</p>}
      {timeline === 'custom' && days.length > 0 && <p className="tm-muted small">{tr(`Overtime counts after 40 hours in each 7 days, starting from the start date. Ranges over ${MAX_DAYS} days are cut short.`, `Las horas extra cuentan después de 40 horas en cada 7 días, desde la fecha de inicio. Los rangos de más de ${MAX_DAYS} días se recortan.`)}</p>}

      <div className="ex-options">
        <fieldset className="ex-people">
          <legend>{tr("Employees", "Empleados")}</legend>
          <div>
            <button type="button" className="tm-link small" onClick={() => setExcluded(new Set())}>{tr("All", "Todos")}</button>
            <button type="button" className="tm-link small" onClick={() => setExcluded(new Set(people.map((e) => e.id)))}>{tr("None", "Ninguno")}</button>
          </div>
          {people.filter((e) => inDept(e, dept)).map((e) => (
            <label key={e.id} className="ex-check">
              <input type="checkbox" className="form-check-input" checked={!excluded.has(e.id)} onChange={() => toggle(e.id)} />
              <span>{e.name}{e.active ? '' : tr(' (not active)', ' (inactivo)')}</span>
            </label>
          ))}
        </fieldset>
        <div className="ex-side">
          <fieldset>
            <legend>{tr("Format", "Formato")}</legend>
            <label className="ex-check"><input type="radio" className="form-check-input" name="ex-format" checked={format === 'summary'} onChange={() => setFormat('summary')} /><span><b>{tr("Summary", "Resumen")}</b> {tr("· one line per person", "· una línea por persona")}</span></label>
            <label className="ex-check"><input type="radio" className="form-check-input" name="ex-format" checked={format === 'detailed'} onChange={() => setFormat('detailed')} /><span><b>{tr("Detailed", "Detallado")}</b> {tr("· one line per punch", "· una línea por registro")}</span></label>
            {data.settings.payrollReady && <label className="ex-check"><input type="radio" className="form-check-input" name="ex-format" checked={format === 'payroll'} onChange={() => setFormat('payroll')} /><span><b>{tr("Payroll CSV", "CSV de nómina")}</b> {tr("· your saved layout (Settings → Business)", "· tu formato guardado (Ajustes → Negocio)")}</span></label>}
          </fieldset>
          <label className="ex-group">
            <span>{tr("Group by", "Agrupar por")}</span>
            <select className="form-select form-select-sm" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
              <option value="none">{tr("Nothing", "Nada")}</option>
              {groupNames.length > 0 && <option value="group">{tr("Staff group", "Grupo")}</option>}
              <option value="position">{tr("Position", "Puesto")}</option>
            </select>
          </label>
          <label className="ex-check"><input type="checkbox" className="form-check-input" checked={approvedOnly} onChange={(e) => setApprovedOnly(e.target.checked)} /><span>{tr("Approved punches only", "Solo registros aprobados")}</span></label>
          <label className="ex-check"><input type="checkbox" className="form-check-input" checked={staffNo} onChange={(e) => setStaffNo(e.target.checked)} /><span>{tr("Include staff no.", "Incluir n.º de empleado")}</span></label>
          {f.payRates && <label className="ex-check"><input type="checkbox" className="form-check-input" checked={withPay} onChange={(e) => setWithPay(e.target.checked)} /><span>{tr("Include pay rates and gross estimate", "Incluir tarifas y pago bruto estimado")}</span></label>}
        </div>
      </div>

      {stillIn.length > 0 && <p className="tm-warn">{tr(`Still clocked in: ${stillIn.map((r) => r.e.name).join(', ')}. Fix any forgotten clock-outs first.`, `Siguen con entrada marcada: ${stillIn.map((r) => r.e.name).join(', ')}. Arregla primero las salidas olvidadas.`)}</p>}
      {missing.length > 0 && <p className="tm-warn">{tr(`${missing.length} ${missing.length === 1 ? 'person has' : 'people have'} no ID for payroll: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? '…' : ''}. Add it on Team → their page → Edit.`, `${missing.length} ${missing.length === 1 ? 'persona no tiene' : 'personas no tienen'} ID de nómina: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? '…' : ''}. Agrégalo en Equipo → su página → Editar.`)}</p>}
      {unapproved > 0 && <p className="tm-warn">{tr(`${unapproved} punch${unapproved === 1 ? '' : 'es'} not approved yet. Approve them on Hours → Review before payroll.`, `${unapproved} registro${unapproved === 1 ? '' : 's'} sin aprobar. Apruébalos en Horas → Revisar antes de la nómina.`)}</p>}

      <div className="tm-gridwrap ex-preview">
        <table className="tm-sheet">
          <thead>
            <tr>
              <th scope="col">{tr("Name", "Nombre")}</th>
              <th scope="col">{tr("Position", "Puesto")}</th>
              <th scope="col">{tr("Regular", "Normales")}</th>
              <th scope="col">{tr("Overtime", "Horas extra")}</th>
              <th scope="col">{tr("Total", "Total")}</th>
              {showPay && <th scope="col">{tr("Rate", "Tarifa")}</th>}
              {showPay && <th scope="col">{tr("Gross (est.)", "Bruto (est.)")}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={showPay ? 7 : 5} className="tm-muted">{tr("No one matches these filters.", "Nadie coincide con estos filtros.")}</td></tr>}
            {groups.map((g) => (
              <PreviewGroup key={g.name || 'all'} group={g} grouped={group} showPay={showPay} sum={sum} />
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <th scope="row">{tr("Total", "Total")}</th>
                <td />
                <td>{formatHours(sum(rows, (r) => r.hours.regular))}</td>
                <td>{formatHours(sum(rows, (r) => r.hours.overtime))}</td>
                <td><b>{formatHours(sum(rows, (r) => r.hours.total))}</b></td>
                {showPay && <td />}
                {showPay && <td>{money(sum(rows, (r) => r.gross ?? 0))}</td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="tm-muted small mt-2">
        {days.length > 0 ? `${dayLabel(start)} ${tr('to', 'a')} ${dayLabel(end)}. ` : ''}{tr('Hours are exact, to the minute. Overtime is time and a half after 40 hours in each seven-day stretch.', 'Las horas son exactas, al minuto. Las horas extra se pagan a tiempo y medio después de 40 horas en cada tramo de siete días.')}
      </p>
    </Modal>
  )
}

function PreviewGroup({ group, grouped, showPay, sum }) {
  return (
    <>
      {group.rows.map((r) => (
        <tr key={r.e.id}>
          <th scope="row">{r.e.name}</th>
          <td>{r.e.position || '—'}</td>
          <td>{formatHours(r.hours.regular)}</td>
          <td className={r.hours.overtime ? 'tm-ot' : ''}>{formatHours(r.hours.overtime)}</td>
          <td><b>{formatHours(r.hours.total)}</b></td>
          {showPay && <td>{r.e.payType === 'hourly' ? money(r.rate) : tr('Commission', 'Comisión')}</td>}
          {showPay && <td>{r.gross === null ? '—' : money(r.gross)}</td>}
        </tr>
      ))}
      {grouped && (
        <tr className="ex-sub">
          <th scope="row">Subtotal: {group.name}</th>
          <td />
          <td>{formatHours(sum(group.rows, (r) => r.hours.regular))}</td>
          <td>{formatHours(sum(group.rows, (r) => r.hours.overtime))}</td>
          <td><b>{formatHours(sum(group.rows, (r) => r.hours.total))}</b></td>
          {showPay && <td />}
          {showPay && <td>{money(sum(group.rows, (r) => r.gross ?? 0))}</td>}
        </tr>
      )}
    </>
  )
}
